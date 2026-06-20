package db

import (
	"log"
	"news-clue-backend/internal/models"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Init(dbPath string) error {
	var err error
	dsn := dbPath + "?_journal=WAL&_timeout=10000&_busy_timeout=10000&_txlock=immediate"
	DB, err = gorm.Open(sqlite.Open(dsn), &gorm.Config{
		PrepareStmt:            true,
		SkipDefaultTransaction: false,
	})
	if err != nil {
		return err
	}
	sqlDB, err := DB.DB()
	if err == nil {
		sqlDB.SetMaxOpenConns(5)
		sqlDB.SetMaxIdleConns(3)
		sqlDB.SetConnMaxLifetime(time.Hour)
		sqlDB.SetConnMaxIdleTime(10 * time.Minute)
	}
	log.Println("SQLite 已连接 (WAL模式+IMMEDIATE锁):", dbPath)

	err = DB.AutoMigrate(
		&models.User{},
		&models.NewsClue{},
		&models.Evidence{},
		&models.OperationLog{},
		&models.AppealRecord{},
	)
	if err != nil {
		return err
	}
	log.Println("数据库表迁移完成")
	return nil
}
