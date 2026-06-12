package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port        int
	DBPath      string
	FrontendURL string
}

func Load() *Config {
	port := 51010
	if p := os.Getenv("PORT"); p != "" {
		if parsed, err := strconv.Atoi(p); err == nil {
			if parsed > 0 && parsed <= 65535 {
				port = parsed
			}
		}
	}

	dbPath := "./data/repair.db"
	if d := os.Getenv("DB_PATH"); d != "" {
		dbPath = d
	}

	frontendURL := "http://localhost:31010"
	if f := os.Getenv("FRONTEND_URL"); f != "" {
		frontendURL = f
	}

	return &Config{
		Port:        port,
		DBPath:      dbPath,
		FrontendURL: frontendURL,
	}
}
