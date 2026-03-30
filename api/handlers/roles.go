package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"

	"api/config"
	"api/models"
	"api/rbac"
)

// Get all roles
func GetRoles(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(`
		SELECT id_role, nom, description, actif, date_creation
		FROM roles
		ORDER BY nom
	`)

	if err != nil {
		jsonErr(w, "Failed to fetch roles", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var roles []map[string]interface{}
	for rows.Next() {
		var id int
		var nom, description string
		var actif bool
		var dateCreation sql.NullTime

		if err := rows.Scan(&id, &nom, &description, &actif, &dateCreation); err != nil {
			continue
		}

		// Count permissions for this role
		var permCount int
		_ = config.DB.QueryRow(`
			SELECT COUNT(*) FROM role_permissions WHERE id_role = $1
		`, id).Scan(&permCount)

		roles = append(roles, map[string]interface{}{
			"id_role":          id,
			"nom":              nom,
			"description":      description,
			"actif":            actif,
			"date_creation":    dateCreation.Time,
			"permission_count": permCount,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(roles)
}

// Create a new role
func CreateRole(w http.ResponseWriter, r *http.Request) {
	var data struct {
		Nom         string `json:"nom"`
		Description string `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		jsonErr(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if data.Nom == "" {
		jsonErr(w, "Role name is required", http.StatusBadRequest)
		return
	}

	var roleID int
	err := config.DB.QueryRow(`
		INSERT INTO roles (nom, description, actif, date_creation)
		VALUES ($1, $2, TRUE, NOW())
		RETURNING id_role
	`, data.Nom, data.Description).Scan(&roleID)

	if err != nil {
		jsonErr(w, "Failed to create role", http.StatusInternalServerError)
		return
	}

	// Invalidate cache
	rbac.InvalidateAllCache()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id_role": roleID,
		"message": "Role created",
	})
}

// Update a role
func UpdateRole(w http.ResponseWriter, r *http.Request) {
	roleID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid role ID", http.StatusBadRequest)
		return
	}

	var data struct {
		Nom         string `json:"nom"`
		Description string `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		jsonErr(w, "Invalid request", http.StatusBadRequest)
		return
	}

	_, err = config.DB.Exec(`
		UPDATE roles SET nom = $1, description = $2 WHERE id_role = $3
	`, data.Nom, data.Description, roleID)

	if err != nil {
		jsonErr(w, "Failed to update role", http.StatusInternalServerError)
		return
	}

	// Invalidate cache
	rbac.InvalidateAllCache()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Role updated"})
}

// Delete a role
func DeleteRole(w http.ResponseWriter, r *http.Request) {
	roleID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid role ID", http.StatusBadRequest)
		return
	}

	// First delete all role permissions
	_, err = config.DB.Exec(`
		DELETE FROM role_permissions WHERE id_role = $1
	`, roleID)

	if err != nil {
		jsonErr(w, "Failed to delete role permissions", http.StatusInternalServerError)
		return
	}

	// Then delete the role
	_, err = config.DB.Exec(`
		DELETE FROM roles WHERE id_role = $1
	`, roleID)

	if err != nil {
		jsonErr(w, "Failed to delete role", http.StatusInternalServerError)
		return
	}

	// Invalidate cache
	rbac.InvalidateAllCache()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Role deleted"})
}

// Get all permissions
func GetPermissions(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(`
		SELECT id_permission, code, description, categorie, actif
		FROM permissions
		ORDER BY categorie, code
	`)

	if err != nil {
		jsonErr(w, "Failed to fetch permissions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var permissions []map[string]interface{}
	for rows.Next() {
		var id int
		var code, description, categorie string
		var actif bool

		if err := rows.Scan(&id, &code, &description, &categorie, &actif); err != nil {
			continue
		}

		permissions = append(permissions, map[string]interface{}{
			"id_permission": id,
			"code":          code,
			"description":   description,
			"categorie":     categorie,
			"actif":         actif,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(permissions)
}

// Assign permission to role
func AssignPermissionToRole(w http.ResponseWriter, r *http.Request) {
	roleID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid role ID", http.StatusBadRequest)
		return
	}

	var data struct {
		Code string `json:"code"`
	}

	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		jsonErr(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Get permission ID from code
	var permID int
	err = config.DB.QueryRow(`
		SELECT id_permission FROM permissions WHERE code = $1
	`, data.Code).Scan(&permID)

	if err != nil {
		jsonErr(w, "Permission not found", http.StatusNotFound)
		return
	}

	// Insert role-permission relationship
	_, err = config.DB.Exec(`
		INSERT INTO role_permissions (id_role, id_permission)
		VALUES ($1, $2)
		ON CONFLICT (id_role, id_permission) DO NOTHING
	`, roleID, permID)

	if err != nil {
		jsonErr(w, "Failed to assign permission", http.StatusInternalServerError)
		return
	}

	// Invalidate cache
	rbac.InvalidateAllCache()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Permission assigned"})
}

// Remove permission from role
func RemovePermissionFromRole(w http.ResponseWriter, r *http.Request) {
	roleID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid role ID", http.StatusBadRequest)
		return
	}

	code := mux.Vars(r)["code"]

	// Get permission ID from code
	var permID int
	err = config.DB.QueryRow(`
		SELECT id_permission FROM permissions WHERE code = $1
	`, code).Scan(&permID)

	if err != nil {
		jsonErr(w, "Permission not found", http.StatusNotFound)
		return
	}

	// Delete role-permission relationship
	_, err = config.DB.Exec(`
		DELETE FROM role_permissions WHERE id_role = $1 AND id_permission = $2
	`, roleID, permID)

	if err != nil {
		jsonErr(w, "Failed to remove permission", http.StatusInternalServerError)
		return
	}

	// Invalidate cache
	rbac.InvalidateAllCache()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Permission removed"})
}

// Get role permissions
func GetRolePermissions(w http.ResponseWriter, r *http.Request) {
	roleID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid role ID", http.StatusBadRequest)
		return
	}

	rows, err := config.DB.Query(`
		SELECT p.id_permission, p.code, p.description, p.categorie
		FROM permissions p
		INNER JOIN role_permissions rp ON p.id_permission = rp.id_permission
		WHERE rp.id_role = $1
		ORDER BY p.categorie, p.code
	`, roleID)

	if err != nil {
		jsonErr(w, "Failed to fetch role permissions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var permissions []map[string]interface{}
	for rows.Next() {
		var id int
		var code, description, categorie string

		if err := rows.Scan(&id, &code, &description, &categorie); err != nil {
			continue
		}

		permissions = append(permissions, map[string]interface{}{
			"id_permission": id,
			"code":          code,
			"description":   description,
			"categorie":     categorie,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(permissions)
}

// Get user roles (for user management)
func GetUserRoles(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	rows, err := config.DB.Query(`
		SELECT r.id_role, r.nom, r.description
		FROM roles r
		INNER JOIN user_roles ur ON r.id_role = ur.id_role
		WHERE ur.id_utilisateur = $1
		ORDER BY r.nom
	`, userID)

	if err != nil {
		jsonErr(w, "Failed to fetch user roles", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var roles []map[string]interface{}
	for rows.Next() {
		var id int
		var nom, description string

		if err := rows.Scan(&id, &nom, &description); err != nil {
			continue
		}

		roles = append(roles, map[string]interface{}{
			"id_role":     id,
			"nom":         nom,
			"description": description,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(roles)
}

// Assign role to user
func AssignRoleToUser(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var data struct {
		RoleID int `json:"id_role"`
	}

	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		jsonErr(w, "Invalid request", http.StatusBadRequest)
		return
	}

	_, err = config.DB.Exec(`
		INSERT INTO user_roles (id_utilisateur, id_role, date_assignation)
		VALUES ($1, $2, NOW())
		ON CONFLICT (id_utilisateur, id_role) DO NOTHING
	`, userID, data.RoleID)

	if err != nil {
		jsonErr(w, "Failed to assign role", http.StatusInternalServerError)
		return
	}

	// Invalidate user cache
	rbac.InvalidateUserCache(userID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Role assigned"})
}

// Remove role from user
func RemoveRoleFromUser(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	roleID, err := strconv.Atoi(mux.Vars(r)["roleId"])
	if err != nil {
		jsonErr(w, "Invalid role ID", http.StatusBadRequest)
		return
	}

	_, err = config.DB.Exec(`
		DELETE FROM user_roles WHERE id_utilisateur = $1 AND id_role = $2
	`, userID, roleID)

	if err != nil {
		jsonErr(w, "Failed to remove role", http.StatusInternalServerError)
		return
	}

	// Invalidate user cache
	rbac.InvalidateUserCache(userID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Role removed"})
}

// Get user permissions (convenience endpoint)
func GetUserPermissions(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		jsonErr(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	permissions, err := rbac.GetUserPermissions(userID)
	if err != nil {
		jsonErr(w, "Failed to fetch permissions", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(permissions)
}
