package handlers

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"api/config"
	"api/logger"
	"api/models"
)

// ============================================================
// BACKUP POSTGRESQL avec RESTIC + fallback pg_dump
// ============================================================

const resticRepo = "/backups/restic-repo"

// ============================================================
// SUIVI DE BACKUP ASYNCHRONE
// ============================================================

type backupJob struct {
	Running    bool      `json:"running"`
	Success    bool      `json:"success"`
	Error      string    `json:"error,omitempty"`
	FileName   string    `json:"file_name,omitempty"`
	StartedAt  time.Time `json:"started_at"`
	FinishedAt time.Time `json:"finished_at,omitempty"`
	BackupType string    `json:"backup_type"`
}

var currentBackup struct {
	sync.Mutex
	*backupJob
}

// ===== ENV HELPERS =====

func resticPassword() (string, error) {
	p := os.Getenv("RESTIC_PASSWORD")
	if p == "" {
		return "", fmt.Errorf("RESTIC_PASSWORD is required")
	}
	return p, nil
}

var (
	resticAvailableCached    bool
	resticAvailableCacheTime time.Time
	resticAvailableCacheMu   sync.Mutex
)

const resticAvailableCacheTTL = 60 * time.Second // Re-vérifier toutes les 60s

func resticAvailable() bool {
	// Forcé à false — on utilise toujours pg_dump
	return false
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

// ===== RESTIC HELPERS =====

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

// runResticTimed exécute restic avec un timeout. Tue le processus si le timeout est dépassé.
func runResticTimed(timeout time.Duration, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, "restic", args...)
	env, err := resticEnv()
	if err != nil {
		return "", err
	}
	cmd.Env = env
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	err = cmd.Run()
	if ctx.Err() == context.DeadlineExceeded {
		return "", fmt.Errorf("restic timeout (%v)", timeout)
	}
	return out.String(), err
}

// ===== INIT REPO =====

func initResticRepo() error {
	os.MkdirAll(resticRepo, 0700)
	out, err := runResticTimed(10*time.Second, "snapshots", "--json")
	if err == nil && strings.HasPrefix(strings.TrimSpace(out), "[") {
		return nil
	}
	// Tentative d'init seulement si snapshots a échoué
	if err != nil {
		log.Printf("[initResticRepo] snapshots failed (tentative init): %v", err)
	}
	_, err = runResticTimed(30*time.Second, "init")
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

// ===== FALLBACK PG_DUMP =====

func runPGDumpBackup(backupType string, tags ...string) (string, error) {
	if err := os.MkdirAll("/backups/pgdump/", 0700); err != nil {
		return "", fmt.Errorf("mkdir pgdump: %w", err)
	}

	host, port, user, password, dbname := config.DBEnv()

	args := pgDumpArgs(host, port, user, dbname, backupType)
	cmd := exec.Command("pg_dump", args...)
	cmd.Env = append(os.Environ(), "PGPASSWORD="+password)

	timestamp := time.Now().UTC().Format("20060102_150405")
	filename := fmt.Sprintf("%s_%s.sql", backupType, timestamp)
	for _, tag := range tags {
		if tag == "auto" {
			filename = fmt.Sprintf("auto_%s_%s.sql", backupType, timestamp)
			break
		}
	}
	filepath := filepath.Join("/backups/pgdump/", filename)

	outFile, err := os.Create(filepath)
	if err != nil {
		return "", fmt.Errorf("create file: %w", err)
	}
	defer outFile.Close()

	var stderr bytes.Buffer
	cmd.Stdout = outFile
	cmd.Stderr = &stderr

	// Timeout de 120s pour éviter que pg_dump ne bloque indéfiniment
	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("pg_dump start: %w", err)
	}
	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()
	select {
	case err := <-done:
		if err != nil {
			return "", fmt.Errorf("pg_dump: %v — %s", err, stderr.String())
		}
	case <-time.After(120 * time.Second):
		cmd.Process.Kill()
		return "", fmt.Errorf("pg_dump timeout (120s) — fichier partiel: %s", filename)
	}

	return filename, nil
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
	ID              string    `json:"id"`
	Type            string    `json:"type"`
	IntervalMinutes int       `json:"interval_minutes"`
	Enabled         bool      `json:"enabled"`
	LastRun         time.Time `json:"-"`
	LastSnap        string    `json:"last_snapshot"`
	NextRun         time.Time `json:"-"`
	stop            chan struct{}
	ticker          *time.Ticker
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
	loadSchedules()
	log.Println("[INFO] Backup scheduler prêt — fallback pg_dump")
	if m := os.Getenv("BACKUP_INTERVAL_MINUTES"); m != "" {
		var minutes int
		fmt.Sscanf(m, "%d", &minutes)
		if minutes > 0 {
			mScheduler.addRule("full", minutes)
		}
	}
	log.Printf("[INFO] Backup scheduler ready (interval: minutes)")
}

func (ms *multiScheduler) addRule(backupType string, intervalMinutes int) string {
	ms.mu.Lock()
	id := fmt.Sprintf("%s-%d-%d", backupType, intervalMinutes, time.Now().UnixNano()%100000)
	rule := &scheduleRule{
		ID: id, Type: backupType,
		IntervalMinutes: intervalMinutes, Enabled: true,
	}
	ms.rules = append(ms.rules, rule)
	ms.mu.Unlock()
	ms.startRule(rule)
	saveSchedules(ms.toJSON())
	return id
}

func (ms *multiScheduler) startRule(rule *scheduleRule) {
	if rule.stop != nil {
		close(rule.stop)
		rule.ticker.Stop()
	}
	rule.ticker = time.NewTicker(time.Duration(rule.IntervalMinutes) * time.Minute)
	rule.stop = make(chan struct{})
	rule.NextRun = time.Now().Add(time.Duration(rule.IntervalMinutes) * time.Minute)
	go func(r *scheduleRule) {
		for {
			select {
			case <-r.ticker.C:
				log.Printf("[INFO] Backup auto (règle %s, type %s)", r.ID, r.Type)

				var id string
				var err error
				if resticAvailable() {
					id, err = runResticBackup("auto", r.Type)
				} else {
					id, err = runPGDumpBackup(r.Type, "auto", r.Type)
				}

				if err != nil {
					log.Printf("[ERROR] Backup auto règle %s: %v", r.ID, err)
				} else {
					log.Printf("[INFO] Backup auto OK snapshot %s (règle %s)", id, r.ID)
					if resticAvailable() {
						runRestic("forget", "--keep-last", "10", "--prune", "--tag", "auto")
					}
					ms.mu.Lock()
					r.LastRun = time.Now()
					r.LastSnap = id
					r.NextRun = time.Now().Add(time.Duration(r.IntervalMinutes) * time.Minute)
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
	for i, r := range ms.rules {
		if r.ID == id {
			if r.stop != nil {
				close(r.stop)
				r.ticker.Stop()
			}
			ms.rules = append(ms.rules[:i], ms.rules[i+1:]...)
			ms.mu.Unlock()
			saveSchedules(ms.toJSON())
			return true
		}
	}
	ms.mu.Unlock()
	return false
}

func (ms *multiScheduler) toggleRule(id string, enabled bool) bool {
	ms.mu.Lock()
	var saved bool
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
			saved = true
			break
		}
	}
	ms.mu.Unlock()
	if saved {
		saveSchedules(ms.toJSON())
	}
	return saved
}

func (ms *multiScheduler) toJSON() []map[string]interface{} {
	ms.mu.Lock()
	defer ms.mu.Unlock()
	out := make([]map[string]interface{}, 0, len(ms.rules))
	for _, r := range ms.rules {
		out = append(out, map[string]interface{}{
			"id":               r.ID,
			"type":             r.Type,
			"interval_minutes": r.IntervalMinutes,
			"enabled":          r.Enabled,
			"last_run":         r.LastRunStr(),
			"next_run":         r.NextRunStr(),
			"last_snapshot":    r.LastSnap,
		})
	}
	return out
}

func saveSchedules(rules []map[string]interface{}) {
	data, err := json.MarshalIndent(rules, "", "  ")
	if err != nil {
		log.Printf("[ERROR] saveSchedules: %v", err)
		return
	}
	if err := os.WriteFile("/backups/schedules.json", data, 0600); err != nil {
		log.Printf("[ERROR] saveSchedules: %v", err)
	}
}

func loadSchedules() {
	data, err := os.ReadFile("/backups/schedules.json")
	if err != nil {
		if os.IsNotExist(err) {
			return
		}
		log.Printf("[ERROR] loadSchedules: %v", err)
		return
	}
	var rules []struct {
		Type            string `json:"type"`
		IntervalMinutes int    `json:"interval_minutes"`
		Enabled         bool   `json:"enabled"`
	}
	if err := json.Unmarshal(data, &rules); err != nil {
		log.Printf("[ERROR] loadSchedules: %v", err)
		return
	}
	for _, rule := range rules {
		id := mScheduler.addRule(rule.Type, rule.IntervalMinutes)
		if !rule.Enabled {
			mScheduler.toggleRule(id, false)
		}
	}
	log.Printf("[INFO] Planifications chargees depuis /backups/schedules.json: %d regle(s)", len(rules))
}

func startScheduler(intervalMinutes int) {
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
	mScheduler.addRule("full", intervalMinutes)
	bScheduler.mu.Lock()
	bScheduler.interval = intervalMinutes
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

	currentBackup.Lock()
	if currentBackup.backupJob != nil && currentBackup.backupJob.Running {
		currentBackup.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]string{"error": "Un backup est déjà en cours"})
		return
	}

	job := &backupJob{
		Running:    true,
		StartedAt:  time.Now(),
		BackupType: backupType,
	}
	currentBackup.backupJob = job
	currentBackup.Unlock()

	logger.Security(fmt.Sprintf("Backup manuel déclenché (type: %s)", backupType))

	go func() {
		defer func() {
			if rec := recover(); rec != nil {
				currentBackup.Lock()
				job.Running = false
				job.Success = false
				job.Error = fmt.Sprintf("panic: %v", rec)
				job.FinishedAt = time.Now()
				currentBackup.Unlock()
				log.Printf("[PANIC] TriggerBackup goroutine: %v", rec)
			}
		}()

		var id string
		var err error
		if resticAvailable() {
			id, err = runResticBackup("manual", backupType)
		} else {
			id, err = runPGDumpBackup(backupType)
		}

		currentBackup.Lock()
		defer currentBackup.Unlock()

		job.FinishedAt = time.Now()
		job.Running = false

		if err != nil {
			job.Success = false
			job.Error = err.Error()
			log.Printf("[ERROR] TriggerBackup async: %v", err)
			return
		}

		job.Success = true
		job.FileName = id

		bScheduler.mu.Lock()
		bScheduler.lastRun = time.Now()
		bScheduler.lastSnap = id
		bScheduler.mu.Unlock()

		logger.Security(fmt.Sprintf("Backup OK — %s %s (type: %s)", resticRepoLabel(), id[:backupMin(8, len(id))], backupType))
	}()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      "started",
		"backup_type": backupType,
		"started_at":  job.StartedAt.UTC().Format(time.RFC3339),
	})
}

// GetBackupStatus retourne l'état du backup asynchrone en cours
func GetBackupStatus(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(models.UserRoleKey).(string)
	if userRole != "admin" {
		http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
		return
	}

	currentBackup.Lock()
	defer currentBackup.Unlock()

	w.Header().Set("Content-Type", "application/json")

	if currentBackup.backupJob == nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"running": false,
			"success": false,
			"error":   "no_backup",
		})
		return
	}

	json.NewEncoder(w).Encode(currentBackup.backupJob)
}

// resticRepoLabel retourne le libellé adapté au mode actif
func resticRepoLabel() string {
	if resticAvailable() {
		return "snapshot"
	}
	return "fichier"
}

func ListBackups(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(models.UserRoleKey).(string)
	if userRole != "admin" {
		http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
		return
	}

	if !resticAvailable() {
		entries, err := os.ReadDir("/backups/pgdump/")
		if err != nil {
			log.Printf("[ListBackups] /backups/pgdump/ read error: %v (creating directory)", err)
			// Créer le dossier s'il n'existe pas
			os.MkdirAll("/backups/pgdump/", 0700)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"snapshots":  []ResticSnapshot{},
				"schedule":   map[string]interface{}{"rules": mScheduler.toJSON()},
				"repository": "/backups/pgdump/",
			})
			return
		}

		snapshots := make([]ResticSnapshot, 0)
		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
				continue
			}
			info, err := entry.Info()
			if err != nil {
				continue
			}

			tags := []string{"pgdump"}
			name := entry.Name()
			// Détection auto/manuel
			if strings.HasPrefix(name, "auto_") {
				tags = append(tags, "auto")
				name = strings.TrimPrefix(name, "auto_")
			}
			// Détection du type (data/logs/full)
			if strings.HasPrefix(name, "data_") {
				tags = append(tags, "data")
			} else if strings.HasPrefix(name, "logs_") {
				tags = append(tags, "logs")
			} else if strings.HasPrefix(name, "full_") {
				tags = append(tags, "full")
			}

			snapshots = append(snapshots, ResticSnapshot{
				ID:       entry.Name(),
				ShortID:  entry.Name(),
				Time:     info.ModTime(),
				Hostname: "pgdump",
				Tags:     tags,
				Paths:    []string{filepath.Join("/backups/pgdump/", entry.Name())},
			})
		}

		// Tri du plus récent au plus ancien
		for i, j := 0, len(snapshots)-1; i < j; i, j = i+1, j-1 {
			snapshots[i], snapshots[j] = snapshots[j], snapshots[i]
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"snapshots":  snapshots,
			"schedule":   map[string]interface{}{"rules": mScheduler.toJSON()},
			"repository": "/backups/pgdump/",
		})
		return
	}

	// Fallback: Restic disponible mais peut échouer → essayer pgdump
	log.Printf("[ListBackups] resticAvailable=true, tentatives Restic…")
	snapshots, err := listResticSnapshots()
	if err != nil {
		log.Printf("[ListBackups] listResticSnapshots failed: %v (fallback pgdump)", err)
		// Fallback vers pgdump au lieu de retourner 500
		entries, dirErr := os.ReadDir("/backups/pgdump/")
		if dirErr != nil {
			log.Printf("[ListBackups] pgdump fallback also failed: %v", dirErr)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "Erreur: " + err.Error() + " | pgdump: " + dirErr.Error()})
			return
		}
		pgSnaps := make([]ResticSnapshot, 0)
		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
				continue
			}
			info, infoErr := entry.Info()
			if infoErr != nil {
				continue
			}
			tags := []string{"pgdump"}
			if strings.HasPrefix(entry.Name(), "data_") {
				tags = append(tags, "data")
			} else if strings.HasPrefix(entry.Name(), "logs_") {
				tags = append(tags, "logs")
			} else if strings.HasPrefix(entry.Name(), "full_") {
				tags = append(tags, "full")
			}
			pgSnaps = append(pgSnaps, ResticSnapshot{
				ID: entry.Name(), ShortID: entry.Name(), Time: info.ModTime(),
				Hostname: "pgdump", Tags: tags,
				Paths: []string{filepath.Join("/backups/pgdump/", entry.Name())},
			})
		}
		for i, j := 0, len(pgSnaps)-1; i < j; i, j = i+1, j-1 {
			pgSnaps[i], pgSnaps[j] = pgSnaps[j], pgSnaps[i]
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"snapshots": pgSnaps, "schedule": map[string]interface{}{"rules": mScheduler.toJSON()},
			"repository": "/backups/pgdump/",
		})
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

	if !resticAvailable() {
		entries, err := os.ReadDir("/backups/pgdump/")
		if err != nil {
			log.Printf("[GetBackupStats] /backups/pgdump/ read error: %v (creating directory)", err)
			os.MkdirAll("/backups/pgdump/", 0700)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"total_size":       0,
				"total_file_count": 0,
				"snapshots_count":  0,
			})
			return
		}

		var totalSize int64
		var count int
		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
				continue
			}
			info, err := entry.Info()
			if err != nil {
				continue
			}
			totalSize += info.Size()
			count++
		}

		stats := map[string]interface{}{
			"total_size":       totalSize,
			"total_file_count": 0,
			"snapshots_count":  count,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(stats)
		return
	}

	stats, err := getResticStats()
	if err != nil {
		log.Printf("[GetBackupStats] getResticStats failed: %v (fallback pgdump)", err)
		// Fallback vers les stats pgdump
		entries, dirErr := os.ReadDir("/backups/pgdump/")
		if dirErr != nil {
			log.Printf("[GetBackupStats] pgdump fallback also failed: %v", dirErr)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "Restic: " + err.Error() + " | pgdump: " + dirErr.Error()})
			return
		}
		var totalSize int64
		var snapCount int
		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
				continue
			}
			info, infoErr := entry.Info()
			if infoErr != nil {
				continue
			}
			totalSize += info.Size()
			snapCount++
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total_size":       totalSize,
			"total_file_count": 0,
			"snapshots_count":  snapCount,
		})
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
		Action          string `json:"action"`
		Type            string `json:"type"`
		IntervalMinutes int    `json:"interval_minutes"`
		ID              string `json:"id"`
		Enabled         bool   `json:"enabled"`
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
		if body.IntervalMinutes < 1 || body.IntervalMinutes > 43200 {
			writeErr("interval_minutes doit être entre 1 et 43200 (30 jours)", http.StatusBadRequest)
			return
		}
		id := mScheduler.addRule(body.Type, body.IntervalMinutes)
		logger.Security(fmt.Sprintf("Règle backup ajoutée: type=%s, interval=%dmin, id=%s", body.Type, body.IntervalMinutes, id))
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
		if body.IntervalMinutes > 0 {
			startScheduler(body.IntervalMinutes)
			logger.Security(fmt.Sprintf("Backup automatique configuré: toutes les %dmin", body.IntervalMinutes))
		} else if body.IntervalMinutes == 0 && body.Action == "" {
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

	if !resticAvailable() {
		var filePath string
		if snapID == "latest" {
			entries, err := os.ReadDir("/backups/pgdump/")
			if err != nil || len(entries) == 0 {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusNotFound)
				json.NewEncoder(w).Encode(map[string]string{"error": "Aucun backup pgdump trouvé"})
				return
			}
			var newest os.FileInfo
			for _, entry := range entries {
				if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
					continue
				}
				info, err := entry.Info()
				if err != nil {
					continue
				}
				if newest == nil || info.ModTime().After(newest.ModTime()) {
					newest = info
				}
			}
			if newest == nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusNotFound)
				json.NewEncoder(w).Encode(map[string]string{"error": "Aucun fichier .sql trouvé dans /backups/pgdump/"})
				return
			}
			filePath = filepath.Join("/backups/pgdump/", newest.Name())
			snapID = newest.Name()
		} else {
			// Éviter les traversées de répertoire
			if strings.Contains(snapID, "/") || strings.Contains(snapID, "..") {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]string{"error": "snapshot ID invalide"})
				return
			}
			filePath = filepath.Join("/backups/pgdump/", snapID)
			if _, err := os.Stat(filePath); os.IsNotExist(err) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusNotFound)
				json.NewEncoder(w).Encode(map[string]string{"error": "Fichier pgdump introuvable: " + snapID})
				return
			}
		}

		downloadName := fmt.Sprintf("pgdump-%s", filepath.Base(filePath))
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, downloadName))
		http.ServeFile(w, r, filePath)
		return
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

	host, port, user, password, dbname := config.DBEnv()

	if !resticAvailable() {
		// Éviter les traversées de répertoire
		if strings.Contains(snapID, "/") || strings.Contains(snapID, "..") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "snapshot_id invalide"})
			return
		}

		filePath := filepath.Join("/backups/pgdump/", snapID)
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{"error": "Fichier pgdump introuvable: " + snapID})
			return
		}

		shortID := snapID[:backupMin(8, len(snapID))]
		logger.Security(fmt.Sprintf("Restauration DB depuis fichier pgdump %s déclenchée", shortID))

		backupType := "full"
		if strings.HasPrefix(snapID, "data_") {
			backupType = "data"
		} else if strings.HasPrefix(snapID, "logs_") {
			backupType = "logs"
		}

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

		content, err := os.ReadFile(filePath)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "Erreur lecture fichier pgdump: " + err.Error()})
			return
		}

		var cleanSQL strings.Builder
		for _, line := range strings.Split(string(content), "\n") {
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

		logger.Security(fmt.Sprintf("Restauration DB réussie depuis fichier pgdump %s (type: %s)", shortID, backupType))
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":     true,
			"snapshot_id": snapID,
			"backup_type": backupType,
			"message":     fmt.Sprintf("Base de données restaurée avec succès depuis le fichier pgdump %s (type: %s)", shortID, backupType),
			"output":      psqlOut.String(),
		})
		return
	}

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
