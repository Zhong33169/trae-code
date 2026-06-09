package config

import "os"

type Config struct {
	Port   int
	DBPath string
}

func Load() *Config {
	port := 8002
	if p := getEnvInt("BACKEND_PORT"); p > 0 {
		port = p
	}

	dbPath := "data/consultation.db"
	if d := os.Getenv("DB_PATH"); d != "" {
		dbPath = d
	}

	return &Config{
		Port:   port,
		DBPath: dbPath,
	}
}

func getEnvInt(key string) int {
	val := os.Getenv(key)
	if val == "" {
		return 0
	}
	n := 0
	for _, c := range val {
		if c >= '0' && c <= '9' {
			n = n*10 + int(c-'0')
		} else {
			return 0
		}
	}
	return n
}
