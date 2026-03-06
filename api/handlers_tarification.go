package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

// Tarification Handlers
func getTarifications(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Vérifier le cache
	if cached := catalogCache.Get(cacheKeyAllTarifications); cached != nil {
		w.Write(cached)
		return
	}

	rows, err := db.Query("SELECT id_tarification, prix, unite, periodicite, actif, id_produit FROM tarification")
	if err != nil {
		log.Printf("Error fetching tarifications: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var tarifications []Tarification
	for rows.Next() {
		var t Tarification
		err := rows.Scan(&t.ID, &t.Prix, &t.Unite, &t.Periodicite, &t.Actif, &t.IDProduit)
		if err != nil {
			log.Printf("Error scanning tarification: %v", err)
			jsonError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		tarifications = append(tarifications, t)
	}

	// Stocker dans le cache
	CacheSetJSON(catalogCache, cacheKeyAllTarifications, tarifications)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tarifications)
}

func getTarification(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var t Tarification
	err = db.QueryRow("SELECT id_tarification, prix, unite, periodicite, actif, id_produit FROM tarification WHERE id_tarification = $1", id).Scan(&t.ID, &t.Prix, &t.Unite, &t.Periodicite, &t.Actif, &t.IDProduit)
	if err != nil {
		jsonError(w, "Pricing not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(t)
}

func createTarification(w http.ResponseWriter, r *http.Request) {
	var t Tarification
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if t.Prix < 0 {
		jsonError(w, "Price cannot be negative", http.StatusBadRequest)
		return
	}

	err := db.QueryRow("INSERT INTO tarification (prix, unite, periodicite, actif, id_produit) VALUES ($1, $2, $3, $4, $5) RETURNING id_tarification", t.Prix, t.Unite, t.Periodicite, t.Actif, t.IDProduit).Scan(&t.ID)
	if err != nil {
		log.Printf("Error creating tarification: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	invalidateTarificationsCache()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(t)
}

func updateTarification(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var t Tarification
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if t.Prix < 0 {
		jsonError(w, "Price cannot be negative", http.StatusBadRequest)
		return
	}

	_, err = db.Exec("UPDATE tarification SET prix = $1, unite = $2, periodicite = $3, actif = $4, id_produit = $5 WHERE id_tarification = $6", t.Prix, t.Unite, t.Periodicite, t.Actif, t.IDProduit, id)
	if err != nil {
		log.Printf("Error updating tarification %d: %v", id, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	invalidateTarificationsCache()

	t.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(t)
}

func deleteTarification(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	_, err = db.Exec("DELETE FROM tarification WHERE id_tarification = $1", id)
	if err != nil {
		log.Printf("Error deleting tarification %d: %v", id, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	invalidateTarificationsCache()

	w.WriteHeader(http.StatusNoContent)
}
