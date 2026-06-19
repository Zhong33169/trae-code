package repository

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
)

func InitDB(dbPath string) (*sql.DB, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("创建数据库目录失败: %w", err)
	}

	db, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL")
	if err != nil {
		return nil, fmt.Errorf("打开数据库失败: %w", err)
	}

	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, fmt.Errorf("设置WAL模式失败: %w", err)
	}

	if _, err := db.Exec("PRAGMA foreign_keys=ON"); err != nil {
		return nil, fmt.Errorf("启用外键约束失败: %w", err)
	}

	if err := RunMigrations(db); err != nil {
		return nil, fmt.Errorf("执行数据库迁移失败: %w", err)
	}

	return db, nil
}

func CloseDB(db *sql.DB) {
	if db != nil {
		db.Close()
	}
}

func RunMigrations(db *sql.DB) error {
	migrationSQL, err := os.ReadFile("migrations/init.sql")
	if err != nil {
		return fmt.Errorf("读取迁移文件失败: %w", err)
	}

	if _, err := db.Exec(string(migrationSQL)); err != nil {
		return fmt.Errorf("执行迁移SQL失败: %w", err)
	}

	return nil
}
