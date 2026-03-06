package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

// ===== CACHE IN-MEMORY AVEC TTL =====

// cacheEntry représente une entrée du cache avec expiration
type cacheEntry struct {
	data      []byte
	expiresAt time.Time
}

// Cache est un cache thread-safe en mémoire avec TTL et nettoyage automatique
type Cache struct {
	mu         sync.RWMutex
	entries    map[string]cacheEntry
	defaultTTL time.Duration
	stats      CacheStats
}

// CacheStats contient les statistiques du cache
type CacheStats struct {
	Hits   int64 `json:"hits"`
	Misses int64 `json:"misses"`
	Size   int   `json:"size"`
}

// NewCache crée un nouveau cache avec un TTL par défaut et un nettoyage périodique
func NewCache(defaultTTL time.Duration, cleanupInterval time.Duration) *Cache {
	c := &Cache{
		entries:    make(map[string]cacheEntry),
		defaultTTL: defaultTTL,
	}

	// Goroutine de nettoyage des entrées expirées
	go func() {
		ticker := time.NewTicker(cleanupInterval)
		defer ticker.Stop()
		for range ticker.C {
			c.cleanup()
		}
	}()

	return c
}

// Get récupère une entrée du cache. Retourne nil si absente ou expirée.
func (c *Cache) Get(key string) []byte {
	c.mu.RLock()
	entry, exists := c.entries[key]
	c.mu.RUnlock()

	if !exists || time.Now().After(entry.expiresAt) {
		if exists {
			// Entrée expirée, la supprimer en lazy
			c.mu.Lock()
			delete(c.entries, key)
			c.mu.Unlock()
		}
		c.mu.Lock()
		c.stats.Misses++
		c.mu.Unlock()
		return nil
	}

	c.mu.Lock()
	c.stats.Hits++
	c.mu.Unlock()
	return entry.data
}

// Set stocke une entrée dans le cache avec le TTL par défaut
func (c *Cache) Set(key string, data []byte) {
	c.SetWithTTL(key, data, c.defaultTTL)
}

// SetWithTTL stocke une entrée dans le cache avec un TTL personnalisé
func (c *Cache) SetWithTTL(key string, data []byte, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = cacheEntry{
		data:      data,
		expiresAt: time.Now().Add(ttl),
	}
}

// Delete supprime une entrée spécifique du cache
func (c *Cache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.entries, key)
}

// DeleteByPrefix supprime toutes les entrées dont la clé commence par le préfixe donné
func (c *Cache) DeleteByPrefix(prefix string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for key := range c.entries {
		if len(key) >= len(prefix) && key[:len(prefix)] == prefix {
			delete(c.entries, key)
		}
	}
}

// Flush vide entièrement le cache
func (c *Cache) Flush() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = make(map[string]cacheEntry)
	log.Println("Cache flushed")
}

// Stats retourne les statistiques du cache
func (c *Cache) Stats() CacheStats {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return CacheStats{
		Hits:   c.stats.Hits,
		Misses: c.stats.Misses,
		Size:   len(c.entries),
	}
}

// cleanup supprime les entrées expirées
func (c *Cache) cleanup() {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	expired := 0
	for key, entry := range c.entries {
		if now.After(entry.expiresAt) {
			delete(c.entries, key)
			expired++
		}
	}
	if expired > 0 {
		log.Printf("Cache cleanup: %d expired entries removed, %d remaining", expired, len(c.entries))
	}
}

// ===== HELPERS POUR SÉRIALISER/DÉSERIALISER =====

// CacheSetJSON sérialise une valeur en JSON et la stocke dans le cache
func CacheSetJSON(c *Cache, key string, value interface{}) {
	data, err := json.Marshal(value)
	if err != nil {
		log.Printf("Cache: error marshaling for key %s: %v", key, err)
		return
	}
	c.Set(key, data)
}

// CacheSetJSONWithTTL sérialise une valeur en JSON et la stocke avec un TTL personnalisé
func CacheSetJSONWithTTL(c *Cache, key string, value interface{}, ttl time.Duration) {
	data, err := json.Marshal(value)
	if err != nil {
		log.Printf("Cache: error marshaling for key %s: %v", key, err)
		return
	}
	c.SetWithTTL(key, data, ttl)
}

// ===== INSTANCES GLOBALES DU CACHE =====

var (
	// catalogCache — cache pour les catégories et produits (TTL: 5 min)
	catalogCache *Cache

	// searchCache — cache pour les résultats de recherche (TTL: 2 min)
	searchCache *Cache
)

// initCache initialise les instances de cache globales
func initCache() {
	catalogCache = NewCache(5*time.Minute, 1*time.Minute)
	searchCache = NewCache(2*time.Minute, 30*time.Second)
	log.Println("Cache initialized (catalog: 5min TTL, search: 2min TTL)")
}

// ===== CLÉS DE CACHE =====

const (
	cacheKeyActiveCategories = "categories:active"
	cacheKeyAllCategories    = "categories:all"
	cacheKeyAllProduits      = "produits:all"
	cacheKeyAllTarifications = "tarifications:all"
)

// Fonctions pour générer des clés dynamiques
func cacheKeyProduitsByCategory(slug string) string {
	return "produits:category:" + slug
}

func cacheKeySearchResults(query string) string {
	return "search:" + query
}

func cacheKeyTarification(id int) string {
	return fmt.Sprintf("tarification:%d", id)
}

// ===== INVALIDATION DU CACHE =====

// invalidateCategoriesCache invalide tout le cache lié aux catégories
func invalidateCategoriesCache() {
	catalogCache.Delete(cacheKeyActiveCategories)
	catalogCache.Delete(cacheKeyAllCategories)
	log.Println("Cache invalidated: categories")
}

// invalidateProduitsCache invalide tout le cache lié aux produits
func invalidateProduitsCache() {
	catalogCache.Delete(cacheKeyAllProduits)
	catalogCache.DeleteByPrefix("produits:category:")
	searchCache.DeleteByPrefix("search:")
	log.Println("Cache invalidated: produits + search")
}

// invalidateTarificationsCache invalide tout le cache lié aux tarifications
func invalidateTarificationsCache() {
	catalogCache.Delete(cacheKeyAllTarifications)
	catalogCache.DeleteByPrefix("tarification:")
	log.Println("Cache invalidated: tarifications")
}

// ===== HANDLERS ADMIN CACHE =====

// getCacheStats retourne les statistiques du cache (admin only)
func getCacheStats(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(UserRoleKey).(string)
	if userRole != "admin" {
		jsonError(w, "Forbidden", http.StatusForbidden)
		return
	}

	stats := map[string]interface{}{
		"catalog_cache": catalogCache.Stats(),
		"search_cache":  searchCache.Stats(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// flushCache vide tous les caches (admin only)
func flushCache(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(UserRoleKey).(string)
	if userRole != "admin" {
		jsonError(w, "Forbidden", http.StatusForbidden)
		return
	}

	catalogCache.Flush()
	searchCache.Flush()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "All caches flushed successfully"})
}
