package services

import (
	"errors"

	mw "api/middleware"
	"api/repositories"
)

type APIKeysService struct {
	repo *repositories.APIKeyRepo
}

func NewAPIKeysService(repo *repositories.APIKeyRepo) *APIKeysService {
	return &APIKeysService{repo: repo}
}

func (s *APIKeysService) GetAll() ([]repositories.APIToken, error) {
	return s.repo.FindAll()
}

func (s *APIKeysService) CreateToken(nom, permissions string, ownerUserID, adminUserID int) (int, string, error) {
	nom = mw.SanitizeString(nom)
	if nom == "" {
		return 0, "", errors.New("name is required")
	}
	if ownerUserID == 0 {
		ownerUserID = adminUserID
	}

	apiKey, err := repositories.GenerateKey()
	if err != nil {
		return 0, "", errors.New("failed to generate api key")
	}

	tokenID, err := s.repo.Create(nom, apiKey, permissions, ownerUserID)
	if err != nil {
		return 0, "", errors.New("internal server error")
	}
	return tokenID, apiKey, nil
}

func (s *APIKeysService) Delete(id int) error {
	n, err := s.repo.Delete(id)
	if err != nil {
		return errors.New("internal server error")
	}
	if n == 0 {
		return errors.New("token not found")
	}
	return nil
}

func (s *APIKeysService) SetActive(id int, active bool) error {
	return s.repo.SetActive(id, active)
}

func (s *APIKeysService) ValidateKey(key string) (int, string, bool) {
	return s.repo.ValidateKey(key)
}
