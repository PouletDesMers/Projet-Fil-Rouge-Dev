package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ===== SYSTÈME DE LOGS EN MÉMOIRE =====

// LogLevel représente le niveau de sévérité d'un log
type LogLevel string

const (
	LogLevelDEBUG    LogLevel = "DEBUG"
	LogLevelINFO     LogLevel = "INFO"
	LogLevelWARN     LogLevel = "WARN"
	LogLevelERROR    LogLevel = "ERROR"
	LogLevelSECURITY LogLevel = "SECURITY"

	// Taille maximale du buffer de logs en mémoire
	maxLogEntries = 2000
)

// LogEntry représente une entrée de log
type LogEntry struct {
	ID        int64    `json:"id"`
	Timestamp string   `json:"timestamp"`
	Level     LogLevel `json:"level"`
	Message   string   `json:"message"`
	Method    string   `json:"method,omitempty"`
	Path      string   `json:"path,omitempty"`
	IP        string   `json:"ip,omitempty"`
	UserID    int      `json:"user_id,omitempty"`
	Status    int      `json:"status,omitempty"`
	Duration  string   `json:"duration,omitempty"`
}

// MemoryLogger est un logger circulaire thread-safe en mémoire
type MemoryLogger struct {
	mu      sync.RWMutex
	entries []LogEntry
	counter int64
}

var appLogger = &MemoryLogger{
	entries: make([]LogEntry, 0, maxLogEntries),
}

// addEntry ajoute une entrée dans le buffer circulaire
func (ml *MemoryLogger) addEntry(entry LogEntry) {
	ml.mu.Lock()
	defer ml.mu.Unlock()

	ml.counter++
	entry.ID = ml.counter
	entry.Timestamp = time.Now().UTC().Format(time.RFC3339)

	if len(ml.entries) >= maxLogEntries {
		// Buffer circulaire : supprimer la plus ancienne entrée
		ml.entries = ml.entries[1:]
	}
	ml.entries = append(ml.entries, entry)
}

// Log enregistre un message avec un niveau donné
func (ml *MemoryLogger) Log(level LogLevel, message string) {
	ml.addEntry(LogEntry{
		Level:   level,
		Message: message,
	})
	log.Printf("[%s] %s", level, message)
}

// LogRequest enregistre une requête HTTP
func (ml *MemoryLogger) LogRequest(level LogLevel, method, path, ip string, userID, status int, duration time.Duration, message string) {
	entry := LogEntry{
		Level:    level,
		Message:  message,
		Method:   method,
		Path:     path,
		IP:       ip,
		UserID:   userID,
		Status:   status,
		Duration: fmt.Sprintf("%dms", duration.Milliseconds()),
	}
	ml.addEntry(entry)
}

// Query retourne les logs filtrés
func (ml *MemoryLogger) Query(level, search string, limit int) []LogEntry {
	ml.mu.RLock()
	defer ml.mu.RUnlock()

	if limit <= 0 || limit > maxLogEntries {
		limit = 200
	}

	// Parcourir en ordre inverse (plus récents d'abord)
	result := make([]LogEntry, 0, limit)
	for i := len(ml.entries) - 1; i >= 0 && len(result) < limit; i-- {
		e := ml.entries[i]

		// Filtre par level
		if level != "" && level != "ALL" && string(e.Level) != level {
			continue
		}

		// Filtre par recherche textuelle
		if search != "" {
			searchLower := strings.ToLower(search)
			if !strings.Contains(strings.ToLower(e.Message), searchLower) &&
				!strings.Contains(strings.ToLower(e.Path), searchLower) &&
				!strings.Contains(strings.ToLower(e.IP), searchLower) {
				continue
			}
		}

		result = append(result, e)
	}
	return result
}

// Stats retourne des statistiques sur les logs
func (ml *MemoryLogger) Stats() map[string]int {
	ml.mu.RLock()
	defer ml.mu.RUnlock()

	counts := map[string]int{
		"total":    len(ml.entries),
		"DEBUG":    0,
		"INFO":     0,
		"WARN":     0,
		"ERROR":    0,
		"SECURITY": 0,
	}
	for _, e := range ml.entries {
		counts[string(e.Level)]++
	}
	return counts
}

// ===== MIDDLEWARE DE LOGGING DES REQUÊTES =====

// responseRecorder capture le status code de la réponse
type responseRecorder struct {
	http.ResponseWriter
	statusCode int
}

func newResponseRecorder(w http.ResponseWriter) *responseRecorder {
	return &responseRecorder{w, http.StatusOK}
}

func (rr *responseRecorder) WriteHeader(code int) {
	rr.statusCode = code
	rr.ResponseWriter.WriteHeader(code)
}

// requestLoggingMiddleware logue chaque requête HTTP avec méthode, path, IP, status et durée
func requestLoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ip := getClientIP(r)

		// Récupérer le userID du contexte si disponible (après authMiddleware)
		rr := newResponseRecorder(w)
		next.ServeHTTP(rr, r)

		duration := time.Since(start)
		status := rr.statusCode
		userID, _ := r.Context().Value(UserIDKey).(int)

		// Déterminer le niveau selon le status
		level := LogLevelINFO
		msg := fmt.Sprintf("%s %s → %d", r.Method, r.URL.Path, status)

		switch {
		case status >= 500:
			level = LogLevelERROR
		case status == 429:
			level = LogLevelSECURITY
			msg = fmt.Sprintf("RATE LIMIT: %s %s from %s", r.Method, r.URL.Path, ip)
		case status == 401 || status == 403:
			level = LogLevelWARN
		case strings.HasPrefix(r.URL.Path, "/api/login") && status == 200:
			level = LogLevelSECURITY
			msg = fmt.Sprintf("LOGIN SUCCESS from %s", ip)
		case strings.HasPrefix(r.URL.Path, "/api/login") && status >= 400:
			level = LogLevelSECURITY
			msg = fmt.Sprintf("LOGIN FAILED %s %s → %d from %s", r.Method, r.URL.Path, status, ip)
		}

		appLogger.LogRequest(level, r.Method, r.URL.Path, ip, userID, status, duration, msg)
	})
}

// ===== FONCTIONS HELPERS D'ACCÈS RAPIDE =====

func logInfo(msg string) {
	appLogger.Log(LogLevelINFO, msg)
}

func logWarn(msg string) {
	appLogger.Log(LogLevelWARN, msg)
}

func logError(msg string) {
	appLogger.Log(LogLevelERROR, msg)
}

func logSecurity(msg string) {
	appLogger.Log(LogLevelSECURITY, msg)
}

// ===== HANDLER API LOGS =====

// getLogs retourne les logs filtrés (admin only)
// GET /api/logs?level=ERROR&search=login&limit=100
func getLogs(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(UserRoleKey).(string)
	if userRole != "admin" {
		jsonError(w, "Forbidden", http.StatusForbidden)
		return
	}

	q := r.URL.Query()
	level := strings.ToUpper(q.Get("level"))
	search := q.Get("search")
	limit := 200
	if l := q.Get("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}

	entries := appLogger.Query(level, search, limit)
	if entries == nil {
		entries = []LogEntry{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

// getLogStats retourne les statistiques des logs (admin only)
// GET /api/logs/stats
func getLogStats(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(UserRoleKey).(string)
	if userRole != "admin" {
		jsonError(w, "Forbidden", http.StatusForbidden)
		return
	}

	stats := appLogger.Stats()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// clearLogs vide le buffer de logs (admin only)
// DELETE /api/logs
func clearLogs(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(UserRoleKey).(string)
	if userRole != "admin" {
		jsonError(w, "Forbidden", http.StatusForbidden)
		return
	}

	appLogger.mu.Lock()
	appLogger.entries = make([]LogEntry, 0, maxLogEntries)
	appLogger.mu.Unlock()

	logInfo("Log buffer cleared by admin")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Logs cleared"})
}
