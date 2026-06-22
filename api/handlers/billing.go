package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"

	"api/config"
	"api/models"
)

// ===== ABONNEMENTS =====

type AbonnementAdmin struct {
	ID                 int        `json:"id"`
	DateDebut          time.Time  `json:"startDate"`
	DateFin            *time.Time `json:"endDate"`
	Quantite           *int       `json:"quantity"`
	Statut             string     `json:"status"`
	RenouvellementAuto bool       `json:"autoRenewal"`
	IDEntreprise       int        `json:"companyId"`
	IDProduit          int        `json:"productId"`
	IDTarification     int        `json:"pricingId"`
	NomEntreprise      string     `json:"companyName"`
	NomProduit         string     `json:"productName"`
	Prix               *float64   `json:"price"`
	Periodicite        *string    `json:"periodicity"`
}

func GetAbonnements(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(`
		SELECT a.id_abonnement, a.date_debut, a.date_fin, a.quantite, a.statut,
		       a.renouvellement_auto, a.id_entreprise, a.id_produit, a.id_tarification,
		       COALESCE(e.nom, ''), COALESCE(p.nom, ''), t.prix, t.periodicite
		FROM abonnement a
		LEFT JOIN entreprise e ON e.id_entreprise = a.id_entreprise
		LEFT JOIN produit p ON p.id_produit = a.id_produit
		LEFT JOIN tarification t ON t.id_tarification = a.id_tarification
		ORDER BY a.date_debut DESC
	`)
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	items := []AbonnementAdmin{}
	for rows.Next() {
		var a AbonnementAdmin
		if err := rows.Scan(&a.ID, &a.DateDebut, &a.DateFin, &a.Quantite, &a.Statut,
			&a.RenouvellementAuto, &a.IDEntreprise, &a.IDProduit, &a.IDTarification,
			&a.NomEntreprise, &a.NomProduit, &a.Prix, &a.Periodicite); err != nil {
			continue
		}
		items = append(items, a)
	}
	if items == nil {
		items = []AbonnementAdmin{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// GetMesAbonnements returns subscriptions for the authenticated user's company
func GetMesAbonnements(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var companyID int
	err := config.DB.QueryRow("SELECT COALESCE(id_entreprise, 0) FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&companyID)
	if err != nil || companyID == 0 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]AbonnementAdmin{})
		return
	}
	rows, err := config.DB.Query(`
		SELECT a.id_abonnement, a.date_debut, a.date_fin, a.quantite, a.statut,
		       a.renouvellement_auto, a.id_entreprise, a.id_produit, a.id_tarification,
		       COALESCE(e.nom, ''), COALESCE(p.nom, ''), t.prix, t.periodicite
		FROM abonnement a
		LEFT JOIN entreprise e ON e.id_entreprise = a.id_entreprise
		LEFT JOIN produit p ON p.id_produit = a.id_produit
		LEFT JOIN tarification t ON t.id_tarification = a.id_tarification
		WHERE a.id_entreprise = $1
		ORDER BY a.date_debut DESC
	`, companyID)
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	items := []AbonnementAdmin{}
	for rows.Next() {
		var a AbonnementAdmin
		if err := rows.Scan(&a.ID, &a.DateDebut, &a.DateFin, &a.Quantite, &a.Statut,
			&a.RenouvellementAuto, &a.IDEntreprise, &a.IDProduit, &a.IDTarification,
			&a.NomEntreprise, &a.NomProduit, &a.Prix, &a.Periodicite); err != nil {
			continue
		}
		items = append(items, a)
	}
	if items == nil {
		items = []AbonnementAdmin{}
	}
	w.Header().Set("Content-Type", "application/json")
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

// CancelAbonnement sets status to "resilie" (client self-service)
func CancelAbonnement(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	userID, ok := getUserID(r)
	if !ok {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	// Verify this subscription belongs to the user's company
	var companyID int
	config.DB.QueryRow("SELECT COALESCE(id_entreprise, 0) FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&companyID)
	if companyID == 0 {
		jsonErr(w, "No company associated", http.StatusForbidden)
		return
	}
	res, err := config.DB.Exec("UPDATE abonnement SET statut = 'resilie', renouvellement_auto = FALSE WHERE id_abonnement = $1 AND id_entreprise = $2", id, companyID)
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		jsonErr(w, "Abonnement introuvable ou non autorisé", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Abonnement résilié"})
}


// CreateAbonnementFromPurchase creates an abonnement from product slug + userId (called after Stripe payment)
func CreateAbonnementFromPurchase(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProductSlug string `json:"product_slug"`
		UserID      int    `json:"user_id"`
		Quantity    int    `json:"quantity"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ProductSlug == "" || req.UserID == 0 {
		jsonErr(w, "product_slug and user_id required", http.StatusBadRequest)
		return
	}
	if req.Quantity < 1 {
		req.Quantity = 1
	}

	// Look up product by slug (try both tables)
	var productID int
	err := config.DB.QueryRow("SELECT id_produit FROM produit WHERE slug = $1 UNION SELECT id_produit FROM produits WHERE slug = $1 LIMIT 1", req.ProductSlug).Scan(&productID)
	if err != nil {
		jsonErr(w, "Produit introuvable", http.StatusNotFound)
		return
	}

	// Find active tarification
	var tarifID int
	err = config.DB.QueryRow("SELECT id_tarification FROM tarification WHERE id_produit = $1 AND actif = TRUE LIMIT 1", productID).Scan(&tarifID)
	if err != nil {
		jsonErr(w, "Aucune tarification active", http.StatusNotFound)
		return
	}

	// Get or create company
	var companyID int
	config.DB.QueryRow("SELECT COALESCE(id_entreprise,0) FROM utilisateur WHERE id_utilisateur=$1", req.UserID).Scan(&companyID)
	if companyID == 0 {
		var name string
		config.DB.QueryRow("SELECT COALESCE(lastname, email, 'Client') FROM utilisateur WHERE id_utilisateur=$1", req.UserID).Scan(&name)
		config.DB.QueryRow("INSERT INTO entreprise (nom) VALUES ($1) RETURNING id_entreprise", name+" (Auto)").Scan(&companyID)
		config.DB.Exec("UPDATE utilisateur SET id_entreprise=$1 WHERE id_utilisateur=$2", companyID, req.UserID)
	}

	// Create abonnement (30 days from now)
	var subID int
	err = config.DB.QueryRow("INSERT INTO abonnement (date_debut,date_fin,quantite,statut,renouvellement_auto,id_entreprise,id_produit,id_tarification) VALUES (CURRENT_DATE,CURRENT_DATE+30,$1,'actif',TRUE,$2,$3,$4) RETURNING id_abonnement",
		req.Quantity, companyID, productID, tarifID).Scan(&subID)
	if err != nil {
		log.Printf("CreateAbonnementFromPurchase error: %v", err)
		jsonErr(w, "Erreur creation abonnement", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": subID, "company_id": companyID, "message": "Abonnement cree"})
}

// ===== STATS =====

func GetTopProductsLast3Months(w http.ResponseWriter, r *http.Request) {
	cutoff := time.Now().AddDate(0, -3, 0)

	rows, err := config.DB.Query(`
		WITH top AS (
			SELECT
				COALESCE(item->>'product_slug', item->>'productName', item->>'product_name', 'n/a') AS slug,
				COALESCE(item->>'product_name', item->>'productName', 'Produit')                    AS name,
				COUNT(*)                                                                           AS total_sales,
				SUM(COALESCE((item->>'quantity')::int, 1))                                         AS total_quantity,
				SUM(COALESCE((item->>'price')::numeric, 0) * COALESCE((item->>'quantity')::int, 1)) AS total_amount
			FROM commande c
			CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.items, '[]'::jsonb)) AS item
			WHERE c.date_commande >= $1 AND (c.statut = 'confirmee' OR c.statut = 'paye')
			GROUP BY slug, name
		)
		SELECT
			t.slug,
			t.name,
			t.total_sales,
			t.total_quantity,
			t.total_amount,
			COALESCE(p.images::text, '[]') AS images,
			p.prix,
			COALESCE(p.devise, 'EUR') AS devise,
			COALESCE(p.duree, '')     AS duree,
			COALESCE(p.tag, '')       AS tag
		FROM top t
		LEFT JOIN produits p ON p.slug = t.slug
		ORDER BY t.total_quantity DESC, t.total_amount DESC, t.name ASC
		LIMIT 3`, cutoff)
	if err != nil {
		log.Printf("top products query error: %v", err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []models.TopProductSales{}
	for rows.Next() {
		var item models.TopProductSales
		var slug string
		var images sql.NullString
		var devise sql.NullString
		var duree sql.NullString
		var tag sql.NullString
		var prix sql.NullFloat64
		if err := rows.Scan(&slug, &item.Nom, &item.TotalSales, &item.TotalQuantity, &item.TotalAmount, &images, &prix, &devise, &duree, &tag); err != nil {
			log.Printf("scan top products error: %v", err)
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		item.ID = 0
		item.Slug = slug
		if images.Valid {
			item.Images = images.String
		}
		if prix.Valid {
			val := prix.Float64
			item.Prix = &val
		}
		if devise.Valid {
			item.Devise = devise.String
		}
		if duree.Valid {
			item.Duree = duree.String
		}
		if tag.Valid {
			item.Tag = tag.String
		}
		items = append(items, item)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"from":         cutoff.Format(time.RFC3339),
		"top_products": items,
	})
}

// ===== COMMANDES =====

func GetCommandes(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	role, _ := r.Context().Value(models.UserRoleKey).(string)

	// Pagination
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}
	offset := (page - 1) * limit

	// Compter le total
	var total int
	if role == "admin" {
		config.DB.QueryRow("SELECT COUNT(*) FROM commande").Scan(&total)
	} else {
		config.DB.QueryRow("SELECT COUNT(*) FROM commande WHERE id_utilisateur = $1", userID).Scan(&total)
	}

	var rows *sql.Rows
	var err error
	if role == "admin" {
		rows, err = config.DB.Query("SELECT id_commande, date_commande, montant_total, statut, id_utilisateur, COALESCE(promo_code, ''), COALESCE(items, '[]'::jsonb) FROM commande ORDER BY id_commande DESC LIMIT $1 OFFSET $2", limit, offset)
	} else {
		rows, err = config.DB.Query("SELECT id_commande, date_commande, montant_total, statut, id_utilisateur, COALESCE(promo_code, ''), COALESCE(items, '[]'::jsonb) FROM commande WHERE id_utilisateur = $1 ORDER BY id_commande DESC LIMIT $2 OFFSET $3", userID, limit, offset)
	}
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	commandes := []models.Commande{}
	for rows.Next() {
		var c models.Commande
		var itemsData []byte
		if err := rows.Scan(&c.ID, &c.DateCommande, &c.MontantTotal, &c.Statut, &c.IDUtilisateur, &c.PromoCode, &itemsData); err != nil {
			log.Printf("Error scanning commande: %v", err)
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		if len(itemsData) == 0 {
			itemsData = []byte("[]")
		}
		json.Unmarshal(itemsData, &c.Items)
		commandes = append(commandes, c)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"commandes": commandes, "total": total, "page": page, "limit": limit})
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
	var itemsData []byte
	if err := config.DB.QueryRow("SELECT id_commande, date_commande, montant_total, statut, id_utilisateur, COALESCE(promo_code,''), COALESCE(items, '[]'::jsonb) FROM commande WHERE id_commande = $1", id).Scan(
		&c.ID, &c.DateCommande, &c.MontantTotal, &c.Statut, &c.IDUtilisateur, &c.PromoCode, &itemsData); err != nil {
		jsonErr(w, "Order not found", http.StatusNotFound)
		return
	}
	if len(itemsData) == 0 {
		itemsData = []byte("[]")
	}
	json.Unmarshal(itemsData, &c.Items)
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

	itemsJSON, _ := json.Marshal(c.Items)

	var promoCode *string
	if c.PromoCode != "" {
		pc := c.PromoCode
		promoCode = &pc
	}
	if err := config.DB.QueryRow("INSERT INTO commande (montant_total, statut, id_utilisateur, promo_code, items) VALUES ($1,$2,$3,$4,$5) RETURNING id_commande",
		c.MontantTotal, c.Statut, c.IDUtilisateur, promoCode, itemsJSON).Scan(&c.ID); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
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
	rows, err := config.DB.Query("SELECT id_facture, date_facture, montant, lien_pdf, id_commande FROM facture")
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
	rows, err := config.DB.Query("SELECT id_paiement, moyen, statut, date_paiement, reference_externe, id_commande FROM paiement")
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
