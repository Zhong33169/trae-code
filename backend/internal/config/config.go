package config

import (
	"os"
)

type Config struct {
	Port       string
	JWTSecret  string
	DBPath     string
	FEBaseURL  string
}

func Load() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8002"
	}
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "news-clue-super-secret-key-2024"
	}
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./news_clue.db"
	}
	feBaseURL := os.Getenv("FE_BASE_URL")
	if feBaseURL == "" {
		feBaseURL = "http://localhost:3002"
	}
	return &Config{
		Port:      port,
		JWTSecret: jwtSecret,
		DBPath:    dbPath,
		FEBaseURL: feBaseURL,
	}
}
