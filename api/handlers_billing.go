package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

func getAbonnements(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_abonnement, date_debut, date_fin, quantite, statut, renouvellement_auto, id_entreprise, id_produit, id_tarification FROM abonnement")
	if err != nil {
		log.Printf("Error fetching abonnements: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var abonnements []Abonnement
	for rows.Next() {
		var a Abonnement
		err := rows.Scan(&a.ID, &a.DateDebut, &a.DateFin, &a.Quantite, &a.Statut, &a.RenouvellementAuto, &a.IDEntreprise, &a.IDProduit, &a.IDTarification)
		if err != nil {
			log.Printf("Error scanning abonnement: %v", err)
			jsonError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		abonnements = append(abonnements, a)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(abonnements)
}

func getAbonnement(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var a Abonnement
	err = db.QueryRow("SELECT id_abonnement, date_debut, date_fin, quantite, statut, renouvellement_auto, id_entreprise, id_produit, id_tarification FROM abonnement WHERE id_abonnement = $1", id).Scan(&a.ID, &a.DateDebut, &a.DateFin, &a.Quantite, &a.Statut, &a.RenouvellementAuto, &a.IDEntreprise, &a.IDProduit, &a.IDTarification)
	if err != nil {
		jsonError(w, "Subscription not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(a)
}

func createAbonnement(w http.ResponseWriter, r *http.Request) {
	var a Abonnement
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	err := db.QueryRow("INSERT INTO abonnement (date_debut, date_fin, quantite, statut, renouvellement_auto, id_entreprise, id_produit, id_tarification) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_abonnement", a.DateDebut, a.DateFin, a.Quantite, a.Statut, a.RenouvellementAuto, a.IDEntreprise, a.IDProduit, a.IDTarification).Scan(&a.ID)
	if err != nil {
		log.Printf("Error creating abonnement: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(a)
}

func updateAbonnement(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var a Abonnement
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	_, err = db.Exec("UPDATE abonnement SET date_debut = $1, date_fin = $2, quantite = $3, statut = $4, renouvellement_auto = $5, id_entreprise = $6, id_produit = $7, id_tarification = $8 WHERE id_abonnement = $9", a.DateDebut, a.DateFin, a.Quantite, a.Statut, a.RenouvellementAuto, a.IDEntreprise, a.IDProduit, a.IDTarification, id)
	if err != nil {
		log.Printf("Error updating abonnement %d: %v", id, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	a.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(a)
}

func deleteAbonnement(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	_, err = db.Exec("DELETE FROM abonnement WHERE id_abonnement = $1", id)
	if err != nil {
		log.Printf("Error deleting abonnement %d: %v", id, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func getCommandes(w http.ResponseWriter, r *http.Request) {
	// Filtrer les commandes par utilisateur connecté (sauf admin)
	userID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		jsonError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var role string
	db.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&role)

	var rows *sql.Rows
	var err error
	if role == "admin" {
		rows, err = db.Query("SELECT id_commande, date_commande, montant_total, statut, id_utilisateur, COALESCE(promo_code, '') FROM commande")
	} else {
		rows, err = db.Query("SELECT id_commande, date_commande, montant_total, statut, id_utilisateur, COALESCE(promo_code, '') FROM commande WHERE id_utilisateur = $1", userID)
	}
	if err != nil {
		log.Printf("Error fetching commandes: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var commandes []Commande
	for rows.Next() {
		var c Commande
		err := rows.Scan(&c.ID, &c.DateCommande, &c.MontantTotal, &c.Statut, &c.IDUtilisateur, &c.PromoCode)
		if err != nil {
			log.Printf("Error scanning commande: %v", err)
			jsonError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		commandes = append(commandes, c)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(commandes)
}

func getCommande(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	// Vérifier que l'utilisateur a accès à cette commande
	userID, _ := r.Context().Value(UserIDKey).(int)
	var role string
	db.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&role)

	var c Commande
	err = db.QueryRow("SELECT id_commande, date_commande, montant_total, statut, id_utilisateur, COALESCE(promo_code, '') FROM commande WHERE id_commande = $1", id).Scan(&c.ID, &c.DateCommande, &c.MontantTotal, &c.Statut, &c.IDUtilisateur, &c.PromoCode)
	if err != nil {
		jsonError(w, "Order not found", http.StatusNotFound)
		return
	}

	// IDOR protection: un utilisateur non-admin ne peut voir que ses commandes
	if role != "admin" && c.IDUtilisateur != userID {
		jsonError(w, "Forbidden", http.StatusForbidden)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c)
}

func createCommande(w http.ResponseWriter, r *http.Request) {
	var c Commande
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Forcer l'ID utilisateur connecté (pas d'usurpation)
	userID, _ := r.Context().Value(UserIDKey).(int)
	c.IDUtilisateur = userID

	var promoCode *string
	if c.PromoCode != "" {
		pc := sanitizeString(c.PromoCode)
		promoCode = &pc
	}
	err := db.QueryRow("INSERT INTO commande (montant_total, statut, id_utilisateur, promo_code) VALUES ($1, $2, $3, $4) RETURNING id_commande", c.MontantTotal, c.Statut, c.IDUtilisateur, promoCode).Scan(&c.ID)
	if err != nil {
		log.Printf("Error creating commande: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

func updateCommande(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var c Commande
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if c.PromoCode != "" && c.IDUtilisateur > 0 {
		_, err = db.Exec("UPDATE commande SET montant_total = $1, statut = $2, id_utilisateur = $3, promo_code = $4 WHERE id_commande = $5", c.MontantTotal, c.Statut, c.IDUtilisateur, c.PromoCode, id)
	} else if c.PromoCode != "" {
		_, err = db.Exec("UPDATE commande SET montant_total = $1, statut = $2, promo_code = $3 WHERE id_commande = $4", c.MontantTotal, c.Statut, c.PromoCode, id)
	} else if c.IDUtilisateur > 0 {
		_, err = db.Exec("UPDATE commande SET montant_total = $1, statut = $2, id_utilisateur = $3 WHERE id_commande = $4", c.MontantTotal, c.Statut, c.IDUtilisateur, id)
	} else {
		_, err = db.Exec("UPDATE commande SET montant_total = $1, statut = $2 WHERE id_commande = $3", c.MontantTotal, c.Statut, id)
	}
	if err != nil {
		log.Printf("Error updating commande %d: %v", id, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	c.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c)
}

func deleteCommande(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	_, err = db.Exec("DELETE FROM commande WHERE id_commande = $1", id)
	if err != nil {
		log.Printf("Error deleting commande %d: %v", id, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func getFactures(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_facture, date_facture, montant, lien_pdf, id_commande FROM facture")
	if err != nil {
		log.Printf("Error fetching factures: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var factures []Facture
	for rows.Next() {
		var f Facture
		err := rows.Scan(&f.ID, &f.DateFacture, &f.Montant, &f.LienPDF, &f.IDCommande)
		if err != nil {
			log.Printf("Error scanning facture: %v", err)
			jsonError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		factures = append(factures, f)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(factures)
}

func getFacture(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var f Facture
	err = db.QueryRow("SELECT id_facture, date_facture, montant, lien_pdf, id_commande FROM facture WHERE id_facture = $1", id).Scan(&f.ID, &f.DateFacture, &f.Montant, &f.LienPDF, &f.IDCommande)
	if err != nil {
		jsonError(w, "Invoice not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(f)
}

func createFacture(w http.ResponseWriter, r *http.Request) {
	var f Facture
	if err := json.NewDecoder(r.Body).Decode(&f); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	err := db.QueryRow("INSERT INTO facture (date_facture, montant, lien_pdf, id_commande) VALUES ($1, $2, $3, $4) RETURNING id_facture", f.DateFacture, f.Montant, f.LienPDF, f.IDCommande).Scan(&f.ID)
	if err != nil {
		log.Printf("Error creating facture: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(f)
}

func updateFacture(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var f Facture
	if err := json.NewDecoder(r.Body).Decode(&f); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	_, err = db.Exec("UPDATE facture SET date_facture = $1, montant = $2, lien_pdf = $3, id_commande = $4 WHERE id_facture = $5", f.DateFacture, f.Montant, f.LienPDF, f.IDCommande, id)
	if err != nil {
		log.Printf("Error updating facture %d: %v", id, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	f.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(f)
}

func deleteFacture(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	_, err = db.Exec("DELETE FROM facture WHERE id_facture = $1", id)
	if err != nil {
		log.Printf("Error deleting facture %d: %v", id, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func getPaiements(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_paiement, moyen, statut, date_paiement, reference_externe, id_commande FROM paiement")
	if err != nil {
		log.Printf("Error fetching paiements: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var paiements []Paiement
	for rows.Next() {
		var p Paiement
		err := rows.Scan(&p.ID, &p.Moyen, &p.Statut, &p.DatePaiement, &p.ReferenceExterne, &p.IDCommande)
		if err != nil {
			log.Printf("Error scanning paiement: %v", err)
			jsonError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		paiements = append(paiements, p)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(paiements)
}

func getPaiement(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var p Paiement
	err = db.QueryRow("SELECT id_paiement, moyen, statut, date_paiement, reference_externe, id_commande FROM paiement WHERE id_paiement = $1", id).Scan(&p.ID, &p.Moyen, &p.Statut, &p.DatePaiement, &p.ReferenceExterne, &p.IDCommande)
	if err != nil {
		jsonError(w, "Payment not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func createPaiement(w http.ResponseWriter, r *http.Request) {
	var p Paiement
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	err := db.QueryRow("INSERT INTO paiement (moyen, statut, date_paiement, reference_externe, id_commande) VALUES ($1, $2, $3, $4, $5) RETURNING id_paiement", p.Moyen, p.Statut, p.DatePaiement, p.ReferenceExterne, p.IDCommande).Scan(&p.ID)
	if err != nil {
		log.Printf("Error creating paiement: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(p)
}

func updatePaiement(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var p Paiement
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	_, err = db.Exec("UPDATE paiement SET moyen = $1, statut = $2, date_paiement = $3, reference_externe = $4, id_commande = $5 WHERE id_paiement = $6", p.Moyen, p.Statut, p.DatePaiement, p.ReferenceExterne, p.IDCommande, id)
	if err != nil {
		log.Printf("Error updating paiement %d: %v", id, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	p.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func deletePaiement(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	_, err = db.Exec("DELETE FROM paiement WHERE id_paiement = $1", id)
	if err != nil {
		log.Printf("Error deleting paiement %d: %v", id, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
