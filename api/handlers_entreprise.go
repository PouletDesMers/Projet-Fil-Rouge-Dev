package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

// Enterprise Handlers
func getEntreprises(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_entreprise, nom, secteur, taille, pays, date_creation FROM entreprise")
	if err != nil {
		log.Printf("Error fetching entreprises: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var entreprises []Entreprise
	for rows.Next() {
		var e Entreprise
		err := rows.Scan(&e.ID, &e.Nom, &e.Secteur, &e.Taille, &e.Pays, &e.DateCreation)
		if err != nil {
			log.Printf("Error scanning entreprise: %v", err)
			jsonError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		entreprises = append(entreprises, e)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entreprises)
}

func getEntreprise(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var e Entreprise
	err = db.QueryRow("SELECT id_entreprise, nom, secteur, taille, pays, date_creation FROM entreprise WHERE id_entreprise = $1", id).Scan(&e.ID, &e.Nom, &e.Secteur, &e.Taille, &e.Pays, &e.DateCreation)
	if err != nil {
		jsonError(w, "Company not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(e)
}

func createEntreprise(w http.ResponseWriter, r *http.Request) {
	var e Entreprise
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Sanitiser les champs
	e.Nom = sanitizeString(e.Nom)
	e.Secteur = sanitizeString(e.Secteur)
	e.Taille = sanitizeString(e.Taille)
	e.Pays = sanitizeString(e.Pays)

	if e.Nom == "" {
		jsonError(w, "Company name is required", http.StatusBadRequest)
		return
	}

	err := db.QueryRow("INSERT INTO entreprise (nom, secteur, taille, pays) VALUES ($1, $2, $3, $4) RETURNING id_entreprise", e.Nom, e.Secteur, e.Taille, e.Pays).Scan(&e.ID)
	if err != nil {
		log.Printf("Error creating entreprise: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(e)
}

func updateEntreprise(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var e Entreprise
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	e.Nom = sanitizeString(e.Nom)
	e.Secteur = sanitizeString(e.Secteur)
	e.Taille = sanitizeString(e.Taille)
	e.Pays = sanitizeString(e.Pays)

	_, err = db.Exec("UPDATE entreprise SET nom = $1, secteur = $2, taille = $3, pays = $4 WHERE id_entreprise = $5", e.Nom, e.Secteur, e.Taille, e.Pays, id)
	if err != nil {
		log.Printf("Error updating entreprise %d: %v", id, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	e.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(e)
}

func deleteEntreprise(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	_, err = db.Exec("DELETE FROM entreprise WHERE id_entreprise = $1", id)
	if err != nil {
		log.Printf("Error deleting entreprise %d: %v", id, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
