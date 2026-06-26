package cache

import (
	"sync"
	"testing"
	"time"
)

func TestNew(t *testing.T) {
	c := New(5*time.Minute, 1*time.Minute)
	if c == nil {
		t.Fatal("expected non-nil cache")
	}
	if c.defaultTTL != 5*time.Minute {
		t.Errorf("expected defaultTTL 5m, got %v", c.defaultTTL)
	}
}

func TestSetAndGet(t *testing.T) {
	c := New(5*time.Minute, 1*time.Minute)
	c.Set("key1", []byte("value1"))

	got := c.Get("key1")
	if string(got) != "value1" {
		t.Errorf("expected 'value1', got '%s'", string(got))
	}
}

func TestGetMiss(t *testing.T) {
	c := New(5*time.Minute, 1*time.Minute)
	got := c.Get("nonexistent")
	if got != nil {
		t.Errorf("expected nil, got %v", got)
	}
}

func TestGetExpired(t *testing.T) {
	c := New(5*time.Minute, 1*time.Minute)
	c.SetWithTTL("key1", []byte("value1"), 1*time.Microsecond)
	time.Sleep(10 * time.Millisecond)

	got := c.Get("key1")
	if got != nil {
		t.Errorf("expected nil for expired key, got %v", got)
	}
}

func TestSetWithTTL(t *testing.T) {
	c := New(5*time.Minute, 1*time.Minute)
	c.SetWithTTL("key1", []byte("value1"), 10*time.Second)

	got := c.Get("key1")
	if string(got) != "value1" {
		t.Errorf("expected 'value1', got '%s'", string(got))
	}
}

func TestDelete(t *testing.T) {
	c := New(5*time.Minute, 1*time.Minute)
	c.Set("key1", []byte("value1"))
	c.Delete("key1")

	got := c.Get("key1")
	if got != nil {
		t.Errorf("expected nil after delete, got %v", got)
	}
}

func TestDeleteByPrefix(t *testing.T) {
	c := New(5*time.Minute, 1*time.Minute)
	c.Set("prefix:foo", []byte("foo"))
	c.Set("prefix:bar", []byte("bar"))
	c.Set("other:baz", []byte("baz"))

	c.DeleteByPrefix("prefix:")

	if c.Get("prefix:foo") != nil {
		t.Error("expected prefix:foo to be deleted")
	}
	if c.Get("prefix:bar") != nil {
		t.Error("expected prefix:bar to be deleted")
	}
	if string(c.Get("other:baz")) != "baz" {
		t.Error("expected other:baz to remain")
	}
}

func TestFlush(t *testing.T) {
	c := New(5*time.Minute, 1*time.Minute)
	c.Set("key1", []byte("value1"))
	c.Set("key2", []byte("value2"))
	c.Flush()

	if c.Get("key1") != nil {
		t.Error("expected key1 to be flushed")
	}
	if c.Get("key2") != nil {
		t.Error("expected key2 to be flushed")
	}
}

func TestStats(t *testing.T) {
	c := New(5*time.Minute, 1*time.Minute)
	c.Set("key1", []byte("value1"))

	// Hit
	c.Get("key1")
	c.Get("key1")

	// Miss
	c.Get("nonexistent")

	stats := c.Stats()
	if stats.Hits != 2 {
		t.Errorf("expected 2 hits, got %d", stats.Hits)
	}
	if stats.Misses != 1 {
		t.Errorf("expected 1 miss, got %d", stats.Misses)
	}
	if stats.Size != 1 {
		t.Errorf("expected size 1, got %d", stats.Size)
	}
}

func TestFlushResetsStats(t *testing.T) {
	c := New(5*time.Minute, 1*time.Minute)
	c.Set("key1", []byte("value1"))
	c.Get("key1")
	c.Flush()

	stats := c.Stats()
	if stats.Hits != 1 {
		t.Errorf("expected 1 hit after flush, got %d", stats.Hits)
	}
	if stats.Size != 0 {
		t.Errorf("expected size 0 after flush, got %d", stats.Size)
	}
}

func TestConcurrentAccess(t *testing.T) {
	c := New(5*time.Minute, 1*time.Minute)
	var wg sync.WaitGroup

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			key := "key" + string(rune('0'+n))
			c.Set(key, []byte("value"))
			c.Get(key)
			c.Delete(key)
		}(i)
	}
	wg.Wait()
}

func TestCleanup(t *testing.T) {
	c := New(50*time.Millisecond, 20*time.Millisecond)
	c.SetWithTTL("key1", []byte("value1"), 30*time.Millisecond)
	c.SetWithTTL("key2", []byte("value2"), 30*time.Millisecond)

	time.Sleep(100 * time.Millisecond)

	stats := c.Stats()
	if stats.Size != 0 {
		t.Errorf("expected size 0 after cleanup, got %d", stats.Size)
	}
}

func TestSetJSON(t *testing.T) {
	c := New(5*time.Minute, 1*time.Minute)
	SetJSON(c, "json-key", map[string]string{"hello": "world"})

	data := c.Get("json-key")
	if data == nil {
		t.Fatal("expected non-nil data")
	}
	if string(data) != `{"hello":"world"}` {
		t.Errorf("expected JSON, got %s", string(data))
	}
}

func TestSetJSONWithTTL(t *testing.T) {
	c := New(5*time.Minute, 1*time.Minute)
	SetJSONWithTTL(c, "json-key", map[string]int{"count": 42}, 10*time.Second)

	data := c.Get("json-key")
	if data == nil {
		t.Fatal("expected non-nil data")
	}
	if string(data) != `{"count":42}` {
		t.Errorf("expected JSON, got %s", string(data))
	}
}

func TestKeyFunctions(t *testing.T) {
	if got := KeyProduitsByCategory("cyber"); got != "produits:category:cyber" {
		t.Errorf("unexpected key: %s", got)
	}
	if got := KeySearchResults("test"); got != "search:test" {
		t.Errorf("unexpected key: %s", got)
	}
	if got := KeyTarification(42); got != "tarification:42" {
		t.Errorf("unexpected key: %s", got)
	}
}

func TestGlobalCaches(t *testing.T) {
	Init()
	if CatalogCache == nil {
		t.Error("CatalogCache should not be nil")
	}
	if SearchCache == nil {
		t.Error("SearchCache should not be nil")
	}
	if AdminCache == nil {
		t.Error("AdminCache should not be nil")
	}
}

func TestInvalidateCategories(t *testing.T) {
	Init()
	CatalogCache.Set(KeyActiveCategories, []byte("data"))
	CatalogCache.Set(KeyAllCategories, []byte("data"))

	InvalidateCategories()

	if CatalogCache.Get(KeyActiveCategories) != nil {
		t.Error("expected active categories to be invalidated")
	}
	if CatalogCache.Get(KeyAllCategories) != nil {
		t.Error("expected all categories to be invalidated")
	}
}

func TestInvalidateProduits(t *testing.T) {
	Init()
	CatalogCache.Set(KeyAllProduits, []byte("data"))
	CatalogCache.Set(KeyProduitsByCategory("test"), []byte("data"))
	SearchCache.Set(KeySearchResults("test"), []byte("data"))

	InvalidateProduits()

	if CatalogCache.Get(KeyAllProduits) != nil {
		t.Error("expected all produits to be invalidated")
	}
	if CatalogCache.Get(KeyProduitsByCategory("test")) != nil {
		t.Error("expected category produits to be invalidated")
	}
	if SearchCache.Get(KeySearchResults("test")) != nil {
		t.Error("expected search results to be invalidated")
	}
}
