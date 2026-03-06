package services

import (
	"errors"

	mw "api/middleware"
	"api/models"
	"api/repositories"
)

type ImagesService struct {
	repo *repositories.ImagesRepo
}

func NewImagesService(repo *repositories.ImagesRepo) *ImagesService {
	return &ImagesService{repo: repo}
}

func (s *ImagesService) GetAll() ([]models.CarouselImage, error) {
	return s.repo.FindAll()
}

func (s *ImagesService) GetActive() ([]models.CarouselImage, error) {
	return s.repo.FindActive()
}

func (s *ImagesService) GetByID(id int) (models.CarouselImage, error) {
	img, err := s.repo.FindByID(id)
	if err != nil {
		return img, errors.New("image not found")
	}
	return img, nil
}

func (s *ImagesService) Create(img *models.CarouselImage, creatorID int) error {
	img.Titre = mw.SanitizeString(img.Titre)
	img.Description = mw.SanitizeString(img.Description)
	img.AltText = mw.SanitizeString(img.AltText)

	if img.Titre == "" || img.URLImage == "" {
		return errors.New("title and URL are required")
	}
	if img.AltText == "" {
		img.AltText = img.Titre
	}
	if img.OrdreAffichage == 0 {
		img.OrdreAffichage = s.repo.MaxOrdre() + 1
	}
	if err := s.repo.Create(img, creatorID); err != nil {
		return errors.New("internal server error")
	}
	img.IDUtilisateurCreation = &creatorID
	return nil
}

func (s *ImagesService) Update(id int, patch models.CarouselImage) (models.CarouselImage, error) {
	cur, err := s.repo.FindByID(id)
	if err != nil {
		return cur, errors.New("image not found")
	}

	if patch.Titre != "" { cur.Titre = mw.SanitizeString(patch.Titre) }
	if patch.Description != "" { cur.Description = mw.SanitizeString(patch.Description) }
	if patch.URLImage != "" { cur.URLImage = patch.URLImage }
	if patch.AltText != "" { cur.AltText = mw.SanitizeString(patch.AltText) }
	if patch.OrdreAffichage != 0 { cur.OrdreAffichage = patch.OrdreAffichage }
	// Actif peut passer à false explicitement
	cur.Actif = patch.Actif

	if err := s.repo.Update(&cur); err != nil {
		return cur, errors.New("internal server error")
	}
	return cur, nil
}

func (s *ImagesService) Delete(id int) error {
	if err := s.repo.Delete(id); err != nil {
		return errors.New("internal server error")
	}
	return nil
}
