package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
)

// ===== FONCTIONS UTILITAIRES =====

func getUserIDFromContext(r *http.Request) int {
	if userID, ok := r.Context().Value(UserIDKey).(int); ok {
		return userID
	}
	return 0
}

// ===== HANDLERS CATEGORIES WEB =====

func getCategories(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	rows, err := db.Query(`
		SELECT id_categorie, nom, slug, description, icone, couleur, 
		       ordre_affichage, actif, date_creation, date_modification
		FROM categories 
		ORDER BY ordre_affichage ASC
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var categories []CategorieWeb
	for rows.Next() {
		var c CategorieWeb
		err := rows.Scan(&c.ID, &c.Nom, &c.Slug, &c.Description, &c.Icone,
			&c.Couleur, &c.OrdreAffichage, &c.Actif, &c.DateCreation, &c.DateModification)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		categories = append(categories, c)
	}

	json.NewEncoder(w).Encode(categories)
}

func getActiveCategories(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	rows, err := db.Query(`
		SELECT id_categorie, nom, slug, description, icone, couleur, ordre_affichage
		FROM categories 
		WHERE actif = TRUE
		ORDER BY ordre_affichage ASC
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var categories []CategorieWeb
	for rows.Next() {
		var c CategorieWeb
		err := rows.Scan(&c.ID, &c.Nom, &c.Slug, &c.Description, &c.Icone, &c.Couleur, &c.OrdreAffichage)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		categories = append(categories, c)
	}

	json.NewEncoder(w).Encode(categories)
}

func createCategorie(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var c CategorieWeb
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserIDFromContext(r)

	err := db.QueryRow(`
		INSERT INTO categories (nom, slug, description, icone, couleur, ordre_affichage, actif, id_utilisateur_creation)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id_categorie, date_creation, date_modification
	`, c.Nom, c.Slug, c.Description, c.Icone, c.Couleur, c.OrdreAffichage, c.Actif, userID).Scan(
		&c.ID, &c.DateCreation, &c.DateModification)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(c)
}

func updateCategorie(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	var c CategorieWeb
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err = db.Exec(`
		UPDATE categories 
		SET nom = $1, slug = $2, description = $3, icone = $4, couleur = $5, 
		    ordre_affichage = $6, actif = $7, date_modification = CURRENT_TIMESTAMP
		WHERE id_categorie = $8
	`, c.Nom, c.Slug, c.Description, c.Icone, c.Couleur, c.OrdreAffichage, c.Actif, id)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	c.ID = id
	json.NewEncoder(w).Encode(c)
}

func deleteCategorie(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	// Vérifier s'il y a des produits associés
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM produits WHERE id_categorie = $1", id).Scan(&count)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if count > 0 {
		http.Error(w, "Cannot delete category with associated products", http.StatusConflict)
		return
	}

	_, err = db.Exec("DELETE FROM categories WHERE id_categorie = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ===== HANDLERS PRODUITS WEB =====

func getProduits(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	query := `
		SELECT p.id_produit, p.nom, p.slug, p.description_courte, p.description_longue,
		       p.description_html, COALESCE(p.images::text, '[]'),
		       p.prix, p.devise, p.duree, p.id_categorie, p.tag, p.statut, p.type_achat,
		       p.ordre_affichage, p.actif, p.date_creation, p.date_modification,
		       c.nom as categorie_nom
		FROM produits p
		LEFT JOIN categories c ON p.id_categorie = c.id_categorie
		ORDER BY p.ordre_affichage ASC
	`

	categoryFilter := r.URL.Query().Get("category")
	if categoryFilter != "" {
		query = `
			SELECT p.id_produit, p.nom, p.slug, p.description_courte, p.description_longue,
			       p.description_html, COALESCE(p.images::text, '[]'),
			       p.prix, p.devise, p.duree, p.id_categorie, p.tag, p.statut, p.type_achat,
			       p.ordre_affichage, p.actif, p.date_creation, p.date_modification,
			       c.nom as categorie_nom
			FROM produits p
			LEFT JOIN categories c ON p.id_categorie = c.id_categorie
			WHERE c.slug = $1
			ORDER BY p.ordre_affichage ASC
		`
	}

	var rows *sql.Rows
	var err error

	if categoryFilter != "" {
		rows, err = db.Query(query, categoryFilter)
	} else {
		rows, err = db.Query(query)
	}

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var produits []ProduitWeb
	for rows.Next() {
		var p ProduitWeb
		var categorieNom sql.NullString
		var descHTML sql.NullString

		err := rows.Scan(&p.ID, &p.Nom, &p.Slug, &p.DescriptionCourte, &p.DescriptionLongue,
			&descHTML, &p.Images,
			&p.Prix, &p.Devise, &p.Duree, &p.IDCategorie, &p.Tag, &p.Statut,
			&p.TypeAchat, &p.OrdreAffichage, &p.Actif, &p.DateCreation,
			&p.DateModification, &categorieNom)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if descHTML.Valid {
			p.DescriptionHTML = descHTML.String
		}

		produits = append(produits, p)
	}

	json.NewEncoder(w).Encode(produits)
}

func getActiveProduitsByCategory(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	params := mux.Vars(r)
	categorySlug := params["slug"]

	rows, err := db.Query(`
		SELECT p.id_produit, p.nom, p.slug, p.description_courte, p.description_longue,
		       p.description_html, COALESCE(p.images::text, '[]'),
		       p.prix, p.devise, p.duree, p.tag, p.statut, p.type_achat, p.ordre_affichage
		FROM produits p
		JOIN categories c ON p.id_categorie = c.id_categorie
		WHERE c.slug = $1 AND p.actif = TRUE AND c.actif = TRUE
		ORDER BY p.ordre_affichage ASC
	`, categorySlug)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var produits []ProduitWeb
	for rows.Next() {
		var p ProduitWeb
		var descHTML sql.NullString
		err := rows.Scan(&p.ID, &p.Nom, &p.Slug, &p.DescriptionCourte, &p.DescriptionLongue,
			&descHTML, &p.Images,
			&p.Prix, &p.Devise, &p.Duree, &p.Tag, &p.Statut, &p.TypeAchat, &p.OrdreAffichage)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if descHTML.Valid {
			p.DescriptionHTML = descHTML.String
		}
		produits = append(produits, p)
	}

	json.NewEncoder(w).Encode(produits)
}

func createProduit(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var p ProduitWeb
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userID := getUserIDFromContext(r)

	images := p.Images
	if images == "" {
		images = "[]"
	}

	err := db.QueryRow(`
		INSERT INTO produits (nom, slug, description_courte, description_longue, description_html, images, prix, devise, duree,
		                     id_categorie, tag, statut, type_achat, ordre_affichage, actif, id_utilisateur_creation)
		VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		RETURNING id_produit, date_creation, date_modification
	`, p.Nom, p.Slug, p.DescriptionCourte, p.DescriptionLongue, p.DescriptionHTML, images, p.Prix, p.Devise, p.Duree,
		p.IDCategorie, p.Tag, p.Statut, p.TypeAchat, p.OrdreAffichage, p.Actif, userID).Scan(
		&p.ID, &p.DateCreation, &p.DateModification)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(p)
}

func updateProduit(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	var p ProduitWeb
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	imagesVal := p.Images
	if imagesVal == "" {
		imagesVal = "[]"
	}

	_, err = db.Exec(`
		UPDATE produits 
		SET nom = $1, slug = $2, description_courte = $3, description_longue = $4,
		    description_html = $5, images = $6::jsonb,
		    prix = $7, devise = $8, duree = $9, id_categorie = $10, tag = $11, statut = $12,
		    type_achat = $13, ordre_affichage = $14, actif = $15, date_modification = CURRENT_TIMESTAMP
		WHERE id_produit = $16
	`, p.Nom, p.Slug, p.DescriptionCourte, p.DescriptionLongue, p.DescriptionHTML, imagesVal,
		p.Prix, p.Devise, p.Duree,
		p.IDCategorie, p.Tag, p.Statut, p.TypeAchat, p.OrdreAffichage, p.Actif, id)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	p.ID = id
	json.NewEncoder(w).Encode(p)
}

func deleteProduit(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	_, err = db.Exec("DELETE FROM produits WHERE id_produit = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// searchProduits - Public search across active products (no auth required)
func searchProduits(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		json.NewEncoder(w).Encode([]interface{}{})
		return
	}

	pattern := "%" + q + "%"

	rows, err := db.Query(`
		SELECT p.id_produit, p.nom, p.slug, p.description_courte, p.description_longue,
		       p.description_html, COALESCE(p.images::text, '[]'),
		       p.prix, p.devise, p.duree, p.tag, p.statut, p.type_achat, p.ordre_affichage,
		       c.nom as categorie_nom, c.slug as categorie_slug
		FROM produits p
		JOIN categories c ON p.id_categorie = c.id_categorie
		WHERE p.actif = TRUE AND c.actif = TRUE
		  AND (p.nom ILIKE $1 OR p.description_courte ILIKE $1 OR p.description_longue ILIKE $1 OR p.tag ILIKE $1 OR c.nom ILIKE $1)
		ORDER BY p.ordre_affichage ASC, p.nom ASC
	`, pattern)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type SearchResult struct {
		ID                int     `json:"id_produit"`
		Nom               string  `json:"nom"`
		Slug              string  `json:"slug"`
		DescriptionCourte string  `json:"description_courte"`
		DescriptionLongue string  `json:"description_longue"`
		DescriptionHTML   string  `json:"description_html"`
		Images            string  `json:"images"`
		Prix              float64 `json:"prix"`
		Devise            string  `json:"devise"`
		Duree             string  `json:"duree"`
		Tag               string  `json:"tag"`
		Statut            string  `json:"statut"`
		TypeAchat         string  `json:"type_achat"`
		OrdreAffichage    int     `json:"ordre_affichage"`
		CategorieNom      string  `json:"categorie_nom"`
		CategorieSlug     string  `json:"categorie_slug"`
	}

	var results []SearchResult
	for rows.Next() {
		var p SearchResult
		err := rows.Scan(
			&p.ID, &p.Nom, &p.Slug, &p.DescriptionCourte, &p.DescriptionLongue,
			&p.DescriptionHTML, &p.Images,
			&p.Prix, &p.Devise, &p.Duree, &p.Tag, &p.Statut, &p.TypeAchat, &p.OrdreAffichage,
			&p.CategorieNom, &p.CategorieSlug,
		)
		if err != nil {
			log.Printf("searchProduits scan error: %v", err)
			continue
		}
		results = append(results, p)
	}

	if results == nil {
		results = []SearchResult{}
	}

	json.NewEncoder(w).Encode(results)
}
