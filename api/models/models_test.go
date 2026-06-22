package models

import (
	"database/sql"
	"testing"
	"time"
)

func TestContextKeyConstants(t *testing.T) {
	if UserIDKey != "userID" {
		t.Errorf("expected UserIDKey 'userID', got '%s'", UserIDKey)
	}
	if UserRoleKey != "userRole" {
		t.Errorf("expected UserRoleKey 'userRole', got '%s'", UserRoleKey)
	}
}

func TestCategorieStruct(t *testing.T) {
	c := Categorie{ID: 1, Nom: "Test", Description: "Desc", Actif: true}
	if c.ID != 1 || c.Nom != "Test" || !c.Actif {
		t.Error("Categorie struct fields mismatch")
	}
}

func TestProduitStruct(t *testing.T) {
	p := Produit{ID: 2, Nom: "Produit A", SurDevis: true, Actif: true, IDService: 3}
	if p.ID != 2 || p.Nom != "Produit A" || !p.SurDevis || p.IDService != 3 {
		t.Error("Produit struct fields mismatch")
	}
}

func TestTarificationStruct(t *testing.T) {
	tarif := Tarification{ID: 1, Prix: 99.99, Unite: "mois", Periodicite: "mensuel", Actif: true, IDProduit: 1}
	if tarif.Prix != 99.99 || tarif.Unite != "mois" || tarif.IDProduit != 1 {
		t.Error("Tarification struct fields mismatch")
	}
}

func TestUtilisateurStruct(t *testing.T) {
	now := time.Now()
	u := Utilisateur{
		ID: 1, Email: "test@test.com", Nom: "Doe", Prenom: "John",
		Role: "user", Statut: "actif", EstActif: true,
		DateCreation: now, TotpEnabled: false,
	}
	if u.Email != "test@test.com" || u.Nom != "Doe" || u.Role != "user" {
		t.Error("Utilisateur struct fields mismatch")
	}
	if !u.EstActif {
		t.Error("expected EstActif to be true")
	}
}

func TestCommandeWithItems(t *testing.T) {
	c := Commande{
		ID: 1, MontantTotal: 199.99, Statut: "en_attente",
		Items: []OrderItem{{ProductSlug: "edr-pro", Price: 99.99, Quantity: 2}},
	}
	if len(c.Items) != 1 {
		t.Errorf("expected 1 item, got %d", len(c.Items))
	}
	if c.Items[0].Quantity != 2 {
		t.Errorf("expected quantity 2, got %d", c.Items[0].Quantity)
	}
	if c.Items[0].ProductSlug != "edr-pro" {
		t.Errorf("expected slug 'edr-pro', got '%s'", c.Items[0].ProductSlug)
	}
}

func TestAPILogStruct(t *testing.T) {
	l := APILog{
		ID: 1, Level: "INFO", Method: "GET", Path: "/api/users",
		Status: 200, Duration: "42ms", IP: "127.0.0.1",
		DBErr: sql.NullString{String: "", Valid: false},
	}
	if l.Level != "INFO" || l.Method != "GET" || l.Status != 200 {
		t.Error("APILog struct fields mismatch")
	}
	if l.DBErr.Valid {
		t.Error("expected DBErr to be invalid")
	}
}

func TestAbonnementStruct(t *testing.T) {
	start := time.Now()
	a := Abonnement{
		ID: 1, DateDebut: start, Statut: "actif",
		RenouvellementAuto: true, IDEntreprise: 1, IDProduit: 2, IDTarification: 3,
	}
	if a.ID != 1 || a.Statut != "actif" || !a.RenouvellementAuto {
		t.Error("Abonnement struct fields mismatch")
	}
	if a.IDProduit != 2 || a.IDTarification != 3 {
		t.Error("Abonnement foreign keys mismatch")
	}
}

func TestFactureStruct(t *testing.T) {
	f := Facture{ID: 1, Montant: 49.99, LienPDF: "/invoices/1.pdf", IDCommande: 5}
	if f.Montant != 49.99 || f.LienPDF != "/invoices/1.pdf" {
		t.Error("Facture struct fields mismatch")
	}
}

func TestPaiementStruct(t *testing.T) {
	p := Paiement{ID: 1, Moyen: "carte", Statut: "paye", ReferenceExterne: "stripe_123", IDCommande: 5}
	if p.Moyen != "carte" || p.Statut != "paye" || p.ReferenceExterne != "stripe_123" {
		t.Error("Paiement struct fields mismatch")
	}
}

func TestTicketSupportStruct(t *testing.T) {
	tk := TicketSupport{ID: 1, Sujet: "Problème", Message: "Détail", Statut: "ouvert", IDUtilisateur: 1}
	if tk.Sujet != "Problème" || tk.Statut != "ouvert" {
		t.Error("TicketSupport struct fields mismatch")
	}
}

func TestNotificationStruct(t *testing.T) {
	n := Notification{ID: 1, Type: "info", Message: "Bienvenue", Lu: false, IDUtilisateur: 1}
	if n.Type != "info" {
		t.Error("expected Notification type 'info'")
	}
	if n.Lu {
		t.Error("expected Notification Lu to be false")
	}
}

func TestCarouselImageStruct(t *testing.T) {
	now := time.Now()
	ci := CarouselImage{
		ID: 1, Titre: "Slide 1", URLImage: "/img/slide1.jpg",
		OrdreAffichage: 1, Actif: true,
		DateCreation: now, DateModification: now,
	}
	if ci.Titre != "Slide 1" || ci.OrdreAffichage != 1 {
		t.Error("CarouselImage struct fields mismatch")
	}
}

func TestCategorieWebStruct(t *testing.T) {
	cw := CategorieWeb{
		ID: 1, Nom: "Cyber", Slug: "cyber", Actif: true, OrdreAffichage: 1,
	}
	if cw.Slug != "cyber" || !cw.Actif {
		t.Error("CategorieWeb struct fields mismatch")
	}
}

func TestProduitWebStruct(t *testing.T) {
	prix := 99.99
	pw := ProduitWeb{
		ID: 1, Nom: "Scanner", Slug: "scanner", Prix: &prix,
		Devise: "EUR", Actif: true, OrdreAffichage: 1,
	}
	if pw.Nom != "Scanner" || *pw.Prix != 99.99 {
		t.Error("ProduitWeb struct fields mismatch")
	}
	if pw.Devise != "EUR" {
		t.Error("expected EUR as currency")
	}
}

func TestServiceStruct(t *testing.T) {
	s := Service{ID: 1, Nom: "Service A", Description: "Desc", Actif: true, IDCategorie: 1}
	if s.IDCategorie != 1 || s.Nom != "Service A" {
		t.Error("Service struct fields mismatch")
	}
}

func TestEntrepriseStruct(t *testing.T) {
	e := Entreprise{ID: 1, Nom: "ACME", Secteur: "IT", Taille: "PME", Pays: "FR"}
	if e.Nom != "ACME" || e.Pays != "FR" {
		t.Error("Entreprise struct fields mismatch")
	}
}
