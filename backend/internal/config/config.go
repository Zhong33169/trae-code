package config

import (
	"fmt"
	"os"
)

type Config struct {
	ServerPort      string
	FrontendPort    string
	DBPath          string
	CORSAllowOrigin string
}

func Load() *Config {
	serverPort := getEnv("BACKEND_PORT", "8004")
	frontendPort := getEnv("FRONTEND_PORT", "3004")
	dbPath := getEnv("DB_PATH", "./data/knowledge_revision.db")
	corsOrigin := fmt.Sprintf("http://localhost:%s", frontendPort)

	return &Config{
		ServerPort:      serverPort,
		FrontendPort:    frontendPort,
		DBPath:          dbPath,
		CORSAllowOrigin: corsOrigin,
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
