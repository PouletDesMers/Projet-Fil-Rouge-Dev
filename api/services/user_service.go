package services

import (
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"api/models"
	mw "api/middleware"
	"api/repositories"
)

type UserService struct {
	repo *repositories.UserRepo
}

func NewUserService(repo *repositories.UserRepo) *UserService {
	return &UserService{repo: repo}
}

var ErrInvalidCredentials = errors.New("invalid credentials")

var ErrAccountDisabled = errors.New("account is disabled")

var ErrRequires2FA = errors.New("2fa required")

var ErrInvalid2FA = errors.New("invalid 2fa code")

type LoginResult struct {
	UserID int
	Token  string
}

func (s *UserService) Login(email, password, totpCode string, generateToken func() string) (LoginResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))

	id, hash, totpSecret, totpEnabled, err := s.repo.FindByEmail(email)
	if err != nil {
		return LoginResult{}, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return LoginResult{}, ErrInvalidCredentials
	}

	// Vérification TOTP
	if totpEnabled && totpSecret != nil && *totpSecret != "" {
		if totpCode == "" {
			return LoginResult{}, ErrRequires2FA
		}
		// La validation TOTP effective est faite dans le handler (dépendance externe)
		// On retourne un sentinel spécial pour que le handler sache qu'il doit valider
	}

	statut, _ := s.repo.FindStatutByID(id)
	if statut != "actif" {
		return LoginResult{}, ErrAccountDisabled
	}

	token := generateToken()
	if err := s.repo.CreateSession(token, id); err != nil {
		return LoginResult{}, errors.New("internal server error")
	}
	s.repo.TouchLastLogin(id)

	return LoginResult{UserID: id, Token: token}, nil
}

func (s *UserService) LoginInfo(email string) (id int, hash string, totpSecret *string, totpEnabled bool, err error) {
	return s.repo.FindByEmail(email)
}

func (s *UserService) GetAll() ([]models.Utilisateur, error) {
	users, err := s.repo.FindAll()
	if err != nil {
		return nil, err
	}
	for i := range users {
		users[i].MotDePasse = ""
		users[i].EstActif = (users[i].Statut == "actif")
		users[i].DateInscription = users[i].DateCreation
	}
	return users, nil
}

func (s *UserService) GetByID(id int) (models.Utilisateur, error) {
	u, err := s.repo.FindByID(id)
	if err != nil {
		return u, err
	}
	u.MotDePasse = ""
	u.EstActif = (u.Statut == "actif")
	u.DateInscription = u.DateCreation
	return u, nil
}

func (s *UserService) Create(u models.Utilisateur) (models.Utilisateur, error) {
	u.Email = strings.ToLower(strings.TrimSpace(u.Email))
	if u.Email == "" || !mw.IsValidEmail(u.Email) {
		return u, errors.New("valid email is required")
	}
	u.Nom = mw.SanitizeString(u.Nom)
	u.Prenom = mw.SanitizeString(u.Prenom)
	u.Telephone = mw.SanitizeString(u.Telephone)

	exists, err := s.repo.ExistsByEmail(u.Email)
	if err != nil {
		return u, errors.New("internal server error")
	}
	if exists {
		return u, errors.New("an account with this email already exists")
	}

	u.Role = "client"
	if u.Statut == "" { u.Statut = "actif" }

	if u.MotDePasse == "" {
		return u, errors.New("password is required")
	}
	if !mw.IsValidPassword(u.MotDePasse) {
		return u, errors.New("password must be at least 8 characters with uppercase, lowercase and digit")
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(u.MotDePasse), bcrypt.DefaultCost)
	if err != nil {
		return u, errors.New("internal server error")
	}
	u.MotDePasse = string(hashed)

	id, err := s.repo.Create(&u)
	if err != nil {
		return u, errors.New("internal server error")
	}
	u.ID = id
	u.MotDePasse = ""
	return u, nil
}

func (s *UserService) UpdateByAdmin(id int, patch models.Utilisateur) (models.Utilisateur, error) {
	cur, err := s.repo.FindForUpdate(id)
	if err != nil {
		return cur, errors.New("user not found")
	}
	cur.EstActif = (cur.Statut == "actif")

	if patch.Email != "" { cur.Email = patch.Email }
	if patch.Nom != "" { cur.Nom = patch.Nom }
	if patch.Prenom != "" { cur.Prenom = patch.Prenom }
	if patch.Telephone != "" { cur.Telephone = patch.Telephone }
	if patch.Role != "" { cur.Role = patch.Role }
	if patch.Statut != "" { cur.Statut = patch.Statut }

	if patch.EstActif != cur.EstActif {
		if patch.EstActif { cur.Statut = "actif" } else { cur.Statut = "inactif" }
		cur.EstActif = patch.EstActif
	}

	if patch.MotDePasse != "" {
		if !mw.IsValidPassword(patch.MotDePasse) {
			return cur, errors.New("password must be at least 8 characters with uppercase, lowercase and digit")
		}
		hashed, err := bcrypt.GenerateFromPassword([]byte(patch.MotDePasse), bcrypt.DefaultCost)
		if err != nil {
			return cur, errors.New("internal server error")
		}
		cur.MotDePasse = string(hashed)
	}

	if err := s.repo.Update(&cur); err != nil {
		return cur, errors.New("internal server error")
	}
	cur.MotDePasse = ""
	return cur, nil
}

func (s *UserService) Delete(id, requestingUserID int) error {
	if id == requestingUserID {
		return errors.New("cannot delete your own account")
	}
	n, err := s.repo.Delete(id)
	if err != nil {
		return errors.New("internal server error")
	}
	if n == 0 {
		return errors.New("user not found")
	}
	return nil
}

func (s *UserService) ExistsByEmail(email string) (bool, error) {
	count, err := s.repo.CountByEmail(strings.ToLower(strings.TrimSpace(email)))
	return count > 0, err
}

func (s *UserService) IsAdmin(userID int) bool {
	role, err := s.repo.FindRoleByID(userID)
	return err == nil && role == "admin"
}

func (s *UserService) GetProfile(userID int) (models.Utilisateur, error) {
	return s.repo.FindProfile(userID)
}

func (s *UserService) UpdateProfile(userID int, prenom, nom, email, phone string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	prenom = mw.SanitizeString(prenom)
	nom = mw.SanitizeString(nom)
	phone = mw.SanitizeString(phone)

	if email != "" && !mw.IsValidEmail(email) {
		return errors.New("invalid email format")
	}
	return s.repo.UpdateProfile(userID, prenom, nom, email, phone)
}

func (s *UserService) ChangePassword(userID int, oldPassword, newPassword string) error {
	if !mw.IsValidPassword(newPassword) {
		return errors.New("password must be at least 8 characters with uppercase, lowercase and digit")
	}
	currentHash, err := s.repo.FindHashedPassword(userID)
	if err != nil {
		return errors.New("user not found")
	}
	if oldPassword == "" {
		return errors.New("current password required")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(oldPassword)); err != nil {
		return errors.New("current password is incorrect")
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("internal server error")
	}
	return s.repo.UpdatePassword(userID, string(newHash))
}

func (s *UserService) GetEmailForTOTP(userID int) (string, error) {
	return s.repo.FindEmailByID(userID)
}

func (s *UserService) EnableTOTP(userID int, secret string) error {
	return s.repo.EnableTOTP(userID, secret)
}

func (s *UserService) DisableTOTP(targetUserID int) error {
	_, err := s.repo.DisableTOTP(targetUserID)
	return err
}

func (s *UserService) GetEmailForWebAuthn(userID int) (string, error) {
	return s.repo.FindEmailByID(userID)
}

func (s *UserService) RegisterWebAuthn(userID int, credID, publicKey string) error {
	return s.repo.RegisterWebAuthnCredential(userID, credID, publicKey)
}

func (s *UserService) RemoveWebAuthn(userID int) error {
	return s.repo.RemoveWebAuthnCredential(userID)
}

func (s *UserService) ResetTOTPAdmin(targetUserID int) error {
	n, err := s.repo.DisableTOTP(targetUserID)
	if err != nil {
		return errors.New("error resetting 2fa")
	}
	if n == 0 {
		return errors.New("user not found")
	}
	return nil
}
