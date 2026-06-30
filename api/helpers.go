package main

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"os"
	"strings"
)

func cryptoRandRead(b []byte) (int, error) { return rand.Read(b) }
func encodeHexStr(b []byte) string          { return hex.EncodeToString(b) }

// loadEnv lit un fichier .env et définit les variables d'environnement.
// Ignore silencieusement les erreurs (fichier absent, lignes mal formées).
func loadEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		// Enlever les guillemets éventuels
		val = strings.Trim(val, `"'`)
		if key != "" && os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
}
