package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"

	"api/config"
	mw "api/middleware"
)

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

func generateAPIKey() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)
}

func isAdmin(r *http.Request) bool {
	userID, ok := getUserID(r)
	if !ok { return false }
	var role string
	config.DB.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&role)
	return role == "admin"
}

func GetAPITokens(w http.ResponseWriter, r *http.Request) {
	if !isAdmin(r) {
		http.Error(w, "Forbidden: Admin access required", http.StatusForbidden)
		return
	}
	rows, err := config.DB.Query("SELECT id_token, cle_api, nom, permissions, date_creation, dernier_usage, est_actif, id_utilisateur FROM api_token ORDER BY date_creation DESC")
	if err != nil {
		log.Printf("Error fetching API tokens: %v", err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	tokens := []APIToken{}
	for rows.Next() {
		var t APIToken
		if err := rows.Scan(&t.ID, &t.CleAPI, &t.Nom, &t.Permissions, &t.DateCreation, &t.DernierUsage, &t.EstActif, &t.IDUtilisateur); err != nil {
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		tokens = append(tokens, t)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tokens)
}

func CreateAPIToken(w http.ResponseWriter, r *http.Request) {
	adminUserID, ok := getUserID(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if !isAdmin(r) {
		http.Error(w, "Forbidden: Admin access required", http.StatusForbidden)
		return
	}
	var body struct {
		Nom           string `json:"nom"`
		Permissions   string `json:"permissions"`
		IDUtilisateur int    `json:"id_utilisateur"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if body.Nom == "" {
		jsonErr(w, "Name is required", http.StatusBadRequest)
		return
	}
	body.Nom = mw.SanitizeString(body.Nom)
	if body.IDUtilisateur == 0 { body.IDUtilisateur = adminUserID }
	apiKey := generateAPIKey()
	if apiKey == "" {
		http.Error(w, "Failed to generate API key", http.StatusInternalServerError)
		return
	}
	var tokenID int
	if err := config.DB.QueryRow("INSERT INTO api_token (cle_api, nom, permissions, id_utilisateur) VALUES ($1,$2,$3,$4) RETURNING id_token",
		apiKey, body.Nom, body.Permissions, body.IDUtilisateur).Scan(&tokenID); err != nil {
		log.Printf("Error creating API token: %v", err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id_token":    tokenID,
		"cle_api":     apiKey,
		"nom":         body.Nom,
		"permissions": body.Permissions,
		"message":     "API token created successfully. Save this key - it won't be shown again!",
	})
}

func DeleteAPIToken(w http.ResponseWriter, r *http.Request) {
	if !isAdmin(r) {
		http.Error(w, "Forbidden: Admin access required", http.StatusForbidden)
		return
	}
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, "Invalid token ID", http.StatusBadRequest)
		return
	}
	res, err := config.DB.Exec("DELETE FROM api_token WHERE id_token = $1", id)
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		http.Error(w, "Token not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "API token deleted successfully"})
}

func ToggleAPITokenStatus(w http.ResponseWriter, r *http.Request) {
	if !isAdmin(r) {
		http.Error(w, "Forbidden: Admin access required", http.StatusForbidden)
		return
	}
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, "Invalid token ID", http.StatusBadRequest)
		return
	}
	var body struct {
		EstActif bool `json:"est_actif"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if _, err := config.DB.Exec("UPDATE api_token SET est_actif=$1 WHERE id_token=$2", body.EstActif, id); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Token status updated successfully"})
}
