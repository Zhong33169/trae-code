package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
	"golang.org/x/crypto/bcrypt"
)

var DB *sql.DB

func Init() error {
	dbPath := filepath.Join("database", "app.db")
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create database dir: %w", err)
	}

	var err error
	DB, err = sql.Open("sqlite", dbPath+"?_foreign_keys=on&_journal_mode=WAL")
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	DB.SetMaxOpenConns(1)

	if err := runSchema(); err != nil {
		return fmt.Errorf("failed to run schema: %w", err)
	}

	var count int
	err = DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check seed: %w", err)
	}
	if count == 0 {
		if err := runSeed(); err != nil {
			return fmt.Errorf("failed to run seed: %w", err)
		}
	}

	if err := ensureTestPasswords(); err != nil {
		return fmt.Errorf("failed to reset test passwords: %w", err)
	}

	return nil
}

func runSchema() error {
	schemaPath := filepath.Join("database", "schema.sql")
	data, err := os.ReadFile(schemaPath)
	if err != nil {
		return fmt.Errorf("failed to read schema.sql: %w", err)
	}
	_, err = DB.Exec(string(data))
	return err
}

func hashPassword(pwd string) string {
	h, _ := bcrypt.GenerateFromPassword([]byte(pwd), bcrypt.DefaultCost)
	return string(h)
}

func ensureTestPasswords() error {
	pwdHash := hashPassword("123456")
	users := []string{"initiator1", "handler1", "reviewer1", "admin"}
	for _, u := range users {
		_, err := DB.Exec(
			"UPDATE users SET password = ? WHERE username = ?",
			pwdHash, u,
		)
		if err != nil {
			return fmt.Errorf("failed to update user %s password: %w", u, err)
		}
	}
	return nil
}

func runSeed() error {
	seedPath := filepath.Join("database", "seed.sql")
	data, err := os.ReadFile(seedPath)
	if err != nil {
		return fmt.Errorf("failed to read seed.sql: %w", err)
	}
	_, err = DB.Exec(string(data))
	return err
}
