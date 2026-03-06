package services

import (
	"errors"
	"strings"

	"api/cache"
	"api/models"
	mw "api/middleware"
	"api/repositories"
)

type CatalogService struct {
	repo *repositories.CatalogRepo
}

func NewCatalogService(repo *repositories.CatalogRepo) *CatalogService {
	return &CatalogService{repo: repo}
}

func (s *CatalogService) GetAllCategories() ([]models.CategorieWeb, error) {
	return s.repo.FindAllCategories()
}

func (s *CatalogService) GetActiveCategories() ([]byte, []models.CategorieWeb, error) {
	if cached := cache.CatalogCache.Get(cache.KeyActiveCategories); cached != nil {
		return cached, nil, nil
	}
	cats, err := s.repo.FindActiveCategories()
	if err != nil {
		return nil, nil, err
	}
	return nil, cats, nil
}

func (s *CatalogService) SetActiveCategoriesCache(cats []models.CategorieWeb) {
	cache.SetJSON(cache.CatalogCache, cache.KeyActiveCategories, cats)
}

func (s *CatalogService) CreateCategorie(c *models.CategorieWeb, creatorID int) error {
	c.Nom = mw.SanitizeString(c.Nom)
	c.Description = mw.SanitizeString(c.Description)
	if c.Nom == "" || c.Slug == "" {
		return errors.New("name and slug are required")
	}
	if err := s.repo.CreateCategorie(c, creatorID); err != nil {
		return errors.New("internal server error")
	}
	cache.InvalidateCategories()
	return nil
}

func (s *CatalogService) UpdateCategorie(c *models.CategorieWeb) error {
	c.Nom = mw.SanitizeString(c.Nom)
	c.Description = mw.SanitizeString(c.Description)
	if err := s.repo.UpdateCategorie(c); err != nil {
		return errors.New("internal server error")
	}
	cache.InvalidateCategories()
	return nil
}

func (s *CatalogService) DeleteCategorie(id int) error {
	count, err := s.repo.CountProduitsByCategorie(id)
	if err != nil {
		return errors.New("internal server error")
	}
	if count > 0 {
		return errors.New("cannot delete category with associated products")
	}
	if err := s.repo.DeleteCategorie(id); err != nil {
		return errors.New("internal server error")
	}
	cache.InvalidateCategories()
	return nil
}

func (s *CatalogService) GetAllProduits(categorySlug string) ([]models.ProduitWeb, error) {
	return s.repo.FindAllProduits(categorySlug)
}

func (s *CatalogService) GetActiveProduitsByCategory(slug string) ([]byte, []models.ProduitWeb, error) {
	cacheKey := cache.KeyProduitsByCategory(slug)
	if cached := cache.CatalogCache.Get(cacheKey); cached != nil {
		return cached, nil, nil
	}
	produits, err := s.repo.FindActiveProduitsByCategory(slug)
	if err != nil {
		return nil, nil, err
	}
	return nil, produits, nil
}

func (s *CatalogService) SetProduitsByCategoryCache(slug string, produits []models.ProduitWeb) {
	cache.SetJSON(cache.CatalogCache, cache.KeyProduitsByCategory(slug), produits)
}

func (s *CatalogService) Search(q string) ([]byte, []repositories.SearchResult, error) {
	q = strings.TrimSpace(q)
	if q == "" {
		return nil, []repositories.SearchResult{}, nil
	}
	if len(q) > 100 {
		return nil, nil, errors.New("search query too long")
	}
	cacheKey := cache.KeySearchResults(q)
	if cached := cache.SearchCache.Get(cacheKey); cached != nil {
		return cached, nil, nil
	}
	results, err := s.repo.SearchProduits("%" + q + "%")
	if err != nil {
		return nil, nil, errors.New("internal server error")
	}
	return nil, results, nil
}

func (s *CatalogService) SetSearchCache(q string, results []repositories.SearchResult) {
	cache.SetJSON(cache.SearchCache, cache.KeySearchResults(q), results)
}

func (s *CatalogService) CreateProduit(p *models.ProduitWeb, creatorID int) error {
	p.Nom = mw.SanitizeString(p.Nom)
	p.DescriptionCourte = mw.SanitizeString(p.DescriptionCourte)
	if p.Nom == "" || p.Slug == "" {
		return errors.New("name and slug are required")
	}
	if err := s.repo.CreateProduit(p, creatorID); err != nil {
		return errors.New("internal server error")
	}
	cache.InvalidateProduits()
	return nil
}

func (s *CatalogService) UpdateProduit(p *models.ProduitWeb) error {
	p.Nom = mw.SanitizeString(p.Nom)
	p.DescriptionCourte = mw.SanitizeString(p.DescriptionCourte)
	if err := s.repo.UpdateProduit(p); err != nil {
		return errors.New("internal server error")
	}
	cache.InvalidateProduits()
	return nil
}

func (s *CatalogService) DeleteProduit(id int) error {
	if err := s.repo.DeleteProduit(id); err != nil {
		return errors.New("internal server error")
	}
	cache.InvalidateProduits()
	return nil
}

func (s *CatalogService) GetAllTarifications() ([]byte, []models.Tarification, error) {
	if cached := cache.CatalogCache.Get(cache.KeyAllTarifications); cached != nil {
		return cached, nil, nil
	}
	tarifs, err := s.repo.FindAllTarifications()
	if err != nil {
		return nil, nil, errors.New("internal server error")
	}
	return nil, tarifs, nil
}

func (s *CatalogService) SetTarificationsCache(tarifs []models.Tarification) {
	cache.SetJSON(cache.CatalogCache, cache.KeyAllTarifications, tarifs)
}

func (s *CatalogService) GetTarification(id int) (models.Tarification, error) {
	return s.repo.FindTarificationByID(id)
}

func (s *CatalogService) CreateTarification(t *models.Tarification) error {
	if t.Prix < 0 {
		return errors.New("price cannot be negative")
	}
	if err := s.repo.CreateTarification(t); err != nil {
		return errors.New("internal server error")
	}
	cache.InvalidateTarifications()
	return nil
}

func (s *CatalogService) UpdateTarification(t *models.Tarification) error {
	if t.Prix < 0 {
		return errors.New("price cannot be negative")
	}
	if err := s.repo.UpdateTarification(t); err != nil {
		return errors.New("internal server error")
	}
	cache.InvalidateTarifications()
	return nil
}

func (s *CatalogService) DeleteTarification(id int) error {
	if err := s.repo.DeleteTarification(id); err != nil {
		return errors.New("internal server error")
	}
	cache.InvalidateTarifications()
	return nil
}

func (s *CatalogService) GetAllEntreprises() ([]models.Entreprise, error) {
	return s.repo.FindAllEntreprises()
}

func (s *CatalogService) GetEntreprise(id int) (models.Entreprise, error) {
	return s.repo.FindEntrepriseByID(id)
}

func (s *CatalogService) CreateEntreprise(e *models.Entreprise) error {
	e.Nom = mw.SanitizeString(e.Nom)
	e.Secteur = mw.SanitizeString(e.Secteur)
	e.Taille = mw.SanitizeString(e.Taille)
	e.Pays = mw.SanitizeString(e.Pays)
	if e.Nom == "" {
		return errors.New("company name is required")
	}
	return s.repo.CreateEntreprise(e)
}

func (s *CatalogService) UpdateEntreprise(e *models.Entreprise) error {
	e.Nom = mw.SanitizeString(e.Nom)
	e.Secteur = mw.SanitizeString(e.Secteur)
	e.Taille = mw.SanitizeString(e.Taille)
	e.Pays = mw.SanitizeString(e.Pays)
	return s.repo.UpdateEntreprise(e)
}

func (s *CatalogService) DeleteEntreprise(id int) error {
	return s.repo.DeleteEntreprise(id)
}
