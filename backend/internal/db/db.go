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
	dsn := dbPath + "?_journal=WAL&_timeout=5000&_busy_timeout=5000"
	DB, err = gorm.Open(sqlite.Open(dsn), &gorm.Config{
		PrepareStmt:            true,
		SkipDefaultTransaction: true,
	})
	if err != nil {
		return err
	}
	sqlDB, err := DB.DB()
	if err == nil {
		sqlDB.SetMaxOpenConns(1)
		sqlDB.SetMaxIdleConns(1)
		sqlDB.SetConnMaxLifetime(time.Hour)
	}
	log.Println("SQLite 已连接 (WAL模式):", dbPath)

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
