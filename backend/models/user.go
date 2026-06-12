package models

import "time"

type User struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	Username     string    `json:"username" gorm:"uniqueIndex;size:50;not null"`
	PasswordHash string    `json:"-" gorm:"size:255;not null"`
	Role         string    `json:"role" gorm:"size:20;not null"`
	Name         string    `json:"name" gorm:"size:50;not null"`
	CreatedAt    time.Time `json:"created_at"`
}
