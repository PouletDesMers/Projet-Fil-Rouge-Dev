package rbac

import (
	"database/sql"
	"log"
	"sync"
	"time"

	"api/config"
)

// Permission cache to avoid N+1 queries
type PermissionCache struct {
	userPermissions map[int][]map[string]interface{}
	mu              sync.RWMutex
	ttl             time.Duration
	lastUpdate      map[int]time.Time
}

var cache = &PermissionCache{
	userPermissions: make(map[int][]map[string]interface{}),
	lastUpdate:      make(map[int]time.Time),
	ttl:             5 * time.Minute,
}

// HasPermission checks if user has specific permission
func HasPermission(userID int, permission string) (bool, error) {
	perms, err := GetUserPermissions(userID)
	if err != nil {
		return false, err
	}

	for _, p := range perms {
		if code, ok := p["code"].(string); ok && code == permission {
			return true, nil
		}
	}
	return false, nil
}

// HasAnyPermission checks if user has any of the permissions
func HasAnyPermission(userID int, permissions []string) (bool, error) {
	userPerms, err := GetUserPermissions(userID)
	if err != nil {
		return false, err
	}

	for _, needed := range permissions {
		for _, have := range userPerms {
			if code, ok := have["code"].(string); ok && code == needed {
				return true, nil
			}
		}
	}
	return false, nil
}

// GetUserPermissions returns all permissions for a user
func GetUserPermissions(userID int) ([]map[string]interface{}, error) {
	cache.mu.RLock()
	if perms, ok := cache.userPermissions[userID]; ok {
		if time.Since(cache.lastUpdate[userID]) < cache.ttl {
			cache.mu.RUnlock()
			return perms, nil
		}
	}
	cache.mu.RUnlock()

	// Fetch from DB — retourne des objets complets (code, description, categorie)
	rows, err := config.DB.Query(`
		SELECT p.code, p.description, COALESCE(p.categorie, 'Autre')
		FROM user_roles ur
		JOIN role_permissions rp ON ur.id_role = rp.id_role
		JOIN permissions p ON rp.id_permission = p.id_permission
		WHERE ur.id_utilisateur = $1 AND p.actif = TRUE
		ORDER BY p.categorie, p.code
	`, userID)

	if err != nil {
		if err == sql.ErrNoRows {
			return []map[string]interface{}{}, nil
		}
		log.Printf("Error fetching user permissions: %v", err)
		return nil, err
	}
	defer rows.Close()

	var perms []map[string]interface{}
	for rows.Next() {
		var code, description, categorie string
		if err := rows.Scan(&code, &description, &categorie); err != nil {
			continue
		}
		perms = append(perms, map[string]interface{}{
			"code":        code,
			"description": description,
			"categorie":   categorie,
		})
	}

	// Update cache
	cache.mu.Lock()
	cache.userPermissions[userID] = perms
	cache.lastUpdate[userID] = time.Now()
	cache.mu.Unlock()

	return perms, nil
}

// InvalidateUserCache clears cache for a user
func InvalidateUserCache(userID int) {
	cache.mu.Lock()
	delete(cache.userPermissions, userID)
	delete(cache.lastUpdate, userID)
	cache.mu.Unlock()
}

// InvalidateAllCache clears entire cache
func InvalidateAllCache() {
	cache.mu.Lock()
	cache.userPermissions = make(map[int][]map[string]interface{})
	cache.lastUpdate = make(map[int]time.Time)
	cache.mu.Unlock()
}
