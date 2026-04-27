package logger

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"api/config"
	"api/models"
)

type LogLevel string

const (
	LogLevelDEBUG    LogLevel = "DEBUG"
	LogLevelINFO     LogLevel = "INFO"
	LogLevelWARN     LogLevel = "WARN"
	LogLevelERROR    LogLevel = "ERROR"
	LogLevelSECURITY LogLevel = "SECURITY"

	maxLogEntries = 500
	dbLogChanSize = 4096

	// Chemin par défaut du fichier de log (surchargeable via LOG_FILE_PATH)
	defaultLogFilePath = "/var/log/api/api.log"
)

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
	DurationMs int      `json:"-"`
}

type MemoryLogger struct {
	mu      sync.RWMutex
	entries []LogEntry
	counter int64
}

// ── File writer (JSONL) ──────────────────────────────────────────────────

var (
	fileMu      sync.Mutex
	logFile     *os.File
	logFilePath string
)

// InitLogFile ouvre (ou crée) le fichier de log en mode append.
// Le chemin est lu depuis LOG_FILE_PATH, avec fallback sur defaultLogFilePath.
func InitLogFile() {
	path := os.Getenv("LOG_FILE_PATH")
	if path == "" {
		path = defaultLogFilePath
	}
	logFilePath = path

	// Créer le répertoire parent si nécessaire
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		log.Printf("[WARN] InitLogFile: cannot create directory %s: %v", dir, err)
		return
	}

	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Printf("[WARN] InitLogFile: cannot open %s: %v", path, err)
		return
	}
	logFile = f
	log.Printf("[INFO] InitLogFile: logging to %s", path)
}

// writeToFile écrit une entrée au format JSONL (une ligne = un objet JSON).
func writeToFile(entry LogEntry) {
	fileMu.Lock()
	defer fileMu.Unlock()

	if logFile == nil {
		return
	}

	line, err := json.Marshal(entry)
	if err != nil {
		log.Printf("[WARN] writeToFile: json.Marshal: %v", err)
		return
	}

	if _, err := logFile.Write(append(line, '\n')); err != nil {
		log.Printf("[WARN] writeToFile: write error: %v", err)
	}
}

// FlushLogFile vide et ferme le fichier de log proprement.
func FlushLogFile() {
	fileMu.Lock()
	defer fileMu.Unlock()
	if logFile != nil {
		logFile.Sync()
		logFile.Close()
		logFile = nil
	}
}

// ── dbLogChan est le channel async vers la goroutine d'écriture DB ───────

var dbLogChan = make(chan LogEntry, dbLogChanSize)

var AppLogger = &MemoryLogger{
	entries: make([]LogEntry, 0, maxLogEntries),
}

// addEntry ajoute une entrée dans le buffer circulaire RAM,
// l'envoie au writer DB et l'écrit dans le fichier de log.
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

	// Envoi asynchrone vers la DB (ne bloque pas)
	select {
	case dbLogChan <- entry:
	default:
	}

	// Écriture synchrone dans le fichier (garantit la persistance disque)
	writeToFile(entry)
}

func (ml *MemoryLogger) Log(level LogLevel, message string) {
	ml.addEntry(LogEntry{Level: level, Message: message})
	log.Printf("[%s] %s", level, message)
}

func (ml *MemoryLogger) LogRequest(level LogLevel, method, path, ip string, userID, status int, duration time.Duration, message string) {
	ml.addEntry(LogEntry{
		Level:      level,
		Message:    message,
		Method:     method,
		Path:       path,
		IP:         ip,
		UserID:     userID,
		Status:     status,
		Duration:   fmt.Sprintf("%dms", duration.Milliseconds()),
		DurationMs: int(duration.Milliseconds()),
	})
}

func (ml *MemoryLogger) RamQuery(level, search string, limit int) []LogEntry {
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

func (ml *MemoryLogger) RamStats() map[string]int {
	ml.mu.RLock()
	defer ml.mu.RUnlock()
	counts := map[string]int{"total": len(ml.entries), "DEBUG": 0, "INFO": 0, "WARN": 0, "ERROR": 0, "SECURITY": 0}
	for _, e := range ml.entries {
		counts[string(e.Level)]++
	}
	return counts
}

func (ml *MemoryLogger) FlushRAM() {
	ml.mu.Lock()
	defer ml.mu.Unlock()
	ml.entries = make([]LogEntry, 0, maxLogEntries)
}

// ===== GOROUTINE WRITER DB =====

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

func insertLogBatch(entries []LogEntry) error {
	if config.DB == nil || len(entries) == 0 {
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
	_, err := config.DB.Exec(query, args...)
	return err
}

func InitLogDB() {
	// Initialiser le fichier de log AVANT la DB
	InitLogFile()

	if config.DB == nil {
		log.Println("[WARN] InitLogDB: DB not available — logs écrits uniquement dans le fichier")
		return
	}
	_, err := config.DB.Exec(`
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
		log.Printf("[WARN] InitLogDB: CREATE TABLE: %v", err)
		return
	}
	for _, idx := range []string{
		`CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp ON api_logs (timestamp DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_api_logs_level     ON api_logs (level)`,
		`CREATE INDEX IF NOT EXISTS idx_api_logs_status    ON api_logs (status)`,
		`CREATE INDEX IF NOT EXISTS idx_api_logs_user_id   ON api_logs (user_id) WHERE user_id IS NOT NULL`,
	} {
		config.DB.Exec(idx)
	}
	if res, err := config.DB.Exec(`DELETE FROM api_logs WHERE timestamp < NOW() - INTERVAL '90 days'`); err == nil {
		if n, _ := res.RowsAffected(); n > 0 {
			log.Printf("[INFO] InitLogDB: purged %d old entries (>90 days)", n)
		}
	}
	log.Println("[INFO] InitLogDB: api_logs table ready, starting DB writer goroutine")
	go dbLogWriter()
}

// ===== HELPERS RAPIDES =====

func Info(msg string)     { AppLogger.Log(LogLevelINFO, msg) }
func Warn(msg string)     { AppLogger.Log(LogLevelWARN, msg) }
func Error(msg string)    { AppLogger.Log(LogLevelERROR, msg) }
func Security(msg string) { AppLogger.Log(LogLevelSECURITY, msg) }

// ===== REQUÊTES DB =====

func DBQueryLogs(level, search string, limit int) ([]LogEntry, error) {
	if config.DB == nil {
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
	rows, err := config.DB.Query(query, args...)
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

func DBLogStats() (map[string]int, error) {
	if config.DB == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	rows, err := config.DB.Query(`SELECT level, COUNT(*) FROM api_logs GROUP BY level`)
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

// ===== HANDLERS HTTP =====

func GetLogs(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(models.UserRoleKey).(string)
	if userRole != "admin" {
		http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
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
	entries, err := DBQueryLogs(level, search, limit)
	if err != nil {
		log.Printf("[WARN] GetLogs: DB query failed (%v), falling back to RAM", err)
		entries = AppLogger.RamQuery(level, search, limit)
	}
	if entries == nil {
		entries = []LogEntry{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func GetLogStats(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(models.UserRoleKey).(string)
	if userRole != "admin" {
		http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
		return
	}
	stats, err := DBLogStats()
	if err != nil {
		stats = AppLogger.RamStats()
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func ClearLogs(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(models.UserRoleKey).(string)
	if userRole != "admin" {
		http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
		return
	}
	dbErr := ""
	if config.DB != nil {
		if _, err := config.DB.Exec("DELETE FROM api_logs"); err != nil {
			dbErr = err.Error()
			log.Printf("[WARN] ClearLogs: DB DELETE failed: %v", err)
		}
	}
	AppLogger.FlushRAM()

	// Ne PAS vider le fichier (historique préservé)
	Info("Logs purgés par un administrateur (DB + RAM) — fichier préservé")

	resp := map[string]string{"message": "Logs cleared"}
	if dbErr != "" {
		resp["warning"] = "DB delete failed: " + dbErr
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func getUserIDFromCtx(r *http.Request) int {
	id, _ := r.Context().Value(models.UserIDKey).(int)
	return id
}

func GetUserIDStr(r *http.Request) string {
	return strconv.Itoa(getUserIDFromCtx(r))
}
