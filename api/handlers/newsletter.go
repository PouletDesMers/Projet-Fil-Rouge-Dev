package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"

	"api/config"
	mw "api/middleware"
)

// Subscribe user to newsletter
func SubscribeNewsletter(w http.ResponseWriter, r *http.Request) {
	var data struct {
		Email string `json:"email"`
	}

	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		jsonErr(w, "Invalid request", http.StatusBadRequest)
		return
	}

	data.Email = mw.SanitizeString(data.Email)
	if !mw.IsValidEmail(data.Email) {
		jsonErr(w, "Invalid email", http.StatusBadRequest)
		return
	}

	_, err := config.DB.Exec(`
		INSERT INTO newsletter_subscribers (email, is_subscribed)
		VALUES ($1, TRUE)
		ON CONFLICT (email) DO UPDATE SET is_subscribed = TRUE, unsubscribed_at = NULL
	`, data.Email)

	if err != nil {
		log.Printf("Error subscribing to newsletter: %v", err)
		jsonErr(w, "Failed to subscribe", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Subscribed to newsletter"})
}

// Unsubscribe from newsletter
func UnsubscribeNewsletter(w http.ResponseWriter, r *http.Request) {
	var data struct {
		Email string `json:"email"`
	}

	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		jsonErr(w, "Invalid request", http.StatusBadRequest)
		return
	}

	_, err := config.DB.Exec(`
		UPDATE newsletter_subscribers
		SET is_subscribed = FALSE, unsubscribed_at = NOW()
		WHERE email = $1
	`, data.Email)

	if err != nil {
		jsonErr(w, "Failed to unsubscribe", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Unsubscribed"})
}

// Get newsletter subscribers (admin)
func GetNewsletterSubscribers(w http.ResponseWriter, r *http.Request) {
	page := r.URL.Query().Get("page")
	if page == "" {
		page = "1"
	}

	offset := (atoi(page) - 1) * 50

	rows, err := config.DB.Query(`
		SELECT id_subscriber, email, is_subscribed, subscribed_at
		FROM newsletter_subscribers
		WHERE is_subscribed = TRUE
		ORDER BY subscribed_at DESC
		LIMIT 50 OFFSET $1
	`, offset)

	if err != nil {
		jsonErr(w, "Failed to fetch subscribers", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var subscribers []map[string]interface{}
	for rows.Next() {
		var id int
		var email string
		var isSubscribed bool
		var subscribedAt sql.NullTime

		if err := rows.Scan(&id, &email, &isSubscribed, &subscribedAt); err != nil {
			continue
		}

		subscribers = append(subscribers, map[string]interface{}{
			"id":           id,
			"email":        email,
			"isSubscribed": isSubscribed,
			"subscribedAt": subscribedAt.Time,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(subscribers)
}

// Get newsletter campaigns
func GetNewsletterCampaigns(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(`
		SELECT id_campaign, title, content, status, created_by, created_at, sent_at
		FROM newsletter_campaigns
		ORDER BY created_at DESC
	`)

	if err != nil {
		jsonErr(w, "Failed to fetch campaigns", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var campaigns []map[string]interface{}
	for rows.Next() {
		var id, createdBy int
		var title, content, status string
		var createdAt sql.NullTime
		var sentAt sql.NullTime

		if err := rows.Scan(&id, &title, &content, &status, &createdBy, &createdAt, &sentAt); err != nil {
			continue
		}

		campaigns = append(campaigns, map[string]interface{}{
			"id":         id,
			"title":      title,
			"content":    content,
			"status":     status,
			"created_by": createdBy,
			"created_at": createdAt.Time,
			"sent_at":    sentAt.Time,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(campaigns)
}

// Create newsletter campaign
func CreateNewsletterCampaign(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var data struct {
		Title   string `json:"title"`
		Content string `json:"content"`
	}

	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		jsonErr(w, "Invalid request", http.StatusBadRequest)
		return
	}

	data.Title = mw.SanitizeString(data.Title)
	data.Content = mw.SanitizeString(data.Content)

	var campaignID int
	err := config.DB.QueryRow(`
		INSERT INTO newsletter_campaigns (title, content, status, created_by)
		VALUES ($1, $2, 'draft', $3)
		RETURNING id_campaign
	`, data.Title, data.Content, userID).Scan(&campaignID)

	if err != nil {
		jsonErr(w, "Failed to create campaign", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id_campaign": campaignID,
		"message":     "Campaign created",
	})
}

// Send newsletter campaign
func SendNewsletterCampaign(w http.ResponseWriter, r *http.Request) {
	campaignID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid campaign ID", http.StatusBadRequest)
		return
	}

	// Get campaign
	var title, content string
	row := config.DB.QueryRow(`
		SELECT title, content FROM newsletter_campaigns WHERE id_campaign = $1
	`, campaignID)

	if err := row.Scan(&title, &content); err != nil {
		if err == sql.ErrNoRows {
			jsonErr(w, "Campaign not found", http.StatusNotFound)
		} else {
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
		}
		return
	}

	// Get subscribers
	subRows, err := config.DB.Query(`
		SELECT email FROM newsletter_subscribers WHERE is_subscribed = TRUE
	`)
	if err != nil {
		jsonErr(w, "Failed to get subscribers", http.StatusInternalServerError)
		return
	}
	defer subRows.Close()

	var sentCount int
	for subRows.Next() {
		var email string
		if err := subRows.Scan(&email); err != nil {
			continue
		}

		// TODO: Send email via Node.js endpoint
		// For now, just insert send record
		_, err := config.DB.Exec(`
			INSERT INTO newsletter_campaign_sends (id_campaign, recipient_email, status)
			VALUES ($1, $2, 'sent')
		`, campaignID, email)

		if err == nil {
			sentCount++
		}
	}

	// Update campaign status
	config.DB.Exec(`
		UPDATE newsletter_campaigns SET status = 'sent', sent_at = NOW() WHERE id_campaign = $1
	`, campaignID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":   "Campaign sent",
		"sentCount": sentCount,
	})
}

func atoi(s string) int {
	i, _ := strconv.Atoi(s)
	if i < 1 {
		i = 1
	}
	return i
}
