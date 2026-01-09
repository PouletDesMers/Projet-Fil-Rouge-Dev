package main

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

func getAbonnements(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_abonnement, date_debut, date_fin, quantite, statut, renouvellement_auto, id_entreprise, id_produit, id_tarification FROM abonnement")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var abonnements []Abonnement
	for rows.Next() {
		var a Abonnement
		err := rows.Scan(&a.ID, &a.DateDebut, &a.DateFin, &a.Quantite, &a.Statut, &a.RenouvellementAuto, &a.IDEntreprise, &a.IDProduit, &a.IDTarification)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		abonnements = append(abonnements, a)
	}
	json.NewEncoder(w).Encode(abonnements)
}

func getAbonnement(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var a Abonnement
	err := db.QueryRow("SELECT id_abonnement, date_debut, date_fin, quantite, statut, renouvellement_auto, id_entreprise, id_produit, id_tarification FROM abonnement WHERE id_abonnement = $1", id).Scan(&a.ID, &a.DateDebut, &a.DateFin, &a.Quantite, &a.Statut, &a.RenouvellementAuto, &a.IDEntreprise, &a.IDProduit, &a.IDTarification)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(a)
}

func createAbonnement(w http.ResponseWriter, r *http.Request) {
	var a Abonnement
	json.NewDecoder(r.Body).Decode(&a)
	err := db.QueryRow("INSERT INTO abonnement (date_debut, date_fin, quantite, statut, renouvellement_auto, id_entreprise, id_produit, id_tarification) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_abonnement", a.DateDebut, a.DateFin, a.Quantite, a.Statut, a.RenouvellementAuto, a.IDEntreprise, a.IDProduit, a.IDTarification).Scan(&a.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(a)
}

func updateAbonnement(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var a Abonnement
	json.NewDecoder(r.Body).Decode(&a)
	_, err := db.Exec("UPDATE abonnement SET date_debut = $1, date_fin = $2, quantite = $3, statut = $4, renouvellement_auto = $5, id_entreprise = $6, id_produit = $7, id_tarification = $8 WHERE id_abonnement = $9", a.DateDebut, a.DateFin, a.Quantite, a.Statut, a.RenouvellementAuto, a.IDEntreprise, a.IDProduit, a.IDTarification, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	a.ID = id
	json.NewEncoder(w).Encode(a)
}

func deleteAbonnement(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	_, err := db.Exec("DELETE FROM abonnement WHERE id_abonnement = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func getCommandes(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_commande, date_commande, montant_total, statut, id_utilisateur FROM commande")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var commandes []Commande
	for rows.Next() {
		var c Commande
		err := rows.Scan(&c.ID, &c.DateCommande, &c.MontantTotal, &c.Statut, &c.IDUtilisateur)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		commandes = append(commandes, c)
	}
	json.NewEncoder(w).Encode(commandes)
}

func getCommande(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var c Commande
	err := db.QueryRow("SELECT id_commande, date_commande, montant_total, statut, id_utilisateur FROM commande WHERE id_commande = $1", id).Scan(&c.ID, &c.DateCommande, &c.MontantTotal, &c.Statut, &c.IDUtilisateur)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(c)
}

func createCommande(w http.ResponseWriter, r *http.Request) {
	var c Commande
	json.NewDecoder(r.Body).Decode(&c)
	err := db.QueryRow("INSERT INTO commande (montant_total, statut, id_utilisateur) VALUES ($1, $2, $3) RETURNING id_commande", c.MontantTotal, c.Statut, c.IDUtilisateur).Scan(&c.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(c)
}

func updateCommande(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var c Commande
	json.NewDecoder(r.Body).Decode(&c)
	_, err := db.Exec("UPDATE commande SET montant_total = $1, statut = $2, id_utilisateur = $3 WHERE id_commande = $4", c.MontantTotal, c.Statut, c.IDUtilisateur, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	c.ID = id
	json.NewEncoder(w).Encode(c)
}

func deleteCommande(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	_, err := db.Exec("DELETE FROM commande WHERE id_commande = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func getFactures(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_facture, date_facture, montant, lien_pdf, id_commande FROM facture")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var factures []Facture
	for rows.Next() {
		var f Facture
		err := rows.Scan(&f.ID, &f.DateFacture, &f.Montant, &f.LienPDF, &f.IDCommande)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		factures = append(factures, f)
	}
	json.NewEncoder(w).Encode(factures)
}

func getFacture(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var f Facture
	err := db.QueryRow("SELECT id_facture, date_facture, montant, lien_pdf, id_commande FROM facture WHERE id_facture = $1", id).Scan(&f.ID, &f.DateFacture, &f.Montant, &f.LienPDF, &f.IDCommande)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(f)
}

func createFacture(w http.ResponseWriter, r *http.Request) {
	var f Facture
	json.NewDecoder(r.Body).Decode(&f)
	err := db.QueryRow("INSERT INTO facture (date_facture, montant, lien_pdf, id_commande) VALUES ($1, $2, $3, $4) RETURNING id_facture", f.DateFacture, f.Montant, f.LienPDF, f.IDCommande).Scan(&f.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(f)
}

func updateFacture(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var f Facture
	json.NewDecoder(r.Body).Decode(&f)
	_, err := db.Exec("UPDATE facture SET date_facture = $1, montant = $2, lien_pdf = $3, id_commande = $4 WHERE id_facture = $5", f.DateFacture, f.Montant, f.LienPDF, f.IDCommande, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	f.ID = id
	json.NewEncoder(w).Encode(f)
}

func deleteFacture(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	_, err := db.Exec("DELETE FROM facture WHERE id_facture = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func getPaiements(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_paiement, moyen, statut, date_paiement, reference_externe, id_commande FROM paiement")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var paiements []Paiement
	for rows.Next() {
		var p Paiement
		err := rows.Scan(&p.ID, &p.Moyen, &p.Statut, &p.DatePaiement, &p.ReferenceExterne, &p.IDCommande)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		paiements = append(paiements, p)
	}
	json.NewEncoder(w).Encode(paiements)
}

func getPaiement(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var p Paiement
	err := db.QueryRow("SELECT id_paiement, moyen, statut, date_paiement, reference_externe, id_commande FROM paiement WHERE id_paiement = $1", id).Scan(&p.ID, &p.Moyen, &p.Statut, &p.DatePaiement, &p.ReferenceExterne, &p.IDCommande)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(p)
}

func createPaiement(w http.ResponseWriter, r *http.Request) {
	var p Paiement
	json.NewDecoder(r.Body).Decode(&p)
	err := db.QueryRow("INSERT INTO paiement (moyen, statut, date_paiement, reference_externe, id_commande) VALUES ($1, $2, $3, $4, $5) RETURNING id_paiement", p.Moyen, p.Statut, p.DatePaiement, p.ReferenceExterne, p.IDCommande).Scan(&p.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(p)
}

func updatePaiement(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var p Paiement
	json.NewDecoder(r.Body).Decode(&p)
	_, err := db.Exec("UPDATE paiement SET moyen = $1, statut = $2, date_paiement = $3, reference_externe = $4, id_commande = $5 WHERE id_paiement = $6", p.Moyen, p.Statut, p.DatePaiement, p.ReferenceExterne, p.IDCommande, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	p.ID = id
	json.NewEncoder(w).Encode(p)
}

func deletePaiement(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	_, err := db.Exec("DELETE FROM paiement WHERE id_paiement = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}