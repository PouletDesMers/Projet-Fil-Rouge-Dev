package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/mux"
)

// ===== RATE LIMITER =====

type rateLimiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
	max      int
	window   time.Duration
}

func newRateLimiter(max int, window time.Duration) *rateLimiter {
	rl := &rateLimiter{
		attempts: make(map[string][]time.Time),
		max:      max,
		window:   window,
	}
	// Nettoyage périodique des entrées expirées
	go func() {
		for {
			time.Sleep(window)
			rl.mu.Lock()
			now := time.Now()
			for ip, timestamps := range rl.attempts {
				var valid []time.Time
				for _, t := range timestamps {
					if now.Sub(t) < rl.window {
						valid = append(valid, t)
					}
				}
				if len(valid) == 0 {
					delete(rl.attempts, ip)
				} else {
					rl.attempts[ip] = valid
				}
			}
			rl.mu.Unlock()
		}
	}()
	return rl
}

func (rl *rateLimiter) isAllowed(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	var valid []time.Time
	for _, t := range rl.attempts[ip] {
		if now.Sub(t) < rl.window {
			valid = append(valid, t)
		}
	}

	if len(valid) >= rl.max {
		rl.attempts[ip] = valid
		return false
	}

	rl.attempts[ip] = append(valid, now)
	return true
}

// Rate limiters globaux
var (
	loginLimiter    = newRateLimiter(5, 1*time.Minute)   // 5 tentatives/min
	registerLimiter = newRateLimiter(3, 5*time.Minute)   // 3 créations/5min
	apiLimiter      = newRateLimiter(100, 1*time.Minute) // 100 req/min globales
)

func getClientIP(r *http.Request) string {
	// En production, utiliser X-Real-IP ou X-Forwarded-For du reverse proxy de confiance
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		return strings.Split(forwarded, ",")[0]
	}
	return strings.Split(r.RemoteAddr, ":")[0]
}

func rateLimitMiddleware(limiter *rateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := getClientIP(r)
			if !limiter.isAllowed(ip) {
				log.Printf("SECURITY: Rate limit exceeded for IP: %s on %s %s", ip, r.Method, r.URL.Path)
				w.Header().Set("Retry-After", "60")
				http.Error(w, `{"error":"Too many requests. Please try again later."}`, http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ===== INPUT VALIDATION HELPERS =====

func isValidEmail(email string) bool {
	if len(email) < 5 || len(email) > 254 {
		return false
	}
	atIndex := strings.Index(email, "@")
	if atIndex < 1 {
		return false
	}
	dotIndex := strings.LastIndex(email, ".")
	if dotIndex < atIndex+2 || dotIndex >= len(email)-1 {
		return false
	}
	return true
}

func isValidPassword(password string) bool {
	if len(password) < 8 || len(password) > 128 {
		return false
	}
	var hasUpper, hasLower, hasDigit bool
	for _, c := range password {
		switch {
		case 'A' <= c && c <= 'Z':
			hasUpper = true
		case 'a' <= c && c <= 'z':
			hasLower = true
		case '0' <= c && c <= '9':
			hasDigit = true
		}
	}
	return hasUpper && hasLower && hasDigit
}

// sanitizeString supprime les caractères dangereux
func sanitizeString(s string) string {
	s = strings.TrimSpace(s)
	// Remplacer les caractères HTML dangereux
	replacer := strings.NewReplacer("<", "&lt;", ">", "&gt;", "\"", "&quot;", "'", "&#39;")
	return replacer.Replace(s)
}

// jsonError envoie une erreur JSON standardisée sans exposer les détails internes
func jsonError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

// ===== ADMIN MIDDLEWARE =====

type roleKey string

const UserRoleKey roleKey = "userRole"

func adminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := r.Context().Value(UserIDKey).(int)
		if !ok {
			jsonError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		var role string
		err := db.QueryRow("SELECT role FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&role)
		if err != nil || role != "admin" {
			jsonError(w, "Forbidden: Admin access required", http.StatusForbidden)
			return
		}

		ctx := context.WithValue(r.Context(), UserRoleKey, role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func generateRandomToken() string {
	b := make([]byte, 32) // 256 bits au lieu de 128
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)
}

// ===== SECURITY HEADERS MIDDLEWARE =====

func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		w.Header().Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		next.ServeHTTP(w, r)
	})
}

// ===== MAX BODY SIZE MIDDLEWARE =====

const maxBodySize = 1 << 20 // 1 MB

func maxBodySizeMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.ContentLength > maxBodySize {
			http.Error(w, `{"error":"Request body too large"}`, http.StatusRequestEntityTooLarge)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)
		next.ServeHTTP(w, r)
	})
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

		// Ne pas logger le token même partiellement pour éviter les fuites
		log.Printf("SECURITY: Unauthorized access attempt from %s on %s", getClientIP(r), r.URL.Path)
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
	})
}

func main() {
	initDB()
	initCache()

	// Auto-generate a token if the table is empty (initial setup)
	var count int
	db.QueryRow("SELECT COUNT(*) FROM api_token").Scan(&count)
	if count == 0 {
		newToken := generateRandomToken()
		var userID int
		err := db.QueryRow("SELECT id_utilisateur FROM utilisateur LIMIT 1").Scan(&userID)
		if err == nil {
			_, err = db.Exec("INSERT INTO api_token (cle_api, nom, permissions, id_utilisateur) VALUES ($1, $2, $3, $4)",
				newToken, "System Token", "all", userID)
			if err == nil {
				// SÉCURITÉ: Log le token une seule fois au démarrage, idéalement le stocker en vault
				log.Printf("System API token generated successfully (check DB for the key)")
			}
		}
	}

	r := mux.NewRouter()
	mainRouter = r

	// Apply global middlewares (ordre important: security headers → body limit → CORS → rate limit global → logging)
	r.Use(securityHeadersMiddleware)
	r.Use(maxBodySizeMiddleware)
	r.Use(corsMiddleware)
	r.Use(rateLimitMiddleware(apiLimiter))
	r.Use(requestLoggingMiddleware)

	// Public routes with rate limiting renforcé
	r.Handle("/api/login", rateLimitMiddleware(loginLimiter)(http.HandlerFunc(loginUtilisateur))).Methods("POST")
	r.Handle("/api/users", rateLimitMiddleware(registerLimiter)(http.HandlerFunc(createUtilisateur))).Methods("POST")
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

	// Cache management (admin only)
	r.Handle("/api/cache/stats", authMiddleware(adminMiddleware(http.HandlerFunc(getCacheStats)))).Methods("GET")
	r.Handle("/api/cache/flush", authMiddleware(adminMiddleware(http.HandlerFunc(flushCache)))).Methods("POST")

	// Logs (admin only)
	r.Handle("/api/logs", authMiddleware(adminMiddleware(http.HandlerFunc(getLogs)))).Methods("GET")
	r.Handle("/api/logs/stats", authMiddleware(adminMiddleware(http.HandlerFunc(getLogStats)))).Methods("GET")
	r.Handle("/api/logs", authMiddleware(adminMiddleware(http.HandlerFunc(clearLogs)))).Methods("DELETE")

	// Configuration du serveur avec timeouts de sécurité
	port := os.Getenv("API_PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           r,
		ReadTimeout:       10 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1 MB
	}

	// Graceful shutdown
	go func() {
		log.Printf("API started on port %s (HTTP)", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced shutdown: %v", err)
	}

	// Fermer la connexion DB
	if db != nil {
		db.Close()
	}

	log.Println("Server stopped gracefully")
}
