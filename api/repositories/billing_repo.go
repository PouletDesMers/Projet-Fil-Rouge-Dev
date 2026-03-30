package repositories

import (
	"database/sql"

	"api/models"
)

type BillingRepo struct {
	DB *sql.DB
}

func NewBillingRepo(db *sql.DB) *BillingRepo { return &BillingRepo{DB: db} }

func (r *BillingRepo) FindAllAbonnements() ([]models.Abonnement, error) {
	rows, err := r.DB.Query(
		"SELECT id_abonnement, date_debut, date_fin, quantite, statut, renouvellement_auto, id_entreprise, id_produit, id_tarification FROM abonnement")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []models.Abonnement{}
	for rows.Next() {
		var a models.Abonnement
		if err := rows.Scan(&a.ID, &a.DateDebut, &a.DateFin, &a.Quantite, &a.Statut,
			&a.RenouvellementAuto, &a.IDEntreprise, &a.IDProduit, &a.IDTarification); err != nil {
			return nil, err
		}
		items = append(items, a)
	}
	return items, nil
}

func (r *BillingRepo) FindAbonnementByID(id int) (models.Abonnement, error) {
	var a models.Abonnement
	err := r.DB.QueryRow(
		"SELECT id_abonnement, date_debut, date_fin, quantite, statut, renouvellement_auto, id_entreprise, id_produit, id_tarification FROM abonnement WHERE id_abonnement=$1",
		id).Scan(&a.ID, &a.DateDebut, &a.DateFin, &a.Quantite, &a.Statut,
		&a.RenouvellementAuto, &a.IDEntreprise, &a.IDProduit, &a.IDTarification)
	return a, err
}

func (r *BillingRepo) CreateAbonnement(a *models.Abonnement) error {
	return r.DB.QueryRow(
		"INSERT INTO abonnement (date_debut, date_fin, quantite, statut, renouvellement_auto, id_entreprise, id_produit, id_tarification) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id_abonnement",
		a.DateDebut, a.DateFin, a.Quantite, a.Statut, a.RenouvellementAuto, a.IDEntreprise, a.IDProduit, a.IDTarification,
	).Scan(&a.ID)
}

func (r *BillingRepo) UpdateAbonnement(a *models.Abonnement) error {
	_, err := r.DB.Exec(
		"UPDATE abonnement SET date_debut=$1, date_fin=$2, quantite=$3, statut=$4, renouvellement_auto=$5, id_entreprise=$6, id_produit=$7, id_tarification=$8 WHERE id_abonnement=$9",
		a.DateDebut, a.DateFin, a.Quantite, a.Statut, a.RenouvellementAuto, a.IDEntreprise, a.IDProduit, a.IDTarification, a.ID)
	return err
}

func (r *BillingRepo) DeleteAbonnement(id int) {
	r.DB.Exec("DELETE FROM abonnement WHERE id_abonnement=$1", id)
}

func (r *BillingRepo) FindAllCommandes() ([]models.Commande, error) {
	rows, err := r.DB.Query(
		"SELECT id_commande, date_commande, montant_total, statut, id_utilisateur, COALESCE(promo_code,'') FROM commande")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCommandes(rows)
}

func (r *BillingRepo) FindCommandesByUser(userID int) ([]models.Commande, error) {
	rows, err := r.DB.Query(
		"SELECT id_commande, date_commande, montant_total, statut, id_utilisateur, COALESCE(promo_code,'') FROM commande WHERE id_utilisateur=$1",
		userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCommandes(rows)
}

func (r *BillingRepo) FindCommandeByID(id int) (models.Commande, error) {
	var c models.Commande
	err := r.DB.QueryRow(
		"SELECT id_commande, date_commande, montant_total, statut, id_utilisateur, COALESCE(promo_code,'') FROM commande WHERE id_commande=$1",
		id).Scan(&c.ID, &c.DateCommande, &c.MontantTotal, &c.Statut, &c.IDUtilisateur, &c.PromoCode)
	return c, err
}

func (r *BillingRepo) CreateCommande(c *models.Commande) error {
	var promoCode *string
	if c.PromoCode != "" { pc := c.PromoCode; promoCode = &pc }
	return r.DB.QueryRow(
		"INSERT INTO commande (montant_total, statut, id_utilisateur, promo_code) VALUES ($1,$2,$3,$4) RETURNING id_commande",
		c.MontantTotal, c.Statut, c.IDUtilisateur, promoCode).Scan(&c.ID)
}

func (r *BillingRepo) UpdateCommande(c *models.Commande) error {
	_, err := r.DB.Exec(
		"UPDATE commande SET montant_total=$1, statut=$2 WHERE id_commande=$3",
		c.MontantTotal, c.Statut, c.ID)
	return err
}

func (r *BillingRepo) DeleteCommande(id int) {
	r.DB.Exec("DELETE FROM commande WHERE id_commande=$1", id)
}

func (r *BillingRepo) FindAllFactures() ([]models.Facture, error) {
	rows, err := r.DB.Query("SELECT id_facture, date_facture, montant, lien_pdf, id_commande FROM facture")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []models.Facture{}
	for rows.Next() {
		var f models.Facture
		rows.Scan(&f.ID, &f.DateFacture, &f.Montant, &f.LienPDF, &f.IDCommande)
		items = append(items, f)
	}
	return items, nil
}

func (r *BillingRepo) FindFactureByID(id int) (models.Facture, error) {
	var f models.Facture
	err := r.DB.QueryRow("SELECT id_facture, date_facture, montant, lien_pdf, id_commande FROM facture WHERE id_facture=$1", id).Scan(
		&f.ID, &f.DateFacture, &f.Montant, &f.LienPDF, &f.IDCommande)
	return f, err
}

func (r *BillingRepo) CreateFacture(f *models.Facture) error {
	return r.DB.QueryRow(
		"INSERT INTO facture (date_facture, montant, lien_pdf, id_commande) VALUES ($1,$2,$3,$4) RETURNING id_facture",
		f.DateFacture, f.Montant, f.LienPDF, f.IDCommande).Scan(&f.ID)
}

func (r *BillingRepo) UpdateFacture(f *models.Facture) {
	r.DB.Exec("UPDATE facture SET date_facture=$1, montant=$2, lien_pdf=$3, id_commande=$4 WHERE id_facture=$5",
		f.DateFacture, f.Montant, f.LienPDF, f.IDCommande, f.ID)
}

func (r *BillingRepo) DeleteFacture(id int) {
	r.DB.Exec("DELETE FROM facture WHERE id_facture=$1", id)
}

func (r *BillingRepo) FindAllPaiements() ([]models.Paiement, error) {
	rows, err := r.DB.Query("SELECT id_paiement, moyen, statut, date_paiement, reference_externe, id_commande FROM paiement")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []models.Paiement{}
	for rows.Next() {
		var p models.Paiement
		rows.Scan(&p.ID, &p.Moyen, &p.Statut, &p.DatePaiement, &p.ReferenceExterne, &p.IDCommande)
		items = append(items, p)
	}
	return items, nil
}

func (r *BillingRepo) FindPaiementByID(id int) (models.Paiement, error) {
	var p models.Paiement
	err := r.DB.QueryRow("SELECT id_paiement, moyen, statut, date_paiement, reference_externe, id_commande FROM paiement WHERE id_paiement=$1", id).Scan(
		&p.ID, &p.Moyen, &p.Statut, &p.DatePaiement, &p.ReferenceExterne, &p.IDCommande)
	return p, err
}

func (r *BillingRepo) CreatePaiement(p *models.Paiement) {
	r.DB.QueryRow("INSERT INTO paiement (moyen, statut, date_paiement, reference_externe, id_commande) VALUES ($1,$2,$3,$4,$5) RETURNING id_paiement",
		p.Moyen, p.Statut, p.DatePaiement, p.ReferenceExterne, p.IDCommande).Scan(&p.ID)
}

func (r *BillingRepo) UpdatePaiement(p *models.Paiement) {
	r.DB.Exec("UPDATE paiement SET moyen=$1, statut=$2, date_paiement=$3, reference_externe=$4, id_commande=$5 WHERE id_paiement=$6",
		p.Moyen, p.Statut, p.DatePaiement, p.ReferenceExterne, p.IDCommande, p.ID)
}

func (r *BillingRepo) DeletePaiement(id int) {
	r.DB.Exec("DELETE FROM paiement WHERE id_paiement=$1", id)
}

func scanCommandes(rows *sql.Rows) ([]models.Commande, error) {
	commandes := []models.Commande{}
	for rows.Next() {
		var c models.Commande
		if err := rows.Scan(&c.ID, &c.DateCommande, &c.MontantTotal, &c.Statut, &c.IDUtilisateur, &c.PromoCode); err != nil {
			return nil, err
		}
		commandes = append(commandes, c)
	}
	return commandes, nil
}
