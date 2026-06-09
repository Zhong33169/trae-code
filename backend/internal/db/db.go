package db

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

func Init(dbPath string) (*sql.DB, error) {
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)", dbPath)

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	if err := createTables(db); err != nil {
		return nil, fmt.Errorf("create tables: %w", err)
	}

	return db, nil
}

func createTables(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL,
		name TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS prescription_transfers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		transfer_no TEXT UNIQUE NOT NULL,
		patient_name TEXT NOT NULL,
		id_card TEXT NOT NULL,
		department TEXT NOT NULL,
		doctor_name TEXT NOT NULL,
		medicine_list TEXT NOT NULL,
		total_amount REAL NOT NULL DEFAULT 0,
		status TEXT NOT NULL DEFAULT 'draft',
		version INTEGER NOT NULL DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS transfer_evidences (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		transfer_id INTEGER NOT NULL,
		evidence_type TEXT NOT NULL,
		operator_id INTEGER NOT NULL,
		operator_name TEXT NOT NULL,
		operator_role TEXT NOT NULL,
		evidence_content TEXT NOT NULL,
		remark TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS batch_operations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		batch_no TEXT UNIQUE NOT NULL,
		operation_type TEXT NOT NULL,
		operator_id INTEGER NOT NULL,
		operator_name TEXT NOT NULL,
		total_count INTEGER NOT NULL DEFAULT 0,
		success_count INTEGER NOT NULL DEFAULT 0,
		fail_count INTEGER NOT NULL DEFAULT 0,
		status TEXT NOT NULL DEFAULT 'processing',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS batch_items (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		batch_id INTEGER NOT NULL,
		transfer_id INTEGER NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		error_message TEXT DEFAULT '',
		result_data TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS audit_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		user_name TEXT NOT NULL,
		role TEXT NOT NULL,
		action TEXT NOT NULL,
		target_type TEXT NOT NULL,
		target_id INTEGER NOT NULL,
		old_value TEXT DEFAULT '',
		new_value TEXT DEFAULT '',
		ip_address TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_transfers_status ON prescription_transfers(status);
	CREATE INDEX IF NOT EXISTS idx_transfers_transfer_no ON prescription_transfers(transfer_no);
	CREATE INDEX IF NOT EXISTS idx_evidences_transfer_id ON transfer_evidences(transfer_id);
	CREATE INDEX IF NOT EXISTS idx_batch_items_batch_id ON batch_items(batch_id);
	CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
	CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_type, target_id);
	`

	_, err := db.Exec(schema)
	return err
}
