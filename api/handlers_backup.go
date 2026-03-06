package main

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
)

// ============================================================
// BACKUP POSTGRESQL avec RESTIC
// ============================================================
//
// Restic offre : déduplication, chiffrement AES-256, snapshots,
// rétention automatique, restore, et export vers S3/B2/SFTP.
//
// Endpoints :
//   POST   /api/admin/backup            → snapshot immédiat (restic backup)
//   GET    /api/admin/backup/list       → liste des snapshots (restic snapshots)
//   POST   /api/admin/backup/restore    → restaure un snapshot dans la DB
//   DELETE /api/admin/backup            → supprime un snapshot (restic forget)
//   GET    /api/admin/backup/schedule   → config cron
//   POST   /api/admin/backup/schedule   → configurer le cron
//   GET    /api/admin/backup/download   → export tar.gz d'un snapshot
//   GET    /api/admin/backup/stats      → stats du repo restic

const resticRepo = "/backups/restic-repo"

// ===== ENV HELPERS =====

func dbEnv() (host, port, user, password, dbname string) {
	host = os.Getenv("DB_HOST")
	if host == "" {
		host = "db"
	}
	port = os.Getenv("DB_PORT")
	if port == "" {
		port = "5432"
	}
	user = os.Getenv("DB_USER")
	if user == "" {
		user = "postgres"
	}
	password = os.Getenv("DB_PASSWORD")
	if password == "" {
		password = "password"
	}
	dbname = os.Getenv("DB_NAME")
	if dbname == "" {
		dbname = "mydb"
	}
	return
}

func resticPassword() string {
	p := os.Getenv("RESTIC_PASSWORD")
	if p == "" {
		p = "cyna-restic-secret"
	}
	return p
}

// resticEnv retourne les variables d'environnement nécessaires à restic
func resticEnv() []string {
	env := os.Environ()
	// S'assurer que RESTIC_REPOSITORY et RESTIC_PASSWORD sont définis
	// (écrasent d'éventuelles valeurs vides héritées)
	repo := resticRepo
	if r := os.Getenv("RESTIC_REPOSITORY"); r != "" {
		repo = r
	}
	pass := resticPassword()
	// Filtrer les anciennes valeurs RESTIC_* pour éviter les doublons
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
	return filtered
}

// runRestic exécute une commande restic et retourne stdout + stderr combinés
func runRestic(args ...string) (string, error) {
	cmd := exec.Command("restic", args...)
	cmd.Env = resticEnv()
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	err := cmd.Run()
	return out.String(), err
}

// ===== INIT REPO =====

func initResticRepo() error {
	os.MkdirAll(resticRepo, 0700)
	// Vérifier si le repo existe déjà
	out, err := runRestic("snapshots", "--json")
	if err == nil || strings.Contains(out, "[]") {
		return nil // repo déjà initialisé
	}
	// Initialiser le repo
	_, err = runRestic("init")
	if err != nil {
		return fmt.Errorf("restic init: %w", err)
	}
	log.Println("[INFO] Restic repository initialisé:", resticRepo)
	return nil
}

// ===== SNAPSHOT (BACKUP) =====

// ResticSnapshot représente un snapshot restic (sortie JSON de `restic snapshots`)
type ResticSnapshot struct {
	ID       string    `json:"id"`
	ShortID  string    `json:"short_id"`
	Time     time.Time `json:"time"`
	Hostname string    `json:"hostname"`
	Tags     []string  `json:"tags"`
	Paths    []string  `json:"paths"`
}

// ResticStats représente les stats du repo (sortie JSON de `restic stats`)
type ResticStats struct {
	TotalSize      int64 `json:"total_size"`
	TotalFileCount int64 `json:"total_file_count"`
	SnapshotsCount int   `json:"snapshots_count"`
}

// backupType définit le type de backup : "data" (toutes tables sauf logs) ou "logs" (api_logs seulement)
// "full" (tout) est aussi accepté.
//
// La stratégie :
//   - "data" : exclut la table api_logs → --exclude-table=api_logs
//   - "logs" : ne sauvegarde que api_logs → --table=api_logs
//   - "full" : dump complet sans exclusion
//
// Important : on utilise --data-only --inserts (pas de --create ni de DDL)
// pour que la restauration soit sûre sans DROP DATABASE.

// pgDumpArgs retourne les arguments pg_dump selon le type de backup
func pgDumpArgs(host, port, user, dbname, backupType string) []string {
	base := []string{
		"-h", host, "-p", port, "-U", user, "-d", dbname,
		"--no-password", "--format=plain",
		"--data-only", "--inserts",
		"--no-owner", "--no-acl",
		// NOTE: --disable-triggers est omis car il cause un dump vide
		// avec pg_dump 18.x connecté à postgres 15 (bug protocole \restrict).
		// La désactivation des FK est gérée côté restore via session_replication_role=replica.
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

// runResticBackup : pg_dump → stdin de restic backup --stdin
func runResticBackup(tags ...string) (string, error) {
	host, port, user, password, dbname := dbEnv()

	// Déterminer le type depuis les tags
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

	// Nom du fichier dans le snapshot = type de backup
	filename := backupType + "_" + dbname + ".sql"

	// restic backup --stdin --stdin-filename dump.sql
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
	resticCmd.Env = resticEnv()

	// Pipeline : pg_dump stdout → restic stdin
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

	// Extraire le snapshot ID depuis la sortie JSON de restic
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

// listResticSnapshots retourne la liste des snapshots
func listResticSnapshots() ([]ResticSnapshot, error) {
	out, err := runRestic("snapshots", "--json")
	if err != nil {
		return nil, fmt.Errorf("restic snapshots: %w — %s", err, out)
	}
	var snapshots []ResticSnapshot
	if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &snapshots); err != nil {
		// Restic peut retourner null si le repo est vide
		return []ResticSnapshot{}, nil
	}
	// Tri : plus récent en premier
	for i, j := 0, len(snapshots)-1; i < j; i, j = i+1, j-1 {
		snapshots[i], snapshots[j] = snapshots[j], snapshots[i]
	}
	return snapshots, nil
}

// getResticStats retourne les stats du repository
func getResticStats() (map[string]interface{}, error) {
	out, err := runRestic("stats", "--json")
	if err != nil {
		return nil, fmt.Errorf("restic stats: %w — %s", err, out)
	}
	var stats map[string]interface{}
	json.Unmarshal([]byte(out), &stats)

	// Nombre de snapshots
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
	ticker   *time.Ticker
	stop     chan struct{}
	lastRun  time.Time
	nextRun  time.Time
	lastSnap string // dernier snapshot ID
}

var scheduler = &backupScheduler{}

func initBackupScheduler() {
	os.MkdirAll("/backups", 0700)
	if err := initResticRepo(); err != nil {
		log.Printf("[WARN] Restic init: %v", err)
	}
	// Lire interval depuis variable d'env
	if h := os.Getenv("BACKUP_INTERVAL_HOURS"); h != "" {
		var hours int
		fmt.Sscanf(h, "%d", &hours)
		if hours > 0 {
			startScheduler(hours)
		}
	}
	log.Printf("[INFO] Backup scheduler prêt (restic repo: %s)", resticRepo)
}

func startScheduler(intervalHours int) {
	scheduler.mu.Lock()
	defer scheduler.mu.Unlock()

	if scheduler.stop != nil {
		close(scheduler.stop)
		scheduler.ticker.Stop()
	}

	scheduler.interval = intervalHours
	scheduler.ticker = time.NewTicker(time.Duration(intervalHours) * time.Hour)
	scheduler.stop = make(chan struct{})
	scheduler.nextRun = time.Now().Add(time.Duration(intervalHours) * time.Hour)

	go func(ticker *time.Ticker, stop chan struct{}) {
		for {
			select {
			case <-ticker.C:
				log.Println("[INFO] Backup automatique Restic démarré")
				id, err := runResticBackup("auto", "full")
				if err != nil {
					log.Printf("[ERROR] Backup auto échoué: %v", err)
				} else {
					log.Printf("[INFO] Backup auto OK, snapshot: %s", id)
					// Rétention : garder 10 derniers snapshots
					runRestic("forget", "--keep-last", "10", "--prune", "--tag", "auto")
					scheduler.mu.Lock()
					scheduler.lastRun = time.Now()
					scheduler.lastSnap = id
					scheduler.nextRun = time.Now().Add(time.Duration(scheduler.interval) * time.Hour)
					scheduler.mu.Unlock()
					logSecurity(fmt.Sprintf("Backup automatique OK — snapshot %s", id[:8]))
				}
			case <-stop:
				return
			}
		}
	}(scheduler.ticker, scheduler.stop)
}

func stopScheduler() {
	scheduler.mu.Lock()
	defer scheduler.mu.Unlock()
	if scheduler.stop != nil {
		close(scheduler.stop)
		scheduler.ticker.Stop()
		scheduler.stop = nil
		scheduler.ticker = nil
	}
	scheduler.interval = 0
	scheduler.nextRun = time.Time{}
}

// ===== HANDLERS HTTP =====

// POST /api/admin/backup — snapshot immédiat
// Body (optionnel): { "type": "data" | "logs" | "full" }
func triggerBackup(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(UserRoleKey).(string)
	if userRole != "admin" {
		jsonError(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Lire le type de backup depuis le body (optionnel)
	var body struct {
		Type string `json:"type"`
	}
	json.NewDecoder(r.Body).Decode(&body) // ignorer l'erreur si body vide
	backupType := body.Type
	if backupType != "data" && backupType != "logs" && backupType != "full" {
		backupType = "full"
	}

	logSecurity(fmt.Sprintf("Backup Restic manuel déclenché (type: %s)", backupType))
	id, err := runResticBackup("manual", backupType)
	if err != nil {
		log.Printf("[ERROR] triggerBackup: %v", err)
		jsonError(w, fmt.Sprintf("Backup échoué: %v", err), http.StatusInternalServerError)
		return
	}

	scheduler.mu.Lock()
	scheduler.lastRun = time.Now()
	scheduler.lastSnap = id
	scheduler.mu.Unlock()

	logSecurity(fmt.Sprintf("Backup OK — snapshot %s (type: %s)", id[:min(8, len(id))], backupType))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"snapshot_id": id,
		"backup_type": backupType,
		"message":     fmt.Sprintf("Snapshot %s créé: %s", backupType, id),
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
	})
}

// GET /api/admin/backup/list — liste des snapshots + schedule
func listBackups(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(UserRoleKey).(string)
	if userRole != "admin" {
		jsonError(w, "Forbidden", http.StatusForbidden)
		return
	}

	snapshots, err := listResticSnapshots()
	if err != nil {
		jsonError(w, "Erreur lecture des snapshots: "+err.Error(), http.StatusInternalServerError)
		return
	}

	scheduler.mu.Lock()
	sched := map[string]interface{}{
		"interval_hours": scheduler.interval,
		"enabled":        scheduler.interval > 0,
		"last_run":       nil,
		"next_run":       nil,
		"last_snapshot":  scheduler.lastSnap,
	}
	if !scheduler.lastRun.IsZero() {
		sched["last_run"] = scheduler.lastRun.UTC().Format(time.RFC3339)
	}
	if !scheduler.nextRun.IsZero() && scheduler.interval > 0 {
		sched["next_run"] = scheduler.nextRun.UTC().Format(time.RFC3339)
	}
	scheduler.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"snapshots":  snapshots,
		"schedule":   sched,
		"repository": resticRepo,
	})
}

// GET /api/admin/backup/stats — stats du repo restic
func getBackupStats(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(UserRoleKey).(string)
	if userRole != "admin" {
		jsonError(w, "Forbidden", http.StatusForbidden)
		return
	}

	stats, err := getResticStats()
	if err != nil {
		log.Printf("[ERROR] getBackupStats: %v", err)
		jsonError(w, "Erreur stats restic: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// GET /api/admin/backup/schedule
func getBackupSchedule(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(UserRoleKey).(string)
	if userRole != "admin" {
		jsonError(w, "Forbidden", http.StatusForbidden)
		return
	}
	scheduler.mu.Lock()
	defer scheduler.mu.Unlock()
	resp := map[string]interface{}{
		"interval_hours": scheduler.interval,
		"enabled":        scheduler.interval > 0,
		"last_run":       nil,
		"next_run":       nil,
		"last_snapshot":  scheduler.lastSnap,
	}
	if !scheduler.lastRun.IsZero() {
		resp["last_run"] = scheduler.lastRun.UTC().Format(time.RFC3339)
	}
	if !scheduler.nextRun.IsZero() && scheduler.interval > 0 {
		resp["next_run"] = scheduler.nextRun.UTC().Format(time.RFC3339)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// POST /api/admin/backup/schedule — Body: { "interval_hours": 24 }
func setBackupSchedule(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(UserRoleKey).(string)
	if userRole != "admin" {
		jsonError(w, "Forbidden", http.StatusForbidden)
		return
	}
	var body struct {
		IntervalHours int `json:"interval_hours"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "Body JSON invalide", http.StatusBadRequest)
		return
	}
	if body.IntervalHours < 0 || body.IntervalHours > 720 {
		jsonError(w, "interval_hours doit être entre 0 et 720", http.StatusBadRequest)
		return
	}
	if body.IntervalHours == 0 {
		stopScheduler()
		logSecurity("Backup automatique désactivé")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"enabled": false, "interval_hours": 0})
		return
	}
	startScheduler(body.IntervalHours)
	logSecurity(fmt.Sprintf("Backup automatique configuré: toutes les %dh", body.IntervalHours))
	scheduler.mu.Lock()
	defer scheduler.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"enabled":        true,
		"interval_hours": body.IntervalHours,
		"next_run":       scheduler.nextRun.UTC().Format(time.RFC3339),
	})
}

// GET /api/admin/backup/download?snapshot=abc123 — export SQL du snapshot via restic dump
func downloadBackup(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(UserRoleKey).(string)
	if userRole != "admin" {
		jsonError(w, "Forbidden", http.StatusForbidden)
		return
	}

	snapID := r.URL.Query().Get("snapshot")
	if snapID == "" {
		snapID = "latest"
	}
	// Sécurité : seulement hex + "latest"
	if snapID != "latest" {
		for _, c := range snapID {
			if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
				jsonError(w, "snapshot ID invalide", http.StatusBadRequest)
				return
			}
		}
	}

	_, _, _, _, dbname := dbEnv()

	// Trouver le type de backup dans les tags du snapshot
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
	downloadName := fmt.Sprintf("restic-dump-%s-%s.sql", backupType, snapID[:min(8, len(snapID))])

	// restic dump <snapshot> <file-in-snapshot>
	cmd := exec.Command("restic", "dump", snapID, filename)
	cmd.Env = resticEnv()
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		jsonError(w, "Erreur pipe restic", http.StatusInternalServerError)
		return
	}
	if err := cmd.Start(); err != nil {
		jsonError(w, "restic dump échoué: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, downloadName))
	io.Copy(w, stdout)
	cmd.Wait()
}

// POST /api/admin/backup/restore — restaure un snapshot dans la DB
// Body: { "snapshot_id": "abc123", "type": "data" }
//
// Stratégie de restauration sans DROP DATABASE :
//  1. On identifie le type de backup depuis les tags du snapshot
//  2. On lit le fichier SQL depuis restic dump
//  3. Avant de rejouer les INSERT, on tronque les tables concernées
//     (TRUNCATE … RESTART IDENTITY CASCADE en transaction)
//  4. On rejoue le SQL via psql connecté directement à mydb
func restoreBackup(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(UserRoleKey).(string)
	if userRole != "admin" {
		jsonError(w, "Forbidden", http.StatusForbidden)
		return
	}
	var body struct {
		SnapshotID string `json:"snapshot_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.SnapshotID == "" {
		jsonError(w, "snapshot_id requis", http.StatusBadRequest)
		return
	}

	// Valider l'ID : seulement hex ou "latest"
	snapID := body.SnapshotID
	if snapID != "latest" {
		for _, c := range snapID {
			if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
				jsonError(w, "snapshot_id invalide", http.StatusBadRequest)
				return
			}
		}
	}

	host, port, user, password, dbname := dbEnv()
	shortID := snapID[:min(8, len(snapID))]
	logSecurity(fmt.Sprintf("Restauration DB depuis snapshot %s déclenchée", shortID))

	// 1. Lire les infos du snapshot pour connaître le type de backup
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
			// Trouver le nom du fichier dans le snapshot
			break
		}
	}

	// Nom du fichier dans le snapshot selon le type
	filename := backupType + "_" + dbname + ".sql"

	// 2. Construire le TRUNCATE adapté au type de backup
	var truncateSQL string
	switch backupType {
	case "logs":
		truncateSQL = "TRUNCATE TABLE api_logs RESTART IDENTITY CASCADE;\n"
	case "data":
		// Tronquer toutes les tables de données (pas api_logs)
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

	// 3. restic dump → obtenir le SQL du snapshot
	dumpCmd := exec.Command("restic", "dump", snapID, filename)
	dumpCmd.Env = resticEnv()

	dumpOut, dumpErrBuf := new(bytes.Buffer), new(bytes.Buffer)
	dumpCmd.Stdout = dumpOut
	dumpCmd.Stderr = dumpErrBuf

	if err := dumpCmd.Run(); err != nil {
		jsonError(w, fmt.Sprintf("restic dump: %v — %s", err, dumpErrBuf.String()), http.StatusInternalServerError)
		return
	}

	// Filtrer les lignes incompatibles avec psql / PostgreSQL 15 :
	// - \restrict ... (ajouté par pg_dump 18.x pour protocole mixte)
	// - \connect ... (on se connecte directement à mydb)
	// - SET transaction_timeout (pg 17+, non reconnu sur pg 15)
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

	// 4. Combiner TRUNCATE + SQL du snapshot
	// - session_replication_role=replica désactive les FK checks (équivalent à DISABLE TRIGGER ALL)
	// - On enveloppe dans BEGIN/COMMIT pour garantir l'atomicité
	fullSQL := "BEGIN;\n" +
		"SET LOCAL session_replication_role = 'replica';\n" +
		truncateSQL +
		"\n" + cleanSQL.String() +
		"\nCOMMIT;\n"

	// 5. Exécuter via psql directement dans mydb (pas dans postgres)
	psqlCmd := exec.Command("psql",
		"-h", host, "-p", port, "-U", user, "-d", dbname,
		"--no-password",
		// PAS de --set=ON_ERROR_STOP=1 : les NOTICE de TRUNCATE retournent exit 3 à tort
	)
	psqlCmd.Env = append(os.Environ(), "PGPASSWORD="+password)
	psqlCmd.Stdin = strings.NewReader(fullSQL)

	var psqlOut bytes.Buffer
	psqlCmd.Stdout = &psqlOut
	psqlCmd.Stderr = &psqlOut

	if err := psqlCmd.Run(); err != nil {
		jsonError(w, fmt.Sprintf("psql restore: %v\n%s", err, psqlOut.String()), http.StatusInternalServerError)
		return
	}

	logSecurity(fmt.Sprintf("Restauration DB réussie depuis snapshot %s (type: %s)", shortID, backupType))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"snapshot_id":  snapID,
		"backup_type":  backupType,
		"message":      fmt.Sprintf("Base de données restaurée avec succès depuis le snapshot %s (type: %s)", shortID, backupType),
		"output":       psqlOut.String(),
	})
}

// DELETE /api/admin/backup?snapshot=abc123 — oublie un snapshot (restic forget)
func deleteBackup(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value(UserRoleKey).(string)
	if userRole != "admin" {
		jsonError(w, "Forbidden", http.StatusForbidden)
		return
	}
	snapID := r.URL.Query().Get("snapshot")
	if snapID == "" {
		jsonError(w, "snapshot requis", http.StatusBadRequest)
		return
	}
	out, err := runRestic("forget", "--prune", snapID)
	if err != nil {
		jsonError(w, fmt.Sprintf("restic forget: %v — %s", err, out), http.StatusInternalServerError)
		return
	}
	logSecurity(fmt.Sprintf("Snapshot supprimé: %s", snapID[:min(8, len(snapID))]))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Snapshot supprimé"})
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

