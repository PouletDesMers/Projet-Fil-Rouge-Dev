package middleware

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	apierrors "api/errors"
)

func TestErrorHandler_AppError(t *testing.T) {
	w := httptest.NewRecorder()
	err := apierrors.NewNotFound("user not found")

	ErrorHandler(w, err)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected %d, got %d", http.StatusNotFound, w.Code)
	}
	body := w.Body.String()
	if !strings.Contains(body, "user not found") {
		t.Errorf("body should contain error message, got: %s", body)
	}
	if !strings.Contains(body, `"success":false`) {
		t.Errorf("body should contain success:false, got: %s", body)
	}
}

func TestErrorHandler_GenericError(t *testing.T) {
	w := httptest.NewRecorder()

	ErrorHandler(w, errors.New("unexpected failure"))

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected %d, got %d", http.StatusInternalServerError, w.Code)
	}
	body := w.Body.String()
	if !strings.Contains(body, "Internal server error") {
		t.Errorf("body should contain generic message, got: %s", body)
	}
}
