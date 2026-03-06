package repositories

import (
	"database/sql"

	"api/models"
)

type ImagesRepo struct {
	DB *sql.DB
}

func NewImagesRepo(db *sql.DB) *ImagesRepo { return &ImagesRepo{DB: db} }

const imgSelectFull = `
	SELECT id_image, titre, COALESCE(description,''), url_image, COALESCE(alt_text,''),
	       COALESCE(ordre_affichage,0), COALESCE(actif,false),
	       COALESCE(date_creation,NOW()), COALESCE(date_modification,NOW()), id_utilisateur_creation
	FROM carousel_images`

func (r *ImagesRepo) FindAll() ([]models.CarouselImage, error) {
	rows, err := r.DB.Query(imgSelectFull + " ORDER BY ordre_affichage ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanImages(rows, true)
}

func (r *ImagesRepo) FindActive() ([]models.CarouselImage, error) {
	rows, err := r.DB.Query(`
		SELECT id_image, titre, COALESCE(description,''), url_image, COALESCE(alt_text,''),
		       COALESCE(ordre_affichage,0), COALESCE(date_creation,NOW())
		FROM carousel_images WHERE actif=TRUE ORDER BY ordre_affichage ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	images := []models.CarouselImage{}
	for rows.Next() {
		var img models.CarouselImage
		if err := rows.Scan(&img.ID, &img.Titre, &img.Description, &img.URLImage, &img.AltText,
			&img.OrdreAffichage, &img.DateCreation); err != nil {
			return nil, err
		}
		img.Actif = true
		images = append(images, img)
	}
	return images, nil
}

func (r *ImagesRepo) FindByID(id int) (models.CarouselImage, error) {
	var img models.CarouselImage
	err := r.DB.QueryRow(imgSelectFull+" WHERE id_image=$1", id).Scan(
		&img.ID, &img.Titre, &img.Description, &img.URLImage, &img.AltText,
		&img.OrdreAffichage, &img.Actif, &img.DateCreation, &img.DateModification, &img.IDUtilisateurCreation)
	return img, err
}

func (r *ImagesRepo) MaxOrdre() int {
	var maxOrder int
	r.DB.QueryRow("SELECT COALESCE(MAX(ordre_affichage),0) FROM carousel_images").Scan(&maxOrder)
	return maxOrder
}

func (r *ImagesRepo) Create(img *models.CarouselImage, creatorID int) error {
	return r.DB.QueryRow(
		"INSERT INTO carousel_images (titre, description, url_image, alt_text, ordre_affichage, actif, id_utilisateur_creation) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id_image, date_creation, date_modification",
		img.Titre, img.Description, img.URLImage, img.AltText, img.OrdreAffichage, img.Actif, creatorID).Scan(
		&img.ID, &img.DateCreation, &img.DateModification)
}

func (r *ImagesRepo) Update(img *models.CarouselImage) error {
	_, err := r.DB.Exec(
		"UPDATE carousel_images SET titre=$1, description=$2, url_image=$3, alt_text=$4, ordre_affichage=$5, actif=$6, date_modification=NOW() WHERE id_image=$7",
		img.Titre, img.Description, img.URLImage, img.AltText, img.OrdreAffichage, img.Actif, img.ID)
	return err
}

func (r *ImagesRepo) Delete(id int) error {
	_, err := r.DB.Exec("DELETE FROM carousel_images WHERE id_image=$1", id)
	return err
}

func scanImages(rows *sql.Rows, withCreator bool) ([]models.CarouselImage, error) {
	images := []models.CarouselImage{}
	for rows.Next() {
		var img models.CarouselImage
		var err error
		if withCreator {
			err = rows.Scan(&img.ID, &img.Titre, &img.Description, &img.URLImage, &img.AltText,
				&img.OrdreAffichage, &img.Actif, &img.DateCreation, &img.DateModification, &img.IDUtilisateurCreation)
		} else {
			err = rows.Scan(&img.ID, &img.Titre, &img.Description, &img.URLImage, &img.AltText,
				&img.OrdreAffichage, &img.DateCreation)
			img.Actif = true
		}
		if err != nil {
			return nil, err
		}
		images = append(images, img)
	}
	return images, nil
}
