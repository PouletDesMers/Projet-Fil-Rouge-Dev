package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"api/logger"
)

// responseRecorder capture le status code de la réponse HTTP.
type responseRecorder struct {
	http.ResponseWriter
	statusCode int
}

func newResponseRecorder(w http.ResponseWriter) *responseRecorder {
	return &responseRecorder{w, http.StatusOK}
}

func (rr *responseRecorder) WriteHeader(code int) {
	rr.statusCode = code
	rr.ResponseWriter.WriteHeader(code)
}

// routeDescription retourne un libellé métier lisible pour une paire méthode+route.
func routeDescription(method, path string) string {
	switch {
	case method == "POST" && strings.HasPrefix(path, "/api/login"):
		return "Tentative de connexion"
	case strings.Contains(path, "/logout"):
		return "Déconnexion"
	case strings.Contains(path, "/user/profile"):
		return "Consultation du profil"
	case method == "PUT" && strings.Contains(path, "/user/"):
		return "Mise à jour du profil"
	case strings.Contains(path, "/users/exists"):
		return "Vérification existence email"
	case method == "POST" && path == "/api/users":
		return "Création de compte"
	case method == "GET" && strings.Contains(path, "/produit"):
		return "Consultation produits"
	case method == "POST" && strings.Contains(path, "/produit"):
		return "Création d'un produit"
	case method == "PUT" && strings.Contains(path, "/produit"):
		return "Modification d'un produit"
	case method == "DELETE" && strings.Contains(path, "/produit"):
		return "Suppression d'un produit"
	case method == "GET" && strings.Contains(path, "/categorie"):
		return "Consultation catégories"
	case method == "POST" && strings.Contains(path, "/categorie"):
		return "Création d'une catégorie"
	case method == "PUT" && strings.Contains(path, "/categorie"):
		return "Modification d'une catégorie"
	case method == "DELETE" && strings.Contains(path, "/categorie"):
		return "Suppression d'une catégorie"
	case strings.Contains(path, "/logs/stats"):
		return "Stats des logs (admin)"
	case method == "GET" && strings.HasSuffix(path, "/logs"):
		return "Consultation des logs (admin)"
	case method == "DELETE" && strings.HasSuffix(path, "/logs"):
		return "Purge des logs (admin)"
	case strings.Contains(path, "/cache/stats"):
		return "Stats du cache (admin)"
	case strings.Contains(path, "/cache/flush"):
		return "Purge du cache (admin)"
	case strings.Contains(path, "/billing") || strings.Contains(path, "/subscription"):
		return "Opération facturation"
	case strings.Contains(path, "/api-keys") || strings.Contains(path, "/apikeys"):
		return "Gestion clés API"
	case strings.Contains(path, "/support") || strings.Contains(path, "/ticket"):
		return "Support / tickets"
	case strings.Contains(path, "/images") || strings.Contains(path, "/carousel"):
		return "Gestion des images"
	case strings.Contains(path, "/entreprise"):
		return "Gestion entreprises"
	case strings.Contains(path, "/tarification"):
		return "Gestion tarifications"
	default:
		return ""
	}
}

func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ip := GetClientIP(r)

		rr := newResponseRecorder(w)
		next.ServeHTTP(rr, r)

		duration := time.Since(start)
		status := rr.statusCode

		// Lire le userID depuis le header interne posé par authMiddleware
		userID := 0
		if uid := rr.Header().Get("X-Auth-User-ID"); uid != "" {
			if n, err := strconv.Atoi(uid); err == nil {
				userID = n
			}
		}
		rr.Header().Del("X-Auth-User-ID")

		level := logger.LogLevelINFO
		path := r.URL.Path
		method := r.Method
		msg := routeDescription(method, path)

		switch {
		case status >= 500:
			level = logger.LogLevelERROR
			msg = fmt.Sprintf("Erreur serveur (%d) — %s", status, routeDescription(method, path))
		case status == 429:
			level = logger.LogLevelSECURITY
			msg = fmt.Sprintf("Rate limit dépassé depuis %s", ip)
		case status == 403:
			level = logger.LogLevelWARN
			msg = fmt.Sprintf("Accès refusé — %s", routeDescription(method, path))
		case status == 401:
			level = logger.LogLevelWARN
			msg = fmt.Sprintf("Non authentifié — %s", routeDescription(method, path))
		case status == 404:
			msg = fmt.Sprintf("Ressource introuvable : %s", path)
		case strings.HasPrefix(path, "/api/login") && status == 200:
			level = logger.LogLevelSECURITY
			msg = fmt.Sprintf("Connexion réussie depuis %s", ip)
		case strings.HasPrefix(path, "/api/login") && status >= 400:
			level = logger.LogLevelSECURITY
			msg = fmt.Sprintf("Échec de connexion depuis %s", ip)
		}

		logger.AppLogger.LogRequest(level, method, path, ip, userID, status, duration, msg)
	})
}
