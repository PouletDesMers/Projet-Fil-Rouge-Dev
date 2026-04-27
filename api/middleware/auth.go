package middleware

import (
	"context"
	"net/http"
	"strings"

	"api/config"
	"api/models"
)

func Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := extractToken(r)
		if token == "" {
			http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var userID int
		var role string
		err := config.DB.QueryRow(`
			SELECT u.id_utilisateur, COALESCE(LOWER(u.role), 'client')
			FROM session_utilisateur s
			JOIN utilisateur u ON s.id_utilisateur = u.id_utilisateur
			WHERE s.token_session = $1
			  AND s.date_expiration > NOW()
			  AND COALESCE(u.statut,'actif') = 'actif'`, token).Scan(&userID, &role)
		if err != nil {
			http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), models.UserIDKey, userID)
		ctx = context.WithValue(ctx, models.UserRoleKey, role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func Admin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role, _ := r.Context().Value(models.UserRoleKey).(string)
		if role != "admin" {
			http.Error(w, `{"error":"Forbidden: Admin access required"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// extractToken lit le Bearer token depuis le header Authorization.
func extractToken(r *http.Request) string {
	// Priorité : header Authorization
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimPrefix(authHeader, "Bearer ")
	}
	// Fallback : cookie
	if cookie, err := r.Cookie("session_token"); err == nil {
		return cookie.Value
	}
	return ""
}
