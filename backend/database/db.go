package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB(dbPath string) error {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("create db directory: %w", err)
	}

	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}

	DB.SetMaxOpenConns(1)

	if err := createTables(); err != nil {
		return fmt.Errorf("create tables: %w", err)
	}

	return nil
}

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		display_name TEXT NOT NULL,
		role TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS orders (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		order_no TEXT UNIQUE NOT NULL,
		product_name TEXT NOT NULL,
		supplier TEXT NOT NULL,
		temperature_range TEXT NOT NULL,
		storage_location TEXT NOT NULL,
		risk_level TEXT NOT NULL DEFAULT 'low',
		status TEXT NOT NULL DEFAULT 'registered',
		current_handler_id INTEGER NOT NULL,
		version INTEGER NOT NULL DEFAULT 1,
		created_by INTEGER NOT NULL,
		evidence_temperature INTEGER NOT NULL DEFAULT 0,
		evidence_quality INTEGER NOT NULL DEFAULT 0,
		evidence_quantity INTEGER NOT NULL DEFAULT 0,
		notes TEXT DEFAULT '',
		created_at DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
		updated_at DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
		FOREIGN KEY (current_handler_id) REFERENCES users(id),
		FOREIGN KEY (created_by) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS operation_records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		order_id INTEGER NOT NULL,
		handler_id INTEGER NOT NULL,
		handler_name TEXT NOT NULL,
		handler_role TEXT NOT NULL,
		action TEXT NOT NULL,
		opinion TEXT DEFAULT '',
		result TEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
		FOREIGN KEY (order_id) REFERENCES orders(id),
		FOREIGN KEY (handler_id) REFERENCES users(id)
	);

	CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
	CREATE INDEX IF NOT EXISTS idx_orders_risk_level ON orders(risk_level);
	CREATE INDEX IF NOT EXISTS idx_orders_current_handler ON orders(current_handler_id);
	CREATE INDEX IF NOT EXISTS idx_operation_records_order ON operation_records(order_id);
	`

	_, err := DB.Exec(schema)
	return err
}
