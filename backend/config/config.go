package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         int
	DatabasePath string
}

func Load() *Config {
	_ = godotenv.Load()

	portStr := os.Getenv("BACKEND_PORT")
	port := 8080
	if p, err := strconv.Atoi(portStr); err == nil && p > 0 {
		port = p
	}

	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "repair.db"
	}

	return &Config{
		Port:         port,
		DatabasePath: dbPath,
	}
}
