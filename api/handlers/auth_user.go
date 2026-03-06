package handlers

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"image/png"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"

	"api/config"
	"api/models"
	mw "api/middleware"
	"api/cache"
)

// ===== HELPERS INTERNES =====

func jsonErr(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func getUserID(r *http.Request) (int, bool) {
	id, ok := r.Context().Value(models.UserIDKey).(int)
	return id, ok
}

func generateRandomToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	buf := make([]byte, hex64Len(32))
	encodeHex(buf, b)
	return string(buf)
}

func hex64Len(n int) int { return n * 2 }
func encodeHex(dst, src []byte) {
	const hextable = "0123456789abcdef"
	for i, v := range src {
		dst[i*2] = hextable[v>>4]
		dst[i*2+1] = hextable[v&0x0f]
	}
}

// ===== LOGIN =====

func Login(w http.ResponseWriter, r *http.Request) {
	var creds struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		TotpCode string `json:"totpCode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		jsonErr(w, "Invalid request", http.StatusBadRequest)
		return
	}

	creds.Email = strings.ToLower(strings.TrimSpace(creds.Email))
	if creds.Email == "" || creds.Password == "" {
		jsonErr(w, "Email and password are required", http.StatusBadRequest)
		return
	}

	var storedPassword string
	var id int
	var totpSecretNull struct{ Valid bool; String string }
	var totpEnabled bool

	row := config.DB.QueryRow(
		"SELECT id_utilisateur, mot_de_passe, totp_secret, totp_enabled FROM utilisateur WHERE email = $1",
		creds.Email)
	var totpSecretPtr *string
	err := row.Scan(&id, &storedPassword, &totpSecretPtr, &totpEnabled)
	if err != nil {
		jsonErr(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}
	if totpSecretPtr != nil {
		totpSecretNull.Valid = true
		totpSecretNull.String = *totpSecretPtr
	}

	if err := bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(creds.Password)); err != nil {
		log.Printf("SECURITY: Failed login for user %d from %s", id, mw.GetClientIP(r))
		jsonErr(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	if totpEnabled && totpSecretNull.Valid && totpSecretNull.String != "" {
		if creds.TotpCode == "" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"requires_2fa": true})
			return
		}
		if !totp.Validate(creds.TotpCode, totpSecretNull.String) {
			log.Printf("SECURITY: Failed 2FA for user %d from %s", id, mw.GetClientIP(r))
			jsonErr(w, "Invalid 2FA code", http.StatusUnauthorized)
			return
		}
	}

	var statut string
	config.DB.QueryRow("SELECT statut FROM utilisateur WHERE id_utilisateur = $1", id).Scan(&statut)
	if statut != "actif" {
		jsonErr(w, "Account is disabled", http.StatusForbidden)
		return
	}

	sessionToken := generateRandomToken()
	if sessionToken == "" {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	_, err = config.DB.Exec(
		"INSERT INTO session_utilisateur (token_session, id_utilisateur, date_expiration) VALUES ($1, $2, NOW() + INTERVAL '24 hours')",
		sessionToken, id)
	if err != nil {
		log.Printf("Error creating session for user %d: %v", id, err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	config.DB.Exec("UPDATE utilisateur SET derniere_connexion = NOW() WHERE id_utilisateur = $1", id)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"token": sessionToken, "user_id": id})
}

// ===== 2FA =====

func Setup2FA(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var email string
	if err := config.DB.QueryRow("SELECT email FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&email); err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	key, err := totp.Generate(totp.GenerateOpts{Issuer: "CYNA", AccountName: email})
	if err != nil {
		http.Error(w, "Error generating key", http.StatusInternalServerError)
		return
	}

	var buf bytes.Buffer
	img, err := key.Image(200, 200)
	if err != nil {
		http.Error(w, "Error generating image", http.StatusInternalServerError)
		return
	}
	png.Encode(&buf, img)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"secret":    key.Secret(),
		"qrCodeUrl": "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes()),
	})
}

func Verify2FA(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var data struct {
		Secret string `json:"secret"`
		Code   string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	if !totp.Validate(data.Code, data.Secret) {
		http.Error(w, "Invalid code", http.StatusUnauthorized)
		return
	}
	if _, err := config.DB.Exec(
		"UPDATE utilisateur SET totp_secret = $1, totp_enabled = TRUE WHERE id_utilisateur = $2",
		data.Secret, userID); err != nil {
		log.Printf("Error saving 2FA secret: %v", err)
		http.Error(w, "Error saving 2FA secret", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "2FA enabled successfully"})
}

func Remove2FA(w http.ResponseWriter, r *http.Request) {
	adminUserID, ok := getUserID(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var requestBody struct {
		UserID int `json:"user_id"`
	}
	targetUserID := adminUserID
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err == nil && requestBody.UserID > 0 {
		var adminRole string
		if err := config.DB.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", adminUserID).Scan(&adminRole); err != nil || adminRole != "admin" {
			http.Error(w, "Forbidden: Admin access required", http.StatusForbidden)
			return
		}
		targetUserID = requestBody.UserID
	}

	if _, err := config.DB.Exec(
		"UPDATE utilisateur SET totp_secret = NULL, totp_enabled = FALSE WHERE id_utilisateur = $1",
		targetUserID); err != nil {
		http.Error(w, "Error removing 2FA", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "2FA disabled successfully"})
}

// ===== WEBAUTHN =====

func GetWebAuthnRegisterChallenge(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var email string
	if err := config.DB.QueryRow("SELECT email FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&email); err != nil {
		jsonErr(w, "User not found", http.StatusNotFound)
		return
	}
	challengeBytes := make([]byte, 32)
	if _, err := rand.Read(challengeBytes); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	challenge := map[string]interface{}{
		"challenge": challengeBytes,
		"rp":        map[string]string{"name": "CYNA"},
		"user": map[string]interface{}{
			"id":          []byte(strconv.Itoa(userID)),
			"name":        email,
			"displayName": email,
		},
		"pubKeyCredParams": []map[string]interface{}{
			{"alg": -7, "type": "public-key"},
		},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(challenge)
}

func RegisterWebAuthn(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var data struct {
		ID       string `json:"id"`
		RawID    []int  `json:"rawId"`
		Response struct {
			ClientDataJSON    []int `json:"clientDataJSON"`
			AttestationObject []int `json:"attestationObject"`
		} `json:"response"`
	}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if data.ID == "" {
		jsonErr(w, "Credential ID is required", http.StatusBadRequest)
		return
	}
	if _, err := config.DB.Exec(
		"UPDATE utilisateur SET webauthn_credential_id = $1, webauthn_public_key = $2 WHERE id_utilisateur = $3",
		data.ID, "dummy_public_key", userID); err != nil {
		log.Printf("Error registering WebAuthn for user %d: %v", userID, err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func RemoveWebAuthn(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if _, err := config.DB.Exec(
		"UPDATE utilisateur SET webauthn_credential_id = NULL, webauthn_public_key = NULL WHERE id_utilisateur = $1",
		userID); err != nil {
		log.Printf("Error removing WebAuthn for user %d: %v", userID, err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// ===== UTILISATEURS =====

func GetUsers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Cache hit
	if cached := cache.AdminCache.Get(cache.KeyAdminUsers); cached != nil {
		w.Write(cached)
		return
	}

	rows, err := config.DB.Query(
		`SELECT id_utilisateur, email,
		        COALESCE(nom,''), COALESCE(prenom,''), COALESCE(telephone,''), COALESCE(role,'client'), COALESCE(statut,'actif'),
		        COALESCE(totp_enabled,false), COALESCE(date_creation,NOW()), derniere_connexion, id_entreprise
		 FROM utilisateur`)
	if err != nil {
		log.Printf("Error fetching users: %v", err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	users := []models.Utilisateur{}
	for rows.Next() {
		var u models.Utilisateur
		err := rows.Scan(
			&u.ID, &u.Email, &u.Nom, &u.Prenom, &u.Telephone, &u.Role, &u.Statut,
			&u.TotpEnabled, &u.DateCreation, &u.DerniereConnexion, &u.IDEntreprise,
		)
		if err != nil {
			log.Printf("Error scanning user: %v", err)
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		u.MotDePasse = ""
		u.EstActif = (u.Statut == "actif")
		u.DateInscription = u.DateCreation
		users = append(users, u)
	}
	// Mise en cache + réponse
	cache.SetJSON(cache.AdminCache, cache.KeyAdminUsers, users)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func GetUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid user ID", http.StatusBadRequest)
		return
	}
	var u models.Utilisateur
	err = config.DB.QueryRow(
		`SELECT id_utilisateur, email,
		        COALESCE(nom,''), COALESCE(prenom,''), COALESCE(telephone,''), COALESCE(role,'client'), COALESCE(statut,'actif'),
		        COALESCE(totp_enabled,false), COALESCE(date_creation,NOW()), derniere_connexion, id_entreprise
		 FROM utilisateur WHERE id_utilisateur = $1`,
		id).Scan(&u.ID, &u.Email, &u.Nom, &u.Prenom, &u.Telephone, &u.Role, &u.Statut,
		&u.TotpEnabled, &u.DateCreation, &u.DerniereConnexion, &u.IDEntreprise)
	if err != nil {
		jsonErr(w, "User not found", http.StatusNotFound)
		return
	}
	u.MotDePasse = ""
	u.EstActif = (u.Statut == "actif")
	u.DateInscription = u.DateCreation
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(u)
}

func CreateUser(w http.ResponseWriter, r *http.Request) {
	var u models.Utilisateur
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	u.Email = strings.ToLower(strings.TrimSpace(u.Email))
	if u.Email == "" || !mw.IsValidEmail(u.Email) {
		jsonErr(w, "Valid email is required", http.StatusBadRequest)
		return
	}
	u.Nom = mw.SanitizeString(u.Nom)
	u.Prenom = mw.SanitizeString(u.Prenom)
	u.Telephone = mw.SanitizeString(u.Telephone)

	var exists bool
	if err := config.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM utilisateur WHERE email = $1)", u.Email).Scan(&exists); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if exists {
		jsonErr(w, "An account with this email already exists", http.StatusConflict)
		return
	}

	u.Role = "client"
	if u.Statut == "" {
		u.Statut = "actif"
	}
	if u.MotDePasse == "" {
		jsonErr(w, "Password is required", http.StatusBadRequest)
		return
	}
	if !mw.IsValidPassword(u.MotDePasse) {
		jsonErr(w, "Password must be at least 8 characters with uppercase, lowercase and digit", http.StatusBadRequest)
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(u.MotDePasse), bcrypt.DefaultCost)
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	u.MotDePasse = string(hashed)

	err = config.DB.QueryRow(
		"INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, telephone, role, statut, id_entreprise) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_utilisateur",
		u.Email, u.MotDePasse, u.Nom, u.Prenom, u.Telephone, u.Role, u.Statut, u.IDEntreprise).Scan(&u.ID)
	if err != nil {
		log.Printf("Error creating user: %v", err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	u.MotDePasse = ""
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	cache.InvalidateAdminUsers()
	json.NewEncoder(w).Encode(u)
}

func UpdateUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	requestingUserID, ok := getUserID(r)
	if !ok {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var requestingRole string
	if err := config.DB.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", requestingUserID).Scan(&requestingRole); err != nil || requestingRole != "admin" {
		jsonErr(w, "Forbidden: Admin access required", http.StatusForbidden)
		return
	}

	var cur models.Utilisateur
	if err := config.DB.QueryRow(
		`SELECT id_utilisateur, email, mot_de_passe,
		        COALESCE(nom,''), COALESCE(prenom,''), COALESCE(telephone,''), COALESCE(role,'client'), COALESCE(statut,'actif'),
		        id_entreprise
		 FROM utilisateur WHERE id_utilisateur = $1`,
		id).Scan(&cur.ID, &cur.Email, &cur.MotDePasse, &cur.Nom, &cur.Prenom, &cur.Telephone, &cur.Role, &cur.Statut, &cur.IDEntreprise); err != nil {
		jsonErr(w, "User not found", http.StatusNotFound)
		return
	}
	cur.EstActif = (cur.Statut == "actif")

	var u models.Utilisateur
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if u.Email != "" { cur.Email = u.Email }
	if u.Nom != "" { cur.Nom = u.Nom }
	if u.Prenom != "" { cur.Prenom = u.Prenom }
	if u.Telephone != "" { cur.Telephone = u.Telephone }
	if u.Role != "" { cur.Role = u.Role }
	if u.Statut != "" { cur.Statut = u.Statut }

	if u.EstActif != cur.EstActif {
		if u.EstActif { cur.Statut = "actif" } else { cur.Statut = "inactif" }
		cur.EstActif = u.EstActif
	}

	if u.MotDePasse != "" {
		if !mw.IsValidPassword(u.MotDePasse) {
			jsonErr(w, "Password must be at least 8 characters with uppercase, lowercase and digit", http.StatusBadRequest)
			return
		}
		hashed, err := bcrypt.GenerateFromPassword([]byte(u.MotDePasse), bcrypt.DefaultCost)
		if err != nil {
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		cur.MotDePasse = string(hashed)
	}

	if _, err := config.DB.Exec(
		"UPDATE utilisateur SET email=$1, mot_de_passe=$2, nom=$3, prenom=$4, telephone=$5, role=$6, statut=$7, id_entreprise=$8 WHERE id_utilisateur=$9",
		cur.Email, cur.MotDePasse, cur.Nom, cur.Prenom, cur.Telephone, cur.Role, cur.Statut, cur.IDEntreprise, id); err != nil {
		log.Printf("Error updating user %d: %v", id, err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	cur.MotDePasse = ""
	cache.InvalidateAdminUsers()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cur)
}

func DeleteUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid user ID", http.StatusBadRequest)
		return
	}
	requestingUserID, ok := getUserID(r)
	if !ok {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var requestingRole string
	if err := config.DB.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", requestingUserID).Scan(&requestingRole); err != nil || requestingRole != "admin" {
		jsonErr(w, "Forbidden: Admin access required", http.StatusForbidden)
		return
	}
	if id == requestingUserID {
		jsonErr(w, "Cannot delete your own account", http.StatusBadRequest)
		return
	}
	res, err := config.DB.Exec("DELETE FROM utilisateur WHERE id_utilisateur = $1", id)
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		jsonErr(w, "User not found", http.StatusNotFound)
		return
	}
	cache.InvalidateAdminUsers()
	w.WriteHeader(http.StatusNoContent)
}

func GetUserExists(w http.ResponseWriter, r *http.Request) {
	email := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("email")))
	if email == "" {
		http.Error(w, "Email required", http.StatusBadRequest)
		return
	}
	var count int
	if err := config.DB.QueryRow("SELECT COUNT(*) FROM utilisateur WHERE email = $1", email).Scan(&count); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"exists": count > 0})
}

func ResetUser2FA(w http.ResponseWriter, r *http.Request) {
	targetUserID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}
	adminUserID, ok := getUserID(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var adminRole string
	if err := config.DB.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", adminUserID).Scan(&adminRole); err != nil || adminRole != "admin" {
		http.Error(w, "Forbidden: Admin access required", http.StatusForbidden)
		return
	}
	res, err := config.DB.Exec("UPDATE utilisateur SET totp_secret = NULL, totp_enabled = FALSE WHERE id_utilisateur = $1", targetUserID)
	if err != nil {
		http.Error(w, "Error resetting 2FA", http.StatusInternalServerError)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "2FA reset successfully"})
}

// ===== PROFIL UTILISATEUR =====

func GetUserProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var u models.Utilisateur
	var totpSecretPtr, webauthnCredID, webauthnPubKey *string
	var webauthnCounter *int64

	err := config.DB.QueryRow(`
		SELECT id_utilisateur, email,
		       COALESCE(nom,''), COALESCE(prenom,''), COALESCE(telephone,''), COALESCE(role,'client'), COALESCE(statut,'actif'),
		       COALESCE(date_creation,NOW()), derniere_connexion, id_entreprise,
		       totp_secret, COALESCE(totp_enabled,false), webauthn_credential_id, webauthn_public_key, webauthn_counter
		FROM utilisateur WHERE id_utilisateur = $1`, userID).Scan(
		&u.ID, &u.Email, &u.Nom, &u.Prenom, &u.Telephone, &u.Role, &u.Statut, &u.DateCreation,
		&u.DerniereConnexion, &u.IDEntreprise, &totpSecretPtr, &u.TotpEnabled,
		&webauthnCredID, &webauthnPubKey, &webauthnCounter)

	if err != nil {
		jsonErr(w, "User not found", http.StatusNotFound)
		return
	}

	u.TotpSecret = totpSecretPtr
	u.WebAuthnCredentialID = webauthnCredID
	u.WebAuthnPublicKey = webauthnPubKey
	u.WebAuthnCounter = webauthnCounter

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(u)
}

func UpdateUserProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var data struct {
		FirstName   string `json:"firstName"`
		LastName    string `json:"lastName"`
		Email       string `json:"email"`
		Phone       string `json:"phone"`
		Password    string `json:"motDePasse"`
		OldPassword string `json:"ancienMotDePasse"`
	}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if data.Password != "" {
		if !mw.IsValidPassword(data.Password) {
			jsonErr(w, "Password must be at least 8 characters with uppercase, lowercase and digit", http.StatusBadRequest)
			return
		}
		var currentHash string
		if err := config.DB.QueryRow("SELECT mot_de_passe FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&currentHash); err != nil {
			jsonErr(w, "User not found", http.StatusNotFound)
			return
		}
		if data.OldPassword == "" {
			jsonErr(w, "Current password required", http.StatusBadRequest)
			return
		}
		if err := bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(data.OldPassword)); err != nil {
			jsonErr(w, "Current password is incorrect", http.StatusUnauthorized)
			return
		}
		newHash, err := bcrypt.GenerateFromPassword([]byte(data.Password), bcrypt.DefaultCost)
		if err != nil {
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		if _, err := config.DB.Exec("UPDATE utilisateur SET mot_de_passe = $1 WHERE id_utilisateur = $2", string(newHash), userID); err != nil {
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Password updated successfully"})
		return
	}

	data.FirstName = mw.SanitizeString(data.FirstName)
	data.LastName = mw.SanitizeString(data.LastName)
	data.Email = strings.ToLower(strings.TrimSpace(data.Email))
	data.Phone = mw.SanitizeString(data.Phone)

	if data.Email != "" && !mw.IsValidEmail(data.Email) {
		jsonErr(w, "Invalid email format", http.StatusBadRequest)
		return
	}

	if _, err := config.DB.Exec(
		"UPDATE utilisateur SET prenom=$1, nom=$2, email=$3, telephone=$4 WHERE id_utilisateur=$5",
		data.FirstName, data.LastName, data.Email, data.Phone, userID); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Profile updated successfully"})
}
