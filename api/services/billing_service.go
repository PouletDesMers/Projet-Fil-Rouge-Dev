package services

import (
	"errors"

	"api/models"
	"api/repositories"
)

type BillingService struct {
	repo *repositories.BillingRepo
}

func NewBillingService(repo *repositories.BillingRepo) *BillingService {
	return &BillingService{repo: repo}
}

func (s *BillingService) GetAllAbonnements() ([]models.Abonnement, error) {
	return s.repo.FindAllAbonnements()
}

func (s *BillingService) GetAbonnement(id int) (models.Abonnement, error) {
	a, err := s.repo.FindAbonnementByID(id)
	if err != nil {
		return a, errors.New("subscription not found")
	}
	return a, nil
}

func (s *BillingService) CreateAbonnement(a *models.Abonnement) error {
	if err := s.repo.CreateAbonnement(a); err != nil {
		return errors.New("internal server error")
	}
	return nil
}

func (s *BillingService) UpdateAbonnement(a *models.Abonnement) error {
	if err := s.repo.UpdateAbonnement(a); err != nil {
		return errors.New("internal server error")
	}
	return nil
}

func (s *BillingService) DeleteAbonnement(id int) {
	s.repo.DeleteAbonnement(id)
}

func (s *BillingService) GetCommandes(userID int, isAdmin bool) ([]models.Commande, error) {
	if isAdmin {
		return s.repo.FindAllCommandes()
	}
	return s.repo.FindCommandesByUser(userID)
}

func (s *BillingService) GetCommande(id, userID int, isAdmin bool) (models.Commande, error) {
	c, err := s.repo.FindCommandeByID(id)
	if err != nil {
		return c, errors.New("order not found")
	}
	if !isAdmin && c.IDUtilisateur != userID {
		return c, errors.New("forbidden")
	}
	return c, nil
}

func (s *BillingService) CreateCommande(c *models.Commande) error {
	if err := s.repo.CreateCommande(c); err != nil {
		return errors.New("internal server error")
	}
	return nil
}

func (s *BillingService) UpdateCommande(c *models.Commande) error {
	if err := s.repo.UpdateCommande(c); err != nil {
		return errors.New("internal server error")
	}
	return nil
}

func (s *BillingService) DeleteCommande(id int) {
	s.repo.DeleteCommande(id)
}

func (s *BillingService) GetAllFactures() ([]models.Facture, error) {
	return s.repo.FindAllFactures()
}

func (s *BillingService) GetFacture(id int) (models.Facture, error) {
	f, err := s.repo.FindFactureByID(id)
	if err != nil {
		return f, errors.New("invoice not found")
	}
	return f, nil
}

func (s *BillingService) CreateFacture(f *models.Facture) error {
	return s.repo.CreateFacture(f)
}

func (s *BillingService) UpdateFacture(f *models.Facture) {
	s.repo.UpdateFacture(f)
}

func (s *BillingService) DeleteFacture(id int) {
	s.repo.DeleteFacture(id)
}

func (s *BillingService) GetAllPaiements() ([]models.Paiement, error) {
	return s.repo.FindAllPaiements()
}

func (s *BillingService) GetPaiement(id int) (models.Paiement, error) {
	p, err := s.repo.FindPaiementByID(id)
	if err != nil {
		return p, errors.New("payment not found")
	}
	return p, nil
}

func (s *BillingService) CreatePaiement(p *models.Paiement) {
	s.repo.CreatePaiement(p)
}

func (s *BillingService) UpdatePaiement(p *models.Paiement) {
	s.repo.UpdatePaiement(p)
}

func (s *BillingService) DeletePaiement(id int) {
	s.repo.DeletePaiement(id)
}
