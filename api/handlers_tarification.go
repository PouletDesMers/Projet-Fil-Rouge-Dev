package main

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

// Tarification Handlers
func getTarifications(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_tarification, prix, unite, periodicite, actif, id_produit FROM tarification")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var tarifications []Tarification
	for rows.Next() {
		var t Tarification
		err := rows.Scan(&t.ID, &t.Prix, &t.Unite, &t.Periodicite, &t.Actif, &t.IDProduit)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		tarifications = append(tarifications, t)
	}
	json.NewEncoder(w).Encode(tarifications)
}

func getTarification(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var t Tarification
	err := db.QueryRow("SELECT id_tarification, prix, unite, periodicite, actif, id_produit FROM tarification WHERE id_tarification = $1", id).Scan(&t.ID, &t.Prix, &t.Unite, &t.Periodicite, &t.Actif, &t.IDProduit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(t)
}

func createTarification(w http.ResponseWriter, r *http.Request) {
	var t Tarification
	json.NewDecoder(r.Body).Decode(&t)
	err := db.QueryRow("INSERT INTO tarification (prix, unite, periodicite, actif, id_produit) VALUES ($1, $2, $3, $4, $5) RETURNING id_tarification", t.Prix, t.Unite, t.Periodicite, t.Actif, t.IDProduit).Scan(&t.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(t)
}

func updateTarification(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var t Tarification
	json.NewDecoder(r.Body).Decode(&t)
	_, err := db.Exec("UPDATE tarification SET prix = $1, unite = $2, periodicite = $3, actif = $4, id_produit = $5 WHERE id_tarification = $6", t.Prix, t.Unite, t.Periodicite, t.Actif, t.IDProduit, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	t.ID = id
	json.NewEncoder(w).Encode(t)
}

func deleteTarification(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	_, err := db.Exec("DELETE FROM tarification WHERE id_tarification = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
