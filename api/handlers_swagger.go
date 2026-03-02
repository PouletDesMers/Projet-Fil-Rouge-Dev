package main

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
)

// mainRouter is set in main() so the swagger handler can walk the routes
var mainRouter *mux.Router

// tagForPath returns a Swagger tag based on the path prefix
func tagForPath(path string) string {
	parts := strings.Split(strings.TrimPrefix(path, "/api/"), "/")
	if len(parts) == 0 {
		return "Other"
	}
	switch parts[0] {
	case "login":
		return "Auth"
	case "users", "user":
		return "Users"
	case "categories", "web-categories":
		return "Categories"
	case "produits", "web-products":
		return "Products"
	case "carousel-images":
		return "Carousel"
	case "tarifications":
		return "Tarification"
	case "entreprises":
		return "Entreprises"
	case "abonnements":
		return "Billing"
	case "commandes":
		return "Billing"
	case "factures":
		return "Billing"
	case "paiements":
		return "Billing"
	case "tickets":
		return "Support"
	case "notifications":
		return "Notifications"
	case "api-tokens":
		return "API Tokens"
	case "public":
		return "Public"
	case "webauthn":
		return "2FA / WebAuthn"
	default:
		return strings.Title(parts[0])
	}
}

// isPublicRoute returns true if the route doesn't require authentication
func isPublicRoute(path, method string) bool {
	publicRoutes := map[string]bool{
		"POST /api/login":                 true,
		"POST /api/users":                 true,
		"GET /api/users/exists":           true,
		"GET /api/public/carousel-images": true,
		"GET /api/public/categories":      true,
		"GET /api/public/products/{slug}": true,
		"GET /api/swagger.json":           true,
	}
	return publicRoutes[method+" "+path]
}

// summaryForRoute generates a human-readable summary
func summaryForRoute(method, path string) string {
	known := map[string]string{
		"POST /api/login":                      "Connexion utilisateur",
		"GET /api/users":                       "Liste des utilisateurs",
		"POST /api/users":                      "Créer un compte",
		"GET /api/users/exists":                "Vérifier si un email existe",
		"GET /api/users/{id}":                  "Détails d'un utilisateur",
		"PUT /api/users/{id}":                  "Mettre à jour un utilisateur",
		"DELETE /api/users/{id}":               "Supprimer un utilisateur",
		"POST /api/users/{id}/reset-2fa":       "Réinitialiser le 2FA d'un utilisateur",
		"GET /api/user/profile":                "Mon profil",
		"PUT /api/user/profile":                "Mettre à jour mon profil",
		"POST /api/user/2fa/setup":             "Configurer la 2FA",
		"POST /api/user/2fa/verify":            "Vérifier le code 2FA",
		"DELETE /api/user/2fa/remove":          "Désactiver la 2FA",
		"GET /api/webauthn/register-challenge": "Challenge WebAuthn",
		"POST /api/webauthn/register":          "Enregistrer une clé WebAuthn",
		"DELETE /api/webauthn/remove":          "Supprimer la clé WebAuthn",
		"GET /api/categories":                  "Liste des catégories",
		"POST /api/categories":                 "Créer une catégorie",
		"PUT /api/categories/{id}":             "Mettre à jour une catégorie",
		"DELETE /api/categories/{id}":          "Supprimer une catégorie",
		"GET /api/web-categories":              "Liste des catégories web",
		"POST /api/web-categories":             "Créer une catégorie web",
		"PUT /api/web-categories/{id}":         "Mettre à jour une catégorie web",
		"DELETE /api/web-categories/{id}":      "Supprimer une catégorie web",
		"GET /api/produits":                    "Liste des produits",
		"POST /api/produits":                   "Créer un produit",
		"PUT /api/produits/{id}":               "Mettre à jour un produit",
		"DELETE /api/produits/{id}":            "Supprimer un produit",
		"GET /api/web-products":                "Liste des produits web",
		"POST /api/web-products":               "Créer un produit web",
		"PUT /api/web-products/{id}":           "Mettre à jour un produit web",
		"DELETE /api/web-products/{id}":        "Supprimer un produit web",
		"GET /api/tarifications":               "Liste des tarifications",
		"POST /api/tarifications":              "Créer une tarification",
		"GET /api/tarifications/{id}":          "Détails d'une tarification",
		"PUT /api/tarifications/{id}":          "Mettre à jour une tarification",
		"DELETE /api/tarifications/{id}":       "Supprimer une tarification",
		"GET /api/entreprises":                 "Liste des entreprises",
		"POST /api/entreprises":                "Créer une entreprise",
		"GET /api/entreprises/{id}":            "Détails d'une entreprise",
		"PUT /api/entreprises/{id}":            "Mettre à jour une entreprise",
		"DELETE /api/entreprises/{id}":         "Supprimer une entreprise",
		"GET /api/carousel-images":             "Liste des images carrousel",
		"POST /api/carousel-images":            "Ajouter une image carrousel",
		"GET /api/carousel-images/{id}":        "Détails d'une image carrousel",
		"PUT /api/carousel-images/{id}":        "Mettre à jour une image carrousel",
		"DELETE /api/carousel-images/{id}":     "Supprimer une image carrousel",
		"POST /api/carousel-images/reorder":    "Réordonner les images",
		"GET /api/public/carousel-images":      "Images carrousel actives (public)",
		"GET /api/public/categories":           "Catégories actives (public)",
		"GET /api/public/products/{slug}":      "Produits d'une catégorie (public)",
		"GET /api/abonnements":                 "Liste des abonnements",
		"POST /api/abonnements":                "Créer un abonnement",
		"GET /api/abonnements/{id}":            "Détails d'un abonnement",
		"PUT /api/abonnements/{id}":            "Mettre à jour un abonnement",
		"DELETE /api/abonnements/{id}":         "Supprimer un abonnement",
		"GET /api/commandes":                   "Liste des commandes",
		"POST /api/commandes":                  "Créer une commande",
		"GET /api/commandes/{id}":              "Détails d'une commande",
		"PUT /api/commandes/{id}":              "Mettre à jour une commande",
		"DELETE /api/commandes/{id}":           "Supprimer une commande",
		"GET /api/factures":                    "Liste des factures",
		"POST /api/factures":                   "Créer une facture",
		"GET /api/factures/{id}":               "Détails d'une facture",
		"PUT /api/factures/{id}":               "Mettre à jour une facture",
		"DELETE /api/factures/{id}":            "Supprimer une facture",
		"GET /api/paiements":                   "Liste des paiements",
		"POST /api/paiements":                  "Créer un paiement",
		"GET /api/paiements/{id}":              "Détails d'un paiement",
		"PUT /api/paiements/{id}":              "Mettre à jour un paiement",
		"DELETE /api/paiements/{id}":           "Supprimer un paiement",
		"GET /api/tickets":                     "Liste des tickets de support",
		"POST /api/tickets":                    "Créer un ticket",
		"GET /api/tickets/{id}":                "Détails d'un ticket",
		"PUT /api/tickets/{id}":                "Mettre à jour un ticket",
		"DELETE /api/tickets/{id}":             "Fermer un ticket",
		"GET /api/notifications":               "Mes notifications",
		"POST /api/notifications":              "Créer une notification",
		"GET /api/notifications/{id}":          "Détails d'une notification",
		"PUT /api/notifications/{id}":          "Marquer comme lue",
		"DELETE /api/notifications/{id}":       "Supprimer une notification",
		"GET /api/api-tokens":                  "Liste des tokens API",
		"POST /api/api-tokens":                 "Créer un token API",
		"DELETE /api/api-tokens/{id}":          "Révoquer un token API",
		"PUT /api/api-tokens/{id}/status":      "Activer/désactiver un token",
	}
	if s, ok := known[method+" "+path]; ok {
		return s
	}
	return method + " " + path
}

// getSwaggerSpec generates a dynamic OpenAPI 3.0 spec by walking mux routes
func getSwaggerSpec(w http.ResponseWriter, r *http.Request) {
	paths := map[string]interface{}{}

	mainRouter.Walk(func(route *mux.Route, _ *mux.Router, _ []*mux.Route) error {
		path, err := route.GetPathTemplate()
		if err != nil {
			return nil
		}
		methods, err := route.GetMethods()
		if err != nil || len(methods) == 0 {
			return nil
		}
		// Skip the swagger endpoint itself
		if path == "/api/swagger.json" {
			return nil
		}

		if _, ok := paths[path]; !ok {
			paths[path] = map[string]interface{}{}
		}

		// Extract path parameters
		params := []interface{}{}
		for _, seg := range strings.Split(path, "/") {
			if strings.HasPrefix(seg, "{") && strings.HasSuffix(seg, "}") {
				paramName := strings.Trim(seg, "{}")
				params = append(params, map[string]interface{}{
					"name":     paramName,
					"in":       "path",
					"required": true,
					"schema":   map[string]interface{}{"type": "string"},
				})
			}
		}

		for _, method := range methods {
			op := map[string]interface{}{
				"summary": summaryForRoute(method, path),
				"tags":    []string{tagForPath(path)},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{"description": "Succès"},
					"400": map[string]interface{}{"description": "Requête invalide"},
					"401": map[string]interface{}{"description": "Non autorisé"},
					"500": map[string]interface{}{"description": "Erreur serveur"},
				},
			}

			if len(params) > 0 {
				op["parameters"] = params
			}

			if !isPublicRoute(path, method) {
				op["security"] = []interface{}{
					map[string]interface{}{"BearerAuth": []interface{}{}},
				}
			}

			// Add request body hint for POST/PUT
			if method == "POST" || method == "PUT" {
				op["requestBody"] = map[string]interface{}{
					"required": true,
					"content": map[string]interface{}{
						"application/json": map[string]interface{}{
							"schema": map[string]interface{}{"type": "object"},
						},
					},
				}
			}

			paths[path].(map[string]interface{})[strings.ToLower(method)] = op
		}
		return nil
	})

	spec := map[string]interface{}{
		"openapi": "3.0.0",
		"info": map[string]interface{}{
			"title":       "CYNA API",
			"description": "API REST — générée dynamiquement depuis les routes enregistrées",
			"version":     "1.0.0",
		},
		"servers": []map[string]interface{}{
			{"url": "http://localhost:8080", "description": "API Go directe"},
		},
		"components": map[string]interface{}{
			"securitySchemes": map[string]interface{}{
				"BearerAuth": map[string]interface{}{
					"type":         "http",
					"scheme":       "bearer",
					"bearerFormat": "Token",
					"description":  "Token de session ou clé API",
				},
			},
		},
		"paths": paths,
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
	json.NewEncoder(w).Encode(spec)
}
