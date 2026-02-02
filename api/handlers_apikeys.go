package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

// APIToken struct
type APIToken struct {
	ID            int            `json:"id_token"`
	CleAPI        string         `json:"cle_api"`
	Nom           string         `json:"nom"`
	Permissions   string         `json:"permissions"`
	DateCreation  string         `json:"date_creation"`
	DernierUsage  sql.NullString `json:"dernier_usage"`
	EstActif      bool           `json:"est_actif"`
	IDUtilisateur int            `json:"id_utilisateur"`
}

// Generate random API key
func generateAPIKey() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)
}

// Get all API tokens (admin only)
func getAPITokens(w http.ResponseWriter, r *http.Request) {
	// Verify admin
	adminUserID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var adminRole string
	err := db.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", adminUserID).Scan(&adminRole)
	if err != nil || adminRole != "admin" {
		http.Error(w, "Forbidden: Admin access required", http.StatusForbidden)
		return
	}

	rows, err := db.Query("SELECT id_token, cle_api, nom, permissions, date_creation, dernier_usage, est_actif, id_utilisateur FROM api_token ORDER BY date_creation DESC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var tokens []APIToken
	for rows.Next() {
		var token APIToken
		err := rows.Scan(&token.ID, &token.CleAPI, &token.Nom, &token.Permissions, &token.DateCreation, &token.DernierUsage, &token.EstActif, &token.IDUtilisateur)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		tokens = append(tokens, token)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tokens)
}

// Create new API token (admin only)
func createAPIToken(w http.ResponseWriter, r *http.Request) {
	// Verify admin
	adminUserID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var adminRole string
	err := db.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", adminUserID).Scan(&adminRole)
	if err != nil || adminRole != "admin" {
		http.Error(w, "Forbidden: Admin access required", http.StatusForbidden)
		return
	}

	var requestBody struct {
		Nom           string `json:"nom"`
		Permissions   string `json:"permissions"`
		IDUtilisateur int    `json:"id_utilisateur"`
	}

	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if requestBody.Nom == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}

	// Use admin's ID if no user specified
	if requestBody.IDUtilisateur == 0 {
		requestBody.IDUtilisateur = adminUserID
	}

	// Generate API key
	apiKey := generateAPIKey()
	if apiKey == "" {
		http.Error(w, "Failed to generate API key", http.StatusInternalServerError)
		return
	}

	// Insert into database
	var tokenID int
	err = db.QueryRow(
		"INSERT INTO api_token (cle_api, nom, permissions, id_utilisateur) VALUES ($1, $2, $3, $4) RETURNING id_token",
		apiKey, requestBody.Nom, requestBody.Permissions, requestBody.IDUtilisateur,
	).Scan(&tokenID)

	if err != nil {
		http.Error(w, "Error creating API token: "+err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"id_token":    tokenID,
		"cle_api":     apiKey,
		"nom":         requestBody.Nom,
		"permissions": requestBody.Permissions,
		"message":     "API token created successfully. Save this key - it won't be shown again!",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// Delete API token (admin only)
func deleteAPIToken(w http.ResponseWriter, r *http.Request) {
	// Verify admin
	adminUserID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var adminRole string
	err := db.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", adminUserID).Scan(&adminRole)
	if err != nil || adminRole != "admin" {
		http.Error(w, "Forbidden: Admin access required", http.StatusForbidden)
		return
	}

	params := mux.Vars(r)
	tokenID, err := strconv.Atoi(params["id"])
	if err != nil {
		http.Error(w, "Invalid token ID", http.StatusBadRequest)
		return
	}

	result, err := db.Exec("DELETE FROM api_token WHERE id_token = $1", tokenID)
	if err != nil {
		http.Error(w, "Error deleting token: "+err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Token not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "API token deleted successfully"})
}

// Toggle API token status (admin only)
func toggleAPITokenStatus(w http.ResponseWriter, r *http.Request) {
	// Verify admin
	adminUserID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var adminRole string
	err := db.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", adminUserID).Scan(&adminRole)
	if err != nil || adminRole != "admin" {
		http.Error(w, "Forbidden: Admin access required", http.StatusForbidden)
		return
	}

	params := mux.Vars(r)
	tokenID, err := strconv.Atoi(params["id"])
	if err != nil {
		http.Error(w, "Invalid token ID", http.StatusBadRequest)
		return
	}

	var requestBody struct {
		EstActif bool `json:"est_actif"`
	}

	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	_, err = db.Exec("UPDATE api_token SET est_actif = $1 WHERE id_token = $2", requestBody.EstActif, tokenID)
	if err != nil {
		http.Error(w, "Error updating token status: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Token status updated successfully"})
}
