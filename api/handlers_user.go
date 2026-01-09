package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
)

// User Handlers
func getUtilisateurs(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_utilisateur, email, mot_de_passe, nom, prenom, telephone, role, statut, date_creation, derniere_connexion, id_entreprise FROM utilisateur")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var utilisateurs []Utilisateur
	for rows.Next() {
		var u Utilisateur
		err := rows.Scan(&u.ID, &u.Email, &u.MotDePasse, &u.Nom, &u.Prenom, &u.Telephone, &u.Role, &u.Statut, &u.DateCreation, &u.DerniereConnexion, &u.IDEntreprise)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		utilisateurs = append(utilisateurs, u)
	}
	json.NewEncoder(w).Encode(utilisateurs)
}

func getUtilisateur(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var u Utilisateur
	err := db.QueryRow("SELECT id_utilisateur, email, mot_de_passe, nom, prenom, telephone, role, statut, date_creation, derniere_connexion, id_entreprise FROM utilisateur WHERE id_utilisateur = $1", id).Scan(&u.ID, &u.Email, &u.MotDePasse, &u.Nom, &u.Prenom, &u.Telephone, &u.Role, &u.Statut, &u.DateCreation, &u.DerniereConnexion, &u.IDEntreprise)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(u)
}

func createUtilisateur(w http.ResponseWriter, r *http.Request) {
	var u Utilisateur
	json.NewDecoder(r.Body).Decode(&u)
	if u.Role == "" {
		u.Role = "client"
	}
	if u.Statut == "" {
		u.Statut = "actif"
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(u.MotDePasse), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}
	u.MotDePasse = string(hashedPassword)

	err = db.QueryRow("INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, telephone, role, statut, id_entreprise) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_utilisateur", u.Email, u.MotDePasse, u.Nom, u.Prenom, u.Telephone, u.Role, u.Statut, u.IDEntreprise).Scan(&u.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(u)
}

func updateUtilisateur(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var u Utilisateur
	json.NewDecoder(r.Body).Decode(&u)
	_, err := db.Exec("UPDATE utilisateur SET email = $1, mot_de_passe = $2, nom = $3, prenom = $4, telephone = $5, role = $6, statut = $7, id_entreprise = $8 WHERE id_utilisateur = $9", u.Email, u.MotDePasse, u.Nom, u.Prenom, u.Telephone, u.Role, u.Statut, u.IDEntreprise, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	u.ID = id
	json.NewEncoder(w).Encode(u)
}

func deleteUtilisateur(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	_, err := db.Exec("DELETE FROM utilisateur WHERE id_utilisateur = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func getUtilisateurExists(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if email == "" {
		http.Error(w, "Email required", http.StatusBadRequest)
		return
	}
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM utilisateur WHERE email = $1", email).Scan(&count)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]bool{"exists": count > 0})
}

func loginUtilisateur(w http.ResponseWriter, r *http.Request) {
	var creds struct {
		Email      string `json:"email"`
		MotDePasse string `json:"mot_de_passe"`
		TotpCode   string `json:"totp_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		log.Printf("Login: Error decoding body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	log.Printf("Login attempt for email: %s", creds.Email)

	var storedPassword string
	var id int
	var totpSecret sql.NullString
	err := db.QueryRow("SELECT id_utilisateur, mot_de_passe, totp_secret FROM utilisateur WHERE email = $1", creds.Email).Scan(&id, &storedPassword, &totpSecret)
	if err != nil {
		log.Printf("Login: Database error: %v", err)
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	log.Printf("Login: Found user ID %d, checking password", id)
	err = bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(creds.MotDePasse))
	if err != nil {
		log.Printf("Login: Password mismatch: %v", err)
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Check 2FA if enabled
	if totpSecret.Valid && totpSecret.String != "" {
		if creds.TotpCode == "" {
			log.Printf("Login: 2FA required for user %d", id)
			json.NewEncoder(w).Encode(map[string]interface{}{"requires_2fa": true})
			return
		}
		if !totp.Validate(creds.TotpCode, totpSecret.String) {
			log.Printf("Login: Invalid 2FA code for user %d", id)
			http.Error(w, "Invalid 2FA code", http.StatusUnauthorized)
			return
		}
	}

	log.Printf("Login: Successful login for user %d", id)
	// Return token with user ID
	json.NewEncoder(w).Encode(map[string]interface{}{"token": "dummy_token", "user_id": id})
}

// User Profile Handlers
func getUserProfile(w http.ResponseWriter, r *http.Request) {
	// Get user ID from query param or use 1 as default
	userID := 1
	if id := r.URL.Query().Get("user_id"); id != "" {
		if parsed, err := strconv.Atoi(id); err == nil {
			userID = parsed
		}
	}

	var u Utilisateur
	var totpSecret, webauthnCredID, webauthnPubKey sql.NullString
	var webauthnCounter sql.NullInt64
	var derniereConnexion sql.NullTime
	var idEntreprise sql.NullInt64

	err := db.QueryRow("SELECT id_utilisateur, email, nom, prenom, telephone, role, statut, date_creation, derniere_connexion, id_entreprise, totp_secret, webauthn_credential_id, webauthn_public_key, webauthn_counter FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&u.ID, &u.Email, &u.Nom, &u.Prenom, &u.Telephone, &u.Role, &u.Statut, &u.DateCreation, &derniereConnexion, &idEntreprise, &totpSecret, &webauthnCredID, &webauthnPubKey, &webauthnCounter)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// Handle nullable fields
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

	json.NewEncoder(w).Encode(u)
}

func updateUserProfile(w http.ResponseWriter, r *http.Request) {
	// Get user ID from query param or use 1 as default
	userID := 1
	if id := r.URL.Query().Get("user_id"); id != "" {
		if parsed, err := strconv.Atoi(id); err == nil {
			userID = parsed
		}
	}

	var data struct {
		Prenom    string `json:"prenom"`
		Nom       string `json:"nom"`
		Email     string `json:"email"`
		Telephone string `json:"telephone"`
	}
	json.NewDecoder(r.Body).Decode(&data)
	_, err := db.Exec("UPDATE utilisateur SET prenom = $1, nom = $2, email = $3, telephone = $4 WHERE id_utilisateur = $5", data.Prenom, data.Nom, data.Email, data.Telephone, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// Return updated user
	getUserProfile(w, r)
}
