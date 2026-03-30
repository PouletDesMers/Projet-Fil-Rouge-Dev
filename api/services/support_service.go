package services

import (
	"errors"

	"api/models"
	mw "api/middleware"
	"api/repositories"
)

type SupportService struct {
	repo *repositories.SupportRepo
}

func NewSupportService(repo *repositories.SupportRepo) *SupportService {
	return &SupportService{repo: repo}
}

func (s *SupportService) GetTickets(userID int, isAdmin bool) ([]models.TicketSupport, error) {
	if isAdmin {
		return s.repo.FindAllTickets()
	}
	return s.repo.FindTicketsByUser(userID)
}

func (s *SupportService) GetTicket(id, userID int, isAdmin bool) (models.TicketSupport, error) {
	t, err := s.repo.FindTicketByID(id)
	if err != nil {
		return t, errors.New("ticket not found")
	}
	if !isAdmin && t.IDUtilisateur != userID {
		return t, errors.New("forbidden")
	}
	return t, nil
}

func (s *SupportService) CreateTicket(t *models.TicketSupport) error {
	t.Sujet = mw.SanitizeString(t.Sujet)
	t.Message = mw.SanitizeString(t.Message)
	if t.Sujet == "" || t.Message == "" {
		return errors.New("subject and message are required")
	}
	if t.Statut == "" {
		t.Statut = "ouvert"
	}
	return s.repo.CreateTicket(t)
}

func (s *SupportService) UpdateTicket(t *models.TicketSupport) error {
	t.Sujet = mw.SanitizeString(t.Sujet)
	t.Message = mw.SanitizeString(t.Message)
	return s.repo.UpdateTicket(t)
}

func (s *SupportService) DeleteTicket(id int) error {
	return s.repo.DeleteTicket(id)
}

func (s *SupportService) GetNotifications(userID int, isAdmin bool) ([]models.Notification, error) {
	if isAdmin {
		return s.repo.FindAllNotifications()
	}
	return s.repo.FindNotificationsByUser(userID)
}

func (s *SupportService) GetNotification(id, userID int, isAdmin bool) (models.Notification, error) {
	n, err := s.repo.FindNotificationByID(id)
	if err != nil {
		return n, errors.New("notification not found")
	}
	if !isAdmin && n.IDUtilisateur != userID {
		return n, errors.New("forbidden")
	}
	return n, nil
}

func (s *SupportService) CreateNotification(n *models.Notification) error {
	return s.repo.CreateNotification(n)
}

func (s *SupportService) UpdateNotification(n *models.Notification) error {
	return s.repo.UpdateNotification(n)
}

func (s *SupportService) DeleteNotification(id int) error {
	return s.repo.DeleteNotification(id)
}

func (s *SupportService) MarkAllRead(userID int) error {
	return s.repo.MarkAllRead(userID)
}
