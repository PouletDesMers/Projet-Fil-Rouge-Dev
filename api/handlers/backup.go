package handlers

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"api/config"
	"api/logger"
	"api/models"
)

// ============================================================
// BACKUP POSTGRESQL avec RESTIC
// ============================================================

const resticRepo = "/backups/restic-repo"

// ===== ENV HELPERS =====

func resticPassword() (string, error) {
	p := os.Getenv("RESTIC_PASSWORD")
	if p == "" {
		return "", fmt.Errorf("RESTIC_PASSWORD is required")
	}
	return p, nil
}

func resticEnv() ([]string, error) {
	env := os.Environ()
	repo := resticRepo
	if r := os.Getenv("RESTIC_REPOSITORY"); r != "" {
		repo = r
	}
	pass, err := resticPassword()
	if err != nil {
		return nil, err
	}
	filtered := make([]string, 0, len(env)+2)
	for _, e := range env {
		if !strings.HasPrefix(e, "RESTIC_REPOSITORY=") && !strings.HasPrefix(e, "RESTIC_PASSWORD=") {
			filtered = append(filtered, e)
		}
	}
	filtered = append(filtered,
		"RESTIC_REPOSITORY="+repo,
		"RESTIC_PASSWORD="+pass,
	)
	return filtered, nil
}

func runRestic(args ...string) (string, error) {
	cmd := exec.Command("restic", args...)
	env, err := resticEnv()
	if err != nil {
		return "", err
	}
	cmd.Env = env
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	err = cmd.Run()
	return out.String(), err
}

// ===== INIT REPO =====

func initResticRepo() error {
	os.MkdirAll(resticRepo, 0700)
	out, err := runRestic("snapshots", "--json")
	if err == nil || strings.Contains(out, "[]") {
		return nil
	}
	_, err = runRestic("init")
	if err != nil {
		return fmt.Errorf("restic init: %w", err)
	}
	log.Println("[INFO] Restic repository initialisé:", resticRepo)
	return nil
}

// ===== TYPES =====

type ResticSnapshot struct {
	ID       string    `json:"id"`
	ShortID  string    `json:"short_id"`
	Time     time.Time `json:"time"`
	Hostname string    `json:"hostname"`
	Tags     []string  `json:"tags"`
	Paths    []string  `json:"paths"`
}

type ResticStats struct {
	TotalSize      int64 `json:"total_size"`
	TotalFileCount int64 `json:"total_file_count"`
	SnapshotsCount int   `json:"snapshots_count"`
}

// ===== SNAPSHOT (BACKUP) =====

func pgDumpArgs(host, port, user, dbname, backupType string) []string {
	base := []string{
		"-h", host, "-p", port, "-U", user, "-d", dbname,
		"--no-password", "--format=plain",
		"--data-only", "--inserts",
		"--no-owner", "--no-acl",
	}
	switch backupType {
	case "logs":
		return append(base, "--table=public.api_logs")
	case "data":
		return append(base, "--exclude-table=public.api_logs")
	default: // "full"
		return base
	}
}

func runResticBackup(tags ...string) (string, error) {
	host, port, user, password, dbname := config.DBEnv()

	backupType := "full"
	for _, t := range tags {
		if t == "data" || t == "logs" || t == "full" {
			backupType = t
			break
		}
	}

	dumpArgs := pgDumpArgs(host, port, user, dbname, backupType)
	dumpCmd := exec.Command("pg_dump", dumpArgs...)
	dumpCmd.Env = append(os.Environ(), "PGPASSWORD="+password)

	filename := backupType + "_" + dbname + ".sql"

	resticArgs := []string{
		"backup", "--stdin",
		"--stdin-filename", filename,
		"--host", "cyna-api",
		"--tag", "postgresql",
		"--tag", backupType,
	}
	for _, t := range tags {
		if t != backupType {
			resticArgs = append(resticArgs, "--tag", t)
		}
	}
	resticArgs = append(resticArgs, "--json")

	resticCmd := exec.Command("restic", resticArgs...)
	resticEnvVars, err := resticEnv()
	if err != nil {
		return "", err
	}
	resticCmd.Env = resticEnvVars

	pipe, err := dumpCmd.StdoutPipe()
	if err != nil {
		return "", fmt.Errorf("pg_dump pipe: %w", err)
	}
	resticCmd.Stdin = pipe

	var resticOut, dumpErr, resticErr bytes.Buffer
	dumpCmd.Stderr = &dumpErr
	resticCmd.Stdout = &resticOut
	resticCmd.Stderr = &resticErr

	if err := dumpCmd.Start(); err != nil {
		return "", fmt.Errorf("pg_dump start: %w", err)
	}
	if err := resticCmd.Start(); err != nil {
		dumpCmd.Process.Kill()
		return "", fmt.Errorf("restic start: %w", err)
	}

	dumpWaitErr := dumpCmd.Wait()
	resticWaitErr := resticCmd.Wait()

	if dumpWaitErr != nil {
		return "", fmt.Errorf("pg_dump: %v — %s", dumpWaitErr, dumpErr.String())
	}
	if resticWaitErr != nil {
		return "", fmt.Errorf("restic backup: %v — %s", resticWaitErr, resticErr.String())
	}

	snapshotID := ""
	scanner := bufio.NewScanner(strings.NewReader(resticOut.String()))
	for scanner.Scan() {
		line := scanner.Text()
		var msg map[string]interface{}
		if json.Unmarshal([]byte(line), &msg) == nil {
			if msg["message_type"] == "summary" {
				if id, ok := msg["snapshot_id"].(string); ok {
					snapshotID = id
				}
			}
		}
	}
	if snapshotID == "" {
		snapshotID = "unknown"
	}
	return snapshotID, nil
}

func listResticSnapshots() ([]ResticSnapshot, error) {
	out, err := runRestic("snapshots", "--json")
	if err != nil {
		return nil, fmt.Errorf("restic snapshots: %w — %s", err, out)
	}
	var snapshots []ResticSnapshot
	if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &snapshots); err != nil {
		return []ResticSnapshot{}, nil
	}
	for i, j := 0, len(snapshots)-1; i < j; i, j = i+1, j-1 {
		snapshots[i], snapshots[j] = snapshots[j], snapshots[i]
	}
	return snapshots, nil
}

func getResticStats() (map[string]interface{}, error) {
	out, err := runRestic("stats", "--json")
	if err != nil {
		return nil, fmt.Errorf("restic stats: %w — %s", err, out)
	}
	var stats map[string]interface{}
	json.Unmarshal([]byte(out), &stats)
	snaps, _ := listResticSnapshots()
	if stats == nil {
		stats = map[string]interface{}{}
	}
	stats["snapshots_count"] = len(snaps)
	return stats, nil
}

// ===== PLANIFICATEUR =====

type backupScheduler struct {
	mu       sync.Mutex
	interval int
	lastRun  time.Time
	nextRun  time.Time
	lastSnap string
}

type scheduleRule struct {
	ID            string    `json:"id"`
	Type          string    `json:"type"`
	IntervalHours int       `json:"interval_hours"`
	Enabled       bool      `json:"enabled"`
	LastRun       time.Time `json:"-"`
	LastSnap      string    `json:"last_snapshot"`
	NextRun       time.Time `json:"-"`
	stop          chan struct{}
	ticker        *time.Ticker
}

func (r *scheduleRule) LastRunStr() interface{} {
	if r.LastRun.IsZero() {
		return nil
	}
	return r.LastRun.UTC().Format(time.RFC3339)
}
func (r *scheduleRule) NextRunStr() interface{} {
	if r.NextRun.IsZero() || !r.Enabled {
		return nil
	}
	return r.NextRun.UTC().Format(time.RFC3339)
}

type multiScheduler struct {
	mu    sync.Mutex
	rules []*scheduleRule
}

var mScheduler = &multiScheduler{}
var bScheduler = &backupScheduler{}

func InitBackupScheduler() {
	os.MkdirAll("/backups", 0700)
	if err := initResticRepo(); err != nil {
		log.Printf("[WARN] Restic init: %v", err)
	}
	if h := os.Getenv("BACKUP_INTERVAL_HOURS"); h != "" {
		var hours int
		fmt.Sscanf(h, "%d", &hours)
		if hours > 0 {
			mScheduler.addRule("full", hours)
		}
	}
	log.Printf("[INFO] Backup multi-scheduler prêt (restic repo: %s)", resticRepo)
}

func (ms *multiScheduler) addRule(backupType string, intervalHours int) string {
	ms.mu.Lock()
	defer ms.mu.Unlock()
	id := fmt.Sprintf("%s-%d-%d", backupType, intervalHours, time.Now().UnixNano()%100000)
	rule := &scheduleRule{
		ID: id, Type: backupType,
		IntervalHours: intervalHours, Enabled: true,
	}
	ms.rules = append(ms.rules, rule)
	ms.startRule(rule)
	return id
}

func (ms *multiScheduler) startRule(rule *scheduleRule) {
	if rule.stop != nil {
		close(rule.stop)
		rule.ticker.Stop()
	}
	rule.ticker = time.NewTicker(time.Duration(rule.IntervalHours) * time.Hour)
	rule.stop = make(chan struct{})
	rule.NextRun = time.Now().Add(time.Duration(rule.IntervalHours) * time.Hour)
	go func(r *scheduleRule) {
		for {
			select {
			case <-r.ticker.C:
				log.Printf("[INFO] Backup auto (règle %s, type %s)", r.ID, r.Type)
				id, err := runResticBackup("auto", r.Type)
				if err != nil {
					log.Printf("[ERROR] Backup auto règle %s: %v", r.ID, err)
				} else {
					log.Printf("[INFO] Backup auto OK snapshot %s (règle %s)", id, r.ID)
					runRestic("forget", "--keep-last", "10", "--prune", "--tag", "auto")
					ms.mu.Lock()
					r.LastRun = time.Now()
					r.LastSnap = id
					r.NextRun = time.Now().Add(time.Duration(r.IntervalHours) * time.Hour)
					ms.mu.Unlock()
					logger.Security(fmt.Sprintf("Backup auto OK — snapshot %s (type: %s)", id[:backupMin(8, len(id))], r.Type))
					bScheduler.mu.Lock()
					bScheduler.lastRun = time.Now()
					bScheduler.lastSnap = id
					bScheduler.mu.Unlock()
				}
			case <-r.stop:
				return
			}
		}
	}(rule)
}

func (ms *multiScheduler) deleteRule(id string) bool {
	ms.mu.Lock()
	defer ms.mu.Unlock()
	for i, r := range ms.rules {
		if r.ID == id {
			if r.stop != nil {
				close(r.stop)
				r.ticker.Stop()
			}
			ms.rules = append(ms.rules[:i], ms.rules[i+1:]...)
			return true
		}
	}
	return false
}

func (ms *multiScheduler) toggleRule(id string, enabled bool) bool {
	ms.mu.Lock()
	defer ms.mu.Unlock()
	for _, r := range ms.rules {
		if r.ID == id {
			if enabled && !r.Enabled {
				r.Enabled = true
				ms.startRule(r)
			} else if !enabled && r.Enabled {
				r.Enabled = false
				if r.stop != nil {
					close(r.stop)
					r.ticker.Stop()
					r.stop = nil
					r.ticker = nil
				}
				r.NextRun = time.Time{}
			}
			return true
		}
	}
	return false
}

func (ms *multiScheduler) toJSON() []map[string]interface{} {
	ms.mu.Lock()
	defer ms.mu.Unlock()
	out := make([]map[string]interface{}, 0, len(ms.rules))
	for _, r := range ms.rules {
		out = append(out, map[string]interface{}{
			"id":             r.ID,
			"type":           r.Type,
			"interval_hours": r.IntervalHours,
			"enabled":        r.Enabled,
			"last_run":       r.LastRunStr(),
			"next_run":       r.NextRunStr(),
			"last_snapshot":  r.LastSnap,
		})
	}
	return out
}

func startScheduler(intervalHours int) {
	mScheduler.mu.Lock()
	for i := len(mScheduler.rules) - 1; i >= 0; i-- {
		r := mScheduler.rules[i]
		if r.Type == "full" {
			if r.stop != nil {
				close(r.stop)
				r.ticker.Stop()
			}
			mScheduler.rules = append(mScheduler.rules[:i], mScheduler.rules[i+1:]...)
		}
	}
	mScheduler.mu.Unlock()
	mScheduler.addRule("full", intervalHours)
	bScheduler.mu.Lock()
	bScheduler.interval = intervalHours
	bScheduler.mu.Unlock()
}

func stopScheduler() {
	mScheduler.mu.Lock()
	defer mScheduler.mu.Unlock()
	for _, r := range mScheduler.rules {
		if r.stop != nil {
			close(r.stop)
			r.ticker.Stop()
		}
	}
	mScheduler.rules = nil
	bScheduler.mu.Lock()
	bScheduler.interval = 0
	bScheduler.nextRun = time.Time{}
	bScheduler.mu.Unlock()
}

// backupMin évite le conflit de nom avec le min() builtin de Go 1.21
func backupMin(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ===== HANDLERS HTTP =====

func TriggerBackup(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(models.UserRoleKey).(string)
	if userRole != "admin" {
		http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
		return
	}

	var body struct {
		Type string `json:"type"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	backupType := body.Type
	if backupType != "data" && backupType != "logs" && backupType != "full" {
		backupType = "full"
	}

	logger.Security(fmt.Sprintf("Backup Restic manuel déclenché (type: %s)", backupType))
	id, err := runResticBackup("manual", backupType)
	if err != nil {
		log.Printf("[ERROR] TriggerBackup: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": fmt.Sprintf("Backup échoué: %v", err)})
		return
	}

	bScheduler.mu.Lock()
	bScheduler.lastRun = time.Now()
	bScheduler.lastSnap = id
	bScheduler.mu.Unlock()

	logger.Security(fmt.Sprintf("Backup OK — snapshot %s (type: %s)", id[:backupMin(8, len(id))], backupType))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"snapshot_id": id,
		"backup_type": backupType,
		"message":     fmt.Sprintf("Snapshot %s créé: %s", backupType, id),
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
	})
}

func ListBackups(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(models.UserRoleKey).(string)
	if userRole != "admin" {
		http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
		return
	}

	snapshots, err := listResticSnapshots()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Erreur lecture des snapshots: " + err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"snapshots":  snapshots,
		"schedule":   map[string]interface{}{"rules": mScheduler.toJSON()},
		"repository": resticRepo,
	})
}

func GetBackupStats(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(models.UserRoleKey).(string)
	if userRole != "admin" {
		http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
		return
	}

	stats, err := getResticStats()
	if err != nil {
		log.Printf("[ERROR] GetBackupStats: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Erreur stats restic: " + err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func GetBackupSchedule(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(models.UserRoleKey).(string)
	if userRole != "admin" {
		http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"rules": mScheduler.toJSON(),
	})
}

func SetBackupSchedule(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(models.UserRoleKey).(string)
	if userRole != "admin" {
		http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
		return
	}
	var body struct {
		Action        string `json:"action"`
		Type          string `json:"type"`
		IntervalHours int    `json:"interval_hours"`
		ID            string `json:"id"`
		Enabled       bool   `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Body JSON invalide"})
		return
	}

	writeErr := func(msg string, code int) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		json.NewEncoder(w).Encode(map[string]string{"error": msg})
	}

	switch body.Action {
	case "add":
		if body.Type != "data" && body.Type != "logs" && body.Type != "full" {
			writeErr("type doit être data, logs ou full", http.StatusBadRequest)
			return
		}
		if body.IntervalHours < 1 || body.IntervalHours > 720 {
			writeErr("interval_hours doit être entre 1 et 720", http.StatusBadRequest)
			return
		}
		id := mScheduler.addRule(body.Type, body.IntervalHours)
		logger.Security(fmt.Sprintf("Règle backup ajoutée: type=%s, interval=%dh, id=%s", body.Type, body.IntervalHours, id))
	case "delete":
		if body.ID == "" {
			writeErr("id requis", http.StatusBadRequest)
			return
		}
		if !mScheduler.deleteRule(body.ID) {
			writeErr("règle introuvable", http.StatusNotFound)
			return
		}
		logger.Security(fmt.Sprintf("Règle backup supprimée: %s", body.ID))
	case "toggle":
		if body.ID == "" {
			writeErr("id requis", http.StatusBadRequest)
			return
		}
		if !mScheduler.toggleRule(body.ID, body.Enabled) {
			writeErr("règle introuvable", http.StatusNotFound)
			return
		}
		action := "désactivée"
		if body.Enabled {
			action = "activée"
		}
		logger.Security(fmt.Sprintf("Règle backup %s: %s", action, body.ID))
	default:
		// Rétro-compat : ancien body { "interval_hours": N }
		if body.IntervalHours > 0 {
			startScheduler(body.IntervalHours)
			logger.Security(fmt.Sprintf("Backup automatique configuré: toutes les %dh", body.IntervalHours))
		} else if body.IntervalHours == 0 && body.Action == "" {
			stopScheduler()
			logger.Security("Backup automatique désactivé (compat)")
		} else {
			writeErr("action doit être add, delete ou toggle", http.StatusBadRequest)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"rules": mScheduler.toJSON(),
	})
}

func DownloadBackup(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(models.UserRoleKey).(string)
	if userRole != "admin" {
		http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
		return
	}

	snapID := r.URL.Query().Get("snapshot")
	if snapID == "" {
		snapID = "latest"
	}
	if snapID != "latest" {
		for _, c := range snapID {
			if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]string{"error": "snapshot ID invalide"})
				return
			}
		}
	}

	_, _, _, _, dbname := config.DBEnv()

	backupType := "full"
	snaps, _ := listResticSnapshots()
	for _, s := range snaps {
		if strings.HasPrefix(s.ID, snapID) || strings.HasPrefix(s.ShortID, snapID) || s.ID == snapID || snapID == "latest" {
			for _, tag := range s.Tags {
				if tag == "data" || tag == "logs" || tag == "full" {
					backupType = tag
					break
				}
			}
			break
		}
	}

	filename := backupType + "_" + dbname + ".sql"
	downloadName := fmt.Sprintf("restic-dump-%s-%s.sql", backupType, snapID[:backupMin(8, len(snapID))])

	cmd := exec.Command("restic", "dump", snapID, filename)
	resticEnvVars, err := resticEnv()
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	cmd.Env = resticEnvVars
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Erreur pipe restic"})
		return
	}
	if err := cmd.Start(); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "restic dump échoué: " + err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, downloadName))
	io.Copy(w, stdout)
	cmd.Wait()
}

func RestoreBackup(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(models.UserRoleKey).(string)
	if userRole != "admin" {
		http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
		return
	}
	var body struct {
		SnapshotID string `json:"snapshot_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.SnapshotID == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "snapshot_id requis"})
		return
	}

	snapID := body.SnapshotID
	if snapID != "latest" {
		for _, c := range snapID {
			if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]string{"error": "snapshot_id invalide"})
				return
			}
		}
	}

	host, port, user, password, dbname := config.DBEnv()
	shortID := snapID[:backupMin(8, len(snapID))]
	logger.Security(fmt.Sprintf("Restauration DB depuis snapshot %s déclenchée", shortID))

	backupType := "full"
	snaps, _ := listResticSnapshots()
	for _, s := range snaps {
		if strings.HasPrefix(s.ID, snapID) || strings.HasPrefix(s.ShortID, snapID) || s.ID == snapID {
			for _, tag := range s.Tags {
				if tag == "data" || tag == "logs" || tag == "full" {
					backupType = tag
					break
				}
			}
			break
		}
	}

	filename := backupType + "_" + dbname + ".sql"

	var truncateSQL string
	switch backupType {
	case "logs":
		truncateSQL = "TRUNCATE TABLE api_logs RESTART IDENTITY CASCADE;\n"
	case "data":
		truncateSQL = `DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables
           WHERE schemaname='public' AND tablename <> 'api_logs'
  LOOP
    EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
  END LOOP;
END $$;
`
	default: // full
		truncateSQL = `DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
  END LOOP;
END $$;
`
	}

	dumpCmd := exec.Command("restic", "dump", snapID, filename)
	resticEnvVars, err := resticEnv()
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	dumpCmd.Env = resticEnvVars
	dumpOut, dumpErrBuf := new(bytes.Buffer), new(bytes.Buffer)
	dumpCmd.Stdout = dumpOut
	dumpCmd.Stderr = dumpErrBuf

	if err := dumpCmd.Run(); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": fmt.Sprintf("restic dump: %v — %s", err, dumpErrBuf.String())})
		return
	}

	var cleanSQL strings.Builder
	for _, line := range strings.Split(dumpOut.String(), "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, `\restrict`) ||
			strings.HasPrefix(trimmed, `\connect`) ||
			strings.HasPrefix(trimmed, "SET transaction_timeout") {
			continue
		}
		cleanSQL.WriteString(line)
		cleanSQL.WriteByte('\n')
	}

	fullSQL := "BEGIN;\n" +
		"SET LOCAL session_replication_role = 'replica';\n" +
		truncateSQL +
		"\n" + cleanSQL.String() +
		"\nCOMMIT;\n"

	psqlCmd := exec.Command("psql",
		"-h", host, "-p", port, "-U", user, "-d", dbname,
		"--no-password",
	)
	psqlCmd.Env = append(os.Environ(), "PGPASSWORD="+password)
	psqlCmd.Stdin = strings.NewReader(fullSQL)

	var psqlOut bytes.Buffer
	psqlCmd.Stdout = &psqlOut
	psqlCmd.Stderr = &psqlOut

	if err := psqlCmd.Run(); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": fmt.Sprintf("psql restore: %v\n%s", err, psqlOut.String())})
		return
	}

	logger.Security(fmt.Sprintf("Restauration DB réussie depuis snapshot %s (type: %s)", shortID, backupType))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"snapshot_id": snapID,
		"backup_type": backupType,
		"message":     fmt.Sprintf("Base de données restaurée avec succès depuis le snapshot %s (type: %s)", shortID, backupType),
		"output":      psqlOut.String(),
	})
}

func DeleteBackup(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(models.UserRoleKey).(string)
	if userRole != "admin" {
		http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
		return
	}
	snapID := r.URL.Query().Get("snapshot")
	if snapID == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "snapshot requis"})
		return
	}
	out, err := runRestic("forget", "--prune", snapID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": fmt.Sprintf("restic forget: %v — %s", err, out)})
		return
	}
	logger.Security(fmt.Sprintf("Snapshot supprimé: %s", snapID[:backupMin(8, len(snapID))]))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Snapshot supprimé"})
}
