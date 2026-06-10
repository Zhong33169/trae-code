package models

import (
	"time"

	"gorm.io/gorm"
)

const (
	RoleRegistrar  = "registrar"
	RoleSupervisor = "supervisor"
	RoleReviewer   = "reviewer"

	StatusDraft                  = "draft"
	StatusSubmitted              = "submitted"
	StatusReturnedToRegistrar    = "returned_to_registrar"
	StatusResubmitted            = "resubmitted"
	StatusSupervisorApproved     = "supervisor_approved"
	StatusSupervisorRejected     = "supervisor_rejected"
	StatusHighRiskEscalated      = "high_risk_escalated"
	StatusReviewerApproved       = "reviewer_approved"
	StatusReviewerRejected       = "reviewer_rejected"
	StatusArchived               = "archived"
	StatusOverdue                = "overdue"

	RiskLow    = "low"
	RiskMedium = "medium"
	RiskHigh   = "high"

	StageAppointment = "appointment"
	StageDispatch    = "dispatch"
	StageDelivery    = "delivery"
)

type User struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Username     string         `gorm:"uniqueIndex;size:100;not null" json:"username"`
	RealName     string         `gorm:"size:100" json:"real_name"`
	Role         string         `gorm:"size:50;not null" json:"role"`
	PasswordHash string         `gorm:"size:255" json:"-"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type RepairOrder struct {
	ID                 uint           `gorm:"primaryKey" json:"id"`
	OrderNo            string         `gorm:"uniqueIndex;size:50;not null" json:"order_no"`
	CustomerName       string         `gorm:"size:100" json:"customer_name"`
	Phone              string         `gorm:"size:20" json:"phone"`
	VehiclePlate       string         `gorm:"size:20" json:"vehicle_plate"`
	VehicleModel       string         `gorm:"size:100" json:"vehicle_model"`
	Mileage            int            `json:"mileage"`
	AppointmentType    string         `gorm:"size:50" json:"appointment_type"`
	ProblemDescription string         `gorm:"type:text" json:"problem_description"`
	Status             string         `gorm:"size:50;index;not null;default:draft" json:"status"`
	RiskLevel          string         `gorm:"size:20;default:low" json:"risk_level"`
	RiskReason         string         `gorm:"type:text" json:"risk_reason"`
	Stage              string         `gorm:"size:50;default:appointment" json:"stage"`
	AssignedTechnician string         `gorm:"size:100" json:"assigned_technician"`
	RepairItems        string         `gorm:"type:text" json:"repair_items"`
	EstimatedCost      float64        `gorm:"default:0" json:"estimated_cost"`
	FinalCost          float64        `gorm:"default:0" json:"final_cost"`
	EvidenceSubmitted  bool           `gorm:"default:false" json:"evidence_submitted"`
	EvidenceList       string         `gorm:"type:text" json:"evidence_list"`
	Deadline           time.Time      `json:"deadline"`
	CurrentHandler     string         `gorm:"size:50" json:"current_handler"`
	Version            int            `gorm:"default:1" json:"version"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID        uint           `json:"created_by_id"`
	CreatedBy          *User          `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
	LastOpinion        string         `gorm:"type:text" json:"last_opinion"`
	LastResult         string         `gorm:"type:text" json:"last_result"`
	Operations         []OrderOperation `gorm:"foreignKey:OrderID" json:"operations,omitempty"`
}

type OrderOperation struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	OrderID        uint           `gorm:"index;not null" json:"order_id"`
	OperatorID     uint           `json:"operator_id"`
	OperatorName   string         `gorm:"size:100" json:"operator_name"`
	OperatorRole   string         `gorm:"size:50" json:"operator_role"`
	Action         string         `gorm:"size:50" json:"action"`
	FromStatus     string         `gorm:"size:50" json:"from_status"`
	ToStatus       string         `gorm:"size:50" json:"to_status"`
	Opinion        string         `gorm:"type:text" json:"opinion"`
	Result         string         `gorm:"type:text" json:"result"`
	RiskChange     string         `gorm:"size:200" json:"risk_change"`
	EvidenceCheck  string         `gorm:"type:text" json:"evidence_check"`
	VersionChecked int            `json:"version_checked"`
	IpAddress      string         `gorm:"size:50" json:"ip_address"`
	CreatedAt      time.Time      `json:"created_at"`
}
