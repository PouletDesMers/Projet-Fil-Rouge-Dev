package errors

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNew(t *testing.T) {
	err := New(http.StatusBadRequest, "bad input")
	if err.Code != http.StatusBadRequest {
		t.Errorf("expected code %d, got %d", http.StatusBadRequest, err.Code)
	}
	if err.Message != "bad input" {
		t.Errorf("expected message %q, got %q", "bad input", err.Message)
	}
	if !err.IsOperational {
		t.Error("expected IsOperational=true")
	}
	if err.Error() != "bad input" {
		t.Errorf("Error() returned %q", err.Error())
	}
}

func TestSubclasses(t *testing.T) {
	tests := []struct {
		name     string
		err      *AppError
		wantCode int
	}{
		{"Validation", NewValidation("invalid email").AppError, http.StatusBadRequest},
		{"NotFound", NewNotFound("user not found").AppError, http.StatusNotFound},
		{"Unauthorized", NewUnauthorized("no token").AppError, http.StatusUnauthorized},
		{"Forbidden", NewForbidden("admin only").AppError, http.StatusForbidden},
		{"Conflict", NewConflict("email already used").AppError, http.StatusConflict},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.err.Code != tt.wantCode {
				t.Errorf("expected code %d, got %d", tt.wantCode, tt.err.Code)
			}
		})
	}
}

func TestPredefinedErrors(t *testing.T) {
	if ErrUnauthorized.Code != http.StatusUnauthorized {
		t.Errorf("ErrUnauthorized: expected %d, got %d", http.StatusUnauthorized, ErrUnauthorized.Code)
	}
	if ErrForbidden.Code != http.StatusForbidden {
		t.Errorf("ErrForbidden: expected %d, got %d", http.StatusForbidden, ErrForbidden.Code)
	}
	if ErrNotFound.Code != http.StatusNotFound {
		t.Errorf("ErrNotFound: expected %d, got %d", http.StatusNotFound, ErrNotFound.Code)
	}
	if ErrBadRequest.Code != http.StatusBadRequest {
		t.Errorf("ErrBadRequest: expected %d, got %d", http.StatusBadRequest, ErrBadRequest.Code)
	}
	if ErrInternal.Code != http.StatusInternalServerError {
		t.Errorf("ErrInternal: expected %d, got %d", http.StatusInternalServerError, ErrInternal.Code)
	}
}

func TestJSONResponse(t *testing.T) {
	w := httptest.NewRecorder()
	JSON(w, "not found", http.StatusNotFound)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status %d, got %d", http.StatusNotFound, w.Code)
	}
	ct := w.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}
	body := w.Body.String()
	if body == "" {
		t.Error("expected non-empty body")
	}
}

func TestHandle(t *testing.T) {
	w := httptest.NewRecorder()
	Handle(w, ErrForbidden)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected status %d, got %d", http.StatusForbidden, w.Code)
	}
}
