package main

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

// Get all carousel images
func getCarouselImages(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_image, titre, description, url_image, alt_text, ordre_affichage, actif, date_creation, date_modification, id_utilisateur_creation FROM carousel_images ORDER BY ordre_affichage ASC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var images []CarouselImage
	for rows.Next() {
		var img CarouselImage
		err := rows.Scan(&img.ID, &img.Titre, &img.Description, &img.URLImage, &img.AltText, &img.OrdreAffichage, &img.Actif, &img.DateCreation, &img.DateModification, &img.IDUtilisateurCreation)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		images = append(images, img)
	}
	json.NewEncoder(w).Encode(images)
}

// Get active carousel images only (for frontend)
func getActiveCarouselImages(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_image, titre, description, url_image, alt_text, ordre_affichage, date_creation FROM carousel_images WHERE actif = TRUE ORDER BY ordre_affichage ASC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var images []CarouselImage
	for rows.Next() {
		var img CarouselImage
		err := rows.Scan(&img.ID, &img.Titre, &img.Description, &img.URLImage, &img.AltText, &img.OrdreAffichage, &img.DateCreation)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		img.Actif = true // We only fetch active ones
		images = append(images, img)
	}
	json.NewEncoder(w).Encode(images)
}

// Get single carousel image
func getCarouselImage(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])

	var img CarouselImage
	err := db.QueryRow("SELECT id_image, titre, description, url_image, alt_text, ordre_affichage, actif, date_creation, date_modification, id_utilisateur_creation FROM carousel_images WHERE id_image = $1", id).Scan(&img.ID, &img.Titre, &img.Description, &img.URLImage, &img.AltText, &img.OrdreAffichage, &img.Actif, &img.DateCreation, &img.DateModification, &img.IDUtilisateurCreation)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(img)
}

// Create carousel image
func createCarouselImage(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var img CarouselImage
	if err := json.NewDecoder(r.Body).Decode(&img); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validation
	if img.Titre == "" || img.URLImage == "" {
		http.Error(w, "Titre and URL are required", http.StatusBadRequest)
		return
	}

	// Set defaults
	if img.AltText == "" {
		img.AltText = img.Titre
	}
	if img.OrdreAffichage == 0 {
		// Get max order and add 1
		var maxOrder int
		db.QueryRow("SELECT COALESCE(MAX(ordre_affichage), 0) FROM carousel_images").Scan(&maxOrder)
		img.OrdreAffichage = maxOrder + 1
	}

	err := db.QueryRow("INSERT INTO carousel_images (titre, description, url_image, alt_text, ordre_affichage, actif, id_utilisateur_creation) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_image, date_creation, date_modification",
		img.Titre, img.Description, img.URLImage, img.AltText, img.OrdreAffichage, img.Actif, userID).Scan(&img.ID, &img.DateCreation, &img.DateModification)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	img.IDUtilisateurCreation = &userID
	json.NewEncoder(w).Encode(img)
}

// Update carousel image
func updateCarouselImage(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])

	// Get current image data
	var currentImg CarouselImage
	err := db.QueryRow("SELECT id_image, titre, description, url_image, alt_text, ordre_affichage, actif, date_creation, date_modification, id_utilisateur_creation FROM carousel_images WHERE id_image = $1", id).Scan(&currentImg.ID, &currentImg.Titre, &currentImg.Description, &currentImg.URLImage, &currentImg.AltText, &currentImg.OrdreAffichage, &currentImg.Actif, &currentImg.DateCreation, &currentImg.DateModification, &currentImg.IDUtilisateurCreation)
	if err != nil {
		http.Error(w, "Image not found", http.StatusNotFound)
		return
	}

	// Parse request body
	var updates CarouselImage
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Merge updates (keep current values if not provided)
	if updates.Titre != "" {
		currentImg.Titre = updates.Titre
	}
	if updates.Description != "" {
		currentImg.Description = updates.Description
	}
	if updates.URLImage != "" {
		currentImg.URLImage = updates.URLImage
	}
	if updates.AltText != "" {
		currentImg.AltText = updates.AltText
	}
	if updates.OrdreAffichage != 0 {
		currentImg.OrdreAffichage = updates.OrdreAffichage
	}

	// Always update actif status (boolean field)
	currentImg.Actif = updates.Actif

	// Update timestamp
	now := time.Now()
	_, err = db.Exec("UPDATE carousel_images SET titre = $1, description = $2, url_image = $3, alt_text = $4, ordre_affichage = $5, actif = $6, date_modification = $7 WHERE id_image = $8",
		currentImg.Titre, currentImg.Description, currentImg.URLImage, currentImg.AltText, currentImg.OrdreAffichage, currentImg.Actif, now, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Return updated image
	currentImg.DateModification = now
	json.NewEncoder(w).Encode(currentImg)
}

// Delete carousel image
func deleteCarouselImage(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])

	_, err := db.Exec("DELETE FROM carousel_images WHERE id_image = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Reorder images
func reorderCarouselImages(w http.ResponseWriter, r *http.Request) {
	var orderData struct {
		ImageOrders []struct {
			ID    int `json:"id"`
			Order int `json:"order"`
		} `json:"image_orders"`
	}

	if err := json.NewDecoder(r.Body).Decode(&orderData); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update orders in transaction
	tx, err := db.Begin()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	for _, item := range orderData.ImageOrders {
		_, err := tx.Exec("UPDATE carousel_images SET ordre_affichage = $1, date_modification = NOW() WHERE id_image = $2", item.Order, item.ID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to save order", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Order updated successfully"})
}
