package model

import (
	"time"
)

type Role string

const (
	RoleRegistrar    Role = "registrar"
	RoleSupervisor   Role = "supervisor"
	RoleReviewer     Role = "reviewer"
)

type SelectionStatus string

const (
	StatusDraft             SelectionStatus = "draft"
	StatusPending           SelectionStatus = "pending"
	StatusMissingAttachment SelectionStatus = "missing_attachment"
	StatusRejected          SelectionStatus = "rejected"
	StatusApproved          SelectionStatus = "approved"
	StatusArchived          SelectionStatus = "archived"
	StatusTimeout           SelectionStatus = "timeout"
)

type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Role     Role   `json:"role"`
	Name     string `json:"name"`
}

type Attachment struct {
	ID          string    `json:"id"`
	SelectionID string    `json:"selection_id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	URL         string    `json:"url"`
	UploadedBy  string    `json:"uploaded_by"`
	UploadedAt  time.Time `json:"uploaded_at"`
	Rejected    bool      `json:"rejected"`
	RejectReason string   `json:"reject_reason,omitempty"`
	RejectedBy  string    `json:"rejected_by,omitempty"`
	RejectedAt  *time.Time `json:"rejected_at,omitempty"`
}

type AuditLog struct {
	ID          string    `json:"id"`
	SelectionID string    `json:"selection_id"`
	UserID      string    `json:"user_id"`
	UserName    string    `json:"user_name"`
	Action      string    `json:"action"`
	Detail      string    `json:"detail"`
	CreatedAt   time.Time `json:"created_at"`
}

type Selection struct {
	ID                string          `json:"id"`
	ProductName       string          `json:"product_name"`
	ProductCategory   string          `json:"product_category"`
	Brand             string          `json:"brand"`
	Supplier          string          `json:"supplier"`
	EstimatedPrice    float64         `json:"estimated_price"`
	CommissionRate    float64         `json:"commission_rate"`
	PlannedLiveDate   *time.Time      `json:"planned_live_date,omitempty"`
	Description       string          `json:"description"`
	Status            SelectionStatus `json:"status"`
	CreatedBy         string          `json:"created_by"`
	CreatedByName     string          `json:"created_by_name"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
	Deadline          *time.Time      `json:"deadline,omitempty"`
	RejectReason      string          `json:"reject_reason,omitempty"`
	AuditNote         string          `json:"audit_note,omitempty"`
	ProcessResult     string          `json:"process_result,omitempty"`
	Attachments       []Attachment    `json:"attachments,omitempty"`
	AuditLogs         []AuditLog      `json:"audit_logs,omitempty"`
}

type CreateSelectionRequest struct {
	ProductName     string  `json:"product_name"`
	ProductCategory string  `json:"product_category"`
	Brand           string  `json:"brand"`
	Supplier        string  `json:"supplier"`
	EstimatedPrice  float64 `json:"estimated_price"`
	CommissionRate  float64 `json:"commission_rate"`
	Description     string  `json:"description"`
}

type SubmitForReviewRequest struct {
}

type ReviewRequest struct {
	Approved   bool   `json:"approved"`
	Reason     string `json:"reason,omitempty"`
	RejectAttachIDs []string `json:"reject_attach_ids,omitempty"`
	AttachReasons   map[string]string `json:"attach_reasons,omitempty"`
}

type ProcessResultRequest struct {
	Result string `json:"result"`
	Note   string `json:"note,omitempty"`
}

type ReverifyRequest struct {
}

type ArchiveRequest struct {
	Note string `json:"note,omitempty"`
}

type ReturnRequest struct {
	Reason string `json:"reason"`
}

type AddAttachmentRequest struct {
	Name string `json:"name"`
	Type string `json:"type"`
	URL  string `json:"url"`
}
