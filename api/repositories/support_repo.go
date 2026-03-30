package repositories

import (
	"database/sql"

	"api/models"
)

type SupportRepo struct {
	DB *sql.DB
}

func NewSupportRepo(db *sql.DB) *SupportRepo { return &SupportRepo{DB: db} }

func (r *SupportRepo) FindAllTickets() ([]models.TicketSupport, error) {
	rows, err := r.DB.Query(
		"SELECT id_ticket, sujet, message, statut, date_creation, id_utilisateur FROM ticket_support ORDER BY date_creation DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTickets(rows)
}

func (r *SupportRepo) FindTicketsByUser(userID int) ([]models.TicketSupport, error) {
	rows, err := r.DB.Query(
		"SELECT id_ticket, sujet, message, statut, date_creation, id_utilisateur FROM ticket_support WHERE id_utilisateur=$1 ORDER BY date_creation DESC",
		userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTickets(rows)
}

func (r *SupportRepo) FindTicketByID(id int) (models.TicketSupport, error) {
	var t models.TicketSupport
	err := r.DB.QueryRow(
		"SELECT id_ticket, sujet, message, statut, date_creation, id_utilisateur FROM ticket_support WHERE id_ticket=$1",
		id).Scan(&t.ID, &t.Sujet, &t.Message, &t.Statut, &t.DateCreation, &t.IDUtilisateur)
	return t, err
}

func (r *SupportRepo) CreateTicket(t *models.TicketSupport) error {
	return r.DB.QueryRow(
		"INSERT INTO ticket_support (sujet, message, statut, id_utilisateur) VALUES ($1,$2,$3,$4) RETURNING id_ticket, date_creation",
		t.Sujet, t.Message, t.Statut, t.IDUtilisateur).Scan(&t.ID, &t.DateCreation)
}

func (r *SupportRepo) UpdateTicket(t *models.TicketSupport) error {
	_, err := r.DB.Exec(
		"UPDATE ticket_support SET sujet=$1, message=$2, statut=$3 WHERE id_ticket=$4",
		t.Sujet, t.Message, t.Statut, t.ID)
	return err
}

func (r *SupportRepo) DeleteTicket(id int) error {
	_, err := r.DB.Exec("DELETE FROM ticket_support WHERE id_ticket=$1", id)
	return err
}

func (r *SupportRepo) FindNotificationsByUser(userID int) ([]models.Notification, error) {
	rows, err := r.DB.Query(
		"SELECT id_notification, type, message, lu, date_creation, id_utilisateur FROM notification WHERE id_utilisateur=$1 ORDER BY date_creation DESC",
		userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanNotifications(rows)
}

func (r *SupportRepo) FindAllNotifications() ([]models.Notification, error) {
	rows, err := r.DB.Query(
		"SELECT id_notification, type, message, lu, date_creation, id_utilisateur FROM notification ORDER BY date_creation DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanNotifications(rows)
}

func (r *SupportRepo) FindNotificationByID(id int) (models.Notification, error) {
	var n models.Notification
	err := r.DB.QueryRow(
		"SELECT id_notification, type, message, lu, date_creation, id_utilisateur FROM notification WHERE id_notification=$1",
		id).Scan(&n.ID, &n.Type, &n.Message, &n.Lu, &n.DateCreation, &n.IDUtilisateur)
	return n, err
}

func (r *SupportRepo) CreateNotification(n *models.Notification) error {
	return r.DB.QueryRow(
		"INSERT INTO notification (type, message, lu, id_utilisateur) VALUES ($1,$2,$3,$4) RETURNING id_notification, date_creation",
		n.Type, n.Message, n.Lu, n.IDUtilisateur).Scan(&n.ID, &n.DateCreation)
}

func (r *SupportRepo) UpdateNotification(n *models.Notification) error {
	_, err := r.DB.Exec(
		"UPDATE notification SET type=$1, message=$2, lu=$3 WHERE id_notification=$4",
		n.Type, n.Message, n.Lu, n.ID)
	return err
}

func (r *SupportRepo) DeleteNotification(id int) error {
	_, err := r.DB.Exec("DELETE FROM notification WHERE id_notification=$1", id)
	return err
}

func (r *SupportRepo) MarkAllRead(userID int) error {
	_, err := r.DB.Exec("UPDATE notification SET lu=TRUE WHERE id_utilisateur=$1", userID)
	return err
}

func scanTickets(rows *sql.Rows) ([]models.TicketSupport, error) {
	items := []models.TicketSupport{}
	for rows.Next() {
		var t models.TicketSupport
		if err := rows.Scan(&t.ID, &t.Sujet, &t.Message, &t.Statut, &t.DateCreation, &t.IDUtilisateur); err != nil {
			return nil, err
		}
		items = append(items, t)
	}
	return items, nil
}

func scanNotifications(rows *sql.Rows) ([]models.Notification, error) {
	items := []models.Notification{}
	for rows.Next() {
		var n models.Notification
		if err := rows.Scan(&n.ID, &n.Type, &n.Message, &n.Lu, &n.DateCreation, &n.IDUtilisateur); err != nil {
			return nil, err
		}
		items = append(items, n)
	}
	return items, nil
}

var _ = models.TicketSupport{}
var _ = models.Notification{}
