package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

var DB *sql.DB

func InitDB(dbPath string) error {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建数据库目录失败: %w", err)
	}

	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_foreign_keys=on&_journal_mode=WAL")
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}

	DB.SetMaxOpenConns(1)
	DB.SetMaxIdleConns(1)
	DB.SetConnMaxLifetime(time.Hour)

	if err = runMigrations(); err != nil {
		return fmt.Errorf("执行迁移失败: %w", err)
	}

	if err = seedInitialData(); err != nil {
		return fmt.Errorf("初始化数据失败: %w", err)
	}

	return nil
}

func runMigrations() error {
	schemaPath := filepath.Join("db", "schema.sql")
	sqlBytes, err := os.ReadFile(schemaPath)
	if err != nil {
		return fmt.Errorf("读取schema文件失败: %w", err)
	}

	_, err = DB.Exec(string(sqlBytes))
	return err
}

func seedInitialData() error {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	users := []struct {
		username string
		password string
		realName string
		role     string
	}{
		{"hr01", "123456", "张三", "hr_specialist"},
		{"salary01", "123456", "李四", "salary_supervisor"},
		{"hrbp01", "123456", "王五", "hrbp_leader"},
	}

	for _, u := range users {
		hashed, err := bcrypt.GenerateFromPassword([]byte(u.password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		_, err = DB.Exec(
			"INSERT INTO users (username, password, real_name, role) VALUES (?, ?, ?, ?)",
			u.username, string(hashed), u.realName, u.role,
		)
		if err != nil {
			return err
		}
	}

	employees := []struct {
		no       string
		name     string
		dept     string
		position string
		salary   float64
	}{
		{"E001", "赵六", "技术部", "前端工程师", 15000},
		{"E002", "孙七", "市场部", "市场专员", 12000},
		{"E003", "周八", "人事部", "招聘专员", 10000},
		{"E004", "吴九", "财务部", "会计", 13000},
	}

	for _, e := range employees {
		_, err = DB.Exec(
			"INSERT INTO employees (employee_no, name, department, position, current_salary) VALUES (?, ?, ?, ?, ?)",
			e.no, e.name, e.dept, e.position, e.salary,
		)
		if err != nil {
			return err
		}
	}

	return nil
}
