package middleware

import "testing"

func TestIsValidEmail(t *testing.T) {
	valid := []string{
		"user@example.com",
		"firstname.lastname@domain.org",
		"a@b.io",
	}
	invalid := []string{
		"",
		"notanemail",
		"@nodomain.com",
		"no-at-sign",
		"missing@dot",
		"x@y.",
	}

	for _, email := range valid {
		if !IsValidEmail(email) {
			t.Errorf("expected valid, got invalid for %q", email)
		}
	}
	for _, email := range invalid {
		if IsValidEmail(email) {
			t.Errorf("expected invalid, got valid for %q", email)
		}
	}
}

func TestIsValidPassword(t *testing.T) {
	valid := []string{
		"Password1",
		"SecurePass99",
		"Abcdef1!",
	}
	invalid := []string{
		"",
		"short1A",
		"alllowercase1",
		"ALLUPPERCASE1",
		"NoDigitPass",
	}

	for _, pwd := range valid {
		if !IsValidPassword(pwd) {
			t.Errorf("expected valid, got invalid for %q", pwd)
		}
	}
	for _, pwd := range invalid {
		if IsValidPassword(pwd) {
			t.Errorf("expected invalid, got valid for %q", pwd)
		}
	}
}

func TestSanitizeString(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"  hello  ", "hello"},
		{"<script>", "&lt;script&gt;"},
		{`"quoted"`, "&quot;quoted&quot;"},
		{"it's", "it&#39;s"},
		{"normal text", "normal text"},
	}

	for _, tt := range tests {
		got := SanitizeString(tt.input)
		if got != tt.want {
			t.Errorf("SanitizeString(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}
