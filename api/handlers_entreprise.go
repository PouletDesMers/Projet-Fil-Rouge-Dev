package main

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

// Enterprise Handlers
func getEntreprises(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_entreprise, nom, secteur, taille, pays, date_creation FROM entreprise")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var entreprises []Entreprise
	for rows.Next() {
		var e Entreprise
		err := rows.Scan(&e.ID, &e.Nom, &e.Secteur, &e.Taille, &e.Pays, &e.DateCreation)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		entreprises = append(entreprises, e)
	}
	json.NewEncoder(w).Encode(entreprises)
}

func getEntreprise(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var e Entreprise
	err := db.QueryRow("SELECT id_entreprise, nom, secteur, taille, pays, date_creation FROM entreprise WHERE id_entreprise = $1", id).Scan(&e.ID, &e.Nom, &e.Secteur, &e.Taille, &e.Pays, &e.DateCreation)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(e)
}

func createEntreprise(w http.ResponseWriter, r *http.Request) {
	var e Entreprise
	json.NewDecoder(r.Body).Decode(&e)
	err := db.QueryRow("INSERT INTO entreprise (nom, secteur, taille, pays) VALUES ($1, $2, $3, $4) RETURNING id_entreprise", e.Nom, e.Secteur, e.Taille, e.Pays).Scan(&e.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(e)
}

func updateEntreprise(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var e Entreprise
	json.NewDecoder(r.Body).Decode(&e)
	_, err := db.Exec("UPDATE entreprise SET nom = $1, secteur = $2, taille = $3, pays = $4 WHERE id_entreprise = $5", e.Nom, e.Secteur, e.Taille, e.Pays, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	e.ID = id
	json.NewEncoder(w).Encode(e)
}

func deleteEntreprise(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	_, err := db.Exec("DELETE FROM entreprise WHERE id_entreprise = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
