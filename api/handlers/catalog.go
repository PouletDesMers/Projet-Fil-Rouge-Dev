package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"

	"api/cache"
	"api/config"
	mw "api/middleware"
	"api/models"
)

// ===== CATEGORIES =====

func GetCategories(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Cache hit
	if cached := cache.AdminCache.Get(cache.KeyAdminCategories); cached != nil {
		w.Write(cached)
		return
	}

	rows, err := config.DB.Query(`
		SELECT id_categorie, nom, slug,
		       COALESCE(description,''), COALESCE(image,''), COALESCE(icone,''), COALESCE(couleur,''),
		       COALESCE(ordre_affichage,0), COALESCE(actif,false),
		       COALESCE(date_creation,NOW()), COALESCE(date_modification,NOW())
		FROM categories ORDER BY ordre_affichage ASC`)
	if err != nil {
		log.Printf("Error fetching categories: %v", err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	categories := []models.CategorieWeb{}
	for rows.Next() {
		var c models.CategorieWeb
		if err := rows.Scan(&c.ID, &c.Nom, &c.Slug, &c.Description, &c.Image, &c.Icone, &c.Couleur,
			&c.OrdreAffichage, &c.Actif, &c.DateCreation, &c.DateModification); err != nil {
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		categories = append(categories, c)
	}
	cache.SetJSON(cache.AdminCache, cache.KeyAdminCategories, categories)
	json.NewEncoder(w).Encode(categories)
}

func GetActiveCategories(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if cached := cache.CatalogCache.Get(cache.KeyActiveCategories); cached != nil {
		w.Write(cached)
		return
	}
	rows, err := config.DB.Query(`
		SELECT id_categorie, nom, slug,
		       COALESCE(description,''), COALESCE(image,''), COALESCE(icone,''), COALESCE(couleur,''),
		       COALESCE(ordre_affichage,0)
		FROM categories WHERE actif = TRUE ORDER BY ordre_affichage ASC`)
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	categories := []models.CategorieWeb{}
	for rows.Next() {
		var c models.CategorieWeb
		if err := rows.Scan(&c.ID, &c.Nom, &c.Slug, &c.Description, &c.Image, &c.Icone, &c.Couleur, &c.OrdreAffichage); err != nil {
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		c.Actif = true
		categories = append(categories, c)
	}
	cache.SetJSON(cache.CatalogCache, cache.KeyActiveCategories, categories)
	json.NewEncoder(w).Encode(categories)
}

func CreateCategorie(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var c models.CategorieWeb
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	c.Nom = mw.SanitizeString(c.Nom)
	c.Description = mw.SanitizeString(c.Description)
	c.Image = strings.TrimSpace(c.Image)
	if c.Nom == "" || c.Slug == "" {
		jsonErr(w, "Name and slug are required", http.StatusBadRequest)
		return
	}
	userID, _ := getUserID(r)
	if err := config.DB.QueryRow(`
		INSERT INTO categories (nom, slug, description, image, icone, couleur, ordre_affichage, actif, id_utilisateur_creation)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id_categorie, date_creation, date_modification`,
		c.Nom, c.Slug, c.Description, c.Image, c.Icone, c.Couleur, c.OrdreAffichage, c.Actif, userID).Scan(
		&c.ID, &c.DateCreation, &c.DateModification); err != nil {
		log.Printf("Error creating categorie: %v", err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	cache.InvalidateCategories()
	cache.InvalidateAdminCategories()
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

func UpdateCategorie(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var c models.CategorieWeb
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	c.Nom = mw.SanitizeString(c.Nom)
	c.Description = mw.SanitizeString(c.Description)
	c.Image = strings.TrimSpace(c.Image)
	if _, err := config.DB.Exec(`
		UPDATE categories SET nom=$1, slug=$2, description=$3, image=$4, icone=$5, couleur=$6,
		    ordre_affichage=$7, actif=$8, date_modification=CURRENT_TIMESTAMP WHERE id_categorie=$9`,
		c.Nom, c.Slug, c.Description, c.Image, c.Icone, c.Couleur, c.OrdreAffichage, c.Actif, id); err != nil {
		log.Printf("Error updating categorie %d: %v", id, err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	cache.InvalidateCategories()
	cache.InvalidateAdminCategories()
	c.ID = id
	json.NewEncoder(w).Encode(c)
}

func DeleteCategorie(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var count int
	if err := config.DB.QueryRow("SELECT COUNT(*) FROM produits WHERE id_categorie = $1", id).Scan(&count); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if count > 0 {
		jsonErr(w, "Cannot delete category with associated products", http.StatusConflict)
		return
	}
	if _, err := config.DB.Exec("DELETE FROM categories WHERE id_categorie = $1", id); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	cache.InvalidateCategories()
	cache.InvalidateAdminCategories()
	w.WriteHeader(http.StatusNoContent)
}

// ===== PRODUITS =====

func GetProduits(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	baseQuery := `
		SELECT p.id_produit, p.nom, p.slug,
		       COALESCE(p.description_courte,''), COALESCE(p.description_longue,''),
		       p.description_html, COALESCE(p.images::text, '[]'),
		       p.prix, COALESCE(p.devise,'EUR'), COALESCE(p.duree,''), p.id_categorie,
		       COALESCE(p.tag,''), COALESCE(p.statut,'actif'), COALESCE(p.type_achat,''),
		       COALESCE(p.ordre_affichage,0), COALESCE(p.actif,false),
		       COALESCE(p.date_creation,NOW()), COALESCE(p.date_modification,NOW()),
		       c.nom as categorie_nom
		FROM produits p LEFT JOIN categories c ON p.id_categorie = c.id_categorie`

	var rows *sql.Rows
	var err error
	catFilter := r.URL.Query().Get("category")
	if catFilter != "" {
		rows, err = config.DB.Query(baseQuery+" WHERE c.slug = $1 ORDER BY p.ordre_affichage ASC", catFilter)
	} else {
		rows, err = config.DB.Query(baseQuery + " ORDER BY p.ordre_affichage ASC")
	}
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	produits := []models.ProduitWeb{}
	for rows.Next() {
		var p models.ProduitWeb
		var descHTML, catNom sql.NullString
		if err := rows.Scan(&p.ID, &p.Nom, &p.Slug, &p.DescriptionCourte, &p.DescriptionLongue,
			&descHTML, &p.Images, &p.Prix, &p.Devise, &p.Duree, &p.IDCategorie,
			&p.Tag, &p.Statut, &p.TypeAchat, &p.OrdreAffichage, &p.Actif,
			&p.DateCreation, &p.DateModification, &catNom); err != nil {
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		if descHTML.Valid {
			p.DescriptionHTML = descHTML.String
		}
		produits = append(produits, p)
	}
	json.NewEncoder(w).Encode(produits)
}

func GetActiveProduitsByCategory(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	slug := mux.Vars(r)["slug"]
	cacheKey := cache.KeyProduitsByCategory(slug)
	if cached := cache.CatalogCache.Get(cacheKey); cached != nil {
		w.Write(cached)
		return
	}
	rows, err := config.DB.Query(`
		SELECT p.id_produit, p.nom, p.slug,
		       COALESCE(p.description_courte,''), COALESCE(p.description_longue,''),
		       COALESCE(p.description_html,''), COALESCE(p.images::text,'[]'),
		       p.prix, COALESCE(p.devise,'EUR'), COALESCE(p.duree,''),
		       COALESCE(p.tag,''), COALESCE(p.statut,'actif'), COALESCE(p.type_achat,''),
		       COALESCE(p.ordre_affichage,0)
		FROM produits p JOIN categories c ON p.id_categorie = c.id_categorie
		WHERE c.slug = $1 AND p.actif = TRUE AND c.actif = TRUE ORDER BY p.ordre_affichage ASC`, slug)
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	produits := []models.ProduitWeb{}
	for rows.Next() {
		var p models.ProduitWeb
		var descHTML sql.NullString
		if err := rows.Scan(&p.ID, &p.Nom, &p.Slug, &p.DescriptionCourte, &p.DescriptionLongue,
			&descHTML, &p.Images, &p.Prix, &p.Devise, &p.Duree, &p.Tag, &p.Statut,
			&p.TypeAchat, &p.OrdreAffichage); err != nil {
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		if descHTML.Valid {
			p.DescriptionHTML = descHTML.String
		}
		produits = append(produits, p)
	}
	cache.SetJSON(cache.CatalogCache, cacheKey, produits)
	json.NewEncoder(w).Encode(produits)
}

func CreateProduit(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var p models.ProduitWeb
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	p.Nom = mw.SanitizeString(p.Nom)
	p.DescriptionCourte = mw.SanitizeString(p.DescriptionCourte)
	if p.Nom == "" || p.Slug == "" {
		jsonErr(w, "Name and slug are required", http.StatusBadRequest)
		return
	}
	userID, _ := getUserID(r)
	images := p.Images
	if images == "" {
		images = "[]"
	}
	if err := config.DB.QueryRow(`
		INSERT INTO produits (nom, slug, description_courte, description_longue, description_html,
		    images, prix, devise, duree, id_categorie, tag, statut, type_achat,
		    ordre_affichage, actif, id_utilisateur_creation)
		VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		RETURNING id_produit, date_creation, date_modification`,
		p.Nom, p.Slug, p.DescriptionCourte, p.DescriptionLongue, p.DescriptionHTML,
		images, p.Prix, p.Devise, p.Duree, p.IDCategorie, p.Tag, p.Statut,
		p.TypeAchat, p.OrdreAffichage, p.Actif, userID).Scan(&p.ID, &p.DateCreation, &p.DateModification); err != nil {
		log.Printf("Error creating produit: %v", err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	cache.InvalidateProduits()
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(p)
}

func UpdateProduit(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var p models.ProduitWeb
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	p.Nom = mw.SanitizeString(p.Nom)
	p.DescriptionCourte = mw.SanitizeString(p.DescriptionCourte)
	images := p.Images
	if images == "" {
		images = "[]"
	}
	if _, err := config.DB.Exec(`
		UPDATE produits SET nom=$1, slug=$2, description_courte=$3, description_longue=$4,
		    description_html=$5, images=$6::jsonb, prix=$7, devise=$8, duree=$9,
		    id_categorie=$10, tag=$11, statut=$12, type_achat=$13,
		    ordre_affichage=$14, actif=$15, date_modification=CURRENT_TIMESTAMP
		WHERE id_produit=$16`,
		p.Nom, p.Slug, p.DescriptionCourte, p.DescriptionLongue, p.DescriptionHTML,
		images, p.Prix, p.Devise, p.Duree, p.IDCategorie, p.Tag, p.Statut,
		p.TypeAchat, p.OrdreAffichage, p.Actif, id); err != nil {
		log.Printf("Error updating produit %d: %v", id, err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	cache.InvalidateProduits()
	p.ID = id
	json.NewEncoder(w).Encode(p)
}

func DeleteProduit(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	if _, err := config.DB.Exec("DELETE FROM produits WHERE id_produit = $1", id); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	cache.InvalidateProduits()
	w.WriteHeader(http.StatusNoContent)
}

func SearchProduits(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		json.NewEncoder(w).Encode([]interface{}{})
		return
	}
	if len(q) > 100 {
		jsonErr(w, "Search query too long", http.StatusBadRequest)
		return
	}
	cacheKey := cache.KeySearchResults(q)
	if cached := cache.SearchCache.Get(cacheKey); cached != nil {
		w.Write(cached)
		return
	}
	pattern := "%" + q + "%"
	rows, err := config.DB.Query(`
		SELECT p.id_produit, p.nom, p.slug,
		       COALESCE(p.description_courte,''), COALESCE(p.description_longue,''),
		       COALESCE(p.prix,0), COALESCE(p.devise,'EUR'), COALESCE(p.duree,''),
		       COALESCE(p.tag,''), COALESCE(p.statut,'actif'), COALESCE(p.type_achat,''),
		       COALESCE(p.ordre_affichage,0),
		       COALESCE(c.nom,''), COALESCE(c.slug,''),
		       COALESCE(p.images::text,'[]')
		FROM produits p JOIN categories c ON p.id_categorie = c.id_categorie
		WHERE p.actif=TRUE AND c.actif=TRUE
		  AND (p.nom ILIKE $1 OR p.description_courte ILIKE $1 OR p.tag ILIKE $1 OR c.nom ILIKE $1)
		ORDER BY p.ordre_affichage ASC LIMIT 50`, pattern)
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type SearchResult struct {
		ID                int     `json:"id_produit"`
		Nom               string  `json:"nom"`
		Slug              string  `json:"slug"`
		DescriptionCourte string  `json:"description_courte"`
		DescriptionLongue string  `json:"description_longue"`
		Prix              float64 `json:"prix"`
		Devise            string  `json:"devise"`
		Duree             string  `json:"duree"`
		Tag               string  `json:"tag"`
		Statut            string  `json:"statut"`
		TypeAchat         string  `json:"type_achat"`
		OrdreAffichage    int     `json:"ordre_affichage"`
		CategorieNom      string  `json:"categorie_nom"`
		CategorieSlug     string  `json:"categorie_slug"`
		NomCategorie      string  `json:"nom_categorie"`
		Images            string  `json:"images"`
	}
	results := []SearchResult{}
	for rows.Next() {
		var p SearchResult
		if err := rows.Scan(&p.ID, &p.Nom, &p.Slug, &p.DescriptionCourte, &p.DescriptionLongue,
			&p.Prix, &p.Devise, &p.Duree, &p.Tag,
			&p.Statut, &p.TypeAchat, &p.OrdreAffichage, &p.CategorieNom, &p.CategorieSlug,
			&p.Images); err != nil {
			continue
		}
		p.NomCategorie = p.CategorieNom
		results = append(results, p)
	}
	cache.SetJSON(cache.SearchCache, cacheKey, results)
	json.NewEncoder(w).Encode(results)
}

// ===== TARIFICATION =====

func GetTarifications(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if cached := cache.CatalogCache.Get(cache.KeyAllTarifications); cached != nil {
		w.Write(cached)
		return
	}
	rows, err := config.DB.Query(
		`SELECT id_tarification, COALESCE(prix,0), COALESCE(unite,''), COALESCE(periodicite,''), COALESCE(actif,false), id_produit FROM tarification`)
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	tarifications := []models.Tarification{}
	for rows.Next() {
		var t models.Tarification
		if err := rows.Scan(&t.ID, &t.Prix, &t.Unite, &t.Periodicite, &t.Actif, &t.IDProduit); err != nil {
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		tarifications = append(tarifications, t)
	}
	cache.SetJSON(cache.CatalogCache, cache.KeyAllTarifications, tarifications)
	json.NewEncoder(w).Encode(tarifications)
}

func GetTarification(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var t models.Tarification
	if err := config.DB.QueryRow(
		`SELECT id_tarification, COALESCE(prix,0), COALESCE(unite,''), COALESCE(periodicite,''), COALESCE(actif,false), id_produit FROM tarification WHERE id_tarification = $1`, id).Scan(
		&t.ID, &t.Prix, &t.Unite, &t.Periodicite, &t.Actif, &t.IDProduit); err != nil {
		jsonErr(w, "Pricing not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(t)
}

func CreateTarification(w http.ResponseWriter, r *http.Request) {
	var t models.Tarification
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if t.Prix < 0 {
		jsonErr(w, "Price cannot be negative", http.StatusBadRequest)
		return
	}
	if err := config.DB.QueryRow("INSERT INTO tarification (prix, unite, periodicite, actif, id_produit) VALUES ($1,$2,$3,$4,$5) RETURNING id_tarification",
		t.Prix, t.Unite, t.Periodicite, t.Actif, t.IDProduit).Scan(&t.ID); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	cache.InvalidateTarifications()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(t)
}

func UpdateTarification(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var t models.Tarification
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if t.Prix < 0 {
		jsonErr(w, "Price cannot be negative", http.StatusBadRequest)
		return
	}
	if _, err := config.DB.Exec("UPDATE tarification SET prix=$1, unite=$2, periodicite=$3, actif=$4, id_produit=$5 WHERE id_tarification=$6",
		t.Prix, t.Unite, t.Periodicite, t.Actif, t.IDProduit, id); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	cache.InvalidateTarifications()
	t.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(t)
}

func DeleteTarification(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	if _, err := config.DB.Exec("DELETE FROM tarification WHERE id_tarification = $1", id); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	cache.InvalidateTarifications()
	w.WriteHeader(http.StatusNoContent)
}

// ===== ENTREPRISES =====

func GetEntreprises(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(
		`SELECT id_entreprise, nom, COALESCE(secteur,''), COALESCE(taille,''), COALESCE(pays,''), COALESCE(date_creation,NOW()) FROM entreprise`)
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	entreprises := []models.Entreprise{}
	for rows.Next() {
		var e models.Entreprise
		if err := rows.Scan(&e.ID, &e.Nom, &e.Secteur, &e.Taille, &e.Pays, &e.DateCreation); err != nil {
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		entreprises = append(entreprises, e)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entreprises)
}

func GetEntreprise(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var e models.Entreprise
	if err := config.DB.QueryRow(
		`SELECT id_entreprise, nom, COALESCE(secteur,''), COALESCE(taille,''), COALESCE(pays,''), COALESCE(date_creation,NOW()) FROM entreprise WHERE id_entreprise = $1`, id).Scan(
		&e.ID, &e.Nom, &e.Secteur, &e.Taille, &e.Pays, &e.DateCreation); err != nil {
		jsonErr(w, "Company not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(e)
}

func CreateEntreprise(w http.ResponseWriter, r *http.Request) {
	var e models.Entreprise
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	e.Nom = mw.SanitizeString(e.Nom)
	e.Secteur = mw.SanitizeString(e.Secteur)
	e.Taille = mw.SanitizeString(e.Taille)
	e.Pays = mw.SanitizeString(e.Pays)
	if e.Nom == "" {
		jsonErr(w, "Company name is required", http.StatusBadRequest)
		return
	}
	if err := config.DB.QueryRow("INSERT INTO entreprise (nom, secteur, taille, pays) VALUES ($1,$2,$3,$4) RETURNING id_entreprise",
		e.Nom, e.Secteur, e.Taille, e.Pays).Scan(&e.ID); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(e)
}

func UpdateEntreprise(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var e models.Entreprise
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	e.Nom = mw.SanitizeString(e.Nom)
	e.Secteur = mw.SanitizeString(e.Secteur)
	e.Taille = mw.SanitizeString(e.Taille)
	e.Pays = mw.SanitizeString(e.Pays)
	if _, err := config.DB.Exec("UPDATE entreprise SET nom=$1, secteur=$2, taille=$3, pays=$4 WHERE id_entreprise=$5",
		e.Nom, e.Secteur, e.Taille, e.Pays, id); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	e.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(e)
}

func DeleteEntreprise(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	if _, err := config.DB.Exec("DELETE FROM entreprise WHERE id_entreprise = $1", id); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
