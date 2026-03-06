package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ===== SYSTÈME DE LOGS HYBRIDE (RAM + PostgreSQL) =====
//
// Architecture :
//   requestLoggingMiddleware
//       │
//       ├──► addEntry()  → buffer RAM circulaire (500 entrées, temps réel)
//       │
//       └──► dbLogChan  → goroutine dbLogWriter → INSERT batch (async, non-bloquant)
//
// Lecture (getLogs) : PostgreSQL (historique complet + filtres SQL)
// Fallback          : buffer RAM si DB indisponible

// LogLevel représente le niveau de sévérité d'un log
type LogLevel string

const (
	LogLevelDEBUG    LogLevel = "DEBUG"
	LogLevelINFO     LogLevel = "INFO"
	LogLevelWARN     LogLevel = "WARN"
	LogLevelERROR    LogLevel = "ERROR"
	LogLevelSECURITY LogLevel = "SECURITY"

	// Taille du buffer RAM (temps réel, les 500 dernières entrées)
	maxLogEntries = 500
	// Taille du channel async vers DB (absorbe les pics de trafic)
	dbLogChanSize = 4096
)

// LogEntry représente une entrée de log
type LogEntry struct {
	ID         int64    `json:"id"`
	Timestamp  string   `json:"timestamp"`
	Level      LogLevel `json:"level"`
	Message    string   `json:"message"`
	Method     string   `json:"method,omitempty"`
	Path       string   `json:"path,omitempty"`
	IP         string   `json:"ip,omitempty"`
	UserID     int      `json:"user_id,omitempty"`
	Status     int      `json:"status,omitempty"`
	Duration   string   `json:"duration,omitempty"`
	DurationMs int      `json:"-"` // utilisé pour INSERT DB uniquement
}

// MemoryLogger est un logger circulaire thread-safe en mémoire (temps réel)
type MemoryLogger struct {
	mu      sync.RWMutex
	entries []LogEntry
	counter int64
}

// dbLogChan est le channel async vers la goroutine d'écriture DB
var dbLogChan = make(chan LogEntry, dbLogChanSize)

var appLogger = &MemoryLogger{
	entries: make([]LogEntry, 0, maxLogEntries),
}

// addEntry ajoute une entrée dans le buffer circulaire RAM et l'envoie au writer DB
func (ml *MemoryLogger) addEntry(entry LogEntry) {
	ml.mu.Lock()
	defer ml.mu.Unlock()

	ml.counter++
	entry.ID = ml.counter
	entry.Timestamp = time.Now().UTC().Format(time.RFC3339)

	if len(ml.entries) >= maxLogEntries {
		ml.entries = ml.entries[1:]
	}
	ml.entries = append(ml.entries, entry)

	// Envoi async au writer DB — non-bloquant (drop si channel saturé)
	select {
	case dbLogChan <- entry:
	default:
		// Channel plein : on ne bloque pas la requête HTTP
	}
}

// Log enregistre un message système (non-HTTP)
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
		Level:      level,
		Message:    message,
		Method:     method,
		Path:       path,
		IP:         ip,
		UserID:     userID,
		Status:     status,
		Duration:   fmt.Sprintf("%dms", duration.Milliseconds()),
		DurationMs: int(duration.Milliseconds()),
	}
	ml.addEntry(entry)
}

// ramQuery filtre le buffer RAM (fallback si DB indisponible)
func (ml *MemoryLogger) ramQuery(level, search string, limit int) []LogEntry {
	ml.mu.RLock()
	defer ml.mu.RUnlock()

	result := make([]LogEntry, 0, limit)
	for i := len(ml.entries) - 1; i >= 0 && len(result) < limit; i-- {
		e := ml.entries[i]
		if level != "" && level != "ALL" && string(e.Level) != level {
			continue
		}
		if search != "" {
			s := strings.ToLower(search)
			if !strings.Contains(strings.ToLower(e.Message), s) &&
				!strings.Contains(strings.ToLower(e.Path), s) &&
				!strings.Contains(strings.ToLower(e.IP), s) {
				continue
			}
		}
		result = append(result, e)
	}
	return result
}

func (ml *MemoryLogger) ramStats() map[string]int {
	ml.mu.RLock()
	defer ml.mu.RUnlock()
	counts := map[string]int{"total": len(ml.entries), "DEBUG": 0, "INFO": 0, "WARN": 0, "ERROR": 0, "SECURITY": 0}
	for _, e := range ml.entries {
		counts[string(e.Level)]++
	}
	return counts
}

// ===== GOROUTINE WRITER DB (INSERT batch async) =====

// dbLogWriter consomme le channel et insère en batch toutes les 2s ou par 50 entrées
func dbLogWriter() {
	const batchSize = 50
	const flushInterval = 2 * time.Second

	batch := make([]LogEntry, 0, batchSize)
	ticker := time.NewTicker(flushInterval)
	defer ticker.Stop()

	flush := func() {
		if len(batch) == 0 {
			return
		}
		if err := insertLogBatch(batch); err != nil {
			log.Printf("[WARN] dbLogWriter: INSERT batch failed: %v", err)
		}
		batch = batch[:0]
	}

	for {
		select {
		case entry := <-dbLogChan:
			batch = append(batch, entry)
			if len(batch) >= batchSize {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
}

// insertLogBatch insère un batch en une seule requête multi-VALUES
func insertLogBatch(entries []LogEntry) error {
	if db == nil || len(entries) == 0 {
		return nil
	}
	args := make([]interface{}, 0, len(entries)*9)
	placeholders := make([]string, 0, len(entries))
	for i, e := range entries {
		base := i * 9
		placeholders = append(placeholders, fmt.Sprintf(
			"($%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d)",
			base+1, base+2, base+3, base+4, base+5, base+6, base+7, base+8, base+9,
		))
		ts := e.Timestamp
		if ts == "" {
			ts = time.Now().UTC().Format(time.RFC3339)
		}
		var userID interface{} = nil
		if e.UserID != 0 {
			userID = e.UserID
		}
		args = append(args, ts, string(e.Level), e.Message, e.Method, e.Path,
			e.IP, userID, e.Status, e.DurationMs)
	}
	query := "INSERT INTO api_logs (timestamp,level,message,method,path,ip,user_id,status,duration_ms) VALUES " +
		strings.Join(placeholders, ",")
	_, err := db.Exec(query, args...)
	return err
}

// initLogDB crée la table, les index et démarre la goroutine writer
func initLogDB() {
	if db == nil {
		return
	}
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS api_logs (
			id          BIGSERIAL   PRIMARY KEY,
			timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			level       VARCHAR(16) NOT NULL DEFAULT 'INFO',
			message     TEXT        NOT NULL DEFAULT '',
			method      VARCHAR(10) NOT NULL DEFAULT '',
			path        TEXT        NOT NULL DEFAULT '',
			ip          VARCHAR(64) NOT NULL DEFAULT '',
			user_id     INT         NULL,
			status      INT         NOT NULL DEFAULT 0,
			duration_ms INT         NOT NULL DEFAULT 0
		)`)
	if err != nil {
		log.Printf("[WARN] initLogDB: CREATE TABLE: %v", err)
		return
	}
	for _, idx := range []string{
		`CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp ON api_logs (timestamp DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_api_logs_level     ON api_logs (level)`,
		`CREATE INDEX IF NOT EXISTS idx_api_logs_status    ON api_logs (status)`,
		`CREATE INDEX IF NOT EXISTS idx_api_logs_user_id   ON api_logs (user_id) WHERE user_id IS NOT NULL`,
	} {
		db.Exec(idx)
	}
	// Purge automatique des logs > 90 jours
	if res, err := db.Exec(`DELETE FROM api_logs WHERE timestamp < NOW() - INTERVAL '90 days'`); err == nil {
		if n, _ := res.RowsAffected(); n > 0 {
			log.Printf("[INFO] initLogDB: purged %d old entries (>90 days)", n)
		}
	}
	log.Println("[INFO] initLogDB: api_logs table ready, starting DB writer goroutine")
	go dbLogWriter()
}

// dbQueryLogs interroge PostgreSQL avec filtres indexés
func dbQueryLogs(level, search string, limit int) ([]LogEntry, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	args := []interface{}{}
	conditions := []string{}
	idx := 1
	if level != "" && level != "ALL" {
		conditions = append(conditions, fmt.Sprintf("level = $%d", idx))
		args = append(args, level)
		idx++
	}
	if search != "" {
		conditions = append(conditions, fmt.Sprintf(
			"(path ILIKE $%d OR message ILIKE $%d OR ip ILIKE $%d)", idx, idx+1, idx+2))
		like := "%" + search + "%"
		args = append(args, like, like, like)
		idx += 3
	}
	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}
	args = append(args, limit)
	query := fmt.Sprintf(`
		SELECT id, timestamp, level, message, method, path, ip,
		       COALESCE(user_id, 0), status, duration_ms
		FROM api_logs %s
		ORDER BY timestamp DESC
		LIMIT $%d`, where, idx)
	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	entries := make([]LogEntry, 0, limit)
	for rows.Next() {
		var e LogEntry
		var durationMs int
		var ts time.Time
		if err := rows.Scan(&e.ID, &ts, &e.Level, &e.Message, &e.Method, &e.Path,
			&e.IP, &e.UserID, &e.Status, &durationMs); err != nil {
			continue
		}
		e.Timestamp = ts.UTC().Format(time.RFC3339)
		e.Duration = fmt.Sprintf("%dms", durationMs)
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

func dbLogStats() (map[string]int, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	rows, err := db.Query(`SELECT level, COUNT(*) FROM api_logs GROUP BY level`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	stats := map[string]int{"total": 0, "DEBUG": 0, "INFO": 0, "WARN": 0, "ERROR": 0, "SECURITY": 0}
	for rows.Next() {
		var lvl string
		var cnt int
		if err := rows.Scan(&lvl, &cnt); err != nil {
			continue
		}
		stats[lvl] = cnt
		stats["total"] += cnt
	}
	return stats, rows.Err()
}

// ===== MIDDLEWARE ET HELPERS =====

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

// routeDescription retourne une description métier lisible pour une paire méthode+route
func routeDescription(method, path string) string {
	switch {
	case method == "POST" && strings.HasPrefix(path, "/api/login"):
		return "Tentative de connexion"
	case strings.Contains(path, "/logout"):
		return "Déconnexion"
	case strings.Contains(path, "/user/profile"):
		return "Consultation du profil"
	case method == "PUT" && strings.Contains(path, "/user/"):
		return "Mise à jour du profil"
	case strings.Contains(path, "/users/exists"):
		return "Vérification existence email"
	case method == "POST" && path == "/api/users":
		return "Création de compte"
	case method == "GET" && strings.Contains(path, "/produit"):
		return "Consultation produits"
	case method == "POST" && strings.Contains(path, "/produit"):
		return "Création d'un produit"
	case method == "PUT" && strings.Contains(path, "/produit"):
		return "Modification d'un produit"
	case method == "DELETE" && strings.Contains(path, "/produit"):
		return "Suppression d'un produit"
	case method == "GET" && strings.Contains(path, "/categorie"):
		return "Consultation catégories"
	case method == "POST" && strings.Contains(path, "/categorie"):
		return "Création d'une catégorie"
	case method == "PUT" && strings.Contains(path, "/categorie"):
		return "Modification d'une catégorie"
	case method == "DELETE" && strings.Contains(path, "/categorie"):
		return "Suppression d'une catégorie"
	case strings.Contains(path, "/logs/stats"):
		return "Stats des logs (admin)"
	case method == "GET" && strings.HasSuffix(path, "/logs"):
		return "Consultation des logs (admin)"
	case method == "DELETE" && strings.HasSuffix(path, "/logs"):
		return "Purge des logs (admin)"
	case strings.Contains(path, "/cache/stats"):
		return "Stats du cache (admin)"
	case strings.Contains(path, "/cache/flush"):
		return "Purge du cache (admin)"
	case strings.Contains(path, "/billing") || strings.Contains(path, "/subscription"):
		return "Opération facturation"
	case strings.Contains(path, "/api-keys") || strings.Contains(path, "/apikeys"):
		return "Gestion clés API"
	case strings.Contains(path, "/support") || strings.Contains(path, "/ticket"):
		return "Support / tickets"
	case strings.Contains(path, "/images") || strings.Contains(path, "/carousel"):
		return "Gestion des images"
	case strings.Contains(path, "/entreprise"):
		return "Gestion entreprises"
	case strings.Contains(path, "/tarification"):
		return "Gestion tarifications"
	default:
		return ""
	}
}

// requestLoggingMiddleware logue chaque requête HTTP avec méthode, path, IP, status et durée
func requestLoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ip := getClientIP(r)

		// Exécuter le handler (authMiddleware enrichit le contexte et pose X-Auth-User-ID)
		rr := newResponseRecorder(w)
		next.ServeHTTP(rr, r)

		duration := time.Since(start)
		status := rr.statusCode
		// Lire le userID depuis le header interne posé par authMiddleware
		userID := 0
		if uid := rr.Header().Get("X-Auth-User-ID"); uid != "" {
			if n, err := strconv.Atoi(uid); err == nil {
				userID = n
			}
		}
		// Supprimer le header interne pour qu'il ne parte pas vers le client
		rr.Header().Del("X-Auth-User-ID")

		// Déterminer le niveau et un message lisible selon le status et la route
		level := LogLevelINFO
		path := r.URL.Path
		method := r.Method
		msg := routeDescription(method, path) // description métier par défaut

		switch {
		case status >= 500:
			level = LogLevelERROR
			msg = fmt.Sprintf("Erreur serveur (%d) — %s", status, routeDescription(method, path))
		case status == 429:
			level = LogLevelSECURITY
			msg = fmt.Sprintf("Rate limit dépassé depuis %s", ip)
		case status == 403:
			level = LogLevelWARN
			msg = fmt.Sprintf("Accès refusé — %s", routeDescription(method, path))
		case status == 401:
			level = LogLevelWARN
			msg = fmt.Sprintf("Non authentifié — %s", routeDescription(method, path))
		case status == 404:
			msg = fmt.Sprintf("Ressource introuvable : %s", path)
		case strings.HasPrefix(path, "/api/login") && status == 200:
			level = LogLevelSECURITY
			msg = fmt.Sprintf("Connexion réussie depuis %s", ip)
		case strings.HasPrefix(path, "/api/login") && status >= 400:
			level = LogLevelSECURITY
			msg = fmt.Sprintf("Échec de connexion depuis %s", ip)
		}

		appLogger.LogRequest(level, r.Method, r.URL.Path, ip, userID, status, duration, msg)
	})
}

// ===== FONCTIONS HELPERS D'ACCÈS RAPIDE =====

func logInfo(msg string)     { appLogger.Log(LogLevelINFO, msg) }
func logWarn(msg string)     { appLogger.Log(LogLevelWARN, msg) }
func logError(msg string)    { appLogger.Log(LogLevelERROR, msg) }
func logSecurity(msg string) { appLogger.Log(LogLevelSECURITY, msg) }

// ===== HANDLERS API LOGS =====

// getLogs : lit depuis PostgreSQL (historique complet), fallback buffer RAM
// GET /api/logs?level=ERROR&search=login&limit=200
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
	if limit <= 0 || limit > 5000 {
		limit = 200
	}
	entries, err := dbQueryLogs(level, search, limit)
	if err != nil {
		log.Printf("[WARN] getLogs: DB query failed (%v), falling back to RAM", err)
		entries = appLogger.ramQuery(level, search, limit)
	}
	if entries == nil {
		entries = []LogEntry{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

// getLogStats : compte par niveau depuis PostgreSQL, fallback RAM
// GET /api/logs/stats
func getLogStats(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(UserRoleKey).(string)
	if userRole != "admin" {
		jsonError(w, "Forbidden", http.StatusForbidden)
		return
	}
	stats, err := dbLogStats()
	if err != nil {
		stats = appLogger.ramStats()
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// clearLogs : DELETE FROM api_logs + vide le buffer RAM
// DELETE /api/logs
func clearLogs(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(UserRoleKey).(string)
	if userRole != "admin" {
		jsonError(w, "Forbidden", http.StatusForbidden)
		return
	}
	dbErr := ""
	if db != nil {
		if _, err := db.Exec("DELETE FROM api_logs"); err != nil {
			dbErr = err.Error()
			log.Printf("[WARN] clearLogs: DB DELETE failed: %v", err)
		}
	}
	appLogger.mu.Lock()
	appLogger.entries = make([]LogEntry, 0, maxLogEntries)
	appLogger.mu.Unlock()

	logInfo("Logs purgés par un administrateur")
	resp := map[string]string{"message": "Logs cleared"}
	if dbErr != "" {
		resp["warning"] = "DB delete failed: " + dbErr
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
