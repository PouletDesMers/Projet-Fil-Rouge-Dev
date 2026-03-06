package main

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"image/png"
	"log"
	"net/http"
	"strconv"

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

	log.Printf("setup2FA: Generating 2FA for user %d", userID)

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
	adminUserID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse request body to get target user ID (for admin use)
	var requestBody struct {
		UserID int `json:"user_id"`
	}

	targetUserID := adminUserID // Default to self
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err == nil {
		if requestBody.UserID > 0 {
			// Admin is trying to remove 2FA for another user
			// Verify admin has permission
			var adminRole string
			err := db.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", adminUserID).Scan(&adminRole)
			if err != nil || adminRole != "admin" {
				http.Error(w, "Forbidden: Admin access required", http.StatusForbidden)
				return
			}
			targetUserID = requestBody.UserID
		}
	}

	// Remove 2FA for target user
	_, err := db.Exec("UPDATE utilisateur SET totp_secret = NULL, totp_enabled = FALSE WHERE id_utilisateur = $1", targetUserID)
	if err != nil {
		http.Error(w, "Error removing 2FA", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "2FA disabled successfully"})
}

// WebAuthn handlers
func getWebAuthnRegisterChallenge(w http.ResponseWriter, r *http.Request) {
	// Utiliser le userID du contexte (déjà validé par le middleware)
	userID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		jsonError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var email string
	err := db.QueryRow("SELECT email FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&email)
	if err != nil {
		jsonError(w, "User not found", http.StatusNotFound)
		return
	}

	// Générer un challenge aléatoire sécurisé
	challengeBytes := make([]byte, 32)
	if _, err := rand.Read(challengeBytes); err != nil {
		log.Printf("Error generating WebAuthn challenge: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	challenge := map[string]interface{}{
		"challenge": challengeBytes,
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
	// Utiliser le userID du contexte (déjà validé par le middleware)
	userID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		jsonError(w, "Unauthorized", http.StatusUnauthorized)
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
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if data.ID == "" {
		jsonError(w, "Credential ID is required", http.StatusBadRequest)
		return
	}

	// Store in DB (simplified)
	_, err := db.Exec("UPDATE utilisateur SET webauthn_credential_id = $1, webauthn_public_key = $2 WHERE id_utilisateur = $3", data.ID, "dummy_public_key", userID)
	if err != nil {
		log.Printf("Error registering WebAuthn for user %d: %v", userID, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func removeWebAuthn(w http.ResponseWriter, r *http.Request) {
	// Utiliser le userID du contexte (déjà validé par le middleware)
	userID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		jsonError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	_, err := db.Exec("UPDATE utilisateur SET webauthn_credential_id = NULL, webauthn_public_key = NULL WHERE id_utilisateur = $1", userID)
	if err != nil {
		log.Printf("Error removing WebAuthn for user %d: %v", userID, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}
