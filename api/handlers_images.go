package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

// Get all carousel images
func getCarouselImages(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_image, titre, description, url_image, alt_text, ordre_affichage, actif, date_creation, date_modification, id_utilisateur_creation FROM carousel_images ORDER BY ordre_affichage ASC")
	if err != nil {
		log.Printf("Error fetching carousel images: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var images []CarouselImage
	for rows.Next() {
		var img CarouselImage
		err := rows.Scan(&img.ID, &img.Titre, &img.Description, &img.URLImage, &img.AltText, &img.OrdreAffichage, &img.Actif, &img.DateCreation, &img.DateModification, &img.IDUtilisateurCreation)
		if err != nil {
			log.Printf("Error scanning carousel image: %v", err)
			jsonError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		images = append(images, img)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(images)
}

// Get active carousel images only (for frontend)
func getActiveCarouselImages(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id_image, titre, description, url_image, alt_text, ordre_affichage, date_creation FROM carousel_images WHERE actif = TRUE ORDER BY ordre_affichage ASC")
	if err != nil {
		log.Printf("Error fetching active carousel images: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var images []CarouselImage
	for rows.Next() {
		var img CarouselImage
		err := rows.Scan(&img.ID, &img.Titre, &img.Description, &img.URLImage, &img.AltText, &img.OrdreAffichage, &img.DateCreation)
		if err != nil {
			log.Printf("Error scanning active carousel image: %v", err)
			jsonError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		img.Actif = true
		images = append(images, img)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(images)
}

// Get single carousel image
func getCarouselImage(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	var img CarouselImage
	err = db.QueryRow("SELECT id_image, titre, description, url_image, alt_text, ordre_affichage, actif, date_creation, date_modification, id_utilisateur_creation FROM carousel_images WHERE id_image = $1", id).Scan(&img.ID, &img.Titre, &img.Description, &img.URLImage, &img.AltText, &img.OrdreAffichage, &img.Actif, &img.DateCreation, &img.DateModification, &img.IDUtilisateurCreation)
	if err != nil {
		jsonError(w, "Image not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(img)
}

// Create carousel image
func createCarouselImage(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		jsonError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var img CarouselImage
	if err := json.NewDecoder(r.Body).Decode(&img); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Sanitiser et valider
	img.Titre = sanitizeString(img.Titre)
	img.Description = sanitizeString(img.Description)
	img.AltText = sanitizeString(img.AltText)

	if img.Titre == "" || img.URLImage == "" {
		jsonError(w, "Title and URL are required", http.StatusBadRequest)
		return
	}

	if img.AltText == "" {
		img.AltText = img.Titre
	}
	if img.OrdreAffichage == 0 {
		var maxOrder int
		db.QueryRow("SELECT COALESCE(MAX(ordre_affichage), 0) FROM carousel_images").Scan(&maxOrder)
		img.OrdreAffichage = maxOrder + 1
	}

	err := db.QueryRow("INSERT INTO carousel_images (titre, description, url_image, alt_text, ordre_affichage, actif, id_utilisateur_creation) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_image, date_creation, date_modification",
		img.Titre, img.Description, img.URLImage, img.AltText, img.OrdreAffichage, img.Actif, userID).Scan(&img.ID, &img.DateCreation, &img.DateModification)
	if err != nil {
		log.Printf("Error creating carousel image: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	img.IDUtilisateurCreation = &userID
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(img)
}

// Update carousel image
func updateCarouselImage(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	var currentImg CarouselImage
	err = db.QueryRow("SELECT id_image, titre, description, url_image, alt_text, ordre_affichage, actif, date_creation, date_modification, id_utilisateur_creation FROM carousel_images WHERE id_image = $1", id).Scan(&currentImg.ID, &currentImg.Titre, &currentImg.Description, &currentImg.URLImage, &currentImg.AltText, &currentImg.OrdreAffichage, &currentImg.Actif, &currentImg.DateCreation, &currentImg.DateModification, &currentImg.IDUtilisateurCreation)
	if err != nil {
		jsonError(w, "Image not found", http.StatusNotFound)
		return
	}

	var updates CarouselImage
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if updates.Titre != "" {
		currentImg.Titre = sanitizeString(updates.Titre)
	}
	if updates.Description != "" {
		currentImg.Description = sanitizeString(updates.Description)
	}
	if updates.URLImage != "" {
		currentImg.URLImage = updates.URLImage
	}
	if updates.AltText != "" {
		currentImg.AltText = sanitizeString(updates.AltText)
	}
	if updates.OrdreAffichage != 0 {
		currentImg.OrdreAffichage = updates.OrdreAffichage
	}
	currentImg.Actif = updates.Actif

	now := time.Now()
	_, err = db.Exec("UPDATE carousel_images SET titre = $1, description = $2, url_image = $3, alt_text = $4, ordre_affichage = $5, actif = $6, date_modification = $7 WHERE id_image = $8",
		currentImg.Titre, currentImg.Description, currentImg.URLImage, currentImg.AltText, currentImg.OrdreAffichage, currentImg.Actif, now, id)
	if err != nil {
		log.Printf("Error updating carousel image %d: %v", id, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	currentImg.DateModification = now
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(currentImg)
}

// Delete carousel image
func deleteCarouselImage(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		jsonError(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	_, err = db.Exec("DELETE FROM carousel_images WHERE id_image = $1", id)
	if err != nil {
		log.Printf("Error deleting carousel image %d: %v", id, err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
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
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(orderData.ImageOrders) == 0 {
		jsonError(w, "No image orders provided", http.StatusBadRequest)
		return
	}

	tx, err := db.Begin()
	if err != nil {
		log.Printf("Error starting transaction: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	for _, item := range orderData.ImageOrders {
		_, err := tx.Exec("UPDATE carousel_images SET ordre_affichage = $1, date_modification = NOW() WHERE id_image = $2", item.Order, item.ID)
		if err != nil {
			log.Printf("Error reordering image %d: %v", item.ID, err)
			jsonError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("Error committing reorder: %v", err)
		jsonError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Order updated successfully"})
}
