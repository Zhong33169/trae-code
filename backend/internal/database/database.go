package database

import (
	"log"
	"repair-system/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Init(dbPath string) (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, err
	}

	DB = db

	err = db.AutoMigrate(
		&models.User{},
		&models.RepairOrder{},
		&models.OrderOperation{},
	)
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
		return nil, err
	}

	log.Println("Database migrated successfully")
	return db, nil
}

func GetDB() *gorm.DB {
	return DB
}
