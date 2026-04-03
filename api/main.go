package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"

	"api/cache"
	"api/config"
	"api/handlers"
	"api/logger"
	mw "api/middleware"
	"api/routes"
)

func main() {
	config.Init()
	cache.Init()
	logger.InitLogDB()
	handlers.InitBackupScheduler()

	// Auto-génération d'un token système s'il n'existe pas déjà.
	// Important: la table peut déjà contenir des clés de démo, donc COUNT(*) != 0.
	var systemTokenCount int
	if err := config.DB.QueryRow("SELECT COUNT(*) FROM api_token WHERE nom = 'System Token'").Scan(&systemTokenCount); err != nil {
		log.Printf("Failed checking system API token existence: %v", err)
	} else if systemTokenCount == 0 {
		b := make([]byte, 32)
		if _, err := cryptoRandRead(b); err != nil {
			log.Printf("Failed generating system API token bytes: %v", err)
		} else {
			newToken := encodeHexStr(b)
			var userID int
			err := config.DB.QueryRow("SELECT id_utilisateur FROM utilisateur ORDER BY id_utilisateur ASC LIMIT 1").Scan(&userID)
			if err != nil {
				log.Printf("Failed finding a user for system API token: %v", err)
			} else {
				if _, err := config.DB.Exec(
					"INSERT INTO api_token (cle_api, nom, permissions, id_utilisateur) VALUES ($1, $2, $3, $4)",
					newToken, "System Token", "all", userID,
				); err != nil {
					log.Printf("Failed creating system API token: %v", err)
				} else {
					log.Println("System API token generated successfully (check DB for the key)")
				}
			}
		}
	}

	r := mux.NewRouter()
	handlers.MainRouter = r

	r.Use(mw.SecurityHeaders)
	r.Use(mw.MaxBodySize)
	r.Use(mw.CORS)
	r.Use(mw.RateLimitAPI)
	r.Use(mw.RequestLogger)

	routes.Register(r)

	port := os.Getenv("API_PORT")
	if port == "" {
		port = "8080"
	}
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           r,
		ReadTimeout:       10 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	go func() {
		log.Printf("API started on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced shutdown: %v", err)
	}
	if config.DB != nil {
		config.DB.Close()
	}
	log.Println("Server stopped gracefully")
}
