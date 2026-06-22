package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	apierrors "api/errors"
)

func TestSecurityHeaders(t *testing.T) {
	handler := SecurityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	resp := w.Result()
	headers := resp.Header

	checks := map[string]string{
		"X-Content-Type-Options":    "nosniff",
		"X-Frame-Options":           "DENY",
		"X-XSS-Protection":          "1; mode=block",
		"Referrer-Policy":           "strict-origin-when-cross-origin",
		"Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
		"Cache-Control":             "no-store",
	}

	for key, expected := range checks {
		if got := headers.Get(key); got != expected {
			t.Errorf("header %s: expected %q, got %q", key, expected, got)
		}
	}
}

func TestCORS_AllowedOrigin(t *testing.T) {
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	resp := w.Result()
	if resp.Header.Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Errorf("expected CORS origin, got %s", resp.Header.Get("Access-Control-Allow-Origin"))
	}
}

func TestCORS_DisallowedOrigin(t *testing.T) {
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Origin", "http://evil.com")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	resp := w.Result()
	if resp.Header.Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("expected no CORS for disallowed origin, got %s",
			resp.Header.Get("Access-Control-Allow-Origin"))
	}
}

func TestCORS_OptionsMethod(t *testing.T) {
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("OPTIONS", "/", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for OPTIONS, got %d", w.Code)
	}
}

func TestMaxBodySize_UnderLimit(t *testing.T) {
	handler := MaxBodySize(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("POST", "/", nil)
	req.ContentLength = 100
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for small body, got %d", w.Code)
	}
}

func TestMaxBodySize_OverLimit(t *testing.T) {
	handler := MaxBodySize(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("POST", "/", nil)
	req.ContentLength = maxBodySize + 1
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("expected 413 for oversized body, got %d", w.Code)
	}
}

func TestRateLimiter_IsAllowed(t *testing.T) {
	rl := newRateLimiter(3, 60*1000)
	for i := 0; i < 3; i++ {
		if !rl.isAllowed("test-ip") {
			t.Errorf("expected allowed on attempt %d", i+1)
		}
	}
	if rl.isAllowed("test-ip") {
		t.Error("expected blocked after 3 attempts")
	}
}

func TestRateLimiter_DifferentIPs(t *testing.T) {
	rl := newRateLimiter(2, 60*1000)
	rl.isAllowed("ip-1")
	rl.isAllowed("ip-1")

	if rl.isAllowed("ip-1") {
		t.Error("expected ip-1 to be blocked")
	}
	if !rl.isAllowed("ip-2") {
		t.Error("expected ip-2 to be allowed (different IP)")
	}
}

func TestGetClientIP_XRealIP(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Real-IP", "10.0.0.1")
	req.RemoteAddr = "192.168.1.1:12345"

	ip := GetClientIP(req)
	if ip != "10.0.0.1" {
		t.Errorf("expected X-Real-IP '10.0.0.1', got '%s'", ip)
	}
}

func TestGetClientIP_XForwardedFor(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Forwarded-For", "10.0.0.2, 10.0.0.3")

	ip := GetClientIP(req)
	if ip != "10.0.0.2" {
		t.Errorf("expected X-Forwarded-For '10.0.0.2', got '%s'", ip)
	}
}

func TestGetClientIP_RemoteAddr(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "192.168.1.100:8080"

	ip := GetClientIP(req)
	if ip != "192.168.1.100" {
		t.Errorf("expected RemoteAddr '192.168.1.100', got '%s'", ip)
	}
}

func TestErrorHandler_ValidationError(t *testing.T) {
	w := httptest.NewRecorder()
	err := apierrors.NewValidation("invalid email")

	ErrorHandler(w, err)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected %d, got %d", http.StatusBadRequest, w.Code)
	}
	body := w.Body.String()
	if !strings.Contains(body, "invalid email") {
		t.Errorf("body should contain error message, got: %s", body)
	}
}

func TestErrorHandler_ForbiddenError(t *testing.T) {
	w := httptest.NewRecorder()
	err := apierrors.NewForbidden("access denied")

	ErrorHandler(w, err)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected %d, got %d", http.StatusForbidden, w.Code)
	}
}

func TestErrorHandler_NilError(t *testing.T) {
	w := httptest.NewRecorder()
	ErrorHandler(w, nil)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected %d, got %d", http.StatusInternalServerError, w.Code)
	}
}

func TestRouteDescription(t *testing.T) {
	tests := []struct {
		method string
		path   string
		want   string
	}{
		{"POST", "/api/login", "Tentative de connexion"},
		{"POST", "/api/users", "Création de compte"},
		{"GET", "/api/user/profile", "Consultation du profil"},
		{"PUT", "/api/user/", "Mise à jour du profil"},
		{"GET", "/api/users/exists", "Vérification existence email"},
	}

	for _, tt := range tests {
		got := routeDescription(tt.method, tt.path)
		if got != tt.want {
			t.Errorf("routeDescription(%q, %q) = %q, want %q", tt.method, tt.path, got, tt.want)
		}
	}
}

func TestResponseRecorder(t *testing.T) {
	w := httptest.NewRecorder()
	rr := newResponseRecorder(w)

	if rr.statusCode != http.StatusOK {
		t.Errorf("expected initial status %d, got %d", http.StatusOK, rr.statusCode)
	}

	rr.WriteHeader(http.StatusNotFound)
	if rr.statusCode != http.StatusNotFound {
		t.Errorf("expected status %d, got %d", http.StatusNotFound, rr.statusCode)
	}
}

