package main

import (
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://172.16.1.152:3000")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		log.Printf("CORS Request: Method=%s, Origin=%s", r.Method, r.Header.Get("Origin"))

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	initDB()
	r := mux.NewRouter()
	api := r.PathPrefix("/api").Subrouter()
	api.Use(enableCORS)
	// r.Use(enableCORS) // Removed this line
	api.HandleFunc("/categories", getCategories).Methods("GET")
	api.HandleFunc("/categories", createCategorie).Methods("POST")
	api.HandleFunc("/categories/{id}", getCategorie).Methods("GET")
	api.HandleFunc("/categories/{id}", updateCategorie).Methods("PUT")
	api.HandleFunc("/categories/{id}", deleteCategorie).Methods("DELETE")
	api.HandleFunc("/services", getServices).Methods("GET")
	api.HandleFunc("/services", createService).Methods("POST")
	api.HandleFunc("/services/{id}", getService).Methods("GET")
	api.HandleFunc("/services/{id}", updateService).Methods("PUT")
	api.HandleFunc("/services/{id}", deleteService).Methods("DELETE")
	api.HandleFunc("/produits", getProduits).Methods("GET")
	api.HandleFunc("/produits", createProduit).Methods("POST")
	api.HandleFunc("/produits/{id}", getProduit).Methods("GET")
	api.HandleFunc("/produits/{id}", updateProduit).Methods("PUT")
	api.HandleFunc("/produits/{id}", deleteProduit).Methods("DELETE")
	api.HandleFunc("/tarifications", getTarifications).Methods("GET")
	api.HandleFunc("/tarifications", createTarification).Methods("POST")
	api.HandleFunc("/tarifications/{id}", getTarification).Methods("GET")
	api.HandleFunc("/tarifications/{id}", updateTarification).Methods("PUT")
	api.HandleFunc("/tarifications/{id}", deleteTarification).Methods("DELETE")
	api.HandleFunc("/entreprises", getEntreprises).Methods("GET")
	api.HandleFunc("/entreprises", createEntreprise).Methods("POST")
	api.HandleFunc("/entreprises/{id}", getEntreprise).Methods("GET")
	api.HandleFunc("/entreprises/{id}", updateEntreprise).Methods("PUT")
	api.HandleFunc("/entreprises/{id}", deleteEntreprise).Methods("DELETE")
	api.HandleFunc("/utilisateurs", getUtilisateurs).Methods("GET")
	api.HandleFunc("/utilisateurs", createUtilisateur).Methods("POST")
	api.HandleFunc("/utilisateurs/exists", getUtilisateurExists).Methods("GET")
	api.HandleFunc("/utilisateurs/{id}", getUtilisateur).Methods("GET")
	api.HandleFunc("/utilisateurs/{id}", updateUtilisateur).Methods("PUT")
	api.HandleFunc("/utilisateurs/{id}", deleteUtilisateur).Methods("DELETE")
	api.HandleFunc("/login", loginUtilisateur).Methods("POST")
	api.HandleFunc("/user/profile", getUserProfile).Methods("GET")
	api.HandleFunc("/user/profile", updateUserProfile).Methods("PUT")
	api.HandleFunc("/webauthn/register-challenge", getWebAuthnRegisterChallenge).Methods("GET")
	api.HandleFunc("/webauthn/register", registerWebAuthn).Methods("POST")
	api.HandleFunc("/webauthn/remove", removeWebAuthn).Methods("DELETE")
	api.HandleFunc("/totp/setup", setupTOTP).Methods("GET")
	api.HandleFunc("/totp/remove", removeTOTP).Methods("DELETE")
	api.HandleFunc("/abonnements", getAbonnements).Methods("GET")
	api.HandleFunc("/abonnements", createAbonnement).Methods("POST")
	api.HandleFunc("/abonnements/{id}", getAbonnement).Methods("GET")
	api.HandleFunc("/abonnements/{id}", updateAbonnement).Methods("PUT")
	api.HandleFunc("/abonnements/{id}", deleteAbonnement).Methods("DELETE")
	api.HandleFunc("/commandes", getCommandes).Methods("GET")
	api.HandleFunc("/commandes", createCommande).Methods("POST")
	api.HandleFunc("/commandes/{id}", getCommande).Methods("GET")
	api.HandleFunc("/commandes/{id}", updateCommande).Methods("PUT")
	api.HandleFunc("/commandes/{id}", deleteCommande).Methods("DELETE")
	api.HandleFunc("/factures", getFactures).Methods("GET")
	api.HandleFunc("/factures", createFacture).Methods("POST")
	api.HandleFunc("/factures/{id}", getFacture).Methods("GET")
	api.HandleFunc("/factures/{id}", updateFacture).Methods("PUT")
	api.HandleFunc("/factures/{id}", deleteFacture).Methods("DELETE")
	api.HandleFunc("/paiements", getPaiements).Methods("GET")
	api.HandleFunc("/paiements", createPaiement).Methods("POST")
	api.HandleFunc("/paiements/{id}", getPaiement).Methods("GET")
	api.HandleFunc("/paiements/{id}", updatePaiement).Methods("PUT")
	api.HandleFunc("/paiements/{id}", deletePaiement).Methods("DELETE")
	api.HandleFunc("/tickets", getTicketSupports).Methods("GET")
	api.HandleFunc("/tickets", createTicketSupport).Methods("POST")
	api.HandleFunc("/tickets/{id}", getTicketSupport).Methods("GET")
	api.HandleFunc("/tickets/{id}", updateTicketSupport).Methods("PUT")
	api.HandleFunc("/tickets/{id}", deleteTicketSupport).Methods("DELETE")
	api.HandleFunc("/notifications", getNotifications).Methods("GET")
	api.HandleFunc("/notifications", createNotification).Methods("POST")
	api.HandleFunc("/notifications/{id}", getNotification).Methods("GET")
	api.HandleFunc("/notifications/{id}", updateNotification).Methods("PUT")
	api.HandleFunc("/notifications/{id}", deleteNotification).Methods("DELETE")
	api.HandleFunc("/user/2fa/setup", setup2FA).Methods("POST")
	api.HandleFunc("/user/2fa/verify", verify2FA).Methods("POST")
	api.HandleFunc("/user/2fa/remove", remove2FA).Methods("DELETE")
	api.HandleFunc("/user/profile", updateUserProfile).Methods("PUT")
	log.Println("API démarrée en HTTP sur le port 8080")
	http.ListenAndServe(":8080", r)
}
