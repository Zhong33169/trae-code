package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB(dbPath string) (*sql.DB, error) {
	if dbPath == "" {
		dbPath = "./data/repair.db"
	}

	dir := "./data"
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("创建数据目录失败: %w", err)
		}
	}

	dsn := fmt.Sprintf("%s?_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("连接数据库失败: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("数据库连接测试失败: %w", err)
	}

	DB = db
	log.Println("SQLite 数据库连接成功")
	return db, nil
}

func CreateTables(db *sql.DB) error {
	schemas := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			real_name TEXT NOT NULL,
			role TEXT NOT NULL,
			phone TEXT DEFAULT '',
			shift TEXT DEFAULT 'morning',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS repair_quotes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			quote_no TEXT UNIQUE NOT NULL,
			customer_name TEXT NOT NULL,
			customer_phone TEXT NOT NULL,
			device_type TEXT NOT NULL,
			device_model TEXT DEFAULT '',
			fault_description TEXT DEFAULT '',
			status TEXT NOT NULL DEFAULT 'draft',
			current_handler_id INTEGER DEFAULT 0,
			current_handler TEXT DEFAULT '',
			shift TEXT DEFAULT 'morning',
			estimate_amount REAL DEFAULT 0,
			actual_amount REAL DEFAULT 0,
			payment_status TEXT DEFAULT 'unpaid',
			payment_method TEXT DEFAULT '',
			quote_detail TEXT DEFAULT '',
			confirmed_at DATETIME,
			paid_at DATETIME,
			completed_at DATETIME,
			assigned_technician_id INTEGER DEFAULT 0,
			assigned_technician TEXT DEFAULT '',
			creator_id INTEGER NOT NULL,
			creator_name TEXT NOT NULL,
			handover_count INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS operation_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			quote_id INTEGER NOT NULL,
			operation TEXT NOT NULL,
			old_status TEXT DEFAULT '',
			new_status TEXT DEFAULT '',
			operator_id INTEGER NOT NULL,
			operator_name TEXT NOT NULL,
			operator_role TEXT NOT NULL,
			remark TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (quote_id) REFERENCES repair_quotes(id) ON DELETE CASCADE
		)`,

		`CREATE TABLE IF NOT EXISTS shift_handovers (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			quote_id INTEGER NOT NULL,
			from_user_id INTEGER NOT NULL,
			from_user_name TEXT NOT NULL,
			from_user_role TEXT NOT NULL,
			from_shift TEXT NOT NULL,
			to_user_id INTEGER NOT NULL,
			to_user_name TEXT NOT NULL,
			to_user_role TEXT NOT NULL,
			to_shift TEXT NOT NULL,
			handover_remark TEXT DEFAULT '',
			confirmed_at DATETIME,
			status TEXT DEFAULT 'pending',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (quote_id) REFERENCES repair_quotes(id) ON DELETE CASCADE
		)`,

		`CREATE INDEX IF NOT EXISTS idx_quotes_status ON repair_quotes(status)`,
		`CREATE INDEX IF NOT EXISTS idx_quotes_handler ON repair_quotes(current_handler_id)`,
		`CREATE INDEX IF NOT EXISTS idx_quotes_shift ON repair_quotes(shift)`,
		`CREATE INDEX IF NOT EXISTS idx_logs_quote ON operation_logs(quote_id)`,
		`CREATE INDEX IF NOT EXISTS idx_handovers_quote ON shift_handovers(quote_id)`,
		`CREATE INDEX IF NOT EXISTS idx_handovers_status ON shift_handovers(status)`,
	}

	for _, schema := range schemas {
		if _, err := db.Exec(schema); err != nil {
			return fmt.Errorf("创建表失败: %w, SQL: %s", err, schema)
		}
	}

	log.Println("数据库表初始化完成")
	return nil
}
