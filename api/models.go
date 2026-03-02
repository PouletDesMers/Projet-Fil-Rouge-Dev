package main

import (
	"database/sql"
	"time"
)

type Categorie struct {
	ID          int    `json:"id"`
	Nom         string `json:"name"`
	Description string `json:"description"`
	Actif       bool   `json:"active"`
}

type Service struct {
	ID          int    `json:"id"`
	Nom         string `json:"name"`
	Description string `json:"description"`
	Actif       bool   `json:"active"`
	IDCategorie int    `json:"categoryId"`
}

type Produit struct {
	ID          int    `json:"id"`
	Nom         string `json:"name"`
	Description string `json:"description"`
	SurDevis    bool   `json:"onQuote"`
	Actif       bool   `json:"active"`
	IDService   int    `json:"serviceId"`
}

type Tarification struct {
	ID          int     `json:"id"`
	Prix        float64 `json:"price"`
	Unite       string  `json:"unit"`
	Periodicite string  `json:"periodicity"`
	Actif       bool    `json:"active"`
	IDProduit   int     `json:"productId"`
}

type Entreprise struct {
	ID           int       `json:"id"`
	Nom          string    `json:"name"`
	Secteur      string    `json:"sector"`
	Taille       string    `json:"size"`
	Pays         string    `json:"country"`
	DateCreation time.Time `json:"createdAt"`
}

type Utilisateur struct {
	ID                int        `json:"id_utilisateur"`
	Email             string     `json:"email"`
	MotDePasse        string     `json:"password"`
	Nom               string     `json:"lastName"`
	Prenom            string     `json:"firstName"`
	Telephone         string     `json:"phone"`
	Role              string     `json:"role"`
	Statut            string     `json:"status"`
	EstActif          bool       `json:"est_actif"`
	DateCreation      time.Time  `json:"createdAt"`
	DerniereConnexion *time.Time `json:"lastLogin"`
	IDEntreprise      *int       `json:"companyId"`
	DateInscription   time.Time  `json:"date_inscription"`
	// 2FA fields
	TotpSecret           *string `json:"-"`
	TotpEnabled          bool    `json:"totp_enabled"`
	WebAuthnCredentialID *string `json:"webauthn_credential_id,omitempty"`
	WebAuthnPublicKey    *string `json:"webauthn_public_key,omitempty"`
	WebAuthnCounter      *int64  `json:"webauthn_counter,omitempty"`
}

type CarouselImage struct {
	ID                    int       `json:"id_image"`
	Titre                 string    `json:"titre"`
	Description           string    `json:"description"`
	URLImage              string    `json:"url_image"`
	AltText               string    `json:"alt_text"`
	OrdreAffichage        int       `json:"ordre_affichage"`
	Actif                 bool      `json:"actif"`
	DateCreation          time.Time `json:"date_creation"`
	DateModification      time.Time `json:"date_modification"`
	IDUtilisateurCreation *int      `json:"id_utilisateur_creation"`
}

type CategorieWeb struct {
	ID                    int       `json:"id_categorie"`
	Nom                   string    `json:"nom"`
	Slug                  string    `json:"slug"`
	Description           string    `json:"description"`
	Icone                 string    `json:"icone"`
	Couleur               string    `json:"couleur"`
	OrdreAffichage        int       `json:"ordre_affichage"`
	Actif                 bool      `json:"actif"`
	DateCreation          time.Time `json:"date_creation"`
	DateModification      time.Time `json:"date_modification"`
	IDUtilisateurCreation *int      `json:"id_utilisateur_creation"`
}

type ProduitWeb struct {
	ID                    int       `json:"id_produit"`
	Nom                   string    `json:"nom"`
	Slug                  string    `json:"slug"`
	DescriptionCourte     string    `json:"description_courte"`
	DescriptionLongue     string    `json:"description_longue"`
	Prix                  *float64  `json:"prix"`
	Devise                string    `json:"devise"`
	Duree                 string    `json:"duree"`
	IDCategorie           int       `json:"id_categorie"`
	Tag                   string    `json:"tag"`
	Statut                string    `json:"statut"`
	TypeAchat             string    `json:"type_achat"`
	OrdreAffichage        int       `json:"ordre_affichage"`
	Actif                 bool      `json:"actif"`
	DateCreation          time.Time `json:"date_creation"`
	DateModification      time.Time `json:"date_modification"`
	IDUtilisateurCreation *int      `json:"id_utilisateur_creation"`
}

type Abonnement struct {
	ID                 int        `json:"id"`
	DateDebut          time.Time  `json:"startDate"`
	DateFin            *time.Time `json:"endDate"`
	Quantite           *int       `json:"quantity"`
	Statut             string     `json:"status"`
	RenouvellementAuto bool       `json:"autoRenewal"`
	IDEntreprise       int        `json:"companyId"`
	IDProduit          int        `json:"productId"`
	IDTarification     int        `json:"pricingId"`
}

type Commande struct {
	ID            int       `json:"id"`
	DateCommande  time.Time `json:"orderDate"`
	MontantTotal  float64   `json:"totalAmount"`
	Statut        string    `json:"status"`
	IDUtilisateur int       `json:"userId"`
	PromoCode     string    `json:"promoCode,omitempty"`
}

type Facture struct {
	ID          int       `json:"id"`
	DateFacture time.Time `json:"invoiceDate"`
	Montant     float64   `json:"amount"`
	LienPDF     string    `json:"pdfLink"`
	IDCommande  int       `json:"orderId"`
}

type Paiement struct {
	ID               int       `json:"id"`
	Moyen            string    `json:"method"`
	Statut           string    `json:"status"`
	DatePaiement     time.Time `json:"paymentDate"`
	ReferenceExterne string    `json:"externalReference"`
	IDCommande       int       `json:"orderId"`
}

type TicketSupport struct {
	ID            int       `json:"id"`
	Sujet         string    `json:"subject"`
	Message       string    `json:"message"`
	Statut        string    `json:"status"`
	DateCreation  time.Time `json:"createdAt"`
	IDUtilisateur int       `json:"userId"`
}

type Notification struct {
	ID            int       `json:"id"`
	Type          string    `json:"type"`
	Message       string    `json:"message"`
	Lu            bool      `json:"read"`
	DateCreation  time.Time `json:"createdAt"`
	IDUtilisateur int       `json:"userId"`
}

type contextKey string

const UserIDKey contextKey = "userID"

var db *sql.DB
