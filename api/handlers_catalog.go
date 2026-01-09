package main

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

// Category Handlers
func getCategories(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_categorie, nom, description, actif FROM categorie")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var categories []Categorie
	for rows.Next() {
		var c Categorie
		err := rows.Scan(&c.ID, &c.Nom, &c.Description, &c.Actif)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		categories = append(categories, c)
	}
	json.NewEncoder(w).Encode(categories)
}

func getCategorie(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var c Categorie
	err := db.QueryRow("SELECT id_categorie, nom, description, actif FROM categorie WHERE id_categorie = $1", id).Scan(&c.ID, &c.Nom, &c.Description, &c.Actif)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(c)
}

func createCategorie(w http.ResponseWriter, r *http.Request) {
	var c Categorie
	json.NewDecoder(r.Body).Decode(&c)
	err := db.QueryRow("INSERT INTO categorie (nom, description, actif) VALUES ($1, $2, $3) RETURNING id_categorie", c.Nom, c.Description, c.Actif).Scan(&c.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(c)
}

func updateCategorie(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var c Categorie
	json.NewDecoder(r.Body).Decode(&c)
	_, err := db.Exec("UPDATE categorie SET nom = $1, description = $2, actif = $3 WHERE id_categorie = $4", c.Nom, c.Description, c.Actif, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	c.ID = id
	json.NewEncoder(w).Encode(c)
}

func deleteCategorie(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	_, err := db.Exec("DELETE FROM categorie WHERE id_categorie = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Service Handlers
func getServices(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_service, nom, description, actif, id_categorie FROM service")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var services []Service
	for rows.Next() {
		var s Service
		err := rows.Scan(&s.ID, &s.Nom, &s.Description, &s.Actif, &s.IDCategorie)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		services = append(services, s)
	}
	json.NewEncoder(w).Encode(services)
}

func getService(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var s Service
	err := db.QueryRow("SELECT id_service, nom, description, actif, id_categorie FROM service WHERE id_service = $1", id).Scan(&s.ID, &s.Nom, &s.Description, &s.Actif, &s.IDCategorie)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(s)
}

func createService(w http.ResponseWriter, r *http.Request) {
	var s Service
	json.NewDecoder(r.Body).Decode(&s)
	err := db.QueryRow("INSERT INTO service (nom, description, actif, id_categorie) VALUES ($1, $2, $3, $4) RETURNING id_service", s.Nom, s.Description, s.Actif, s.IDCategorie).Scan(&s.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(s)
}

func updateService(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var s Service
	json.NewDecoder(r.Body).Decode(&s)
	_, err := db.Exec("UPDATE service SET nom = $1, description = $2, actif = $3, id_categorie = $4 WHERE id_service = $5", s.Nom, s.Description, s.Actif, s.IDCategorie, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	s.ID = id
	json.NewEncoder(w).Encode(s)
}

func deleteService(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	_, err := db.Exec("DELETE FROM service WHERE id_service = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Product Handlers
func getProduits(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_produit, nom, description, sur_devis, actif, id_service FROM produit")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var produits []Produit
	for rows.Next() {
		var p Produit
		err := rows.Scan(&p.ID, &p.Nom, &p.Description, &p.SurDevis, &p.Actif, &p.IDService)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		produits = append(produits, p)
	}
	json.NewEncoder(w).Encode(produits)
}

func getProduit(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var p Produit
	err := db.QueryRow("SELECT id_produit, nom, description, sur_devis, actif, id_service FROM produit WHERE id_produit = $1", id).Scan(&p.ID, &p.Nom, &p.Description, &p.SurDevis, &p.Actif, &p.IDService)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(p)
}

func createProduit(w http.ResponseWriter, r *http.Request) {
	var p Produit
	json.NewDecoder(r.Body).Decode(&p)
	err := db.QueryRow("INSERT INTO produit (nom, description, sur_devis, actif, id_service) VALUES ($1, $2, $3, $4, $5) RETURNING id_produit", p.Nom, p.Description, p.SurDevis, p.Actif, p.IDService).Scan(&p.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(p)
}

func updateProduit(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var p Produit
	json.NewDecoder(r.Body).Decode(&p)
	_, err := db.Exec("UPDATE produit SET nom = $1, description = $2, sur_devis = $3, actif = $4, id_service = $5 WHERE id_produit = $6", p.Nom, p.Description, p.SurDevis, p.Actif, p.IDService, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	p.ID = id
	json.NewEncoder(w).Encode(p)
}

func deleteProduit(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	_, err := db.Exec("DELETE FROM produit WHERE id_produit = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
