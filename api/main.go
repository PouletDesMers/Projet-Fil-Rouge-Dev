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

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// SÉCURISÉ: Seulement les domaines autorisés
		allowedOrigins := []string{
			"http://localhost:3000",
			"https://cyna.fr",
			"https://app.cyna.fr",
		}

		origin := r.Header.Get("Origin")
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				break
			}
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
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

		// 3. Check if it's the master secret from env (used by Proxy ONLY)
		masterSecret := os.Getenv("API_SECRET")
		if masterSecret != "" && token == masterSecret {
			// SÉCURISÉ: Master secret seulement pour le proxy interne
			// Vérifier que la requête vient du proxy (IP locale)
			clientIP := r.Header.Get("X-Forwarded-For")
			if clientIP == "" {
				clientIP = r.RemoteAddr
			}

			// Autoriser seulement localhost/docker
			if !strings.HasPrefix(clientIP, "127.0.0.1") && !strings.HasPrefix(clientIP, "172.") && !strings.HasPrefix(clientIP, "::1") {
				log.Printf("SECURITY: Master secret used from unauthorized IP: %s", clientIP)
				http.Error(w, "Unauthorized: Invalid Source", http.StatusUnauthorized)
				return
			}

			// Utiliser un utilisateur système dédié
			err = db.QueryRow("SELECT id_utilisateur FROM utilisateur WHERE email = 'system@cyna.fr' AND role = 'admin' LIMIT 1").Scan(&userID)
			if err != nil {
				log.Printf("SECURITY: No system user found for master secret")
				http.Error(w, "Unauthorized: System User Not Found", http.StatusUnauthorized)
				return
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
	mainRouter = r // expose globally for dynamic swagger spec

	// Apply CORS middleware globally
	r.Use(corsMiddleware)

	// Public routes (No Auth required) - Define these FIRST with exact paths
	r.HandleFunc("/api/login", loginUtilisateur).Methods("POST")
	r.HandleFunc("/api/users", createUtilisateur).Methods("POST")
	r.HandleFunc("/api/users/exists", getUtilisateurExists).Methods("GET")

	// Protected routes - Use full paths with authMiddleware
	r.Handle("/api/categories", authMiddleware(http.HandlerFunc(getCategories))).Methods("GET")
	r.Handle("/api/categories", authMiddleware(http.HandlerFunc(createCategorie))).Methods("POST")
	r.Handle("/api/categories/{id}", authMiddleware(http.HandlerFunc(updateCategorie))).Methods("PUT")
	r.Handle("/api/categories/{id}", authMiddleware(http.HandlerFunc(deleteCategorie))).Methods("DELETE")
	r.Handle("/api/produits", authMiddleware(http.HandlerFunc(getProduits))).Methods("GET")
	r.Handle("/api/produits", authMiddleware(http.HandlerFunc(createProduit))).Methods("POST")
	r.Handle("/api/produits/{id}", authMiddleware(http.HandlerFunc(updateProduit))).Methods("PUT")
	r.Handle("/api/produits/{id}", authMiddleware(http.HandlerFunc(deleteProduit))).Methods("DELETE")
	r.Handle("/api/tarifications", authMiddleware(http.HandlerFunc(getTarifications))).Methods("GET")
	r.Handle("/api/tarifications", authMiddleware(http.HandlerFunc(createTarification))).Methods("POST")
	r.Handle("/api/tarifications/{id}", authMiddleware(http.HandlerFunc(getTarification))).Methods("GET")
	r.Handle("/api/tarifications/{id}", authMiddleware(http.HandlerFunc(updateTarification))).Methods("PUT")
	r.Handle("/api/tarifications/{id}", authMiddleware(http.HandlerFunc(deleteTarification))).Methods("DELETE")
	r.Handle("/api/entreprises", authMiddleware(http.HandlerFunc(getEntreprises))).Methods("GET")
	r.Handle("/api/entreprises", authMiddleware(http.HandlerFunc(createEntreprise))).Methods("POST")
	r.Handle("/api/entreprises/{id}", authMiddleware(http.HandlerFunc(getEntreprise))).Methods("GET")
	r.Handle("/api/entreprises/{id}", authMiddleware(http.HandlerFunc(updateEntreprise))).Methods("PUT")
	r.Handle("/api/entreprises/{id}", authMiddleware(http.HandlerFunc(deleteEntreprise))).Methods("DELETE")
	r.Handle("/api/users", authMiddleware(http.HandlerFunc(getusers))).Methods("GET")
	r.Handle("/api/users/{id}", authMiddleware(http.HandlerFunc(getUtilisateur))).Methods("GET")
	r.Handle("/api/users/{id}", authMiddleware(http.HandlerFunc(updateUtilisateur))).Methods("PUT")
	r.Handle("/api/users/{id}", authMiddleware(http.HandlerFunc(deleteUtilisateur))).Methods("DELETE")
	r.Handle("/api/users/{id}/reset-2fa", authMiddleware(http.HandlerFunc(resetUser2FA))).Methods("POST")
	r.Handle("/api/user/profile", authMiddleware(http.HandlerFunc(getUserProfile))).Methods("GET")
	r.Handle("/api/user/profile", authMiddleware(http.HandlerFunc(updateUserProfile))).Methods("PUT")

	// API Tokens management (admin only)
	r.Handle("/api/api-tokens", authMiddleware(http.HandlerFunc(getAPITokens))).Methods("GET")
	r.Handle("/api/api-tokens", authMiddleware(http.HandlerFunc(createAPIToken))).Methods("POST")
	r.Handle("/api/api-tokens/{id}", authMiddleware(http.HandlerFunc(deleteAPIToken))).Methods("DELETE")
	r.Handle("/api/api-tokens/{id}/status", authMiddleware(http.HandlerFunc(toggleAPITokenStatus))).Methods("PUT")

	// WebAuthn and 2FA routes (protected)
	r.Handle("/api/webauthn/register-challenge", authMiddleware(http.HandlerFunc(getWebAuthnRegisterChallenge))).Methods("GET")
	r.Handle("/api/webauthn/register", authMiddleware(http.HandlerFunc(registerWebAuthn))).Methods("POST")
	r.Handle("/api/webauthn/remove", authMiddleware(http.HandlerFunc(removeWebAuthn))).Methods("DELETE")
	r.Handle("/api/user/2fa/setup", authMiddleware(http.HandlerFunc(setup2FA))).Methods("POST")
	r.Handle("/api/user/2fa/verify", authMiddleware(http.HandlerFunc(verify2FA))).Methods("POST")
	r.Handle("/api/user/2fa/remove", authMiddleware(http.HandlerFunc(remove2FA))).Methods("DELETE")

	// Billing routes (protected)
	r.Handle("/api/abonnements", authMiddleware(http.HandlerFunc(getAbonnements))).Methods("GET")
	r.Handle("/api/abonnements", authMiddleware(http.HandlerFunc(createAbonnement))).Methods("POST")
	r.Handle("/api/abonnements/{id}", authMiddleware(http.HandlerFunc(getAbonnement))).Methods("GET")
	r.Handle("/api/abonnements/{id}", authMiddleware(http.HandlerFunc(updateAbonnement))).Methods("PUT")
	r.Handle("/api/abonnements/{id}", authMiddleware(http.HandlerFunc(deleteAbonnement))).Methods("DELETE")
	r.Handle("/api/commandes", authMiddleware(http.HandlerFunc(getCommandes))).Methods("GET")
	r.Handle("/api/commandes", authMiddleware(http.HandlerFunc(createCommande))).Methods("POST")
	r.Handle("/api/commandes/{id}", authMiddleware(http.HandlerFunc(getCommande))).Methods("GET")
	r.Handle("/api/commandes/{id}", authMiddleware(http.HandlerFunc(updateCommande))).Methods("PUT")
	r.Handle("/api/commandes/{id}", authMiddleware(http.HandlerFunc(deleteCommande))).Methods("DELETE")
	r.Handle("/api/factures", authMiddleware(http.HandlerFunc(getFactures))).Methods("GET")
	r.Handle("/api/factures", authMiddleware(http.HandlerFunc(createFacture))).Methods("POST")
	r.Handle("/api/factures/{id}", authMiddleware(http.HandlerFunc(getFacture))).Methods("GET")
	r.Handle("/api/factures/{id}", authMiddleware(http.HandlerFunc(updateFacture))).Methods("PUT")
	r.Handle("/api/factures/{id}", authMiddleware(http.HandlerFunc(deleteFacture))).Methods("DELETE")
	r.Handle("/api/paiements", authMiddleware(http.HandlerFunc(getPaiements))).Methods("GET")
	r.Handle("/api/paiements", authMiddleware(http.HandlerFunc(createPaiement))).Methods("POST")
	r.Handle("/api/paiements/{id}", authMiddleware(http.HandlerFunc(getPaiement))).Methods("GET")
	r.Handle("/api/paiements/{id}", authMiddleware(http.HandlerFunc(updatePaiement))).Methods("PUT")
	r.Handle("/api/paiements/{id}", authMiddleware(http.HandlerFunc(deletePaiement))).Methods("DELETE")

	// Support tickets (protected)
	r.Handle("/api/tickets", authMiddleware(http.HandlerFunc(getTicketSupports))).Methods("GET")
	r.Handle("/api/tickets", authMiddleware(http.HandlerFunc(createTicketSupport))).Methods("POST")
	r.Handle("/api/tickets/{id}", authMiddleware(http.HandlerFunc(getTicketSupport))).Methods("GET")
	r.Handle("/api/tickets/{id}", authMiddleware(http.HandlerFunc(updateTicketSupport))).Methods("PUT")
	r.Handle("/api/tickets/{id}", authMiddleware(http.HandlerFunc(deleteTicketSupport))).Methods("DELETE")

	// Notifications (protected)
	r.Handle("/api/notifications", authMiddleware(http.HandlerFunc(getNotifications))).Methods("GET")
	r.Handle("/api/notifications", authMiddleware(http.HandlerFunc(createNotification))).Methods("POST")
	r.Handle("/api/notifications/{id}", authMiddleware(http.HandlerFunc(getNotification))).Methods("GET")
	r.Handle("/api/notifications/{id}", authMiddleware(http.HandlerFunc(updateNotification))).Methods("PUT")
	r.Handle("/api/notifications/{id}", authMiddleware(http.HandlerFunc(deleteNotification))).Methods("DELETE")

	// Carousel Images routes (protected)
	r.Handle("/api/carousel-images", authMiddleware(http.HandlerFunc(getCarouselImages))).Methods("GET")
	r.Handle("/api/carousel-images", authMiddleware(http.HandlerFunc(createCarouselImage))).Methods("POST")
	r.Handle("/api/carousel-images/{id}", authMiddleware(http.HandlerFunc(getCarouselImage))).Methods("GET")
	r.Handle("/api/carousel-images/{id}", authMiddleware(http.HandlerFunc(updateCarouselImage))).Methods("PUT")
	r.Handle("/api/carousel-images/{id}", authMiddleware(http.HandlerFunc(deleteCarouselImage))).Methods("DELETE")
	r.Handle("/api/carousel-images/reorder", authMiddleware(http.HandlerFunc(reorderCarouselImages))).Methods("POST")

	// Web Categories routes (protected)
	r.Handle("/api/web-categories", authMiddleware(http.HandlerFunc(getCategories))).Methods("GET")
	r.Handle("/api/web-categories", authMiddleware(http.HandlerFunc(createCategorie))).Methods("POST")
	r.Handle("/api/web-categories/{id}", authMiddleware(http.HandlerFunc(updateCategorie))).Methods("PUT")
	r.Handle("/api/web-categories/{id}", authMiddleware(http.HandlerFunc(deleteCategorie))).Methods("DELETE")

	// Web Products routes (protected)
	r.Handle("/api/web-products", authMiddleware(http.HandlerFunc(getProduits))).Methods("GET")
	r.Handle("/api/web-products", authMiddleware(http.HandlerFunc(createProduit))).Methods("POST")
	r.Handle("/api/web-products/{id}", authMiddleware(http.HandlerFunc(updateProduit))).Methods("PUT")
	r.Handle("/api/web-products/{id}", authMiddleware(http.HandlerFunc(deleteProduit))).Methods("DELETE")

	// Public carousel images (no auth required)
	r.HandleFunc("/api/public/carousel-images", getActiveCarouselImages).Methods("GET")

	// Public categories and products (no auth required)
	r.HandleFunc("/api/public/categories", getActiveCategories).Methods("GET")
	r.HandleFunc("/api/public/products/{slug}", getActiveProduitsByCategory).Methods("GET")
	r.HandleFunc("/api/public/search", searchProduits).Methods("GET")

	// Dynamic OpenAPI spec (public — no auth required)
	r.HandleFunc("/api/swagger.json", getSwaggerSpec).Methods("GET")

	log.Println("API started in HTTP on port 8080")

	http.ListenAndServe(":8080", r)
}
