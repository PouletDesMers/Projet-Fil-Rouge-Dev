# Documentation des Routes API — Projet Fil Rouge

> Dernière mise à jour : 2026-06-12

## Middlewares appliqués globalement

Toutes les routes sont protégées par les middlewares suivants (dans l'ordre) :

| Middleware | Rôle |
|---|---|
| `SecurityHeaders` | Headers de sécurité HTTP (CSP, HSTS, etc.) |
| `MaxBodySize` | Limite la taille du corps de requête |
| `CORS` | Gestion des origines cross-origin |
| `RateLimitAPI` | Rate limiting global sur `/api/*` |
| `RequestLogger` | Log de chaque requête |

## Légende des middlewares par route

| Alias | Composition |
|---|---|
| `auth` | `Auth` (JWT obligatoire) |
| `adminRaw` | `Auth` → `Admin` (vérifie le rôle `admin`) |
| `adminLim` | `RateLimitAdmin` → `Auth` → `Admin` |
| `RateLimitLogin` | Rate limit spécifique pour le login |
| `RateLimitRegister` | Rate limit spécifique pour les inscriptions |

---

## 1. Routes publiques (sans authentification)

| Méthode | Route | Handler | Middleware |
|---|---|---|---|
| `POST` | `/api/login` | `Login` | `RateLimitLogin` |
| `POST` | `/api/password-reset` | `ResetPassword` | `RateLimitRegister` |
| `POST` | `/api/verify-email` | `VerifyEmail` | `RateLimitRegister` |
| `POST` | `/api/save-verification-token` | `SaveVerificationToken` | `RateLimitRegister` |
| `POST` | `/api/resend-verification-email` | `ResendVerificationEmail` | `RateLimitRegister` |
| `POST` | `/api/users` | `CreateUser` | `RateLimitRegister` |
| `GET` | `/api/users/exists` | `GetUserExists` | — |
| `GET` | `/api/public/carousel-images` | `GetActiveCarouselImages` | — |
| `GET` | `/api/public/categories` | `GetActiveCategories` | — |
| `GET` | `/api/public/products/{slug}` | `GetActiveProduitsByCategory` | — |
| `GET` | `/api/public/search` | `SearchProduits` | — |
| `GET` | `/api/public/top-products` | `GetTopProductsLast3Months` | — |
| `POST` | `/api/newsletter/subscribe` | `SubscribeNewsletter` | — |
| `POST` | `/api/newsletter/unsubscribe` | `UnsubscribeNewsletter` | — |

### Swagger

| Méthode | Route | Handler |
|---|---|---|
| `GET` | `/swagger` | `GetSwaggerSpec` |
| `GET` | `/swagger/` | `GetSwaggerSpec` |
| `GET` | `/api/swagger.json` | `GetSwaggerSpec` |

---

## 2. Catégories (auth)

| Méthode | Route | Handler |
|---|---|---|
| `GET` | `/api/categories` | `GetCategories` |
| `POST` | `/api/categories` | `CreateCategorie` |
| `PUT` | `/api/categories/{id}` | `UpdateCategorie` |
| `DELETE` | `/api/categories/{id}` | `DeleteCategorie` |

### Alias Web Categories

| Méthode | Route | Handler |
|---|---|---|
| `GET` | `/api/web-categories` | `GetCategories` |
| `POST` | `/api/web-categories` | `CreateCategorie` |
| `PUT` | `/api/web-categories/{id}` | `UpdateCategorie` |
| `DELETE` | `/api/web-categories/{id}` | `DeleteCategorie` |

---

## 3. Produits (auth)

| Méthode | Route | Handler |
|---|---|---|
| `GET` | `/api/produits` | `GetProduits` |
| `POST` | `/api/produits` | `CreateProduit` |
| `PUT` | `/api/produits/{id}` | `UpdateProduit` |
| `DELETE` | `/api/produits/{id}` | `DeleteProduit` |

### Alias Web Products

| Méthode | Route | Handler |
|---|---|---|
| `GET` | `/api/web-products` | `GetProduits` |
| `POST` | `/api/web-products` | `CreateProduit` |
| `PUT` | `/api/web-products/{id}` | `UpdateProduit` |
| `DELETE` | `/api/web-products/{id}` | `DeleteProduit` |

---

## 4. Tarifications (auth)

| Méthode | Route | Handler |
|---|---|---|
| `GET` | `/api/tarifications` | `GetTarifications` |
| `POST` | `/api/tarifications` | `CreateTarification` |
| `GET` | `/api/tarifications/{id}` | `GetTarification` |
| `PUT` | `/api/tarifications/{id}` | `UpdateTarification` |
| `DELETE` | `/api/tarifications/{id}` | `DeleteTarification` |

---

## 5. Entreprises (auth)

| Méthode | Route | Handler |
|---|---|---|
| `GET` | `/api/entreprises` | `GetEntreprises` |
| `POST` | `/api/entreprises` | `CreateEntreprise` |
| `GET` | `/api/entreprises/{id}` | `GetEntreprise` |
| `PUT` | `/api/entreprises/{id}` | `UpdateEntreprise` |
| `DELETE` | `/api/entreprises/{id}` | `DeleteEntreprise` |

---

## 6. Utilisateurs

| Méthode | Route | Handler | Middleware |
|---|---|---|---|
| `GET` | `/api/users` | `GetUsers` | `auth` |
| `GET` | `/api/users/{id}` | `GetUser` | `auth` |
| `PUT` | `/api/users/{id}` | `UpdateUser` | `auth` |
| `DELETE` | `/api/users/{id}` | `DeleteUser` | `auth` |
| `POST` | `/api/users/{id}/reset-2fa` | `ResetUser2FA` | `auth` |
| `GET` | `/api/user/profile` | `GetUserProfile` | `auth` |
| `PUT` | `/api/user/profile` | `UpdateUserProfile` | `auth` |

---

## 7. 2FA / WebAuthn (auth)

| Méthode | Route | Handler |
|---|---|---|
| `POST` | `/api/user/2fa/setup` | `Setup2FA` |
| `POST` | `/api/user/2fa/verify` | `Verify2FA` |
| `DELETE` | `/api/user/2fa/remove` | `Remove2FA` |
| `GET` | `/api/webauthn/register-challenge` | `GetWebAuthnRegisterChallenge` |
| `POST` | `/api/webauthn/register` | `RegisterWebAuthn` |
| `DELETE` | `/api/webauthn/remove` | `RemoveWebAuthn` |

---

## 8. API Tokens (auth)

| Méthode | Route | Handler |
|---|---|---|
| `GET` | `/api/api-tokens` | `GetAPITokens` |
| `POST` | `/api/api-tokens` | `CreateAPIToken` |
| `DELETE` | `/api/api-tokens/{id}` | `DeleteAPIToken` |
| `PUT` | `/api/api-tokens/{id}/status` | `ToggleAPITokenStatus` |

---

## 9. Facturation — Abonnements

### Client (auth)

| Méthode | Route | Handler |
|---|---|---|
| `GET` | `/api/abonnements` | `GetAbonnements` |
| `POST` | `/api/abonnements` | `CreateAbonnement` |
| `GET` | `/api/abonnements/{id}` | `GetAbonnement` |
| `PUT` | `/api/abonnements/{id}` | `UpdateAbonnement` |
| `DELETE` | `/api/abonnements/{id}` | `DeleteAbonnement` |
| `POST` | `/api/abonnements/from-purchase` | `CreateAbonnementFromPurchase` |

### Mes abonnements (auth)

| Méthode | Route | Handler |
|---|---|---|
| `GET` | `/api/mes-abonnements` | `GetMesAbonnements` |
| `PUT` | `/api/mes-abonnements/{id}/cancel` | `CancelAbonnement` |

### Admin (adminRaw)

| Méthode | Route | Handler |
|---|---|---|
| `GET` | `/api/admin/abonnements` | `GetAbonnements` |
| `POST` | `/api/admin/abonnements` | `CreateAbonnement` |
| `PUT` | `/api/admin/abonnements/{id}` | `UpdateAbonnement` |
| `DELETE` | `/api/admin/abonnements/{id}` | `DeleteAbonnement` |

---

## 10. Facturation — Commandes (auth)

| Méthode | Route | Handler |
|---|---|---|
| `GET` | `/api/commandes` | `GetCommandes` |
| `POST` | `/api/commandes` | `CreateCommande` |
| `GET` | `/api/commandes/{id}` | `GetCommande` |
| `PUT` | `/api/commandes/{id}` | `UpdateCommande` |
| `DELETE` | `/api/commandes/{id}` | `DeleteCommande` |

---

## 11. Facturation — Factures (auth)

| Méthode | Route | Handler |
|---|---|---|
| `GET` | `/api/factures` | `GetFactures` |
| `POST` | `/api/factures` | `CreateFacture` |
| `GET` | `/api/factures/{id}` | `GetFacture` |
| `PUT` | `/api/factures/{id}` | `UpdateFacture` |
| `DELETE` | `/api/factures/{id}` | `DeleteFacture` |

---

## 12. Facturation — Paiements (auth)

| Méthode | Route | Handler |
|---|---|---|
| `GET` | `/api/paiements` | `GetPaiements` |
| `POST` | `/api/paiements` | `CreatePaiement` |
| `GET` | `/api/paiements/{id}` | `GetPaiement` |
| `PUT` | `/api/paiements/{id}` | `UpdatePaiement` |
| `DELETE` | `/api/paiements/{id}` | `DeletePaiement` |

---

## 13. Support & Notifications (auth)

### Tickets

| Méthode | Route | Handler |
|---|---|---|
| `GET` | `/api/tickets` | `GetTicketSupports` |
| `POST` | `/api/tickets` | `CreateTicketSupport` |
| `GET` | `/api/tickets/{id}` | `GetTicketSupport` |
| `PUT` | `/api/tickets/{id}` | `UpdateTicketSupport` |
| `DELETE` | `/api/tickets/{id}` | `DeleteTicketSupport` |

### Notifications

| Méthode | Route | Handler |
|---|---|---|
| `GET` | `/api/notifications` | `GetNotifications` |
| `POST` | `/api/notifications` | `CreateNotification` |
| `GET` | `/api/notifications/{id}` | `GetNotification` |
| `PUT` | `/api/notifications/{id}` | `UpdateNotification` |
| `DELETE` | `/api/notifications/{id}` | `DeleteNotification` |

---

## 14. Images Carousel (auth)

| Méthode | Route | Handler |
|---|---|---|
| `GET` | `/api/carousel-images` | `GetCarouselImages` |
| `POST` | `/api/carousel-images` | `CreateCarouselImage` |
| `POST` | `/api/carousel-images/reorder` | `ReorderCarouselImages` |
| `GET` | `/api/carousel-images/{id}` | `GetCarouselImage` |
| `PUT` | `/api/carousel-images/{id}` | `UpdateCarouselImage` |
| `DELETE` | `/api/carousel-images/{id}` | `DeleteCarouselImage` |

---

## 15. Logs (admin + adminLimiter)

| Méthode | Route | Handler | Middleware |
|---|---|---|---|
| `GET` | `/api/logs` | `GetLogs` | `adminLim` |
| `GET` | `/api/logs/stats` | `GetLogStats` | `adminLim` |
| `DELETE` | `/api/logs` | `ClearLogs` | `adminRaw` |

---

## 16. Cache (admin)

| Méthode | Route | Handler | Middleware |
|---|---|---|---|
| `GET` | `/api/cache/stats` | `GetStats` | `adminRaw` |
| `POST` | `/api/cache/flush` | `FlushAll` | `adminRaw` |

---

## 17. Backup (admin + adminLimiter)

| Méthode | Route | Handler | Middleware |
|---|---|---|---|
| `POST` | `/api/admin/backup` | `TriggerBackup` | `adminLim` |
| `GET` | `/api/admin/backup/status` | `GetBackupStatus` | `adminLim` |
| `GET` | `/api/admin/backup/list` | `ListBackups` | `adminLim` |
| `GET` | `/api/admin/backup/stats` | `GetBackupStats` | `adminLim` |
| `GET` | `/api/admin/backup/schedule` | `GetBackupSchedule` | `adminLim` |
| `POST` | `/api/admin/backup/schedule` | `SetBackupSchedule` | `adminLim` |
| `GET` | `/api/admin/backup/download` | `DownloadBackup` | `adminLim` |
| `POST` | `/api/admin/backup/restore` | `RestoreBackup` | `adminLim` |
| `DELETE` | `/api/admin/backup` | `DeleteBackup` | `adminRaw` |

---

## 18. Newsletter

| Méthode | Route | Handler | Middleware |
|---|---|---|---|
| `POST` | `/api/newsletter/subscribe` | `SubscribeNewsletter` | — |
| `POST` | `/api/newsletter/unsubscribe` | `UnsubscribeNewsletter` | — |
| `GET` | `/api/admin/newsletter/subscribers` | `GetNewsletterSubscribers` | `adminRaw` |
| `GET` | `/api/admin/newsletter/campaigns` | `GetNewsletterCampaigns` | `adminRaw` |
| `POST` | `/api/admin/newsletter/campaigns` | `CreateNewsletterCampaign` | `adminRaw` |
| `POST` | `/api/admin/newsletter/campaigns/{id}/send` | `SendNewsletterCampaign` | `adminRaw` |

---

## 19. Stats & Analytics (admin)

| Méthode | Route | Handler | Middleware |
|---|---|---|---|
| `GET` | `/api/admin/stats/top-products` | `GetTopProductsLast3Months` | `adminRaw` |

---

## 20. Rôles & Permissions (admin)

| Méthode | Route | Handler | Middleware |
|---|---|---|---|
| `GET` | `/api/admin/roles` | `GetRoles` | `adminRaw` |
| `POST` | `/api/admin/roles` | `CreateRole` | `adminRaw` |
| `PUT` | `/api/admin/roles/{id}` | `UpdateRole` | `adminRaw` |
| `DELETE` | `/api/admin/roles/{id}` | `DeleteRole` | `adminRaw` |
| `GET` | `/api/admin/permissions` | `GetPermissions` | `adminRaw` |
| `GET` | `/api/admin/roles/{id}/permissions` | `GetRolePermissions` | `adminRaw` |
| `POST` | `/api/admin/roles/{id}/permissions` | `AssignPermissionToRole` | `adminRaw` |
| `DELETE` | `/api/admin/roles/{id}/permissions/{code}` | `RemovePermissionFromRole` | `adminRaw` |
| `GET` | `/api/admin/users/{id}/roles` | `GetUserRoles` | `adminRaw` |
| `POST` | `/api/admin/users/{id}/roles` | `AssignRoleToUser` | `adminRaw` |
| `DELETE` | `/api/admin/users/{id}/roles/{roleId}` | `RemoveRoleFromUser` | `adminRaw` |
| `GET` | `/api/admin/users/{id}/permissions` | `GetUserPermissions` | `adminRaw` |

---

## Récapitulatif par niveau d'accès

| Niveau | Nombre de routes |
|---|---|
| **Public** (sans auth) | 17 |
| **Auth** (JWT) | 68 |
| **Admin** | 35 |
| **Total** | ~103 |

## Middleware adminLim

Les routes avec `adminLim` (RateLimitAdmin) appliquent un rate limiting renforcé en plus de l'authentification admin :

- `GET /api/logs`
- `GET /api/logs/stats`
- `POST /api/admin/backup`
- `GET /api/admin/backup/status`
- `GET /api/admin/backup/list`
- `GET /api/admin/backup/stats`
- `GET /api/admin/backup/schedule`
- `POST /api/admin/backup/schedule`
- `GET /api/admin/backup/download`
- `POST /api/admin/backup/restore`
