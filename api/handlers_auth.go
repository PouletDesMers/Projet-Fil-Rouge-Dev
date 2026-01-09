package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image/png"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/pquerna/otp/totp"
)

// 2FA Handlers
func setup2FA(w http.ResponseWriter, r *http.Request) {
	// Identity is already validated by the middleware
	userID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var email string
	err := db.QueryRow("SELECT email FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&email)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	log.Printf("setup2FA: Generating 2FA for user %d (%s)", userID, email)

	// Generate a new TOTP key
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "CYNA",
		AccountName: email,
	})
	if err != nil {
		http.Error(w, "Error generating key", http.StatusInternalServerError)
		return
	}

	// Convert TOTP key to PNG
	var buf bytes.Buffer
	img, err := key.Image(200, 200)
	if err != nil {
		http.Error(w, "Error generating image", http.StatusInternalServerError)
		return
	}
	png.Encode(&buf, img)

	// Return the secret and the QR code as base64
	response := map[string]string{
		"secret":    key.Secret(),
		"qrCodeUrl": "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes()),
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func verify2FA(w http.ResponseWriter, r *http.Request) {
	// Identity is already validated by the middleware
	userID, ok := r.Context().Value(UserIDKey).(int)
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

	if valid := totp.Validate(data.Code, data.Secret); !valid {
		http.Error(w, "Invalid code", http.StatusUnauthorized)
		return
	}

	// Save the secret and mark as enabled
	_, err := db.Exec("UPDATE utilisateur SET totp_secret = $1, totp_enabled = TRUE WHERE id_utilisateur = $2", data.Secret, userID)
	if err != nil {
		log.Printf("Error saving 2FA secret: %v", err)
		http.Error(w, "Error saving 2FA secret", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "2FA enabled successfully"})
}

func remove2FA(w http.ResponseWriter, r *http.Request) {
	// Identity is already validated by the middleware
	userID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Remove 2FA for user
	_, err := db.Exec("UPDATE utilisateur SET totp_secret = NULL, totp_enabled = FALSE WHERE id_utilisateur = $1", userID)
	if err != nil {
		http.Error(w, "Error removing 2FA", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "2FA disabled successfully"})
}

// WebAuthn handlers
func getWebAuthnRegisterChallenge(w http.ResponseWriter, r *http.Request) {
	// Security: Get user identity from the session token
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	token := strings.TrimPrefix(authHeader, "Bearer ")

	var userID int
	var email string
	err := db.QueryRow("SELECT s.id_utilisateur, u.email FROM session_utilisateur s JOIN utilisateur u ON s.id_utilisateur = u.id_utilisateur WHERE s.token_session = $1 AND s.est_valide = TRUE AND s.date_expiration > NOW()", token).Scan(&userID, &email)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Simplified challenge
	challenge := map[string]interface{}{
		"challenge": []byte("random_challenge"),
		"rp": map[string]string{
			"name": "CYNA",
		},
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

func registerWebAuthn(w http.ResponseWriter, r *http.Request) {
	// Security: Get user identity from the session token
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	token := strings.TrimPrefix(authHeader, "Bearer ")

	var userID int
	err := db.QueryRow("SELECT id_utilisateur FROM session_utilisateur WHERE token_session = $1 AND est_valide = TRUE AND date_expiration > NOW()", token).Scan(&userID)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
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
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	// Store in DB (simplified)
	_, err = db.Exec("UPDATE utilisateur SET webauthn_credential_id = $1, webauthn_public_key = $2 WHERE id_utilisateur = $3", data.ID, "dummy_public_key", userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func removeWebAuthn(w http.ResponseWriter, r *http.Request) {
	// Security: Get user identity from the session token
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	token := strings.TrimPrefix(authHeader, "Bearer ")

	var userID int
	err := db.QueryRow("SELECT id_utilisateur FROM session_utilisateur WHERE token_session = $1 AND est_valide = TRUE AND date_expiration > NOW()", token).Scan(&userID)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	_, err = db.Exec("UPDATE utilisateur SET webauthn_credential_id = NULL, webauthn_public_key = NULL WHERE id_utilisateur = $1", userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}
