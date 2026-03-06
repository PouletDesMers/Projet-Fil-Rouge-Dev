package repositories

import (
	"database/sql"
	"time"

	"api/models"
)

type UserRepo struct {
	DB *sql.DB
}

func NewUserRepo(db *sql.DB) *UserRepo { return &UserRepo{DB: db} }

func (r *UserRepo) FindByEmail(email string) (id int, hash string, totpSecret *string, totpEnabled bool, err error) {
	err = r.DB.QueryRow(
		"SELECT id_utilisateur, mot_de_passe, totp_secret, totp_enabled FROM utilisateur WHERE email = $1",
		email).Scan(&id, &hash, &totpSecret, &totpEnabled)
	return
}

func (r *UserRepo) FindStatutByID(id int) (string, error) {
	var s string
	err := r.DB.QueryRow("SELECT statut FROM utilisateur WHERE id_utilisateur = $1", id).Scan(&s)
	return s, err
}

func (r *UserRepo) FindRoleByID(id int) (string, error) {
	var role string
	err := r.DB.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", id).Scan(&role)
	return role, err
}

func (r *UserRepo) FindByID(id int) (models.Utilisateur, error) {
	var u models.Utilisateur
	err := r.DB.QueryRow(`
		SELECT id_utilisateur, email,
		       COALESCE(nom,''), COALESCE(prenom,''), COALESCE(telephone,''),
		       COALESCE(role,'client'), COALESCE(statut,'actif'),
		       COALESCE(totp_enabled,false), COALESCE(date_creation,NOW()),
		       derniere_connexion, id_entreprise
		FROM utilisateur WHERE id_utilisateur = $1`, id).Scan(
		&u.ID, &u.Email, &u.Nom, &u.Prenom, &u.Telephone,
		&u.Role, &u.Statut, &u.TotpEnabled, &u.DateCreation,
		&u.DerniereConnexion, &u.IDEntreprise)
	return u, err
}

func (r *UserRepo) FindProfile(id int) (models.Utilisateur, error) {
	var u models.Utilisateur
	err := r.DB.QueryRow(`
		SELECT id_utilisateur, email,
		       COALESCE(nom,''), COALESCE(prenom,''), COALESCE(telephone,''),
		       COALESCE(role,'client'), COALESCE(statut,'actif'),
		       COALESCE(date_creation,NOW()), derniere_connexion, id_entreprise,
		       totp_secret, COALESCE(totp_enabled,false),
		       webauthn_credential_id, webauthn_public_key, webauthn_counter
		FROM utilisateur WHERE id_utilisateur = $1`, id).Scan(
		&u.ID, &u.Email, &u.Nom, &u.Prenom, &u.Telephone,
		&u.Role, &u.Statut, &u.DateCreation, &u.DerniereConnexion, &u.IDEntreprise,
		&u.TotpSecret, &u.TotpEnabled,
		&u.WebAuthnCredentialID, &u.WebAuthnPublicKey, &u.WebAuthnCounter)
	return u, err
}

func (r *UserRepo) FindAll() ([]models.Utilisateur, error) {
	rows, err := r.DB.Query(`
		SELECT id_utilisateur, email,
		       COALESCE(nom,''), COALESCE(prenom,''), COALESCE(telephone,''),
		       COALESCE(role,'client'), COALESCE(statut,'actif'),
		       COALESCE(totp_enabled,false), COALESCE(date_creation,NOW()),
		       derniere_connexion, id_entreprise
		FROM utilisateur`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []models.Utilisateur{}
	for rows.Next() {
		var u models.Utilisateur
		if err := rows.Scan(
			&u.ID, &u.Email, &u.Nom, &u.Prenom, &u.Telephone,
			&u.Role, &u.Statut, &u.TotpEnabled, &u.DateCreation,
			&u.DerniereConnexion, &u.IDEntreprise); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

func (r *UserRepo) ExistsByEmail(email string) (bool, error) {
	var exists bool
	err := r.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM utilisateur WHERE email = $1)", email).Scan(&exists)
	return exists, err
}

func (r *UserRepo) FindHashedPassword(id int) (string, error) {
	var h string
	err := r.DB.QueryRow("SELECT mot_de_passe FROM utilisateur WHERE id_utilisateur = $1", id).Scan(&h)
	return h, err
}

func (r *UserRepo) FindForUpdate(id int) (models.Utilisateur, error) {
	var u models.Utilisateur
	err := r.DB.QueryRow(`
		SELECT id_utilisateur, email, mot_de_passe,
		       COALESCE(nom,''), COALESCE(prenom,''), COALESCE(telephone,''),
		       COALESCE(role,'client'), COALESCE(statut,'actif'), id_entreprise
		FROM utilisateur WHERE id_utilisateur = $1`, id).Scan(
		&u.ID, &u.Email, &u.MotDePasse, &u.Nom, &u.Prenom, &u.Telephone,
		&u.Role, &u.Statut, &u.IDEntreprise)
	return u, err
}

func (r *UserRepo) Create(u *models.Utilisateur) (int, error) {
	var id int
	err := r.DB.QueryRow(
		"INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, telephone, role, statut, id_entreprise) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id_utilisateur",
		u.Email, u.MotDePasse, u.Nom, u.Prenom, u.Telephone, u.Role, u.Statut, u.IDEntreprise,
	).Scan(&id)
	return id, err
}

func (r *UserRepo) Update(u *models.Utilisateur) error {
	_, err := r.DB.Exec(
		"UPDATE utilisateur SET email=$1, mot_de_passe=$2, nom=$3, prenom=$4, telephone=$5, role=$6, statut=$7, id_entreprise=$8 WHERE id_utilisateur=$9",
		u.Email, u.MotDePasse, u.Nom, u.Prenom, u.Telephone, u.Role, u.Statut, u.IDEntreprise, u.ID)
	return err
}

func (r *UserRepo) UpdateProfile(id int, prenom, nom, email, telephone string) error {
	_, err := r.DB.Exec(
		"UPDATE utilisateur SET prenom=$1, nom=$2, email=$3, telephone=$4 WHERE id_utilisateur=$5",
		prenom, nom, email, telephone, id)
	return err
}

func (r *UserRepo) UpdatePassword(id int, hashedPassword string) error {
	_, err := r.DB.Exec("UPDATE utilisateur SET mot_de_passe=$1 WHERE id_utilisateur=$2", hashedPassword, id)
	return err
}

func (r *UserRepo) Delete(id int) (int64, error) {
	res, err := r.DB.Exec("DELETE FROM utilisateur WHERE id_utilisateur = $1", id)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return n, nil
}

func (r *UserRepo) CreateSession(token string, userID int) error {
	_, err := r.DB.Exec(
		"INSERT INTO session_utilisateur (token_session, id_utilisateur, date_expiration) VALUES ($1,$2,NOW()+INTERVAL '24 hours')",
		token, userID)
	return err
}

func (r *UserRepo) TouchLastLogin(id int) {
	r.DB.Exec("UPDATE utilisateur SET derniere_connexion=NOW() WHERE id_utilisateur=$1", id)
}

func (r *UserRepo) FindEmailByID(id int) (string, error) {
	var email string
	err := r.DB.QueryRow("SELECT email FROM utilisateur WHERE id_utilisateur=$1", id).Scan(&email)
	return email, err
}

func (r *UserRepo) EnableTOTP(userID int, secret string) error {
	_, err := r.DB.Exec("UPDATE utilisateur SET totp_secret=$1, totp_enabled=TRUE WHERE id_utilisateur=$2", secret, userID)
	return err
}

func (r *UserRepo) DisableTOTP(userID int) (int64, error) {
	res, err := r.DB.Exec("UPDATE utilisateur SET totp_secret=NULL, totp_enabled=FALSE WHERE id_utilisateur=$1", userID)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return n, nil
}

func (r *UserRepo) RegisterWebAuthnCredential(userID int, credID, publicKey string) error {
	_, err := r.DB.Exec(
		"UPDATE utilisateur SET webauthn_credential_id=$1, webauthn_public_key=$2 WHERE id_utilisateur=$3",
		credID, publicKey, userID)
	return err
}

func (r *UserRepo) RemoveWebAuthnCredential(userID int) error {
	_, err := r.DB.Exec(
		"UPDATE utilisateur SET webauthn_credential_id=NULL, webauthn_public_key=NULL WHERE id_utilisateur=$1",
		userID)
	return err
}

func (r *UserRepo) CountByEmail(email string) (int, error) {
	var count int
	err := r.DB.QueryRow("SELECT COUNT(*) FROM utilisateur WHERE email=$1", email).Scan(&count)
	return count, err
}

func (r *UserRepo) FindWebAuthnChallenge(userID int) (string, error) {
	return r.FindEmailByID(userID)
}

type NullTime struct {
	Time  time.Time
	Valid bool
}

func (nt *NullTime) Scan(value interface{}) error {
	if value == nil {
		nt.Valid = false
		return nil
	}
	nt.Valid = true
	nt.Time = value.(time.Time)
	return nil
}
