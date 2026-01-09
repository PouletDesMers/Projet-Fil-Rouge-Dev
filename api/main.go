package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/mux"
)

func generateRandomToken() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)
}

func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Unauthorized: Missing Token", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Unauthorized: Invalid Token Format", http.StatusUnauthorized)
			return
		}

		token := parts[1]
		var userID int

		// 1. Check if it's a valid session token
		err := db.QueryRow("SELECT id_utilisateur FROM session_utilisateur WHERE token_session = $1 AND est_valide = TRUE AND date_expiration > NOW()", token).Scan(&userID)
		if err == nil {
			// Valid session found!
			ctx := context.WithValue(r.Context(), UserIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		// 2. Check if it's a valid API token
		err = db.QueryRow("SELECT id_utilisateur FROM api_token WHERE cle_api = $1 AND est_actif = TRUE", token).Scan(&userID)
		if err == nil {
			db.Exec("UPDATE api_token SET dernier_usage = NOW() WHERE cle_api = $1", token)
			ctx := context.WithValue(r.Context(), UserIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		// 3. Check if it's the master secret from env (used by Proxy)
		masterSecret := os.Getenv("API_SECRET")
		if masterSecret != "" && token == masterSecret {
			// For the master secret, we might not have a specific user ID.
			// Let's try to find an admin or just use a dummy.
			// Improved logic: find the first admin.
			err = db.QueryRow("SELECT id_utilisateur FROM utilisateur WHERE role = 'admin' LIMIT 1").Scan(&userID)
			if err != nil {
				// If no admin, fallback to anything or 0
				db.QueryRow("SELECT id_utilisateur FROM utilisateur LIMIT 1").Scan(&userID)
			}
			ctx := context.WithValue(r.Context(), UserIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		log.Printf("Unauthorized access attempt with token: %s...", token[:5])
		http.Error(w, "Unauthorized: Invalid Token", http.StatusUnauthorized)
	})
}

func main() {
	initDB()

	// Auto-generate a token if the table is empty (initial setup)
	var count int
	db.QueryRow("SELECT COUNT(*) FROM api_token").Scan(&count)
	if count == 0 {
		newToken := generateRandomToken()
		// Get first user (usually admin if created) or create dummy
		var userID int
		err := db.QueryRow("SELECT id_utilisateur FROM utilisateur LIMIT 1").Scan(&userID)
		if err == nil {
			_, err = db.Exec("INSERT INTO api_token (cle_api, nom, permissions, id_utilisateur) VALUES ($1, $2, $3, $4)",
				newToken, "System Token", "all", userID)
			if err == nil {
				log.Printf("========================================")
				log.Printf("NEW SYSTEM API TOKEN GENERATED:")
				log.Printf("%s", newToken)
				log.Printf("========================================")
			}
		}
	}

	r := mux.NewRouter()

	// Public routes (No Auth required)
	r.HandleFunc("/api/login", loginUtilisateur).Methods("POST")
	r.HandleFunc("/api/utilisateurs", createUtilisateur).Methods("POST")
	r.HandleFunc("/api/utilisateurs/exists", getUtilisateurExists).Methods("GET")

	// Protected routes
	api := r.PathPrefix("/api").Subrouter()
	api.Use(authMiddleware)

	api.HandleFunc("/categories", getCategories).Methods("GET")
	api.HandleFunc("/categories", createCategorie).Methods("POST")
	api.HandleFunc("/categories/{id}", getCategorie).Methods("GET")
	api.HandleFunc("/categories/{id}", updateCategorie).Methods("PUT")
	api.HandleFunc("/categories/{id}", deleteCategorie).Methods("DELETE")
	api.HandleFunc("/services", getServices).Methods("GET")
	api.HandleFunc("/services", createService).Methods("POST")
	api.HandleFunc("/services/{id}", getService).Methods("GET")
	api.HandleFunc("/services/{id}", updateService).Methods("PUT")
	api.HandleFunc("/services/{id}", deleteService).Methods("DELETE")
	api.HandleFunc("/produits", getProduits).Methods("GET")
	api.HandleFunc("/produits", createProduit).Methods("POST")
	api.HandleFunc("/produits/{id}", getProduit).Methods("GET")
	api.HandleFunc("/produits/{id}", updateProduit).Methods("PUT")
	api.HandleFunc("/produits/{id}", deleteProduit).Methods("DELETE")
	api.HandleFunc("/tarifications", getTarifications).Methods("GET")
	api.HandleFunc("/tarifications", createTarification).Methods("POST")
	api.HandleFunc("/tarifications/{id}", getTarification).Methods("GET")
	api.HandleFunc("/tarifications/{id}", updateTarification).Methods("PUT")
	api.HandleFunc("/tarifications/{id}", deleteTarification).Methods("DELETE")
	api.HandleFunc("/entreprises", getEntreprises).Methods("GET")
	api.HandleFunc("/entreprises", createEntreprise).Methods("POST")
	api.HandleFunc("/entreprises/{id}", getEntreprise).Methods("GET")
	api.HandleFunc("/entreprises/{id}", updateEntreprise).Methods("PUT")
	api.HandleFunc("/entreprises/{id}", deleteEntreprise).Methods("DELETE")
	api.HandleFunc("/utilisateurs", getUtilisateurs).Methods("GET")
	api.HandleFunc("/utilisateurs/{id}", getUtilisateur).Methods("GET")
	api.HandleFunc("/utilisateurs/{id}", updateUtilisateur).Methods("PUT")
	api.HandleFunc("/utilisateurs/{id}", deleteUtilisateur).Methods("DELETE")
	api.HandleFunc("/user/profile", getUserProfile).Methods("GET")
	api.HandleFunc("/user/profile", updateUserProfile).Methods("PUT")

	api.HandleFunc("/webauthn/register-challenge", getWebAuthnRegisterChallenge).Methods("GET")
	api.HandleFunc("/webauthn/register", registerWebAuthn).Methods("POST")
	api.HandleFunc("/webauthn/remove", removeWebAuthn).Methods("DELETE")

	api.HandleFunc("/user/2fa/setup", setup2FA).Methods("POST")
	api.HandleFunc("/user/2fa/verify", verify2FA).Methods("POST")
	api.HandleFunc("/user/2fa/remove", remove2FA).Methods("DELETE")

	api.HandleFunc("/abonnements", getAbonnements).Methods("GET")
	api.HandleFunc("/abonnements", createAbonnement).Methods("POST")
	api.HandleFunc("/abonnements/{id}", getAbonnement).Methods("GET")
	api.HandleFunc("/abonnements/{id}", updateAbonnement).Methods("PUT")
	api.HandleFunc("/abonnements/{id}", deleteAbonnement).Methods("DELETE")
	api.HandleFunc("/commandes", getCommandes).Methods("GET")
	api.HandleFunc("/commandes", createCommande).Methods("POST")
	api.HandleFunc("/commandes/{id}", getCommande).Methods("GET")
	api.HandleFunc("/commandes/{id}", updateCommande).Methods("PUT")
	api.HandleFunc("/commandes/{id}", deleteCommande).Methods("DELETE")
	api.HandleFunc("/factures", getFactures).Methods("GET")
	api.HandleFunc("/factures", createFacture).Methods("POST")
	api.HandleFunc("/factures/{id}", getFacture).Methods("GET")
	api.HandleFunc("/factures/{id}", updateFacture).Methods("PUT")
	api.HandleFunc("/factures/{id}", deleteFacture).Methods("DELETE")
	api.HandleFunc("/paiements", getPaiements).Methods("GET")
	api.HandleFunc("/paiements", createPaiement).Methods("POST")
	api.HandleFunc("/paiements/{id}", getPaiement).Methods("GET")
	api.HandleFunc("/paiements/{id}", updatePaiement).Methods("PUT")
	api.HandleFunc("/paiements/{id}", deletePaiement).Methods("DELETE")
	api.HandleFunc("/tickets", getTicketSupports).Methods("GET")
	api.HandleFunc("/tickets", createTicketSupport).Methods("POST")
	api.HandleFunc("/tickets/{id}", getTicketSupport).Methods("GET")
	api.HandleFunc("/tickets/{id}", updateTicketSupport).Methods("PUT")
	api.HandleFunc("/tickets/{id}", deleteTicketSupport).Methods("DELETE")
	api.HandleFunc("/notifications", getNotifications).Methods("GET")
	api.HandleFunc("/notifications", createNotification).Methods("POST")
	api.HandleFunc("/notifications/{id}", getNotification).Methods("GET")
	api.HandleFunc("/notifications/{id}", updateNotification).Methods("PUT")
	api.HandleFunc("/notifications/{id}", deleteNotification).Methods("DELETE")

	log.Println("API démarrée en HTTP sur le port 8080")

	http.ListenAndServe(":8080", r)
}
