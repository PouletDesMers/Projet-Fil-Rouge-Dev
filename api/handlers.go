package main

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

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

func getTarifications(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_tarification, prix, unite, periodicite, actif, id_produit FROM tarification")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var tarifications []Tarification
	for rows.Next() {
		var t Tarification
		err := rows.Scan(&t.ID, &t.Prix, &t.Unite, &t.Periodicite, &t.Actif, &t.IDProduit)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		tarifications = append(tarifications, t)
	}
	json.NewEncoder(w).Encode(tarifications)
}

func getTarification(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var t Tarification
	err := db.QueryRow("SELECT id_tarification, prix, unite, periodicite, actif, id_produit FROM tarification WHERE id_tarification = $1", id).Scan(&t.ID, &t.Prix, &t.Unite, &t.Periodicite, &t.Actif, &t.IDProduit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(t)
}

func createTarification(w http.ResponseWriter, r *http.Request) {
	var t Tarification
	json.NewDecoder(r.Body).Decode(&t)
	err := db.QueryRow("INSERT INTO tarification (prix, unite, periodicite, actif, id_produit) VALUES ($1, $2, $3, $4, $5) RETURNING id_tarification", t.Prix, t.Unite, t.Periodicite, t.Actif, t.IDProduit).Scan(&t.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(t)
}

func updateTarification(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var t Tarification
	json.NewDecoder(r.Body).Decode(&t)
	_, err := db.Exec("UPDATE tarification SET prix = $1, unite = $2, periodicite = $3, actif = $4, id_produit = $5 WHERE id_tarification = $6", t.Prix, t.Unite, t.Periodicite, t.Actif, t.IDProduit, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	t.ID = id
	json.NewEncoder(w).Encode(t)
}

func deleteTarification(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	_, err := db.Exec("DELETE FROM tarification WHERE id_tarification = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func getEntreprises(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_entreprise, nom, secteur, taille, pays, date_creation FROM entreprise")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var entreprises []Entreprise
	for rows.Next() {
		var e Entreprise
		err := rows.Scan(&e.ID, &e.Nom, &e.Secteur, &e.Taille, &e.Pays, &e.DateCreation)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		entreprises = append(entreprises, e)
	}
	json.NewEncoder(w).Encode(entreprises)
}

func getEntreprise(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var e Entreprise
	err := db.QueryRow("SELECT id_entreprise, nom, secteur, taille, pays, date_creation FROM entreprise WHERE id_entreprise = $1", id).Scan(&e.ID, &e.Nom, &e.Secteur, &e.Taille, &e.Pays, &e.DateCreation)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(e)
}

func createEntreprise(w http.ResponseWriter, r *http.Request) {
	var e Entreprise
	json.NewDecoder(r.Body).Decode(&e)
	err := db.QueryRow("INSERT INTO entreprise (nom, secteur, taille, pays) VALUES ($1, $2, $3, $4) RETURNING id_entreprise", e.Nom, e.Secteur, e.Taille, e.Pays).Scan(&e.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(e)
}

func updateEntreprise(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var e Entreprise
	json.NewDecoder(r.Body).Decode(&e)
	_, err := db.Exec("UPDATE entreprise SET nom = $1, secteur = $2, taille = $3, pays = $4 WHERE id_entreprise = $5", e.Nom, e.Secteur, e.Taille, e.Pays, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	e.ID = id
	json.NewEncoder(w).Encode(e)
}

func deleteEntreprise(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	_, err := db.Exec("DELETE FROM entreprise WHERE id_entreprise = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func getUtilisateurs(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_utilisateur, email, mot_de_passe, nom, prenom, telephone, role, statut, date_creation, derniere_connexion, id_entreprise FROM utilisateur")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var utilisateurs []Utilisateur
	for rows.Next() {
		var u Utilisateur
		err := rows.Scan(&u.ID, &u.Email, &u.MotDePasse, &u.Nom, &u.Prenom, &u.Telephone, &u.Role, &u.Statut, &u.DateCreation, &u.DerniereConnexion, &u.IDEntreprise)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		utilisateurs = append(utilisateurs, u)
	}
	json.NewEncoder(w).Encode(utilisateurs)
}

func getUtilisateur(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var u Utilisateur
	err := db.QueryRow("SELECT id_utilisateur, email, mot_de_passe, nom, prenom, telephone, role, statut, date_creation, derniere_connexion, id_entreprise FROM utilisateur WHERE id_utilisateur = $1", id).Scan(&u.ID, &u.Email, &u.MotDePasse, &u.Nom, &u.Prenom, &u.Telephone, &u.Role, &u.Statut, &u.DateCreation, &u.DerniereConnexion, &u.IDEntreprise)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(u)
}

func createUtilisateur(w http.ResponseWriter, r *http.Request) {
	var u Utilisateur
	json.NewDecoder(r.Body).Decode(&u)
	err := db.QueryRow("INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, telephone, role, statut, id_entreprise) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_utilisateur", u.Email, u.MotDePasse, u.Nom, u.Prenom, u.Telephone, u.Role, u.Statut, u.IDEntreprise).Scan(&u.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(u)
}

func updateUtilisateur(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var u Utilisateur
	json.NewDecoder(r.Body).Decode(&u)
	_, err := db.Exec("UPDATE utilisateur SET email = $1, mot_de_passe = $2, nom = $3, prenom = $4, telephone = $5, role = $6, statut = $7, id_entreprise = $8 WHERE id_utilisateur = $9", u.Email, u.MotDePasse, u.Nom, u.Prenom, u.Telephone, u.Role, u.Statut, u.IDEntreprise, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	u.ID = id
	json.NewEncoder(w).Encode(u)
}

func deleteUtilisateur(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	_, err := db.Exec("DELETE FROM utilisateur WHERE id_utilisateur = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func getVerifEmailExiste(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	email := params["email"]
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM utilisateur WHERE email = $1", email).Scan(&count)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	exists := 0
	if count > 0 {
		exists = 1
	}
	json.NewEncoder(w).Encode(map[string]int{"exists": exists})
}

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

func getTicketSupports(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_ticket, sujet, message, statut, date_creation, id_utilisateur FROM ticket_support")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var tickets []TicketSupport
	for rows.Next() {
		var t TicketSupport
		err := rows.Scan(&t.ID, &t.Sujet, &t.Message, &t.Statut, &t.DateCreation, &t.IDUtilisateur)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		tickets = append(tickets, t)
	}
	json.NewEncoder(w).Encode(tickets)
}

func getTicketSupport(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var t TicketSupport
	err := db.QueryRow("SELECT id_ticket, sujet, message, statut, date_creation, id_utilisateur FROM ticket_support WHERE id_ticket = $1", id).Scan(&t.ID, &t.Sujet, &t.Message, &t.Statut, &t.DateCreation, &t.IDUtilisateur)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(t)
}

func createTicketSupport(w http.ResponseWriter, r *http.Request) {
	var t TicketSupport
	json.NewDecoder(r.Body).Decode(&t)
	err := db.QueryRow("INSERT INTO ticket_support (sujet, message, statut, id_utilisateur) VALUES ($1, $2, $3, $4) RETURNING id_ticket", t.Sujet, t.Message, t.Statut, t.IDUtilisateur).Scan(&t.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(t)
}

func updateTicketSupport(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var t TicketSupport
	json.NewDecoder(r.Body).Decode(&t)
	_, err := db.Exec("UPDATE ticket_support SET sujet = $1, message = $2, statut = $3, id_utilisateur = $4 WHERE id_ticket = $5", t.Sujet, t.Message, t.Statut, t.IDUtilisateur, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	t.ID = id
	json.NewEncoder(w).Encode(t)
}

func deleteTicketSupport(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	_, err := db.Exec("DELETE FROM ticket_support WHERE id_ticket = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func getNotifications(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_notification, type, message, lu, date_creation, id_utilisateur FROM notification")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var notifications []Notification
	for rows.Next() {
		var n Notification
		err := rows.Scan(&n.ID, &n.Type, &n.Message, &n.Lu, &n.DateCreation, &n.IDUtilisateur)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		notifications = append(notifications, n)
	}
	json.NewEncoder(w).Encode(notifications)
}

func getNotification(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var n Notification
	err := db.QueryRow("SELECT id_notification, type, message, lu, date_creation, id_utilisateur FROM notification WHERE id_notification = $1", id).Scan(&n.ID, &n.Type, &n.Message, &n.Lu, &n.DateCreation, &n.IDUtilisateur)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(n)
}

func createNotification(w http.ResponseWriter, r *http.Request) {
	var n Notification
	json.NewDecoder(r.Body).Decode(&n)
	err := db.QueryRow("INSERT INTO notification (type, message, lu, id_utilisateur) VALUES ($1, $2, $3, $4) RETURNING id_notification", n.Type, n.Message, n.Lu, n.IDUtilisateur).Scan(&n.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(n)
}

func updateNotification(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var n Notification
	json.NewDecoder(r.Body).Decode(&n)
	_, err := db.Exec("UPDATE notification SET type = $1, message = $2, lu = $3, id_utilisateur = $4 WHERE id_notification = $5", n.Type, n.Message, n.Lu, n.IDUtilisateur, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	n.ID = id
	json.NewEncoder(w).Encode(n)
}

func deleteNotification(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	_, err := db.Exec("DELETE FROM notification WHERE id_notification = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
