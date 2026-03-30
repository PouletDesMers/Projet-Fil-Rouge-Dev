package repositories

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
)

type APIKeyRepo struct {
	DB *sql.DB
}

func NewAPIKeyRepo(db *sql.DB) *APIKeyRepo { return &APIKeyRepo{DB: db} }

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

func GenerateKey() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (r *APIKeyRepo) FindAll() ([]APIToken, error) {
	rows, err := r.DB.Query(
		"SELECT id_token, cle_api, nom, permissions, date_creation, dernier_usage, est_actif, id_utilisateur FROM api_token ORDER BY date_creation DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	tokens := []APIToken{}
	for rows.Next() {
		var t APIToken
		if err := rows.Scan(&t.ID, &t.CleAPI, &t.Nom, &t.Permissions, &t.DateCreation, &t.DernierUsage, &t.EstActif, &t.IDUtilisateur); err != nil {
			return nil, err
		}
		tokens = append(tokens, t)
	}
	return tokens, nil
}

func (r *APIKeyRepo) Create(nom, apiKey, permissions string, userID int) (int, error) {
	var tokenID int
	err := r.DB.QueryRow(
		"INSERT INTO api_token (cle_api, nom, permissions, id_utilisateur) VALUES ($1,$2,$3,$4) RETURNING id_token",
		apiKey, nom, permissions, userID).Scan(&tokenID)
	return tokenID, err
}

func (r *APIKeyRepo) Delete(id int) (int64, error) {
	res, err := r.DB.Exec("DELETE FROM api_token WHERE id_token=$1", id)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return n, nil
}

func (r *APIKeyRepo) SetActive(id int, active bool) error {
	_, err := r.DB.Exec("UPDATE api_token SET est_actif=$1 WHERE id_token=$2", active, id)
	return err
}

func (r *APIKeyRepo) TouchLastUsed(key string) {
	r.DB.Exec("UPDATE api_token SET dernier_usage=NOW() WHERE cle_api=$1", key)
}

func (r *APIKeyRepo) ValidateKey(key string) (userID int, permissions string, valid bool) {
	err := r.DB.QueryRow(
		"SELECT id_utilisateur, permissions FROM api_token WHERE cle_api=$1 AND est_actif=TRUE",
		key).Scan(&userID, &permissions)
	if err != nil {
		return 0, "", false
	}
	return userID, permissions, true
}
