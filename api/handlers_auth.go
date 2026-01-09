package main

import (
	"bytes"
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
	// Generate a new TOTP key
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "CYNA",
		AccountName: "user@example.com", // Should be dynamic based on logged in user
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
	json.NewEncoder(w).Encode(response)
}

func verify2FA(w http.ResponseWriter, r *http.Request) {
	var data struct {
		Secret string `json:"secret"`
		Code   string `json:"code"`
		UserID int    `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Default to user ID 1 if not provided
	if data.UserID == 0 {
		data.UserID = 1
	}

	if valid := totp.Validate(data.Code, data.Secret); !valid {
		http.Error(w, "Invalid code", http.StatusUnauthorized)
		return
	}

	// Save the secret to the user's profile (enable 2FA)
	_, err := db.Exec("UPDATE utilisateur SET totp_secret = $1 WHERE id_utilisateur = $2", data.Secret, data.UserID)
	if err != nil {
		log.Printf("Error saving 2FA secret: %v", err)
		http.Error(w, "Error saving 2FA secret", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "2FA enabled successfully"})
}

func remove2FA(w http.ResponseWriter, r *http.Request) {
	// Get user ID from query param or use 1 as default
	userID := 1
	if id := r.URL.Query().Get("user_id"); id != "" {
		if parsed, err := strconv.Atoi(id); err == nil {
			userID = parsed
		}
	}

	// Remove 2FA for user
	_, err := db.Exec("UPDATE utilisateur SET totp_secret = NULL WHERE id_utilisateur = $1", userID)
	if err != nil {
		http.Error(w, "Error removing 2FA", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "2FA disabled successfully"})
}

// WebAuthn handlers
func getWebAuthnRegisterChallenge(w http.ResponseWriter, r *http.Request) {
	// Simplified challenge
	challenge := map[string]interface{}{
		"challenge": []byte("random_challenge"),
		"rp": map[string]string{
			"name": "CYNA",
		},
		"user": map[string]interface{}{
			"id":          []byte("user_id"),
			"name":        "user@example.com",
			"displayName": "User",
		},
		"pubKeyCredParams": []map[string]interface{}{
			{"alg": -7, "type": "public-key"},
		},
	}
	json.NewEncoder(w).Encode(challenge)
}

func registerWebAuthn(w http.ResponseWriter, r *http.Request) {
	var data struct {
		ID       string `json:"id"`
		RawID    []int  `json:"rawId"`
		Response struct {
			ClientDataJSON    []int `json:"clientDataJSON"`
			AttestationObject []int `json:"attestationObject"`
		} `json:"response"`
	}
	json.NewDecoder(r.Body).Decode(&data)
	// Store in DB (simplified)
	_, err := db.Exec("UPDATE utilisateur SET webauthn_credential_id = $1, webauthn_public_key = $2 WHERE id_utilisateur = 1", data.ID, "dummy_public_key")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func removeWebAuthn(w http.ResponseWriter, r *http.Request) {
	_, err := db.Exec("UPDATE utilisateur SET webauthn_credential_id = NULL, webauthn_public_key = NULL WHERE id_utilisateur = 1")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// TOTP handlers
func setupTOTP(w http.ResponseWriter, r *http.Request) {
	secret := "JBSWY3DPEHPK3PXP" // Dummy secret
	_, err := db.Exec("UPDATE utilisateur SET totp_secret = $1 WHERE id_utilisateur = 1", secret)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"secret": secret})
}

func removeTOTP(w http.ResponseWriter, r *http.Request) {
	_, err := db.Exec("UPDATE utilisateur SET totp_secret = NULL WHERE id_utilisateur = 1")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}
