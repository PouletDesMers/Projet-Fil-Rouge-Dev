package middleware

import (
	"log"
	"net/http"
	"sync"
	"time"
)

type rateLimiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
	max      int
	window   time.Duration
}

func newRateLimiter(max int, window time.Duration) *rateLimiter {
	rl := &rateLimiter{
		attempts: make(map[string][]time.Time),
		max:      max,
		window:   window,
	}
	go func() {
		for {
			time.Sleep(window)
			rl.mu.Lock()
			now := time.Now()
			for ip, timestamps := range rl.attempts {
				var valid []time.Time
				for _, t := range timestamps {
					if now.Sub(t) < rl.window {
						valid = append(valid, t)
					}
				}
				if len(valid) == 0 {
					delete(rl.attempts, ip)
				} else {
					rl.attempts[ip] = valid
				}
			}
			rl.mu.Unlock()
		}
	}()
	return rl
}

func (rl *rateLimiter) isAllowed(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	var valid []time.Time
	for _, t := range rl.attempts[ip] {
		if now.Sub(t) < rl.window {
			valid = append(valid, t)
		}
	}
	if len(valid) >= rl.max {
		rl.attempts[ip] = valid
		return false
	}
	rl.attempts[ip] = append(valid, now)
	return true
}

var (
	LoginLimiter    = newRateLimiter(5, 1*time.Minute)
	RegisterLimiter = newRateLimiter(3, 5*time.Minute)
	APILimiter      = newRateLimiter(100, 1*time.Minute)
	AdminLimiter    = newRateLimiter(600, 1*time.Minute)
)

func GetClientIP(r *http.Request) string {
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		parts := splitFirst(fwd, ',')
		return parts
	}
	return splitFirst(r.RemoteAddr, ':')
}

func splitFirst(s string, sep byte) string {
	for i := 0; i < len(s); i++ {
		if s[i] == sep {
			return s[:i]
		}
	}
	return s
}

func RateLimit(limiter *rateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := GetClientIP(r)
			if !limiter.isAllowed(ip) {
				log.Printf("SECURITY: Rate limit exceeded for IP: %s on %s %s", ip, r.Method, r.URL.Path)
				w.Header().Set("Retry-After", "60")
				http.Error(w, `{"error":"Too many requests. Please try again later."}`, http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

var (
	RateLimitLogin    = RateLimit(LoginLimiter)
	RateLimitRegister = RateLimit(RegisterLimiter)
	RateLimitAPI      = RateLimit(APILimiter)
	RateLimitAdmin    = RateLimit(AdminLimiter)
)
