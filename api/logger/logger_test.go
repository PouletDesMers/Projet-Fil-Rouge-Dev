package logger

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestMemoryLogger_Log(t *testing.T) {
	ml := &MemoryLogger{entries: make([]LogEntry, 0, maxLogEntries)}
	ml.Log(LogLevelINFO, "test message")

	if ml.counter != 1 {
		t.Errorf("expected counter 1, got %d", ml.counter)
	}
	if len(ml.entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(ml.entries))
	}
	if ml.entries[0].Level != LogLevelINFO {
		t.Errorf("expected level INFO, got %s", ml.entries[0].Level)
	}
	if ml.entries[0].Message != "test message" {
		t.Errorf("expected message 'test message', got '%s'", ml.entries[0].Message)
	}
	if ml.entries[0].Timestamp == "" {
		t.Error("expected non-empty timestamp")
	}
}

func TestMemoryLogger_LogRequest(t *testing.T) {
	ml := &MemoryLogger{entries: make([]LogEntry, 0, maxLogEntries)}
	ml.LogRequest(LogLevelWARN, "GET", "/api/test", "127.0.0.1", 1, 404, 100*time.Millisecond, "not found")

	if len(ml.entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(ml.entries))
	}
	e := ml.entries[0]
	if e.Level != LogLevelWARN {
		t.Errorf("expected WARN, got %s", e.Level)
	}
	if e.Method != "GET" || e.Path != "/api/test" || e.IP != "127.0.0.1" {
		t.Error("request fields mismatch")
	}
	if e.Status != 404 || e.UserID != 1 {
		t.Error("status/userID fields mismatch")
	}
	if e.Duration != "100ms" || e.DurationMs != 100 {
		t.Errorf("duration mismatch: %s / %d", e.Duration, e.DurationMs)
	}
}

func TestMemoryLogger_LogLevels(t *testing.T) {
	ml := &MemoryLogger{entries: make([]LogEntry, 0, maxLogEntries)}
	levels := []LogLevel{LogLevelDEBUG, LogLevelINFO, LogLevelWARN, LogLevelERROR, LogLevelSECURITY}

	for _, lvl := range levels {
		ml.Log(lvl, "test")
	}

	if ml.counter != 5 {
		t.Errorf("expected 5 logs, got %d", ml.counter)
	}
	for i, lvl := range levels {
		if ml.entries[i].Level != lvl {
			t.Errorf("entry %d: expected level %s, got %s", i, lvl, ml.entries[i].Level)
		}
	}
}

func TestMemoryLogger_RamQuery_NoFilter(t *testing.T) {
	ml := &MemoryLogger{entries: make([]LogEntry, 0, maxLogEntries)}
	ml.Log(LogLevelINFO, "msg1")
	ml.Log(LogLevelWARN, "msg2")
	ml.Log(LogLevelERROR, "msg3")

	results := ml.RamQuery("", "", 10)
	if len(results) != 3 {
		t.Errorf("expected 3 results, got %d", len(results))
	}
}

func TestMemoryLogger_RamQuery_FilterByLevel(t *testing.T) {
	ml := &MemoryLogger{entries: make([]LogEntry, 0, maxLogEntries)}
	ml.Log(LogLevelINFO, "info msg")
	ml.Log(LogLevelWARN, "warn msg")
	ml.Log(LogLevelERROR, "error msg")

	results := ml.RamQuery("ERROR", "", 10)
	if len(results) != 1 {
		t.Fatalf("expected 1 ERROR result, got %d", len(results))
	}
	if results[0].Message != "error msg" {
		t.Errorf("expected 'error msg', got '%s'", results[0].Message)
	}
}

func TestMemoryLogger_RamQuery_FilterBySearch(t *testing.T) {
	ml := &MemoryLogger{entries: make([]LogEntry, 0, maxLogEntries)}
	ml.Log(LogLevelINFO, "user login success")
	ml.Log(LogLevelWARN, "failed login attempt")
	ml.Log(LogLevelERROR, "database error")

	results := ml.RamQuery("", "login", 10)
	if len(results) != 2 {
		t.Errorf("expected 2 results matching 'login', got %d", len(results))
	}
}

func TestMemoryLogger_RamQuery_SearchByPath(t *testing.T) {
	ml := &MemoryLogger{entries: make([]LogEntry, 0, maxLogEntries)}
	ml.LogRequest(LogLevelINFO, "GET", "/api/users", "::1", 0, 200, 0, "ok")
	ml.LogRequest(LogLevelINFO, "POST", "/api/login", "::1", 1, 200, 0, "ok")

	results := ml.RamQuery("", "/api/users", 10)
	if len(results) != 1 {
		t.Errorf("expected 1 result matching '/api/users', got %d", len(results))
	}
}

func TestMemoryLogger_RamQuery_SearchByIP(t *testing.T) {
	ml := &MemoryLogger{entries: make([]LogEntry, 0, maxLogEntries)}
	ml.LogRequest(LogLevelINFO, "GET", "/", "10.0.0.1", 0, 200, 0, "ok")
	ml.LogRequest(LogLevelINFO, "GET", "/", "10.0.0.2", 0, 200, 0, "ok")

	results := ml.RamQuery("", "10.0.0.1", 10)
	if len(results) != 1 {
		t.Errorf("expected 1 result for IP 10.0.0.1, got %d", len(results))
	}
}

func TestMemoryLogger_RamQuery_Limit(t *testing.T) {
	ml := &MemoryLogger{entries: make([]LogEntry, 0, maxLogEntries)}
	for i := 0; i < 10; i++ {
		ml.Log(LogLevelINFO, "msg")
	}

	results := ml.RamQuery("", "", 3)
	if len(results) != 3 {
		t.Errorf("expected 3 results (limited), got %d", len(results))
	}
}

func TestMemoryLogger_RamQuery_LevelAll(t *testing.T) {
	ml := &MemoryLogger{entries: make([]LogEntry, 0, maxLogEntries)}
	ml.Log(LogLevelINFO, "info msg")
	ml.Log(LogLevelWARN, "warn msg")

	results := ml.RamQuery("ALL", "", 10)
	if len(results) != 2 {
		t.Errorf("expected 2 results for 'ALL' level, got %d", len(results))
	}
}

func TestMemoryLogger_RamStats(t *testing.T) {
	ml := &MemoryLogger{entries: make([]LogEntry, 0, maxLogEntries)}
	ml.Log(LogLevelINFO, "i1")
	ml.Log(LogLevelINFO, "i2")
	ml.Log(LogLevelWARN, "w1")
	ml.Log(LogLevelERROR, "e1")

	stats := ml.RamStats()
	if stats["total"] != 4 {
		t.Errorf("expected total 4, got %d", stats["total"])
	}
	if stats["INFO"] != 2 {
		t.Errorf("expected INFO count 2, got %d", stats["INFO"])
	}
	if stats["WARN"] != 1 {
		t.Errorf("expected WARN count 1, got %d", stats["WARN"])
	}
	if stats["ERROR"] != 1 {
		t.Errorf("expected ERROR count 1, got %d", stats["ERROR"])
	}
}

func TestMemoryLogger_RingBufferLimit(t *testing.T) {
	ml := &MemoryLogger{entries: make([]LogEntry, 0, maxLogEntries)}
	for i := 0; i < maxLogEntries+10; i++ {
		ml.Log(LogLevelINFO, "msg")
	}

	if len(ml.entries) != maxLogEntries {
		t.Errorf("expected %d entries (ring buffer cap), got %d", maxLogEntries, len(ml.entries))
	}
	if ml.counter != int64(maxLogEntries+10) {
		t.Errorf("expected counter %d, got %d", maxLogEntries+10, ml.counter)
	}
}

func TestMemoryLogger_LogLevelConstants(t *testing.T) {
	if LogLevelDEBUG != "DEBUG" {
		t.Errorf("expected DEBUG, got %s", LogLevelDEBUG)
	}
	if LogLevelINFO != "INFO" {
		t.Errorf("expected INFO, got %s", LogLevelINFO)
	}
	if LogLevelWARN != "WARN" {
		t.Errorf("expected WARN, got %s", LogLevelWARN)
	}
	if LogLevelERROR != "ERROR" {
		t.Errorf("expected ERROR, got %s", LogLevelERROR)
	}
	if LogLevelSECURITY != "SECURITY" {
		t.Errorf("expected SECURITY, got %s", LogLevelSECURITY)
	}
}

func TestInitLogFile(t *testing.T) {
	tmpDir := t.TempDir()
	logPath := filepath.Join(tmpDir, "test.log")
	os.Setenv("LOG_FILE_PATH", logPath)
	defer os.Unsetenv("LOG_FILE_PATH")

	InitLogFile()
	defer FlushLogFile()

	if logFile == nil {
		t.Fatal("expected logFile to be non-nil after InitLogFile")
	}
	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		t.Error("expected log file to exist")
	}
}

func TestWriteToFile(t *testing.T) {
	tmpDir := t.TempDir()
	logPath := filepath.Join(tmpDir, "write.log")
	os.Setenv("LOG_FILE_PATH", logPath)
	defer os.Unsetenv("LOG_FILE_PATH")

	InitLogFile()
	defer FlushLogFile()

	entry := LogEntry{Level: LogLevelINFO, Message: "file test", Timestamp: "2024-01-01T00:00:00Z"}
	writeToFile(entry)

	data, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "file test") {
		t.Errorf("expected log file to contain 'file test', got: %s", string(data))
	}
	if !strings.Contains(string(data), "INFO") {
		t.Errorf("expected log file to contain 'INFO', got: %s", string(data))
	}
}

func TestFlushLogFile(t *testing.T) {
	tmpDir := t.TempDir()
	logPath := filepath.Join(tmpDir, "flush.log")
	os.Setenv("LOG_FILE_PATH", logPath)
	defer os.Unsetenv("LOG_FILE_PATH")

	InitLogFile()
	FlushLogFile()

	if logFile != nil {
		t.Error("expected logFile to be nil after FlushLogFile")
	}
}
