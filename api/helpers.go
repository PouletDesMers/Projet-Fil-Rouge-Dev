package main

import (
	"crypto/rand"
	"encoding/hex"
)

func cryptoRandRead(b []byte) (int, error) { return rand.Read(b) }
func encodeHexStr(b []byte) string          { return hex.EncodeToString(b) }
