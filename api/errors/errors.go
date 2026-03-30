package errors

import (
	"encoding/json"
	"net/http"
)

type AppError struct {
	Code          int    `json:"code"`
	Message       string `json:"error"`
	IsOperational bool   `json:"-"`
}

func (e *AppError) Error() string    { return e.Message }
func (e *AppError) AppErr() *AppError { return e }

type AppErrorer interface {
	error
	AppErr() *AppError
}

func New(code int, message string) *AppError {
	return &AppError{Code: code, Message: message, IsOperational: true}
}

type ValidationError struct{ *AppError }
type NotFoundError struct{ *AppError }
type UnauthorizedError struct{ *AppError }
type ForbiddenError struct{ *AppError }
type ConflictError struct{ *AppError }

func NewValidation(message string) *ValidationError {
	return &ValidationError{New(http.StatusBadRequest, message)}
}

func NewNotFound(message string) *NotFoundError {
	return &NotFoundError{New(http.StatusNotFound, message)}
}

func NewUnauthorized(message string) *UnauthorizedError {
	return &UnauthorizedError{New(http.StatusUnauthorized, message)}
}

func NewForbidden(message string) *ForbiddenError {
	return &ForbiddenError{New(http.StatusForbidden, message)}
}

func NewConflict(message string) *ConflictError {
	return &ConflictError{New(http.StatusConflict, message)}
}

var (
	ErrUnauthorized = New(http.StatusUnauthorized, "Unauthorized")
	ErrForbidden    = New(http.StatusForbidden, "Forbidden")
	ErrNotFound     = New(http.StatusNotFound, "Not found")
	ErrBadRequest   = New(http.StatusBadRequest, "Bad request")
	ErrInternal     = New(http.StatusInternalServerError, "Internal server error")
)

func JSON(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func Handle(w http.ResponseWriter, err *AppError) {
	JSON(w, err.Message, err.Code)
}
