package middleware

import (
	"encoding/json"
	"log"
	"net/http"

	"api/models"
	"api/rbac"
)

// RequirePermission checks if user has any of the required permissions
func RequirePermission(permissions ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := r.Context().Value(models.UserIDKey).(int)
			if !ok {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]string{"error": "Unauthorized"})
				return
			}

			has, err := rbac.HasAnyPermission(userID, permissions)
			if err != nil {
				log.Printf("Permission check error for user %d: %v", userID, err)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{"error": "Internal server error"})
				return
			}

			if !has {
				log.Printf("SECURITY: User %d denied access to %s %s", userID, r.Method, r.URL.Path)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				json.NewEncoder(w).Encode(map[string]string{"error": "Insufficient permissions"})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequirePermissionExact checks if user has exact permission
func RequirePermissionExact(permission string) func(http.Handler) http.Handler {
	return RequirePermission(permission)
}

// RequireAllPermissions checks if user has all permissions
func RequireAllPermissions(permissions ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := r.Context().Value(models.UserIDKey).(int)
			if !ok {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]string{"error": "Unauthorized"})
				return
			}

			for _, perm := range permissions {
				has, err := rbac.HasPermission(userID, perm)
				if err != nil || !has {
					log.Printf("SECURITY: User %d denied access (missing %s)", userID, perm)
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusForbidden)
					json.NewEncoder(w).Encode(map[string]string{"error": "Insufficient permissions"})
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}
