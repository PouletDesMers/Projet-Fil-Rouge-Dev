package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"

	"api/config"
)

type Ticket struct {
	ID              int        `json:"id"`
	Sujet           string     `json:"subject"`
	Message         string     `json:"message"`
	Statut          string     `json:"status"`
	DateCreation    time.Time  `json:"createdAt"`
	IDUtilisateur   *int       `json:"userId"`
	EmailExpediteur string     `json:"email,omitempty"`
}

func GetTicketSupports(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	rows, err := config.DB.Query(
		`SELECT id_ticket, COALESCE(sujet,''), COALESCE(message,''), COALESCE(statut,'ouvert'), date_creation, id_utilisateur, COALESCE(email_expediteur,'')
		 FROM ticket_support WHERE id_utilisateur = $1 ORDER BY date_creation DESC`, userID)
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	tickets := []Ticket{}
	for rows.Next() {
		var t Ticket
		rows.Scan(&t.ID, &t.Sujet, &t.Message, &t.Statut, &t.DateCreation, &t.IDUtilisateur, &t.EmailExpediteur)
		tickets = append(tickets, t)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tickets)
}

func GetTicketSupport(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	var t Ticket
	err := config.DB.QueryRow(
		`SELECT id_ticket, COALESCE(sujet,''), COALESCE(message,''), COALESCE(statut,'ouvert'), date_creation, id_utilisateur, COALESCE(email_expediteur,'')
		 FROM ticket_support WHERE id_ticket = $1`, id).Scan(
		&t.ID, &t.Sujet, &t.Message, &t.Statut, &t.DateCreation, &t.IDUtilisateur, &t.EmailExpediteur)
	if err != nil {
		jsonErr(w, "Ticket not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(t)
}

func CreateTicketSupport(w http.ResponseWriter, r *http.Request) {
	userID, isAuth := getUserID(r)

	var body struct {
		Subject string `json:"subject"`
		Message string `json:"message"`
		Email   string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Subject == "" || body.Message == "" {
		jsonErr(w, "Subject and message are required", http.StatusBadRequest)
		return
	}

	var t Ticket
	if isAuth {
		t.IDUtilisateur = &userID
		config.DB.QueryRow(
			`INSERT INTO ticket_support (sujet, message, id_utilisateur) VALUES ($1,$2,$3) RETURNING id_ticket, date_creation`,
			body.Subject, body.Message, userID).Scan(&t.ID, &t.DateCreation)
	} else {
		if body.Email == "" {
			jsonErr(w, "Email is required for guest submissions", http.StatusBadRequest)
			return
		}
		t.EmailExpediteur = body.Email
		config.DB.QueryRow(
			`INSERT INTO ticket_support (sujet, message, email_expediteur) VALUES ($1,$2,$3) RETURNING id_ticket, date_creation`,
			body.Subject, body.Message, body.Email).Scan(&t.ID, &t.DateCreation)
	}
	t.Sujet = body.Subject
	t.Message = body.Message
	t.Statut = "ouvert"

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(t)
}

func UpdateTicketSupport(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) }
func DeleteTicketSupport(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) }

// Notification Handlers (stubs)

func GetNotifications(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode([]interface{}{})
}
func GetNotification(w http.ResponseWriter, r *http.Request)   { w.WriteHeader(http.StatusNotFound) }
func CreateNotification(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) }
func UpdateNotification(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) }
func DeleteNotification(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) }
