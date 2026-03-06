package cache

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"api/models"
)

// entry représente une valeur stockée dans le cache avec sa date d'expiration.
type entry struct {
	data      []byte
	expiresAt time.Time
}

type Stats struct {
	Hits   int64 `json:"hits"`
	Misses int64 `json:"misses"`
	Size   int   `json:"size"`
}

type Cache struct {
	mu         sync.RWMutex
	entries    map[string]entry
	defaultTTL time.Duration
	hits       int64
	misses     int64
}

func New(defaultTTL, cleanupInterval time.Duration) *Cache {
	c := &Cache{
		entries:    make(map[string]entry),
		defaultTTL: defaultTTL,
	}
	go func() {
		ticker := time.NewTicker(cleanupInterval)
		defer ticker.Stop()
		for range ticker.C {
			c.cleanup()
		}
	}()
	return c
}

func (c *Cache) Get(key string) []byte {
	c.mu.RLock()
	e, exists := c.entries[key]
	c.mu.RUnlock()

	if !exists || time.Now().After(e.expiresAt) {
		if exists {
			c.mu.Lock()
			delete(c.entries, key)
			c.mu.Unlock()
		}
		c.mu.Lock()
		c.misses++
		c.mu.Unlock()
		return nil
	}
	c.mu.Lock()
	c.hits++
	c.mu.Unlock()
	return e.data
}

func (c *Cache) Set(key string, data []byte) {
	c.SetWithTTL(key, data, c.defaultTTL)
}

func (c *Cache) SetWithTTL(key string, data []byte, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = entry{data: data, expiresAt: time.Now().Add(ttl)}
}

func (c *Cache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.entries, key)
}

func (c *Cache) DeleteByPrefix(prefix string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for k := range c.entries {
		if len(k) >= len(prefix) && k[:len(prefix)] == prefix {
			delete(c.entries, k)
		}
	}
}

func (c *Cache) Flush() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = make(map[string]entry)
	log.Println("Cache flushed")
}

func (c *Cache) Stats() Stats {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return Stats{Hits: c.hits, Misses: c.misses, Size: len(c.entries)}
}

func (c *Cache) cleanup() {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	expired := 0
	for k, e := range c.entries {
		if now.After(e.expiresAt) {
			delete(c.entries, k)
			expired++
		}
	}
	if expired > 0 {
		log.Printf("Cache cleanup: %d expired entries removed, %d remaining", expired, len(c.entries))
	}
}

// ===== HELPERS JSON =====

func SetJSON(c *Cache, key string, value interface{}) {
	data, err := json.Marshal(value)
	if err != nil {
		log.Printf("Cache: error marshaling key %s: %v", key, err)
		return
	}
	c.Set(key, data)
}

func SetJSONWithTTL(c *Cache, key string, value interface{}, ttl time.Duration) {
	data, err := json.Marshal(value)
	if err != nil {
		log.Printf("Cache: error marshaling key %s: %v", key, err)
		return
	}
	c.SetWithTTL(key, data, ttl)
}

// ===== INSTANCES GLOBALES =====

var (
	// CatalogCache — catégories et produits (TTL: 5 min)
	CatalogCache *Cache
	// SearchCache — résultats de recherche (TTL: 2 min)
	SearchCache *Cache
)

func Init() {
	CatalogCache = New(5*time.Minute, 1*time.Minute)
	SearchCache = New(2*time.Minute, 30*time.Second)
	log.Println("Cache initialized (catalog: 5min TTL, search: 2min TTL)")
}

// ===== CLÉS =====

const (
	KeyActiveCategories = "categories:active"
	KeyAllCategories    = "categories:all"
	KeyAllProduits      = "produits:all"
	KeyAllTarifications = "tarifications:all"
)

func KeyProduitsByCategory(slug string) string      { return "produits:category:" + slug }
func KeySearchResults(query string) string          { return "search:" + query }
func KeyTarification(id int) string                 { return fmt.Sprintf("tarification:%d", id) }

// ===== INVALIDATION =====

func InvalidateCategories() {
	CatalogCache.Delete(KeyActiveCategories)
	CatalogCache.Delete(KeyAllCategories)
	log.Println("Cache invalidated: categories")
}

func InvalidateProduits() {
	CatalogCache.Delete(KeyAllProduits)
	CatalogCache.DeleteByPrefix("produits:category:")
	SearchCache.DeleteByPrefix("search:")
	log.Println("Cache invalidated: produits + search")
}

func InvalidateTarifications() {
	CatalogCache.Delete(KeyAllTarifications)
	CatalogCache.DeleteByPrefix("tarification:")
	log.Println("Cache invalidated: tarifications")
}

// ===== HANDLERS ADMIN =====

func GetStats(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(models.UserRoleKey).(string)
	if userRole != "admin" {
		http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
		return
	}
	stats := map[string]interface{}{
		"catalog_cache": CatalogCache.Stats(),
		"search_cache":  SearchCache.Stats(),
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func FlushAll(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(models.UserRoleKey).(string)
	if userRole != "admin" {
		http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
		return
	}
	CatalogCache.Flush()
	SearchCache.Flush()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "All caches flushed successfully"})
}
