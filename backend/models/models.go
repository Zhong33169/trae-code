package models

import (
	"time"
)

type Role string

const (
	RoleAdmission Role = "admission"
	RoleAcademic  Role = "academic"
	RoleAdmin     Role = "admin"
)

type EnrollmentStatus string

const (
	StatusDraft            EnrollmentStatus = "draft"
	StatusPendingVerify    EnrollmentStatus = "pending_verify"
	StatusPendingCorrection EnrollmentStatus = "pending_correction"
	StatusPendingReview    EnrollmentStatus = "pending_review"
	StatusArchived         EnrollmentStatus = "archived"
	StatusRejected         EnrollmentStatus = "rejected"
)

type AttachmentStatus string

const (
	AttachPending  AttachmentStatus = "pending"
	AttachApproved AttachmentStatus = "approved"
	AttachRejected AttachmentStatus = "rejected"
)

type User struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Username string `gorm:"uniqueIndex" json:"username"`
	Name     string `json:"name"`
	Role     Role   `json:"role"`
	Password string `json:"-"`
}

type Enrollment struct {
	ID              uint             `gorm:"primaryKey" json:"id"`
	StudentName     string           `json:"student_name"`
	IDCard          string           `json:"id_card"`
	Phone           string           `json:"phone"`
	Major           string           `json:"major"`
	Status          EnrollmentStatus `json:"status"`
	CreatedBy       uint             `json:"created_by"`
	CreatedByName   string           `json:"created_by_name"`
	Deadline        *time.Time       `json:"deadline"`
	IsOverdue       bool             `gorm:"-" json:"is_overdue"`
	RejectReason    string           `json:"reject_reason"`
	AdminRemark     string           `json:"admin_remark"`
	AuditRemark     string           `json:"audit_remark"`
	Attachments     []Attachment     `json:"attachments,omitempty"`
	AuditLogs       []AuditLog       `json:"audit_logs,omitempty"`
	CreatedAt       time.Time        `json:"created_at"`
	UpdatedAt       time.Time        `json:"updated_at"`
}

type Attachment struct {
	ID           uint             `gorm:"primaryKey" json:"id"`
	EnrollmentID uint             `json:"enrollment_id"`
	Name         string           `json:"name"`
	Type         string           `json:"type"`
	FileKey      string           `json:"file_key"`
	Status       AttachmentStatus `json:"status"`
	RejectReason string           `json:"reject_reason"`
	UploadedBy   uint             `json:"uploaded_by"`
	UploadedByName string         `json:"uploaded_by_name"`
	CreatedAt    time.Time        `json:"created_at"`
	UpdatedAt    time.Time        `json:"updated_at"`
}

type AuditLog struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	EnrollmentID uint      `json:"enrollment_id"`
	UserID       uint      `json:"user_id"`
	UserName     string    `json:"user_name"`
	UserRole     string    `json:"user_role"`
	Action       string    `json:"action"`
	Reason       string    `json:"reason"`
	FromStatus   string    `json:"from_status"`
	ToStatus     string    `json:"to_status"`
	CreatedAt    time.Time  `json:"created_at"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	User  User   `json:"user"`
	Token string `json:"token"`
}

type EnrollmentCreate struct {
	StudentName string `json:"student_name" binding:"required"`
	IDCard      string `json:"id_card" binding:"required"`
	Phone       string `json:"phone" binding:"required"`
	Major       string `json:"major" binding:"required"`
}

type EnrollmentSubmit struct {
	EnrollmentID uint `json:"enrollment_id" binding:"required"`
}

type VerifyRequest struct {
	EnrollmentID uint   `json:"enrollment_id" binding:"required"`
	Pass         bool   `json:"pass"`
	Reason       string `json:"reason"`
}

type ReviewRequest struct {
	EnrollmentID uint   `json:"enrollment_id" binding:"required"`
	Pass         bool   `json:"pass"`
	Reason       string `json:"reason"`
	Remark       string `json:"remark"`
}

type AttachmentReject struct {
	AttachmentID uint   `json:"attachment_id" binding:"required"`
	Reason       string `json:"reason" binding:"required"`
}

type BatchResult struct {
	ID      uint   `json:"id"`
	Success bool   `json:"success"`
	Message string `json:"message"`
}
