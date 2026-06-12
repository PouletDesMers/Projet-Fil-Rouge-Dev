package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"

	"api/config"
	"api/models"
)

// ===== ABONNEMENTS =====

func GetAbonnements(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var role string
	config.DB.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&role)

	w.Header().Set("Content-Type", "application/json")

	if role == "admin" {
		const q = "SELECT id_abonnement, date_debut, date_fin, quantite, statut, renouvellement_auto, id_entreprise, id_produit, id_tarification FROM abonnement"
		rows, err := config.DB.Query(q)
		if err != nil {
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		items := []models.Abonnement{}
		for rows.Next() {
			var a models.Abonnement
			rows.Scan(&a.ID, &a.DateDebut, &a.DateFin, &a.Quantite, &a.Statut, &a.RenouvellementAuto, &a.IDEntreprise, &a.IDProduit, &a.IDTarification)
			items = append(items, a)
		}
		json.NewEncoder(w).Encode(items)
		return
	}

	// Utilisateur normal : vérifier s'il a une entreprise
	var entrepriseID sql.NullInt64
	config.DB.QueryRow("SELECT id_entreprise FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&entrepriseID)

	if entrepriseID.Valid {
		// Abonnements via entreprise
		rows, err := config.DB.Query("SELECT id_abonnement, date_debut, date_fin, quantite, statut, renouvellement_auto, id_entreprise, id_produit, id_tarification FROM abonnement WHERE id_entreprise = $1", entrepriseID.Int64)
		if err != nil {
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		items := []models.Abonnement{}
		for rows.Next() {
			var a models.Abonnement
			rows.Scan(&a.ID, &a.DateDebut, &a.DateFin, &a.Quantite, &a.Statut, &a.RenouvellementAuto, &a.IDEntreprise, &a.IDProduit, &a.IDTarification)
			items = append(items, a)
		}
		json.NewEncoder(w).Encode(items)
		return
	}

	// Pas d'entreprise : retourner les commandes confirmées comme abonnements
	rows, err := config.DB.Query(
		"SELECT id_commande, date_commande, montant_total, statut FROM commande WHERE id_utilisateur = $1 AND statut = 'confirmed' ORDER BY date_commande DESC",
		userID,
	)
	if err != nil {
		json.NewEncoder(w).Encode([]models.Abonnement{})
		return
	}
	defer rows.Close()

	type AbonnementDTO struct {
		ID        int     `json:"id"`
		StartDate string  `json:"startDate"`
		EndDate   *string `json:"endDate"`
		Status    string  `json:"status"`
		AutoRenewal bool  `json:"autoRenewal"`
		Quantity  int     `json:"quantity"`
	}

	items := []AbonnementDTO{}
	for rows.Next() {
		var id int
		var dateCommande string
		var montant float64
		var statut string
		if err := rows.Scan(&id, &dateCommande, &montant, &statut); err != nil {
			continue
		}
		items = append(items, AbonnementDTO{
			ID:          id,
			StartDate:   dateCommande,
			EndDate:     nil,
			Status:      "active",
			AutoRenewal: false,
			Quantity:    1,
		})
	}
	json.NewEncoder(w).Encode(items)
}

func GetAbonnement(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var a models.Abonnement
	if err := config.DB.QueryRow("SELECT id_abonnement, date_debut, date_fin, quantite, statut, renouvellement_auto, id_entreprise, id_produit, id_tarification FROM abonnement WHERE id_abonnement = $1", id).Scan(
		&a.ID, &a.DateDebut, &a.DateFin, &a.Quantite, &a.Statut, &a.RenouvellementAuto, &a.IDEntreprise, &a.IDProduit, &a.IDTarification); err != nil {
		jsonErr(w, "Subscription not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(a)
}

func CreateAbonnement(w http.ResponseWriter, r *http.Request) {
	var a models.Abonnement
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if err := config.DB.QueryRow("INSERT INTO abonnement (date_debut, date_fin, quantite, statut, renouvellement_auto, id_entreprise, id_produit, id_tarification) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id_abonnement",
		a.DateDebut, a.DateFin, a.Quantite, a.Statut, a.RenouvellementAuto, a.IDEntreprise, a.IDProduit, a.IDTarification).Scan(&a.ID); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(a)
}

func UpdateAbonnement(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var a models.Abonnement
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if _, err := config.DB.Exec("UPDATE abonnement SET date_debut=$1, date_fin=$2, quantite=$3, statut=$4, renouvellement_auto=$5, id_entreprise=$6, id_produit=$7, id_tarification=$8 WHERE id_abonnement=$9",
		a.DateDebut, a.DateFin, a.Quantite, a.Statut, a.RenouvellementAuto, a.IDEntreprise, a.IDProduit, a.IDTarification, id); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	a.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(a)
}

func DeleteAbonnement(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	config.DB.Exec("DELETE FROM abonnement WHERE id_abonnement = $1", id)
	w.WriteHeader(http.StatusNoContent)
}

// ===== STATS =====

func GetTopProductsLast3Months(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(`
		SELECT p.id_produit, p.nom, p.slug,
		       COALESCE(p.description_courte,''), COALESCE(p.description_longue,''),
		       COALESCE(p.description_html,''), COALESCE(p.images::text,'[]'),
		       COALESCE(p.prix,0), COALESCE(p.devise,'EUR'), COALESCE(p.duree,'mois'),
		       COALESCE(p.tag,''), COALESCE(p.statut,'Disponible'), COALESCE(p.type_achat,'panier'),
		       COALESCE(p.ordre_affichage,0), p.id_categorie,
		       COALESCE(c.nom,''), COALESCE(c.slug,'')
		FROM produits p
		LEFT JOIN categories c ON c.id_categorie = p.id_categorie
		WHERE p.actif = TRUE
		ORDER BY p.ordre_affichage DESC, p.id_produit ASC
		LIMIT 8`)
	if err != nil {
		log.Printf("top products query error: %v", err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []models.ProduitWeb{}
	for rows.Next() {
		var p models.ProduitWeb
		var descHTML sql.NullString
		var catID sql.NullInt64
		var catNom, catSlug string
		var prix float64
		if err := rows.Scan(&p.ID, &p.Nom, &p.Slug, &p.DescriptionCourte, &p.DescriptionLongue,
			&descHTML, &p.Images, &prix, &p.Devise, &p.Duree, &p.Tag, &p.Statut,
			&p.TypeAchat, &p.OrdreAffichage, &catID, &catNom, &catSlug); err != nil {
			log.Printf("scan top products error: %v", err)
			continue
		}
		p.Prix = &prix
		if descHTML.Valid {
			p.DescriptionHTML = descHTML.String
		}
		p.Actif = true
		if catID.Valid {
			p.IDCategorie = int(catID.Int64)
		}
		_ = catNom
		_ = catSlug
		items = append(items, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// ===== COMMANDES =====

func GetCommandes(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var role string
	config.DB.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&role)

	var rows *sql.Rows
	var err error
	if role == "admin" {
		rows, err = config.DB.Query("SELECT id_commande, date_commande, montant_total, statut, id_utilisateur, COALESCE(promo_code, '') FROM commande")
	} else {
		rows, err = config.DB.Query("SELECT id_commande, date_commande, montant_total, statut, id_utilisateur, COALESCE(promo_code, '') FROM commande WHERE id_utilisateur = $1", userID)
	}
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	commandes := []models.Commande{}
	for rows.Next() {
		var c models.Commande
		if err := rows.Scan(&c.ID, &c.DateCommande, &c.MontantTotal, &c.Statut, &c.IDUtilisateur, &c.PromoCode); err != nil {
			log.Printf("Error scanning commande: %v", err)
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		c.Items = []models.OrderItem{}
		commandes = append(commandes, c)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(commandes)
}

func GetCommande(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	userID, _ := getUserID(r)
	var role string
	config.DB.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&role)

	var c models.Commande
	if err := config.DB.QueryRow("SELECT id_commande, date_commande, montant_total, statut, id_utilisateur, COALESCE(promo_code,'') FROM commande WHERE id_commande = $1", id).Scan(
		&c.ID, &c.DateCommande, &c.MontantTotal, &c.Statut, &c.IDUtilisateur, &c.PromoCode); err != nil {
		jsonErr(w, "Order not found", http.StatusNotFound)
		return
	}
	c.Items = []models.OrderItem{}
	if role != "admin" && c.IDUtilisateur != userID {
		jsonErr(w, "Forbidden", http.StatusForbidden)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c)
}

func CreateCommande(w http.ResponseWriter, r *http.Request) {
	var c models.Commande
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	userID, _ := getUserID(r)
	c.IDUtilisateur = userID

	var promoCode *string
	if c.PromoCode != "" {
		pc := c.PromoCode
		promoCode = &pc
	}
	if err := config.DB.QueryRow("INSERT INTO commande (montant_total, statut, id_utilisateur, promo_code) VALUES ($1,$2,$3,$4) RETURNING id_commande",
		c.MontantTotal, c.Statut, c.IDUtilisateur, promoCode).Scan(&c.ID); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	c.Items = []models.OrderItem{}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

func UpdateCommande(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var c models.Commande
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if _, err := config.DB.Exec("UPDATE commande SET montant_total=$1, statut=$2 WHERE id_commande=$3", c.MontantTotal, c.Statut, id); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	c.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c)
}

func DeleteCommande(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	config.DB.Exec("DELETE FROM commande WHERE id_commande = $1", id)
	w.WriteHeader(http.StatusNoContent)
}

// ===== FACTURES =====

func GetFactures(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var role string
	config.DB.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&role)

	var rows *sql.Rows
	var err error
	if role == "admin" {
		rows, err = config.DB.Query("SELECT id_facture, date_facture, montant, lien_pdf, id_commande FROM facture")
	} else {
		rows, err = config.DB.Query(`
			SELECT f.id_facture, f.date_facture, f.montant, f.lien_pdf, f.id_commande
			FROM facture f
			JOIN commande c ON f.id_commande = c.id_commande
			WHERE c.id_utilisateur = $1`, userID)
	}
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	items := []models.Facture{}
	for rows.Next() {
		var f models.Facture
		rows.Scan(&f.ID, &f.DateFacture, &f.Montant, &f.LienPDF, &f.IDCommande)
		items = append(items, f)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func GetFacture(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var f models.Facture
	if err := config.DB.QueryRow("SELECT id_facture, date_facture, montant, lien_pdf, id_commande FROM facture WHERE id_facture = $1", id).Scan(
		&f.ID, &f.DateFacture, &f.Montant, &f.LienPDF, &f.IDCommande); err != nil {
		jsonErr(w, "Invoice not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(f)
}

func CreateFacture(w http.ResponseWriter, r *http.Request) {
	var f models.Facture
	if err := json.NewDecoder(r.Body).Decode(&f); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	config.DB.QueryRow("INSERT INTO facture (date_facture, montant, lien_pdf, id_commande) VALUES ($1,$2,$3,$4) RETURNING id_facture",
		f.DateFacture, f.Montant, f.LienPDF, f.IDCommande).Scan(&f.ID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(f)
}

func UpdateFacture(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var f models.Facture
	json.NewDecoder(r.Body).Decode(&f)
	config.DB.Exec("UPDATE facture SET date_facture=$1, montant=$2, lien_pdf=$3, id_commande=$4 WHERE id_facture=$5",
		f.DateFacture, f.Montant, f.LienPDF, f.IDCommande, id)
	f.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(f)
}

func DeleteFacture(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	config.DB.Exec("DELETE FROM facture WHERE id_facture = $1", id)
	w.WriteHeader(http.StatusNoContent)
}

// ===== PAIEMENTS =====

func GetPaiements(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var role string
	config.DB.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&role)

	var rows *sql.Rows
	var err error
	if role == "admin" {
		rows, err = config.DB.Query("SELECT id_paiement, moyen, statut, date_paiement, reference_externe, id_commande FROM paiement")
	} else {
		rows, err = config.DB.Query(`
			SELECT p.id_paiement, p.moyen, p.statut, p.date_paiement, p.reference_externe, p.id_commande
			FROM paiement p
			JOIN commande c ON p.id_commande = c.id_commande
			WHERE c.id_utilisateur = $1`, userID)
	}
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	items := []models.Paiement{}
	for rows.Next() {
		var p models.Paiement
		rows.Scan(&p.ID, &p.Moyen, &p.Statut, &p.DatePaiement, &p.ReferenceExterne, &p.IDCommande)
		items = append(items, p)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func GetPaiement(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var p models.Paiement
	if err := config.DB.QueryRow("SELECT id_paiement, moyen, statut, date_paiement, reference_externe, id_commande FROM paiement WHERE id_paiement = $1", id).Scan(
		&p.ID, &p.Moyen, &p.Statut, &p.DatePaiement, &p.ReferenceExterne, &p.IDCommande); err != nil {
		jsonErr(w, "Payment not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func CreatePaiement(w http.ResponseWriter, r *http.Request) {
	var p models.Paiement
	json.NewDecoder(r.Body).Decode(&p)
	config.DB.QueryRow("INSERT INTO paiement (moyen, statut, date_paiement, reference_externe, id_commande) VALUES ($1,$2,$3,$4,$5) RETURNING id_paiement",
		p.Moyen, p.Statut, p.DatePaiement, p.ReferenceExterne, p.IDCommande).Scan(&p.ID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(p)
}

func UpdatePaiement(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	var p models.Paiement
	json.NewDecoder(r.Body).Decode(&p)
	config.DB.Exec("UPDATE paiement SET moyen=$1, statut=$2, date_paiement=$3, reference_externe=$4, id_commande=$5 WHERE id_paiement=$6",
		p.Moyen, p.Statut, p.DatePaiement, p.ReferenceExterne, p.IDCommande, id)
	p.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func DeletePaiement(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	config.DB.Exec("DELETE FROM paiement WHERE id_paiement = $1", id)
	w.WriteHeader(http.StatusNoContent)
}
