package models

import "time"

type SamplingTask struct {
	ID              uint      `json:"id" gorm:"primaryKey"`
	TaskNo          string    `json:"task_no" gorm:"uniqueIndex;size:50;not null"`
	ProjectName     string    `json:"project_name" gorm:"size:200;not null"`
	SampleLocation  string    `json:"sample_location" gorm:"size:200;not null"`
	SampleType      string    `json:"sample_type" gorm:"size:50;not null"`
	Status          string    `json:"status" gorm:"size:30;not null;default:pending_review"`
	Version         int       `json:"version" gorm:"not null;default:1"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	RegistrarID     uint      `json:"registrar_id"`
	RegistrarName   string    `json:"registrar_name" gorm:"size:50"`
	SupervisorID    *uint     `json:"supervisor_id"`
	SupervisorName  string    `json:"supervisor_name" gorm:"size:50"`
	ReviewerID      *uint     `json:"reviewer_id"`
	ReviewerName    string    `json:"reviewer_name" gorm:"size:50"`
	RejectReason    string    `json:"reject_reason" gorm:"size:500"`
	ReturnReason    string    `json:"return_reason" gorm:"size:500"`
	Evidences       []Evidence `json:"evidences,omitempty" gorm:"foreignKey:TaskID"`
	Logs            []TaskLog  `json:"logs,omitempty" gorm:"foreignKey:TaskID"`
}
