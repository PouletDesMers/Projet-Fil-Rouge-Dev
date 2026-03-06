package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
)

// User Handlers
func getusers(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_utilisateur, email, nom, prenom, telephone, role, statut, totp_enabled, date_creation, derniere_connexion, id_entreprise FROM utilisateur")
	if err != nil {
		log.Printf("Error fetching users: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var users []Utilisateur
	for rows.Next() {
		var u Utilisateur
		var nom, prenom, telephone, role, statut sql.NullString
		var derniereConnexion sql.NullTime
		var idEntreprise sql.NullInt64
		err := rows.Scan(&u.ID, &u.Email, &nom, &prenom, &telephone, &role, &statut, &u.TotpEnabled, &u.DateCreation, &derniereConnexion, &idEntreprise)
		if err != nil {
			log.Printf("Error scanning user row: %v", err)
			jsonError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		u.Nom = nom.String
		u.Prenom = prenom.String
		u.Telephone = telephone.String
		u.Role = role.String
		u.Statut = statut.String
		if derniereConnexion.Valid {
			u.DerniereConnexion = &derniereConnexion.Time
		}
		if idEntreprise.Valid {
			val := int(idEntreprise.Int64)
			u.IDEntreprise = &val
		}
		// Clear password for security
		u.MotDePasse = ""
		// Set est_actif based on statut
		u.EstActif = (u.Statut == "actif")
		// Use date_creation as date_inscription
		u.DateInscription = u.DateCreation
		users = append(users, u)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func resetUser2FA(w http.ResponseWriter, r *http.Request) {
	// Get the user ID from URL parameter
	params := mux.Vars(r)
	targetUserID, err := strconv.Atoi(params["id"])
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Verify the requester is an admin
	adminUserID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var adminRole string
	err = db.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", adminUserID).Scan(&adminRole)
	if err != nil || adminRole != "admin" {
		http.Error(w, "Forbidden: Admin access required", http.StatusForbidden)
		return
	}

	// Reset 2FA for the target user
	result, err := db.Exec("UPDATE utilisateur SET totp_secret = NULL, totp_enabled = FALSE WHERE id_utilisateur = $1", targetUserID)
	if err != nil {
		http.Error(w, "Error resetting 2FA", http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil || rowsAffected == 0 {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "2FA reset successfully"})
}

func getUtilisateur(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid user ID", http.StatusBadRequest)
		return
	}
	var u Utilisateur
	var telephone sql.NullString
	var derniereConnexion sql.NullTime
	var idEntreprise sql.NullInt64
	err = db.QueryRow("SELECT id_utilisateur, email, nom, prenom, telephone, role, statut, totp_enabled, date_creation, derniere_connexion, id_entreprise FROM utilisateur WHERE id_utilisateur = $1", id).Scan(&u.ID, &u.Email, &u.Nom, &u.Prenom, &telephone, &u.Role, &u.Statut, &u.TotpEnabled, &u.DateCreation, &derniereConnexion, &idEntreprise)
	if err != nil {
		jsonError(w, "User not found", http.StatusNotFound)
		return
	}
	if telephone.Valid {
		u.Telephone = telephone.String
	}
	if derniereConnexion.Valid {
		u.DerniereConnexion = &derniereConnexion.Time
	}
	if idEntreprise.Valid {
		val := int(idEntreprise.Int64)
		u.IDEntreprise = &val
	}
	// Clear password for security
	u.MotDePasse = ""
	// Set est_actif based on statut
	u.EstActif = (u.Statut == "actif")
	// Use date_creation as date_inscription
	u.DateInscription = u.DateCreation
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(u)
}

func createUtilisateur(w http.ResponseWriter, r *http.Request) {
	var u Utilisateur
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Normalisation de l'email (tout en minuscules et sans espaces)
	u.Email = strings.ToLower(strings.TrimSpace(u.Email))
	if u.Email == "" || !isValidEmail(u.Email) {
		jsonError(w, "Valid email is required", http.StatusBadRequest)
		return
	}

	// Sanitiser les champs texte
	u.Nom = sanitizeString(u.Nom)
	u.Prenom = sanitizeString(u.Prenom)
	u.Telephone = sanitizeString(u.Telephone)

	// Vérification si l'utilisateur existe déjà
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM utilisateur WHERE email = $1)", u.Email).Scan(&exists)
	if err != nil {
		log.Printf("Database error during user creation check: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if exists {
		jsonError(w, "An account with this email already exists", http.StatusConflict)
		return
	}

	// Forcer le rôle client à la création (sécurité: empêcher l'auto-promotion)
	u.Role = "client"
	if u.Statut == "" {
		u.Statut = "actif"
	}

	if u.MotDePasse == "" {
		jsonError(w, "Password is required", http.StatusBadRequest)
		return
	}

	// Validation du mot de passe
	if !isValidPassword(u.MotDePasse) {
		jsonError(w, "Password must be at least 8 characters with uppercase, lowercase and digit", http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(u.MotDePasse), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Error hashing password: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	u.MotDePasse = string(hashedPassword)

	err = db.QueryRow("INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, telephone, role, statut, id_entreprise) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_utilisateur", u.Email, u.MotDePasse, u.Nom, u.Prenom, u.Telephone, u.Role, u.Statut, u.IDEntreprise).Scan(&u.ID)
	if err != nil {
		log.Printf("Error creating user: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Ne jamais renvoyer le mot de passe hashé
	u.MotDePasse = ""
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(u)
}

func updateUtilisateur(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Vérifier que l'utilisateur connecté est admin (seuls les admins modifient via cette route)
	requestingUserID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		jsonError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var requestingRole string
	err = db.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", requestingUserID).Scan(&requestingRole)
	if err != nil || requestingRole != "admin" {
		jsonError(w, "Forbidden: Admin access required", http.StatusForbidden)
		return
	}

	// Get current user data
	var currentUser Utilisateur
	err = db.QueryRow("SELECT id_utilisateur, email, mot_de_passe, nom, prenom, telephone, role, statut, id_entreprise FROM utilisateur WHERE id_utilisateur = $1", id).Scan(&currentUser.ID, &currentUser.Email, &currentUser.MotDePasse, &currentUser.Nom, &currentUser.Prenom, &currentUser.Telephone, &currentUser.Role, &currentUser.Statut, &currentUser.IDEntreprise)
	if err != nil {
		jsonError(w, "User not found", http.StatusNotFound)
		return
	}
	// Set est_actif based on statut
	currentUser.EstActif = (currentUser.Statut == "actif")

	// Parse request body
	var u Utilisateur
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Merge updates (keep current values if not provided)
	if u.Email != "" {
		currentUser.Email = u.Email
	}
	if u.Nom != "" {
		currentUser.Nom = u.Nom
	}
	if u.Prenom != "" {
		currentUser.Prenom = u.Prenom
	}
	if u.Telephone != "" {
		currentUser.Telephone = u.Telephone
	}
	if u.Role != "" {
		currentUser.Role = u.Role
	}
	if u.Statut != "" {
		currentUser.Statut = u.Statut
	}

	// Handle est_actif update - only change if explicitly different
	// For role-only updates (promote/demote), don't change the activation status
	if u.Statut == "" && u.Email == "" && u.Nom == "" && u.Prenom == "" && u.Telephone == "" && u.MotDePasse == "" {
		// This is likely a role-only update, keep current status
		u.EstActif = currentUser.EstActif
	}

	if u.EstActif != currentUser.EstActif {
		if u.EstActif {
			currentUser.Statut = "actif"
		} else {
			currentUser.Statut = "inactif"
		}
		currentUser.EstActif = u.EstActif
	}

	// Handle password update if provided
	if u.MotDePasse != "" {
		if !isValidPassword(u.MotDePasse) {
			jsonError(w, "Password must be at least 8 characters with uppercase, lowercase and digit", http.StatusBadRequest)
			return
		}
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(u.MotDePasse), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("Error hashing password for user %d: %v", id, err)
			jsonError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		currentUser.MotDePasse = string(hashedPassword)
	}

	// Execute update
	_, err = db.Exec("UPDATE utilisateur SET email = $1, mot_de_passe = $2, nom = $3, prenom = $4, telephone = $5, role = $6, statut = $7, id_entreprise = $8 WHERE id_utilisateur = $9",
		currentUser.Email, currentUser.MotDePasse, currentUser.Nom, currentUser.Prenom, currentUser.Telephone, currentUser.Role, currentUser.Statut, currentUser.IDEntreprise, id)
	if err != nil {
		log.Printf("Error updating user %d: %v", id, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Return updated user (without password)
	currentUser.MotDePasse = ""
	json.NewEncoder(w).Encode(currentUser)
}

func deleteUtilisateur(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Vérifier que l'utilisateur connecté est admin
	requestingUserID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		jsonError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var requestingRole string
	err = db.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", requestingUserID).Scan(&requestingRole)
	if err != nil || requestingRole != "admin" {
		jsonError(w, "Forbidden: Admin access required", http.StatusForbidden)
		return
	}

	// Empêcher l'auto-suppression
	if id == requestingUserID {
		jsonError(w, "Cannot delete your own account", http.StatusBadRequest)
		return
	}

	result, err := db.Exec("DELETE FROM utilisateur WHERE id_utilisateur = $1", id)
	if err != nil {
		log.Printf("Error deleting user %d: %v", id, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		jsonError(w, "User not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func getUtilisateurExists(w http.ResponseWriter, r *http.Request) {
	email := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("email")))
	if email == "" {
		http.Error(w, "Email required", http.StatusBadRequest)
		return
	}
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM utilisateur WHERE email = $1", email).Scan(&count)
	if err != nil {
		log.Printf("Error checking email existence: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]bool{"exists": count > 0})
}

func loginUtilisateur(w http.ResponseWriter, r *http.Request) {
	var creds struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		TotpCode string `json:"totpCode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		jsonError(w, "Invalid request", http.StatusBadRequest)
		return
	}

	creds.Email = strings.ToLower(strings.TrimSpace(creds.Email))

	if creds.Email == "" || creds.Password == "" {
		jsonError(w, "Email and password are required", http.StatusBadRequest)
		return
	}

	var storedPassword string
	var id int
	var totpSecret sql.NullString
	var totpEnabled bool
	err := db.QueryRow("SELECT id_utilisateur, mot_de_passe, totp_secret, totp_enabled FROM utilisateur WHERE email = $1", creds.Email).Scan(&id, &storedPassword, &totpSecret, &totpEnabled)
	if err != nil {
		// Message générique pour ne pas révéler si l'email existe
		jsonError(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(creds.Password))
	if err != nil {
		log.Printf("SECURITY: Failed login attempt for user ID %d from %s", id, getClientIP(r))
		jsonError(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Check 2FA if enabled
	if totpEnabled && totpSecret.Valid && totpSecret.String != "" {
		if creds.TotpCode == "" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"requires_2fa": true})
			return
		}
		if !totp.Validate(creds.TotpCode, totpSecret.String) {
			log.Printf("SECURITY: Failed 2FA attempt for user ID %d from %s", id, getClientIP(r))
			jsonError(w, "Invalid 2FA code", http.StatusUnauthorized)
			return
		}
	}

	// Vérifier que le compte est actif
	var statut string
	db.QueryRow("SELECT statut FROM utilisateur WHERE id_utilisateur = $1", id).Scan(&statut)
	if statut != "actif" {
		jsonError(w, "Account is disabled", http.StatusForbidden)
		return
	}

	// Create a session token
	sessionToken := generateRandomToken()
	if sessionToken == "" {
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Insert into session_utilisateur (valid for 24 hours)
	_, err = db.Exec("INSERT INTO session_utilisateur (token_session, id_utilisateur, date_expiration) VALUES ($1, $2, NOW() + INTERVAL '24 hours')", sessionToken, id)
	if err != nil {
		log.Printf("Error creating session for user %d: %v", id, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Mettre à jour la dernière connexion
	db.Exec("UPDATE utilisateur SET derniere_connexion = NOW() WHERE id_utilisateur = $1", id)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"token": sessionToken, "user_id": id})
}

// User Profile Handlers
func getUserProfile(w http.ResponseWriter, r *http.Request) {
	// Identity is already validated by the middleware and stored in context
	userID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		log.Printf("Profile: No userID found in context")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	log.Printf("Profile: Fetching data for user ID %d", userID)

	var u Utilisateur
	var totpSecret, webauthnCredID, webauthnPubKey sql.NullString
	var telephone sql.NullString
	var webauthnCounter sql.NullInt64
	var derniereConnexion sql.NullTime
	var idEntreprise sql.NullInt64

	query := `
		SELECT id_utilisateur, email, nom, prenom, telephone, role, statut, date_creation, derniere_connexion, id_entreprise, 
		       totp_secret, totp_enabled, webauthn_credential_id, webauthn_public_key, webauthn_counter 
		FROM utilisateur 
		WHERE id_utilisateur = $1`

	err := db.QueryRow(query, userID).Scan(
		&u.ID, &u.Email, &u.Nom, &u.Prenom, &telephone, &u.Role, &u.Statut, &u.DateCreation,
		&derniereConnexion, &idEntreprise, &totpSecret, &u.TotpEnabled, &webauthnCredID, &webauthnPubKey, &webauthnCounter)

	if err != nil {
		log.Printf("Profile: Error fetching user %d: %v", userID, err)
		if err == sql.ErrNoRows {
			jsonError(w, "User not found", http.StatusNotFound)
		} else {
			jsonError(w, "Internal server error", http.StatusInternalServerError)
		}
		return
	}

	// Handle nullable fields
	if telephone.Valid {
		u.Telephone = telephone.String
	}
	if totpSecret.Valid {
		u.TotpSecret = &totpSecret.String
	}
	if derniereConnexion.Valid {
		u.DerniereConnexion = &derniereConnexion.Time
	}
	if idEntreprise.Valid {
		val := int(idEntreprise.Int64)
		u.IDEntreprise = &val
	}
	if webauthnCredID.Valid {
		u.WebAuthnCredentialID = &webauthnCredID.String
	}
	if webauthnPubKey.Valid {
		u.WebAuthnPublicKey = &webauthnPubKey.String
	}
	if webauthnCounter.Valid {
		u.WebAuthnCounter = &webauthnCounter.Int64
	}

	log.Printf("Profile: Returning user %d, totp_enabled: %v", userID, u.TotpEnabled)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(u)
}

func updateUserProfile(w http.ResponseWriter, r *http.Request) {
	// Identity is already validated by the middleware and stored in context
	userID, ok := r.Context().Value(UserIDKey).(int)
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

	// Handle password change if requested
	if data.Password != "" {
		// Validation du nouveau mot de passe
		if !isValidPassword(data.Password) {
			jsonError(w, "Password must be at least 8 characters with uppercase, lowercase and digit", http.StatusBadRequest)
			return
		}
		// Verify current password first
		var currentHash string
		err := db.QueryRow("SELECT mot_de_passe FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&currentHash)
		if err != nil {
			jsonError(w, "User not found", http.StatusNotFound)
			return
		}
		if data.OldPassword == "" {
			jsonError(w, "Current password required", http.StatusBadRequest)
			return
		}
		if err := bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(data.OldPassword)); err != nil {
			jsonError(w, "Current password is incorrect", http.StatusUnauthorized)
			return
		}
		// Hash the new password
		newHash, err := bcrypt.GenerateFromPassword([]byte(data.Password), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("Error hashing password for user %d: %v", userID, err)
			jsonError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		_, err = db.Exec("UPDATE utilisateur SET mot_de_passe = $1 WHERE id_utilisateur = $2", string(newHash), userID)
		if err != nil {
			log.Printf("Profile update password error for user %d: %v", userID, err)
			jsonError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Password updated successfully"})
		return
	}

	// Sanitiser les champs texte
	data.FirstName = sanitizeString(data.FirstName)
	data.LastName = sanitizeString(data.LastName)
	data.Email = strings.ToLower(strings.TrimSpace(data.Email))
	data.Phone = sanitizeString(data.Phone)

	if data.Email != "" && !isValidEmail(data.Email) {
		jsonError(w, "Invalid email format", http.StatusBadRequest)
		return
	}

	// Standard profile update (no password change)
	_, err := db.Exec("UPDATE utilisateur SET prenom = $1, nom = $2, email = $3, telephone = $4 WHERE id_utilisateur = $5",
		data.FirstName, data.LastName, data.Email, data.Phone, userID)

	if err != nil {
		log.Printf("Profile update error for user %d: %v", userID, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Profile updated successfully"})
}
