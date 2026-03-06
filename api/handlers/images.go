package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"

	"api/config"
	"api/models"
	mw "api/middleware"
)

func GetCarouselImages(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(
		`SELECT id_image, titre, COALESCE(description,''), url_image, COALESCE(alt_text,''),
		        COALESCE(ordre_affichage,0), COALESCE(actif,false),
		        COALESCE(date_creation,NOW()), COALESCE(date_modification,NOW()), id_utilisateur_creation
		 FROM carousel_images ORDER BY ordre_affichage ASC`)
	if err != nil {
		log.Printf("Error fetching carousel images: %v", err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	images := []models.CarouselImage{}
	for rows.Next() {
		var img models.CarouselImage
		if err := rows.Scan(&img.ID, &img.Titre, &img.Description, &img.URLImage, &img.AltText,
			&img.OrdreAffichage, &img.Actif, &img.DateCreation, &img.DateModification, &img.IDUtilisateurCreation); err != nil {
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		images = append(images, img)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(images)
}

func GetActiveCarouselImages(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(
		`SELECT id_image, titre, COALESCE(description,''), url_image, COALESCE(alt_text,''),
		        COALESCE(ordre_affichage,0), COALESCE(date_creation,NOW())
		 FROM carousel_images WHERE actif = TRUE ORDER BY ordre_affichage ASC`)
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	images := []models.CarouselImage{}
	for rows.Next() {
		var img models.CarouselImage
		if err := rows.Scan(&img.ID, &img.Titre, &img.Description, &img.URLImage, &img.AltText,
			&img.OrdreAffichage, &img.DateCreation); err != nil {
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		img.Actif = true
		images = append(images, img)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(images)
}

func GetCarouselImage(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var img models.CarouselImage
	if err := config.DB.QueryRow(
		`SELECT id_image, titre, COALESCE(description,''), url_image, COALESCE(alt_text,''),
		        COALESCE(ordre_affichage,0), COALESCE(actif,false),
		        COALESCE(date_creation,NOW()), COALESCE(date_modification,NOW()), id_utilisateur_creation
		 FROM carousel_images WHERE id_image = $1`, id).Scan(
		&img.ID, &img.Titre, &img.Description, &img.URLImage, &img.AltText,
		&img.OrdreAffichage, &img.Actif, &img.DateCreation, &img.DateModification, &img.IDUtilisateurCreation); err != nil {
		jsonErr(w, "Image not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(img)
}

func CreateCarouselImage(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var img models.CarouselImage
	if err := json.NewDecoder(r.Body).Decode(&img); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	img.Titre = mw.SanitizeString(img.Titre)
	img.Description = mw.SanitizeString(img.Description)
	img.AltText = mw.SanitizeString(img.AltText)
	if img.Titre == "" || img.URLImage == "" {
		jsonErr(w, "Title and URL are required", http.StatusBadRequest)
		return
	}
	if img.AltText == "" { img.AltText = img.Titre }
	if img.OrdreAffichage == 0 {
		var maxOrder int
		config.DB.QueryRow("SELECT COALESCE(MAX(ordre_affichage), 0) FROM carousel_images").Scan(&maxOrder)
		img.OrdreAffichage = maxOrder + 1
	}
	if err := config.DB.QueryRow("INSERT INTO carousel_images (titre, description, url_image, alt_text, ordre_affichage, actif, id_utilisateur_creation) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id_image, date_creation, date_modification",
		img.Titre, img.Description, img.URLImage, img.AltText, img.OrdreAffichage, img.Actif, userID).Scan(
		&img.ID, &img.DateCreation, &img.DateModification); err != nil {
		log.Printf("Error creating carousel image: %v", err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	img.IDUtilisateurCreation = &userID
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(img)
}

func UpdateCarouselImage(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	var cur models.CarouselImage
	if err := config.DB.QueryRow(
		`SELECT id_image, titre, COALESCE(description,''), url_image, COALESCE(alt_text,''),
		        COALESCE(ordre_affichage,0), COALESCE(actif,false),
		        COALESCE(date_creation,NOW()), COALESCE(date_modification,NOW()), id_utilisateur_creation
		 FROM carousel_images WHERE id_image = $1`, id).Scan(
		&cur.ID, &cur.Titre, &cur.Description, &cur.URLImage, &cur.AltText,
		&cur.OrdreAffichage, &cur.Actif, &cur.DateCreation, &cur.DateModification, &cur.IDUtilisateurCreation); err != nil {
		jsonErr(w, "Image not found", http.StatusNotFound)
		return
	}
	var updates models.CarouselImage
	json.NewDecoder(r.Body).Decode(&updates)
	if updates.Titre != "" { cur.Titre = mw.SanitizeString(updates.Titre) }
	if updates.Description != "" { cur.Description = mw.SanitizeString(updates.Description) }
	if updates.URLImage != "" { cur.URLImage = updates.URLImage }
	if updates.AltText != "" { cur.AltText = mw.SanitizeString(updates.AltText) }
	if updates.OrdreAffichage != 0 { cur.OrdreAffichage = updates.OrdreAffichage }
	cur.Actif = updates.Actif

	now := time.Now()
	if _, err := config.DB.Exec("UPDATE carousel_images SET titre=$1, description=$2, url_image=$3, alt_text=$4, ordre_affichage=$5, actif=$6, date_modification=$7 WHERE id_image=$8",
		cur.Titre, cur.Description, cur.URLImage, cur.AltText, cur.OrdreAffichage, cur.Actif, now, id); err != nil {
		log.Printf("Error updating carousel image %d: %v", id, err)
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	cur.DateModification = now
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cur)
}

func DeleteCarouselImage(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	config.DB.Exec("DELETE FROM carousel_images WHERE id_image = $1", id)
	w.WriteHeader(http.StatusNoContent)
}

func ReorderCarouselImages(w http.ResponseWriter, r *http.Request) {
	var orderData struct {
		ImageOrders []struct {
			ID    int `json:"id"`
			Order int `json:"order"`
		} `json:"image_orders"`
	}
	if err := json.NewDecoder(r.Body).Decode(&orderData); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if len(orderData.ImageOrders) == 0 {
		jsonErr(w, "No image orders provided", http.StatusBadRequest)
		return
	}
	tx, err := config.DB.Begin()
	if err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()
	for _, item := range orderData.ImageOrders {
		if _, err := tx.Exec("UPDATE carousel_images SET ordre_affichage=$1, date_modification=NOW() WHERE id_image=$2", item.Order, item.ID); err != nil {
			jsonErr(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		jsonErr(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Order updated successfully"})
}
