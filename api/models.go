package main

import (
	"database/sql"
	"time"
)

type Categorie struct {
	ID          int    `json:"id_categorie"`
	Nom         string `json:"nom"`
	Description string `json:"description"`
	Actif       bool   `json:"actif"`
}

type Service struct {
	ID          int    `json:"id_service"`
	Nom         string `json:"nom"`
	Description string `json:"description"`
	Actif       bool   `json:"actif"`
	IDCategorie int    `json:"id_categorie"`
}

type Produit struct {
	ID          int    `json:"id_produit"`
	Nom         string `json:"nom"`
	Description string `json:"description"`
	SurDevis    bool   `json:"sur_devis"`
	Actif       bool   `json:"actif"`
	IDService   int    `json:"id_service"`
}

type Tarification struct {
	ID          int     `json:"id_tarification"`
	Prix        float64 `json:"prix"`
	Unite       string  `json:"unite"`
	Periodicite string  `json:"periodicite"`
	Actif       bool    `json:"actif"`
	IDProduit   int     `json:"id_produit"`
}

type Entreprise struct {
	ID           int       `json:"id_entreprise"`
	Nom          string    `json:"nom"`
	Secteur      string    `json:"secteur"`
	Taille       string    `json:"taille"`
	Pays         string    `json:"pays"`
	DateCreation time.Time `json:"date_creation"`
}

type Utilisateur struct {
	ID                int        `json:"id_utilisateur"`
	Email             string     `json:"email"`
	MotDePasse        string     `json:"mot_de_passe"`
	Nom               string     `json:"nom"`
	Prenom            string     `json:"prenom"`
	Telephone         string     `json:"telephone"`
	Role              string     `json:"role"`
	Statut            string     `json:"statut"`
	DateCreation      time.Time  `json:"date_creation"`
	DerniereConnexion *time.Time `json:"derniere_connexion"`
	IDEntreprise      *int       `json:"id_entreprise"`
	// 2FA fields
	TotpSecret           *string `json:"totp_secret,omitempty"`
	WebAuthnCredentialID *string `json:"webauthn_credential_id,omitempty"`
	WebAuthnPublicKey    *string `json:"webauthn_public_key,omitempty"`
	WebAuthnCounter      *int64  `json:"webauthn_counter,omitempty"`
}

type Abonnement struct {
	ID                 int        `json:"id_abonnement"`
	DateDebut          time.Time  `json:"date_debut"`
	DateFin            *time.Time `json:"date_fin"`
	Quantite           *int       `json:"quantite"`
	Statut             string     `json:"statut"`
	RenouvellementAuto bool       `json:"renouvellement_auto"`
	IDEntreprise       int        `json:"id_entreprise"`
	IDProduit          int        `json:"id_produit"`
	IDTarification     int        `json:"id_tarification"`
}

type Commande struct {
	ID            int       `json:"id_commande"`
	DateCommande  time.Time `json:"date_commande"`
	MontantTotal  float64   `json:"montant_total"`
	Statut        string    `json:"statut"`
	IDUtilisateur int       `json:"id_utilisateur"`
}

type Facture struct {
	ID          int       `json:"id_facture"`
	DateFacture time.Time `json:"date_facture"`
	Montant     float64   `json:"montant"`
	LienPDF     string    `json:"lien_pdf"`
	IDCommande  int       `json:"id_commande"`
}

type Paiement struct {
	ID               int       `json:"id_paiement"`
	Moyen            string    `json:"moyen"`
	Statut           string    `json:"statut"`
	DatePaiement     time.Time `json:"date_paiement"`
	ReferenceExterne string    `json:"reference_externe"`
	IDCommande       int       `json:"id_commande"`
}

type TicketSupport struct {
	ID            int       `json:"id_ticket"`
	Sujet         string    `json:"sujet"`
	Message       string    `json:"message"`
	Statut        string    `json:"statut"`
	DateCreation  time.Time `json:"date_creation"`
	IDUtilisateur int       `json:"id_utilisateur"`
}

type Notification struct {
	ID            int       `json:"id_notification"`
	Type          string    `json:"type"`
	Message       string    `json:"message"`
	Lu            bool      `json:"lu"`
	DateCreation  time.Time `json:"date_creation"`
	IDUtilisateur int       `json:"id_utilisateur"`
}

var db *sql.DB
