package rbac

import "testing"

func TestPermissionConstants(t *testing.T) {
	tests := []struct {
		got  string
		name string
	}{
		{PermUsersView, "users.view"},
		{PermUsersEdit, "users.edit"},
		{PermUsersCreate, "users.create"},
		{PermUsersDelete, "users.delete"},
		{PermProductsView, "products.view"},
		{PermProductsEdit, "products.edit"},
		{PermProductsCreate, "products.create"},
		{PermProductsDelete, "products.delete"},
		{PermNewsletterView, "newsletter.view"},
		{PermNewsletterManage, "newsletter.manage"},
		{PermNewsletterSend, "newsletter.send"},
		{PermRolesManage, "roles.manage"},
		{PermAdminAccess, "admin.access"},
	}

	for _, tt := range tests {
		if tt.got != tt.name {
			t.Errorf("expected %s, got %s", tt.name, tt.got)
		}
	}
}

func TestPermissionCategories_AllCategoriesPresent(t *testing.T) {
	expectedCategories := []string{"users", "products", "newsletter", "admin"}
	for _, cat := range expectedCategories {
		if _, ok := PermissionCategories[cat]; !ok {
			t.Errorf("missing category: %s", cat)
		}
	}
}

func TestPermissionCategories_Users(t *testing.T) {
	perms := PermissionCategories["users"]
	expected := []string{PermUsersView, PermUsersEdit, PermUsersCreate, PermUsersDelete}
	for _, p := range expected {
		if !contains(perms, p) {
			t.Errorf("users category missing permission: %s", p)
		}
	}
}

func TestPermissionCategories_Products(t *testing.T) {
	perms := PermissionCategories["products"]
	expected := []string{PermProductsView, PermProductsEdit, PermProductsCreate, PermProductsDelete}
	for _, p := range expected {
		if !contains(perms, p) {
			t.Errorf("products category missing permission: %s", p)
		}
	}
}

func TestPermissionCategories_Newsletter(t *testing.T) {
	perms := PermissionCategories["newsletter"]
	expected := []string{PermNewsletterView, PermNewsletterManage, PermNewsletterSend}
	for _, p := range expected {
		if !contains(perms, p) {
			t.Errorf("newsletter category missing permission: %s", p)
		}
	}
}

func TestPermissionCategories_Admin(t *testing.T) {
	perms := PermissionCategories["admin"]
	expected := []string{PermAdminAccess, PermRolesManage}
	for _, p := range expected {
		if !contains(perms, p) {
			t.Errorf("admin category missing permission: %s", p)
		}
	}
}

func TestPermissionCategories_TotalCount(t *testing.T) {
	totalPerms := 0
	for _, perms := range PermissionCategories {
		totalPerms += len(perms)
	}
	if totalPerms != 13 {
		t.Errorf("expected 13 total permissions across all categories, got %d", totalPerms)
	}
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
