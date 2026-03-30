package repositories

import (
	"database/sql"

	"api/models"
)

type CatalogRepo struct {
	DB *sql.DB
}

func NewCatalogRepo(db *sql.DB) *CatalogRepo { return &CatalogRepo{DB: db} }

func (r *CatalogRepo) FindAllCategories() ([]models.CategorieWeb, error) {
	rows, err := r.DB.Query(`
		SELECT id_categorie, nom, slug,
		       COALESCE(description,''), COALESCE(icone,''), COALESCE(couleur,''),
		       COALESCE(ordre_affichage,0), COALESCE(actif,false),
		       COALESCE(date_creation,NOW()), COALESCE(date_modification,NOW())
		FROM categories ORDER BY ordre_affichage ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cats := []models.CategorieWeb{}
	for rows.Next() {
		var c models.CategorieWeb
		if err := rows.Scan(&c.ID, &c.Nom, &c.Slug, &c.Description, &c.Icone, &c.Couleur,
			&c.OrdreAffichage, &c.Actif, &c.DateCreation, &c.DateModification); err != nil {
			return nil, err
		}
		cats = append(cats, c)
	}
	return cats, nil
}

func (r *CatalogRepo) FindActiveCategories() ([]models.CategorieWeb, error) {
	rows, err := r.DB.Query(`
		SELECT id_categorie, nom, slug,
		       COALESCE(description,''), COALESCE(icone,''), COALESCE(couleur,''),
		       COALESCE(ordre_affichage,0)
		FROM categories WHERE actif=TRUE ORDER BY ordre_affichage ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cats := []models.CategorieWeb{}
	for rows.Next() {
		var c models.CategorieWeb
		if err := rows.Scan(&c.ID, &c.Nom, &c.Slug, &c.Description, &c.Icone, &c.Couleur, &c.OrdreAffichage); err != nil {
			return nil, err
		}
		c.Actif = true
		cats = append(cats, c)
	}
	return cats, nil
}

func (r *CatalogRepo) CreateCategorie(c *models.CategorieWeb, creatorID int) error {
	return r.DB.QueryRow(`
		INSERT INTO categories (nom, slug, description, icone, couleur, ordre_affichage, actif, id_utilisateur_creation)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		RETURNING id_categorie, date_creation, date_modification`,
		c.Nom, c.Slug, c.Description, c.Icone, c.Couleur, c.OrdreAffichage, c.Actif, creatorID).Scan(
		&c.ID, &c.DateCreation, &c.DateModification)
}

func (r *CatalogRepo) UpdateCategorie(c *models.CategorieWeb) error {
	_, err := r.DB.Exec(`
		UPDATE categories SET nom=$1, slug=$2, description=$3, icone=$4, couleur=$5,
		    ordre_affichage=$6, actif=$7, date_modification=CURRENT_TIMESTAMP WHERE id_categorie=$8`,
		c.Nom, c.Slug, c.Description, c.Icone, c.Couleur, c.OrdreAffichage, c.Actif, c.ID)
	return err
}

func (r *CatalogRepo) DeleteCategorie(id int) error {
	_, err := r.DB.Exec("DELETE FROM categories WHERE id_categorie=$1", id)
	return err
}

func (r *CatalogRepo) CountProduitsByCategorie(catID int) (int, error) {
	var count int
	err := r.DB.QueryRow("SELECT COUNT(*) FROM produits WHERE id_categorie=$1", catID).Scan(&count)
	return count, err
}

const produitSelectAdmin = `
	SELECT p.id_produit, p.nom, p.slug,
	       COALESCE(p.description_courte,''), COALESCE(p.description_longue,''),
	       p.description_html, COALESCE(p.images::text,'[]'),
	       p.prix, COALESCE(p.devise,'EUR'), COALESCE(p.duree,''), p.id_categorie,
	       COALESCE(p.tag,''), COALESCE(p.statut,'actif'), COALESCE(p.type_achat,''),
	       COALESCE(p.ordre_affichage,0), COALESCE(p.actif,false),
	       COALESCE(p.date_creation,NOW()), COALESCE(p.date_modification,NOW()),
	       c.nom as categorie_nom
	FROM produits p LEFT JOIN categories c ON p.id_categorie=c.id_categorie`

func (r *CatalogRepo) FindAllProduits(categorySlug string) ([]models.ProduitWeb, error) {
	var rows *sql.Rows
	var err error
	if categorySlug != "" {
		rows, err = r.DB.Query(produitSelectAdmin+" WHERE c.slug=$1 ORDER BY p.ordre_affichage ASC", categorySlug)
	} else {
		rows, err = r.DB.Query(produitSelectAdmin + " ORDER BY p.ordre_affichage ASC")
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanProduits(rows)
}

func (r *CatalogRepo) FindActiveProduitsByCategory(slug string) ([]models.ProduitWeb, error) {
	rows, err := r.DB.Query(`
		SELECT p.id_produit, p.nom, p.slug,
		       COALESCE(p.description_courte,''), COALESCE(p.description_longue,''),
		       p.description_html, COALESCE(p.images::text,'[]'),
		       p.prix, COALESCE(p.devise,'EUR'), COALESCE(p.duree,''),
		       COALESCE(p.tag,''), COALESCE(p.statut,'actif'), COALESCE(p.type_achat,''),
		       COALESCE(p.ordre_affichage,0)
		FROM produits p JOIN categories c ON p.id_categorie=c.id_categorie
		WHERE c.slug=$1 AND p.actif=TRUE AND c.actif=TRUE ORDER BY p.ordre_affichage ASC`, slug)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	produits := []models.ProduitWeb{}
	for rows.Next() {
		var p models.ProduitWeb
		var descHTML sql.NullString
		if err := rows.Scan(&p.ID, &p.Nom, &p.Slug, &p.DescriptionCourte, &p.DescriptionLongue,
			&descHTML, &p.Images, &p.Prix, &p.Devise, &p.Duree, &p.Tag, &p.Statut,
			&p.TypeAchat, &p.OrdreAffichage); err != nil {
			return nil, err
		}
		if descHTML.Valid {
			p.DescriptionHTML = descHTML.String
		}
		produits = append(produits, p)
	}
	return produits, nil
}

func (r *CatalogRepo) SearchProduits(pattern string) ([]SearchResult, error) {
	results := []SearchResult{}

	// Produits correspondants
	rows, err := r.DB.Query(`
		SELECT p.id_produit, p.nom, p.slug,
		       COALESCE(p.description_courte,''), COALESCE(p.description_longue,''),
		       COALESCE(p.description_html,''), COALESCE(p.images::text,'[]'),
		       COALESCE(p.prix,0), COALESCE(p.devise,'EUR'), COALESCE(p.duree,''),
		       COALESCE(p.tag,''), COALESCE(p.statut,'actif'), COALESCE(p.type_achat,''),
		       COALESCE(p.ordre_affichage,0),
		       COALESCE(c.nom,''), COALESCE(c.slug,'')
		FROM produits p JOIN categories c ON p.id_categorie=c.id_categorie
		WHERE p.actif=TRUE AND c.actif=TRUE
		  AND (p.nom ILIKE $1 OR p.description_courte ILIKE $1 OR p.tag ILIKE $1 OR c.nom ILIKE $1)
		ORDER BY p.ordre_affichage ASC LIMIT 50`, pattern)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p SearchResult
			if err := rows.Scan(&p.ID, &p.Nom, &p.Slug, &p.DescriptionCourte, &p.DescriptionLongue,
				&p.DescriptionHTML, &p.Images, &p.Prix, &p.Devise, &p.Duree, &p.Tag,
				&p.Statut, &p.TypeAchat, &p.OrdreAffichage, &p.CategorieNom, &p.CategorieSlug); err != nil {
				continue
			}
			p.Type = "product"
			results = append(results, p)
		}
	}

	// Catégories correspondantes
	catRows, errCat := r.DB.Query(`
		SELECT id_categorie, nom, slug, COALESCE(description,''), COALESCE(couleur,'')
		FROM categories
		WHERE actif = TRUE AND (nom ILIKE $1 OR slug ILIKE $1)
		ORDER BY ordre_affichage ASC LIMIT 10`, pattern)
	if errCat == nil {
		defer catRows.Close()
		for catRows.Next() {
			var c SearchResult
			var couleur string
			if err := catRows.Scan(&c.ID, &c.Nom, &c.Slug, &c.DescriptionCourte, &couleur); err != nil {
				continue
			}
			c.Type = "service"
			c.CategorieNom = c.Nom
			c.CategorieSlug = c.Slug
			c.DescriptionLongue = ""
			c.DescriptionHTML = ""
			c.Images = "[]"
			c.Prix = 0
			c.Devise = "EUR"
			c.Duree = ""
			c.Tag = ""
			c.Statut = "actif"
			c.TypeAchat = ""
			c.OrdreAffichage = 0
			results = append(results, c)
		}
	}

	return results, nil
}

type SearchResult struct {
	Type              string  `json:"type"`
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

func (r *CatalogRepo) CreateProduit(p *models.ProduitWeb, creatorID int) error {
	images := p.Images
	if images == "" {
		images = "[]"
	}
	return r.DB.QueryRow(`
		INSERT INTO produits (nom, slug, description_courte, description_longue, description_html,
		    images, prix, devise, duree, id_categorie, tag, statut, type_achat,
		    ordre_affichage, actif, id_utilisateur_creation)
		VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		RETURNING id_produit, date_creation, date_modification`,
		p.Nom, p.Slug, p.DescriptionCourte, p.DescriptionLongue, p.DescriptionHTML,
		images, p.Prix, p.Devise, p.Duree, p.IDCategorie, p.Tag, p.Statut,
		p.TypeAchat, p.OrdreAffichage, p.Actif, creatorID).Scan(&p.ID, &p.DateCreation, &p.DateModification)
}

func (r *CatalogRepo) UpdateProduit(p *models.ProduitWeb) error {
	images := p.Images
	if images == "" {
		images = "[]"
	}
	_, err := r.DB.Exec(`
		UPDATE produits SET nom=$1, slug=$2, description_courte=$3, description_longue=$4,
		    description_html=$5, images=$6::jsonb, prix=$7, devise=$8, duree=$9,
		    id_categorie=$10, tag=$11, statut=$12, type_achat=$13,
		    ordre_affichage=$14, actif=$15, date_modification=CURRENT_TIMESTAMP
		WHERE id_produit=$16`,
		p.Nom, p.Slug, p.DescriptionCourte, p.DescriptionLongue, p.DescriptionHTML,
		images, p.Prix, p.Devise, p.Duree, p.IDCategorie, p.Tag, p.Statut,
		p.TypeAchat, p.OrdreAffichage, p.Actif, p.ID)
	return err
}

func (r *CatalogRepo) DeleteProduit(id int) error {
	_, err := r.DB.Exec("DELETE FROM produits WHERE id_produit=$1", id)
	return err
}

func (r *CatalogRepo) FindAllTarifications() ([]models.Tarification, error) {
	rows, err := r.DB.Query(
		`SELECT id_tarification, COALESCE(prix,0), COALESCE(unite,''), COALESCE(periodicite,''), COALESCE(actif,false), id_produit FROM tarification`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	tarifs := []models.Tarification{}
	for rows.Next() {
		var t models.Tarification
		if err := rows.Scan(&t.ID, &t.Prix, &t.Unite, &t.Periodicite, &t.Actif, &t.IDProduit); err != nil {
			return nil, err
		}
		tarifs = append(tarifs, t)
	}
	return tarifs, nil
}

func (r *CatalogRepo) FindTarificationByID(id int) (models.Tarification, error) {
	var t models.Tarification
	err := r.DB.QueryRow(
		`SELECT id_tarification, COALESCE(prix,0), COALESCE(unite,''), COALESCE(periodicite,''), COALESCE(actif,false), id_produit FROM tarification WHERE id_tarification=$1`, id).Scan(
		&t.ID, &t.Prix, &t.Unite, &t.Periodicite, &t.Actif, &t.IDProduit)
	return t, err
}

func (r *CatalogRepo) CreateTarification(t *models.Tarification) error {
	return r.DB.QueryRow(
		"INSERT INTO tarification (prix, unite, periodicite, actif, id_produit) VALUES ($1,$2,$3,$4,$5) RETURNING id_tarification",
		t.Prix, t.Unite, t.Periodicite, t.Actif, t.IDProduit).Scan(&t.ID)
}

func (r *CatalogRepo) UpdateTarification(t *models.Tarification) error {
	_, err := r.DB.Exec(
		"UPDATE tarification SET prix=$1, unite=$2, periodicite=$3, actif=$4, id_produit=$5 WHERE id_tarification=$6",
		t.Prix, t.Unite, t.Periodicite, t.Actif, t.IDProduit, t.ID)
	return err
}

func (r *CatalogRepo) DeleteTarification(id int) error {
	_, err := r.DB.Exec("DELETE FROM tarification WHERE id_tarification=$1", id)
	return err
}

func (r *CatalogRepo) FindAllEntreprises() ([]models.Entreprise, error) {
	rows, err := r.DB.Query(
		`SELECT id_entreprise, nom, COALESCE(secteur,''), COALESCE(taille,''), COALESCE(pays,''), COALESCE(date_creation,NOW()) FROM entreprise`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	entreprises := []models.Entreprise{}
	for rows.Next() {
		var e models.Entreprise
		if err := rows.Scan(&e.ID, &e.Nom, &e.Secteur, &e.Taille, &e.Pays, &e.DateCreation); err != nil {
			return nil, err
		}
		entreprises = append(entreprises, e)
	}
	return entreprises, nil
}

func (r *CatalogRepo) FindEntrepriseByID(id int) (models.Entreprise, error) {
	var e models.Entreprise
	err := r.DB.QueryRow(
		`SELECT id_entreprise, nom, COALESCE(secteur,''), COALESCE(taille,''), COALESCE(pays,''), COALESCE(date_creation,NOW()) FROM entreprise WHERE id_entreprise=$1`, id).Scan(
		&e.ID, &e.Nom, &e.Secteur, &e.Taille, &e.Pays, &e.DateCreation)
	return e, err
}

func (r *CatalogRepo) CreateEntreprise(e *models.Entreprise) error {
	return r.DB.QueryRow(
		"INSERT INTO entreprise (nom, secteur, taille, pays) VALUES ($1,$2,$3,$4) RETURNING id_entreprise",
		e.Nom, e.Secteur, e.Taille, e.Pays).Scan(&e.ID)
}

func (r *CatalogRepo) UpdateEntreprise(e *models.Entreprise) error {
	_, err := r.DB.Exec(
		"UPDATE entreprise SET nom=$1, secteur=$2, taille=$3, pays=$4 WHERE id_entreprise=$5",
		e.Nom, e.Secteur, e.Taille, e.Pays, e.ID)
	return err
}

func (r *CatalogRepo) DeleteEntreprise(id int) error {
	_, err := r.DB.Exec("DELETE FROM entreprise WHERE id_entreprise=$1", id)
	return err
}

func scanProduits(rows *sql.Rows) ([]models.ProduitWeb, error) {
	produits := []models.ProduitWeb{}
	for rows.Next() {
		var p models.ProduitWeb
		var descHTML, catNom sql.NullString
		if err := rows.Scan(&p.ID, &p.Nom, &p.Slug, &p.DescriptionCourte, &p.DescriptionLongue,
			&descHTML, &p.Images, &p.Prix, &p.Devise, &p.Duree, &p.IDCategorie,
			&p.Tag, &p.Statut, &p.TypeAchat, &p.OrdreAffichage, &p.Actif,
			&p.DateCreation, &p.DateModification, &catNom); err != nil {
			return nil, err
		}
		if descHTML.Valid {
			p.DescriptionHTML = descHTML.String
		}
		produits = append(produits, p)
	}
	return produits, nil
}
