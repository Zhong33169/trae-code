package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func Init(dbPath string) error {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建数据目录失败: %w", err)
	}

	db, err := sql.Open("sqlite3", dbPath+"?_foreign_keys=on&_journal_mode=WAL")
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	if err := db.Ping(); err != nil {
		return fmt.Errorf("连接数据库失败: %w", err)
	}

	DB = db

	if err := createTables(); err != nil {
		return fmt.Errorf("创建表失败: %w", err)
	}

	log.Println("数据库初始化成功")
	return nil
}

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		role TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS repair_orders (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		order_no TEXT UNIQUE NOT NULL,
		title TEXT NOT NULL,
		description TEXT NOT NULL,
		contact_name TEXT NOT NULL,
		contact_phone TEXT NOT NULL,
		address TEXT NOT NULL,
		risk_level TEXT NOT NULL DEFAULT 'medium',
		status TEXT NOT NULL DEFAULT 'pending_registration',
		current_stage TEXT NOT NULL DEFAULT 'registration',
		current_handler_id INTEGER,
		registrar_id INTEGER,
		supervisor_id INTEGER,
		reviewer_id INTEGER,
		master_name TEXT,
		master_phone TEXT,
		dispatch_time DATETIME,
		complete_time DATETIME,
		archive_time DATETIME,
		due_date DATETIME NOT NULL,
		priority INTEGER NOT NULL DEFAULT 50,
		version INTEGER NOT NULL DEFAULT 1,
		last_opinion TEXT,
		last_operator TEXT,
		last_operator_role TEXT,
		evidence_count INTEGER NOT NULL DEFAULT 0,
		required_evidences INTEGER NOT NULL DEFAULT 2,
		is_overdue INTEGER NOT NULL DEFAULT 0,
		conflict_note TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (current_handler_id) REFERENCES users(id),
		FOREIGN KEY (registrar_id) REFERENCES users(id),
		FOREIGN KEY (supervisor_id) REFERENCES users(id),
		FOREIGN KEY (reviewer_id) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS evidences (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		order_id INTEGER NOT NULL,
		type TEXT NOT NULL,
		description TEXT NOT NULL,
		uploaded_by INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (order_id) REFERENCES repair_orders(id) ON DELETE CASCADE,
		FOREIGN KEY (uploaded_by) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS operation_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		order_id INTEGER NOT NULL,
		operator_id INTEGER NOT NULL,
		operator_name TEXT NOT NULL,
		operator_role TEXT NOT NULL,
		action TEXT NOT NULL,
		from_status TEXT,
		to_status TEXT,
		opinion TEXT,
		risk_level TEXT,
		version_before INTEGER,
		version_after INTEGER,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (order_id) REFERENCES repair_orders(id) ON DELETE CASCADE,
		FOREIGN KEY (operator_id) REFERENCES users(id)
	);

	CREATE INDEX IF NOT EXISTS idx_orders_status ON repair_orders(status);
	CREATE INDEX IF NOT EXISTS idx_orders_risk ON repair_orders(risk_level);
	CREATE INDEX IF NOT EXISTS idx_orders_stage ON repair_orders(current_stage);
	CREATE INDEX IF NOT EXISTS idx_orders_handler ON repair_orders(current_handler_id);
	CREATE INDEX IF NOT EXISTS idx_orders_priority ON repair_orders(priority, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_logs_order ON operation_logs(order_id, created_at DESC);
	`

	_, err := DB.Exec(schema)
	return err
}

func Close() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}
