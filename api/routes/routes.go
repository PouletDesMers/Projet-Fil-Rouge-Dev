package routes

import (
	"net/http"

	"github.com/gorilla/mux"

	"api/cache"
	"api/handlers"
	"api/logger"
	mw "api/middleware"
)

func Register(r *mux.Router) {
	// ── Aliases pratiques ──────────────────────────────────────────────────────
	auth := mw.Auth
	adminRaw := func(h http.Handler) http.Handler { return mw.Auth(mw.Admin(h)) }
	adminLim := func(h http.Handler) http.Handler {
		return mw.RateLimitAdmin(mw.Auth(mw.Admin(h)))
	}

	// ── Public ─────────────────────────────────────────────────────────────────
	r.Handle("/api/login", mw.RateLimitLogin(http.HandlerFunc(handlers.Login))).Methods("POST")
	r.Handle("/api/password-reset", mw.RateLimitRegister(http.HandlerFunc(handlers.ResetPassword))).Methods("POST")
	r.Handle("/api/verify-email", mw.RateLimitRegister(http.HandlerFunc(handlers.VerifyEmail))).Methods("POST")
	r.Handle("/api/save-verification-token", mw.RateLimitRegister(http.HandlerFunc(handlers.SaveVerificationToken))).Methods("POST")
	r.Handle("/api/resend-verification-email", mw.RateLimitRegister(http.HandlerFunc(handlers.ResendVerificationEmail))).Methods("POST")
	r.Handle("/api/users", mw.RateLimitRegister(http.HandlerFunc(handlers.CreateUser))).Methods("POST")
	r.HandleFunc("/api/users/exists", handlers.GetUserExists).Methods("GET")
	r.HandleFunc("/api/swagger.json", handlers.GetSwaggerSpec).Methods("GET")
	r.HandleFunc("/api/public/carousel-images", handlers.GetActiveCarouselImages).Methods("GET")
	r.HandleFunc("/api/public/categories", handlers.GetActiveCategories).Methods("GET")
	r.HandleFunc("/api/public/products/{slug}", handlers.GetActiveProduitsByCategory).Methods("GET")
	r.HandleFunc("/api/public/search", handlers.SearchProduits).Methods("GET")
	r.HandleFunc("/api/public/top-products", handlers.GetTopProductsLast3Months).Methods("GET")

	// ── Categories ─────────────────────────────────────────────────────────────
	r.Handle("/api/categories", auth(http.HandlerFunc(handlers.GetCategories))).Methods("GET")
	r.Handle("/api/categories", auth(http.HandlerFunc(handlers.CreateCategorie))).Methods("POST")
	r.Handle("/api/categories/{id}", auth(http.HandlerFunc(handlers.UpdateCategorie))).Methods("PUT")
	r.Handle("/api/categories/{id}", auth(http.HandlerFunc(handlers.DeleteCategorie))).Methods("DELETE")

	// Web Categories aliases
	r.Handle("/api/web-categories", auth(http.HandlerFunc(handlers.GetCategories))).Methods("GET")
	r.Handle("/api/web-categories", auth(http.HandlerFunc(handlers.CreateCategorie))).Methods("POST")
	r.Handle("/api/web-categories/{id}", auth(http.HandlerFunc(handlers.UpdateCategorie))).Methods("PUT")
	r.Handle("/api/web-categories/{id}", auth(http.HandlerFunc(handlers.DeleteCategorie))).Methods("DELETE")

	// ── Produits ───────────────────────────────────────────────────────────────
	r.Handle("/api/produits", auth(http.HandlerFunc(handlers.GetProduits))).Methods("GET")
	r.Handle("/api/produits", auth(http.HandlerFunc(handlers.CreateProduit))).Methods("POST")
	r.Handle("/api/produits/{id}", auth(http.HandlerFunc(handlers.UpdateProduit))).Methods("PUT")
	r.Handle("/api/produits/{id}", auth(http.HandlerFunc(handlers.DeleteProduit))).Methods("DELETE")

	// Web Products aliases
	r.Handle("/api/web-products", auth(http.HandlerFunc(handlers.GetProduits))).Methods("GET")
	r.Handle("/api/web-products", auth(http.HandlerFunc(handlers.CreateProduit))).Methods("POST")
	r.Handle("/api/web-products/{id}", auth(http.HandlerFunc(handlers.UpdateProduit))).Methods("PUT")
	r.Handle("/api/web-products/{id}", auth(http.HandlerFunc(handlers.DeleteProduit))).Methods("DELETE")

	// ── Tarifications ──────────────────────────────────────────────────────────
	r.Handle("/api/tarifications", auth(http.HandlerFunc(handlers.GetTarifications))).Methods("GET")
	r.Handle("/api/tarifications", auth(http.HandlerFunc(handlers.CreateTarification))).Methods("POST")
	r.Handle("/api/tarifications/{id}", auth(http.HandlerFunc(handlers.GetTarification))).Methods("GET")
	r.Handle("/api/tarifications/{id}", auth(http.HandlerFunc(handlers.UpdateTarification))).Methods("PUT")
	r.Handle("/api/tarifications/{id}", auth(http.HandlerFunc(handlers.DeleteTarification))).Methods("DELETE")

	// ── Entreprises ────────────────────────────────────────────────────────────
	r.Handle("/api/entreprises", auth(http.HandlerFunc(handlers.GetEntreprises))).Methods("GET")
	r.Handle("/api/entreprises", auth(http.HandlerFunc(handlers.CreateEntreprise))).Methods("POST")
	r.Handle("/api/entreprises/{id}", auth(http.HandlerFunc(handlers.GetEntreprise))).Methods("GET")
	r.Handle("/api/entreprises/{id}", auth(http.HandlerFunc(handlers.UpdateEntreprise))).Methods("PUT")
	r.Handle("/api/entreprises/{id}", auth(http.HandlerFunc(handlers.DeleteEntreprise))).Methods("DELETE")

	// ── Users ──────────────────────────────────────────────────────────────────
	r.Handle("/api/users", auth(http.HandlerFunc(handlers.GetUsers))).Methods("GET")
	r.Handle("/api/users/{id}", auth(http.HandlerFunc(handlers.GetUser))).Methods("GET")
	r.Handle("/api/users/{id}", auth(http.HandlerFunc(handlers.UpdateUser))).Methods("PUT")
	r.Handle("/api/users/{id}", auth(http.HandlerFunc(handlers.DeleteUser))).Methods("DELETE")
	r.Handle("/api/users/{id}/reset-2fa", auth(http.HandlerFunc(handlers.ResetUser2FA))).Methods("POST")
	r.Handle("/api/user/profile", auth(http.HandlerFunc(handlers.GetUserProfile))).Methods("GET")
	r.Handle("/api/user/profile", auth(http.HandlerFunc(handlers.UpdateUserProfile))).Methods("PUT")

	// ── 2FA / WebAuthn ─────────────────────────────────────────────────────────
	r.Handle("/api/user/2fa/setup", auth(http.HandlerFunc(handlers.Setup2FA))).Methods("POST")
	r.Handle("/api/user/2fa/verify", auth(http.HandlerFunc(handlers.Verify2FA))).Methods("POST")
	r.Handle("/api/user/2fa/remove", auth(http.HandlerFunc(handlers.Remove2FA))).Methods("DELETE")
	r.Handle("/api/webauthn/register-challenge", auth(http.HandlerFunc(handlers.GetWebAuthnRegisterChallenge))).Methods("GET")
	r.Handle("/api/webauthn/register", auth(http.HandlerFunc(handlers.RegisterWebAuthn))).Methods("POST")
	r.Handle("/api/webauthn/remove", auth(http.HandlerFunc(handlers.RemoveWebAuthn))).Methods("DELETE")

	// ── API Tokens ─────────────────────────────────────────────────────────────
	r.Handle("/api/api-tokens", auth(http.HandlerFunc(handlers.GetAPITokens))).Methods("GET")
	r.Handle("/api/api-tokens", auth(http.HandlerFunc(handlers.CreateAPIToken))).Methods("POST")
	r.Handle("/api/api-tokens/{id}", auth(http.HandlerFunc(handlers.DeleteAPIToken))).Methods("DELETE")
	r.Handle("/api/api-tokens/{id}/status", auth(http.HandlerFunc(handlers.ToggleAPITokenStatus))).Methods("PUT")

	// ── Billing ────────────────────────────────────────────────────────────────
	r.Handle("/api/abonnements", auth(http.HandlerFunc(handlers.GetAbonnements))).Methods("GET")
	r.Handle("/api/abonnements", auth(http.HandlerFunc(handlers.CreateAbonnement))).Methods("POST")
	r.Handle("/api/abonnements/{id}", auth(http.HandlerFunc(handlers.GetAbonnement))).Methods("GET")
	r.Handle("/api/abonnements/{id}", auth(http.HandlerFunc(handlers.UpdateAbonnement))).Methods("PUT")
	r.Handle("/api/abonnements/{id}", auth(http.HandlerFunc(handlers.DeleteAbonnement))).Methods("DELETE")

	r.Handle("/api/commandes", auth(http.HandlerFunc(handlers.GetCommandes))).Methods("GET")
	r.Handle("/api/commandes", auth(http.HandlerFunc(handlers.CreateCommande))).Methods("POST")
	r.Handle("/api/commandes/{id}", auth(http.HandlerFunc(handlers.GetCommande))).Methods("GET")
	r.Handle("/api/commandes/{id}", auth(http.HandlerFunc(handlers.UpdateCommande))).Methods("PUT")
	r.Handle("/api/commandes/{id}", auth(http.HandlerFunc(handlers.DeleteCommande))).Methods("DELETE")

	r.Handle("/api/factures", auth(http.HandlerFunc(handlers.GetFactures))).Methods("GET")
	r.Handle("/api/factures", auth(http.HandlerFunc(handlers.CreateFacture))).Methods("POST")
	r.Handle("/api/factures/{id}", auth(http.HandlerFunc(handlers.GetFacture))).Methods("GET")
	r.Handle("/api/factures/{id}", auth(http.HandlerFunc(handlers.UpdateFacture))).Methods("PUT")
	r.Handle("/api/factures/{id}", auth(http.HandlerFunc(handlers.DeleteFacture))).Methods("DELETE")

	r.Handle("/api/paiements", auth(http.HandlerFunc(handlers.GetPaiements))).Methods("GET")
	r.Handle("/api/paiements", auth(http.HandlerFunc(handlers.CreatePaiement))).Methods("POST")
	r.Handle("/api/paiements/{id}", auth(http.HandlerFunc(handlers.GetPaiement))).Methods("GET")
	r.Handle("/api/paiements/{id}", auth(http.HandlerFunc(handlers.UpdatePaiement))).Methods("PUT")
	r.Handle("/api/paiements/{id}", auth(http.HandlerFunc(handlers.DeletePaiement))).Methods("DELETE")

	// ── Support & Notifications ────────────────────────────────────────────────
	r.Handle("/api/tickets", auth(http.HandlerFunc(handlers.GetTicketSupports))).Methods("GET")
	r.Handle("/api/tickets", auth(http.HandlerFunc(handlers.CreateTicketSupport))).Methods("POST")
	r.Handle("/api/tickets/{id}", auth(http.HandlerFunc(handlers.GetTicketSupport))).Methods("GET")
	r.Handle("/api/tickets/{id}", auth(http.HandlerFunc(handlers.UpdateTicketSupport))).Methods("PUT")
	r.Handle("/api/tickets/{id}", auth(http.HandlerFunc(handlers.DeleteTicketSupport))).Methods("DELETE")

	r.Handle("/api/notifications", auth(http.HandlerFunc(handlers.GetNotifications))).Methods("GET")
	r.Handle("/api/notifications", auth(http.HandlerFunc(handlers.CreateNotification))).Methods("POST")
	r.Handle("/api/notifications/{id}", auth(http.HandlerFunc(handlers.GetNotification))).Methods("GET")
	r.Handle("/api/notifications/{id}", auth(http.HandlerFunc(handlers.UpdateNotification))).Methods("PUT")
	r.Handle("/api/notifications/{id}", auth(http.HandlerFunc(handlers.DeleteNotification))).Methods("DELETE")

	// ── Carousel Images ────────────────────────────────────────────────────────
	r.Handle("/api/carousel-images", auth(http.HandlerFunc(handlers.GetCarouselImages))).Methods("GET")
	r.Handle("/api/carousel-images", auth(http.HandlerFunc(handlers.CreateCarouselImage))).Methods("POST")
	r.Handle("/api/carousel-images/reorder", auth(http.HandlerFunc(handlers.ReorderCarouselImages))).Methods("POST")
	r.Handle("/api/carousel-images/{id}", auth(http.HandlerFunc(handlers.GetCarouselImage))).Methods("GET")
	r.Handle("/api/carousel-images/{id}", auth(http.HandlerFunc(handlers.UpdateCarouselImage))).Methods("PUT")
	r.Handle("/api/carousel-images/{id}", auth(http.HandlerFunc(handlers.DeleteCarouselImage))).Methods("DELETE")

	// ── Logs (admin + adminLimiter) ────────────────────────────────────────────
	r.Handle("/api/logs", adminLim(http.HandlerFunc(logger.GetLogs))).Methods("GET")
	r.Handle("/api/logs/stats", adminLim(http.HandlerFunc(logger.GetLogStats))).Methods("GET")
	r.Handle("/api/logs", adminRaw(http.HandlerFunc(logger.ClearLogs))).Methods("DELETE")

	// ── Cache (admin) ──────────────────────────────────────────────────────────
	r.Handle("/api/cache/stats", adminRaw(http.HandlerFunc(cache.GetStats))).Methods("GET")
	r.Handle("/api/cache/flush", adminRaw(http.HandlerFunc(cache.FlushAll))).Methods("POST")

	// ── Backup (admin + adminLimiter) ──────────────────────────────────────────
	r.Handle("/api/admin/backup", adminLim(http.HandlerFunc(handlers.TriggerBackup))).Methods("POST")
	r.Handle("/api/admin/backup/list", adminLim(http.HandlerFunc(handlers.ListBackups))).Methods("GET")
	r.Handle("/api/admin/backup/stats", adminLim(http.HandlerFunc(handlers.GetBackupStats))).Methods("GET")
	r.Handle("/api/admin/backup/schedule", adminLim(http.HandlerFunc(handlers.GetBackupSchedule))).Methods("GET")
	r.Handle("/api/admin/backup/schedule", adminLim(http.HandlerFunc(handlers.SetBackupSchedule))).Methods("POST")
	r.Handle("/api/admin/backup/download", adminLim(http.HandlerFunc(handlers.DownloadBackup))).Methods("GET")
	r.Handle("/api/admin/backup/restore", adminLim(http.HandlerFunc(handlers.RestoreBackup))).Methods("POST")
	r.Handle("/api/admin/backup", adminRaw(http.HandlerFunc(handlers.DeleteBackup))).Methods("DELETE")

	// ── Newsletter ──────────────────────────────────────────────────
	r.HandleFunc("/api/newsletter/subscribe", handlers.SubscribeNewsletter).Methods("POST")
	r.HandleFunc("/api/newsletter/unsubscribe", handlers.UnsubscribeNewsletter).Methods("POST")
	r.Handle("/api/admin/newsletter/subscribers", auth(http.HandlerFunc(handlers.GetNewsletterSubscribers))).Methods("GET")
	r.Handle("/api/admin/newsletter/campaigns", auth(http.HandlerFunc(handlers.GetNewsletterCampaigns))).Methods("GET")
	r.Handle("/api/admin/newsletter/campaigns", auth(http.HandlerFunc(handlers.CreateNewsletterCampaign))).Methods("POST")
	r.Handle("/api/admin/newsletter/campaigns/{id}/send", auth(http.HandlerFunc(handlers.SendNewsletterCampaign))).Methods("POST")

	// ── Stats & Analytics ────────────────────────────────────────────
	r.Handle("/api/admin/stats/top-products", adminRaw(http.HandlerFunc(handlers.GetTopProductsLast3Months))).Methods("GET")

	// ── Roles & Permissions ──────────────────────────────────────────
	r.Handle("/api/admin/roles", adminRaw(http.HandlerFunc(handlers.GetRoles))).Methods("GET")
	r.Handle("/api/admin/roles", adminRaw(http.HandlerFunc(handlers.CreateRole))).Methods("POST")
	r.Handle("/api/admin/roles/{id}", adminRaw(http.HandlerFunc(handlers.UpdateRole))).Methods("PUT")
	r.Handle("/api/admin/roles/{id}", adminRaw(http.HandlerFunc(handlers.DeleteRole))).Methods("DELETE")
	r.Handle("/api/admin/permissions", adminRaw(http.HandlerFunc(handlers.GetPermissions))).Methods("GET")
	r.Handle("/api/admin/roles/{id}/permissions", adminRaw(http.HandlerFunc(handlers.GetRolePermissions))).Methods("GET")
	r.Handle("/api/admin/roles/{id}/permissions", adminRaw(http.HandlerFunc(handlers.AssignPermissionToRole))).Methods("POST")
	r.Handle("/api/admin/roles/{id}/permissions/{code}", adminRaw(http.HandlerFunc(handlers.RemovePermissionFromRole))).Methods("DELETE")
	r.Handle("/api/admin/users/{id}/roles", auth(http.HandlerFunc(handlers.GetUserRoles))).Methods("GET")
	r.Handle("/api/admin/users/{id}/roles", auth(http.HandlerFunc(handlers.AssignRoleToUser))).Methods("POST")
	r.Handle("/api/admin/users/{id}/roles/{roleId}", auth(http.HandlerFunc(handlers.RemoveRoleFromUser))).Methods("DELETE")
	r.Handle("/api/admin/users/{id}/permissions", auth(http.HandlerFunc(handlers.GetUserPermissions))).Methods("GET")
}
