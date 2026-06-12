package models

import "time"

type Evidence struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	TaskID      uint      `json:"task_id" gorm:"index;not null"`
	Type        string    `json:"type" gorm:"size:20;not null"`
	Title       string    `json:"title" gorm:"size:200;not null"`
	Description string    `json:"description" gorm:"size:1000"`
	FileURL     string    `json:"file_url" gorm:"size:500"`
	UploadedBy  string    `json:"uploaded_by" gorm:"size:50"`
	UploadedAt  time.Time `json:"uploaded_at"`
}
