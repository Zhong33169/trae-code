package models

import (
	"database/sql"
	"time"
)

type UserRole string

const (
	RoleRegistrar  UserRole = "registrar"
	RoleSupervisor UserRole = "supervisor"
	RoleReviewer   UserRole = "reviewer"
)

type OrderStatus string

const (
	StatusPendingRegistration   OrderStatus = "pending_registration"
	StatusRegistered            OrderStatus = "registered"
	StatusDispatched            OrderStatus = "dispatched"
	StatusCompleted             OrderStatus = "completed"
	StatusArchived              OrderStatus = "archived"
	StatusReturnedForCorrection OrderStatus = "returned_for_correction"
	StatusMissingEvidence       OrderStatus = "missing_evidence"
	StatusOverdue               OrderStatus = "overdue"
	StatusConflict              OrderStatus = "status_conflict"
)

type RiskLevel string

const (
	RiskHigh   RiskLevel = "high"
	RiskMedium RiskLevel = "medium"
	RiskLow    RiskLevel = "low"
)

type ProcessStage string

const (
	StageRegistration ProcessStage = "registration"
	StageDispatch     ProcessStage = "dispatch"
	StageAcceptance   ProcessStage = "acceptance"
	StageReview       ProcessStage = "review"
)

type User struct {
	ID        int       `json:"id"`
	Username  string    `json:"username"`
	Name      string    `json:"name"`
	Role      UserRole  `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type Evidence struct {
	ID          int       `json:"id"`
	OrderID     int       `json:"order_id"`
	Type        string    `json:"type"`
	Description string    `json:"description"`
	UploadedBy  int       `json:"uploaded_by"`
	CreatedAt   time.Time `json:"created_at"`
}

type OperationLog struct {
	ID            int       `json:"id"`
	OrderID       int       `json:"order_id"`
	OperatorID    int       `json:"operator_id"`
	OperatorName  string    `json:"operator_name"`
	OperatorRole  string    `json:"operator_role"`
	Action        string    `json:"action"`
	FromStatus    string    `json:"from_status"`
	ToStatus      string    `json:"to_status"`
	Opinion       string    `json:"opinion"`
	RiskLevel     string    `json:"risk_level"`
	VersionBefore int       `json:"version_before"`
	VersionAfter  int       `json:"version_after"`
	CreatedAt     time.Time `json:"created_at"`
}

type RepairOrder struct {
	ID                int          `json:"id"`
	OrderNo           string       `json:"order_no"`
	Title             string       `json:"title"`
	Description       string       `json:"description"`
	ContactName       string       `json:"contact_name"`
	ContactPhone      string       `json:"contact_phone"`
	Address           string       `json:"address"`
	RiskLevel         RiskLevel    `json:"risk_level"`
	Status            OrderStatus  `json:"status"`
	CurrentStage      ProcessStage `json:"current_stage"`
	CurrentHandlerID  int          `json:"current_handler_id"`
	CurrentHandler    string       `json:"current_handler"`
	RegistrarID       int          `json:"registrar_id"`
	SupervisorID      int          `json:"supervisor_id"`
	ReviewerID        int          `json:"reviewer_id"`
	MasterName        string       `json:"master_name"`
	MasterPhone       string       `json:"master_phone"`
	DispatchTime      sql.NullTime `json:"dispatch_time"`
	CompleteTime      sql.NullTime `json:"complete_time"`
	ArchiveTime       sql.NullTime `json:"archive_time"`
	DueDate           time.Time    `json:"due_date"`
	Priority          int          `json:"priority"`
	Version           int          `json:"version"`
	LastOpinion       string       `json:"last_opinion"`
	LastOperator      string       `json:"last_operator"`
	LastOperatorRole  string       `json:"last_operator_role"`
	EvidenceCount     int          `json:"evidence_count"`
	RequiredEvidences int          `json:"required_evidences"`
	IsOverdue         bool         `json:"is_overdue"`
	ConflictNote      string       `json:"conflict_note"`
	CreatedAt         time.Time    `json:"created_at"`
	UpdatedAt         time.Time    `json:"updated_at"`
}

type Statistics struct {
	Total          int64 `json:"total"`
	Pending        int64 `json:"pending"`
	InProgress     int64 `json:"in_progress"`
	Completed      int64 `json:"completed"`
	Archived       int64 `json:"archived"`
	HighRisk       int64 `json:"high_risk"`
	MediumRisk     int64 `json:"medium_risk"`
	LowRisk        int64 `json:"low_risk"`
	Overdue        int64 `json:"overdue"`
	Returned       int64 `json:"returned"`
	MissingEvidence int64 `json:"missing_evidence"`
	Conflict       int64 `json:"conflict"`
}
