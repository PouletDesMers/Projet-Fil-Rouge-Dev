package config

import (
	"os"
	"testing"
)

func TestGetEnv_WithValue(t *testing.T) {
	os.Setenv("TEST_MY_KEY", "custom_value")
	defer os.Unsetenv("TEST_MY_KEY")

	got := getEnv("TEST_MY_KEY", "fallback")
	if got != "custom_value" {
		t.Errorf("expected 'custom_value', got '%s'", got)
	}
}

func TestGetEnv_Fallback(t *testing.T) {
	os.Unsetenv("TEST_NONEXISTENT_KEY")

	got := getEnv("TEST_NONEXISTENT_KEY", "default_value")
	if got != "default_value" {
		t.Errorf("expected 'default_value', got '%s'", got)
	}
}

func TestGetEnv_EmptyValue(t *testing.T) {
	os.Unsetenv("TEST_UNSET_KEY")

	got := getEnv("TEST_UNSET_KEY", "fallback")
	if got != "fallback" {
		t.Errorf("expected 'fallback' for unset env var, got '%s'", got)
	}
}

func TestDBEnv_Defaults(t *testing.T) {
	os.Unsetenv("DB_HOST")
	os.Unsetenv("DB_PORT")
	os.Unsetenv("DB_USER")
	os.Unsetenv("DB_PASSWORD")
	os.Unsetenv("DB_NAME")

	host, port, user, password, dbname := DBEnv()

	if host != "localhost" {
		t.Errorf("expected host 'localhost', got '%s'", host)
	}
	if port != "5432" {
		t.Errorf("expected port '5432', got '%s'", port)
	}
	if user != "postgres" {
		t.Errorf("expected user 'postgres', got '%s'", user)
	}
	if password != "password" {
		t.Errorf("expected password 'password', got '%s'", password)
	}
	if dbname != "mydb" {
		t.Errorf("expected dbname 'mydb', got '%s'", dbname)
	}
}
