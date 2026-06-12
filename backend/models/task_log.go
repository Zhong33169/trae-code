package models

import "time"

type TaskLog struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	TaskID       uint      `json:"task_id" gorm:"index;not null"`
	Action       string    `json:"action" gorm:"size:50;not null"`
	OperatorID   uint      `json:"operator_id"`
	OperatorName string    `json:"operator_name" gorm:"size:50"`
	OperatorRole string    `json:"operator_role" gorm:"size:20"`
	Remark       string    `json:"remark" gorm:"size:1000"`
	CreatedAt    time.Time `json:"created_at"`
}
