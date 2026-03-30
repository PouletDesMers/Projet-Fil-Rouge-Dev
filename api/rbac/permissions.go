package rbac

// Permission constants
const (
	// Users
	PermUsersView   = "users.view"
	PermUsersEdit   = "users.edit"
	PermUsersCreate = "users.create"
	PermUsersDelete = "users.delete"

	// Products
	PermProductsView   = "products.view"
	PermProductsEdit   = "products.edit"
	PermProductsCreate = "products.create"
	PermProductsDelete = "products.delete"

	// Newsletter
	PermNewsletterView   = "newsletter.view"
	PermNewsletterManage = "newsletter.manage"
	PermNewsletterSend   = "newsletter.send"

	// Roles & Permissions
	PermRolesManage = "roles.manage"

	// Admin
	PermAdminAccess = "admin.access"
)

// PermissionCategories groups permissions by category
var PermissionCategories = map[string][]string{
	"users": {
		PermUsersView,
		PermUsersEdit,
		PermUsersCreate,
		PermUsersDelete,
	},
	"products": {
		PermProductsView,
		PermProductsEdit,
		PermProductsCreate,
		PermProductsDelete,
	},
	"newsletter": {
		PermNewsletterView,
		PermNewsletterManage,
		PermNewsletterSend,
	},
	"admin": {
		PermAdminAccess,
		PermRolesManage,
	},
}
