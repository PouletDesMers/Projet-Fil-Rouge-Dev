package main

import (
	"crypto/rand"
	"encoding/hex"
	"testing"
)

func TestCryptoRandRead(t *testing.T) {
	b := make([]byte, 32)
	n, err := cryptoRandRead(b)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if n != 32 {
		t.Errorf("expected 32 bytes read, got %d", n)
	}
}

func TestCryptoRandRead_ZeroLength(t *testing.T) {
	b := make([]byte, 0)
	n, err := cryptoRandRead(b)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if n != 0 {
		t.Errorf("expected 0 bytes read, got %d", n)
	}
}

func TestEncodeHexStr(t *testing.T) {
	b := []byte{0x00, 0xFF, 0xAB, 0x12}
	got := encodeHexStr(b)
	expected := hex.EncodeToString(b)
	if got != expected {
		t.Errorf("expected %s, got %s", expected, got)
	}
}

func TestEncodeHexStr_Random(t *testing.T) {
	b := make([]byte, 32)
	rand.Read(b)

	got := encodeHexStr(b)
	expected := hex.EncodeToString(b)
	if got != expected {
		t.Errorf("expected %s, got %s", expected, got)
	}
}

func TestEncodeHexStr_Empty(t *testing.T) {
	got := encodeHexStr([]byte{})
	if got != "" {
		t.Errorf("expected empty string, got %s", got)
	}
}
