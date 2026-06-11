package models

import (
	"time"
)

type Role string

const (
	RoleClerk        Role = "clerk"
	RoleForeman      Role = "foreman"
	RoleManager      Role = "manager"
)

type SubcontractStatus string

const (
	StatusDraft         SubcontractStatus = "draft"
	StatusPendingClerk  SubcontractStatus = "pending_clerk"
	StatusPendingForeman SubcontractStatus = "pending_foreman"
	StatusPendingManager SubcontractStatus = "pending_manager"
	StatusVerified      SubcontractStatus = "verified"
	StatusRejected      SubcontractStatus = "rejected"
	StatusArchived      SubcontractStatus = "archived"
)

type EvidenceType string

const (
	EvidenceRegistration EvidenceType = "registration"
	EvidenceInspection   EvidenceType = "inspection"
	EvidenceArchive      EvidenceType = "archive"
)

type User struct {
	ID       string    `json:"id"`
	Username string    `json:"username"`
	Password string    `json:"-"`
	Name     string    `json:"name"`
	Role     Role      `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type SubcontractForm struct {
	ID                string             `json:"id"`
	Code              string             `json:"code"`
	SubcontractorName string             `json:"subcontractor_name"`
	ProjectName       string             `json:"project_name"`
	EntryDate         time.Time          `json:"entry_date"`
	WorkersCount      int                `json:"workers_count"`
	WorkContent       string             `json:"work_content"`
	Status            SubcontractStatus  `json:"status"`
	Version           int                `json:"version"`
	CreatedBy         string             `json:"created_by"`
	CreatedAt         time.Time          `json:"created_at"`
	UpdatedAt         time.Time          `json:"updated_at"`
	CurrentHandler    string             `json:"current_handler"`
	RejectReason      string             `json:"reject_reason,omitempty"`
}

type Evidence struct {
	ID              string       `json:"id"`
	FormID          string       `json:"form_id"`
	Type            EvidenceType `json:"type"`
	Name            string       `json:"name"`
	UploadedBy      string       `json:"uploaded_by"`
	UploadedAt      time.Time    `json:"uploaded_at"`
	IsSupplemental  bool         `json:"is_supplemental"`
	SupplementNote  string       `json:"supplement_note,omitempty"`
}

type SupplementRecord struct {
	ID          string            `json:"id"`
	FormID      string            `json:"form_id"`
	PerformedBy string            `json:"performed_by"`
	PerformedAt time.Time         `json:"performed_at"`
	Action      string            `json:"action"`
	Details     map[string]string `json:"details"`
	Reason      string            `json:"reason,omitempty"`
}

type AuditLog struct {
	ID        string    `json:"id"`
	FormID    string    `json:"form_id"`
	UserID    string    `json:"user_id"`
	Action    string    `json:"action"`
	FromStatus string   `json:"from_status"`
	ToStatus  string    `json:"to_status"`
	Timestamp time.Time `json:"timestamp"`
	Details   string    `json:"details"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type CreateFormRequest struct {
	SubcontractorName string `json:"subcontractor_name"`
	ProjectName       string `json:"project_name"`
	EntryDate         string `json:"entry_date"`
	WorkersCount      int    `json:"workers_count"`
	WorkContent       string `json:"work_content"`
}

type ProcessFormRequest struct {
	FormID     string            `json:"form_id"`
	ExpectedVersion int           `json:"expected_version"`
	Action     string            `json:"action"`
	Reason     string            `json:"reason,omitempty"`
	EvidenceIDs []string         `json:"evidence_ids,omitempty"`
	Details    map[string]string `json:"details,omitempty"`
}

type BatchProcessRequest struct {
	FormIDs []string `json:"form_ids"`
	Action  string   `json:"action"`
	Reason  string   `json:"reason,omitempty"`
}

type UploadEvidenceRequest struct {
	FormID         string       `json:"form_id"`
	Type           EvidenceType `json:"type"`
	Name           string       `json:"name"`
	IsSupplemental bool         `json:"is_supplemental"`
	SupplementNote string       `json:"supplement_note,omitempty"`
}

type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Reason  string `json:"reason,omitempty"`
}
