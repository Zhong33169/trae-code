package model

import "time"

const (
	RoleReceptionAssistant = "reception_assistant"
	RoleAttendingPhysician = "attending_physician"
	RolePharmacyAdmin      = "pharmacy_admin"

	StatusDraft              = "draft"
	StatusPendingRegistration = "pending_registration"
	StatusRegistered          = "registered"
	StatusPendingVerification = "pending_verification"
	StatusVerified            = "verified"
	StatusPendingReview       = "pending_review"
	StatusArchived            = "archived"

	EvidenceTypeRegistration = "registration"
	EvidenceTypeVerification = "verification"
	EvidenceTypeReview       = "review"

	BatchStatusProcessing = "processing"
	BatchStatusCompleted  = "completed"

	BatchItemStatusPending = "pending"
	BatchItemStatusSuccess = "success"
	BatchItemStatusFailed  = "failed"

	BatchOpRegister = "register"
	BatchOpVerify   = "verify"
	BatchOpReview   = "review"
)

type User struct {
	ID            int64     `json:"id"`
	Username      string    `json:"username"`
	PasswordHash  string    `json:"-"`
	Role          string    `json:"role"`
	Name          string    `json:"name"`
	CreatedAt     time.Time `json:"created_at"`
}

type PrescriptionTransfer struct {
	ID            int64     `json:"id"`
	TransferNo    string    `json:"transfer_no"`
	PatientName   string    `json:"patient_name"`
	IDCard        string    `json:"id_card"`
	Department    string    `json:"department"`
	DoctorName    string    `json:"doctor_name"`
	MedicineList  string    `json:"medicine_list"`
	TotalAmount   float64   `json:"total_amount"`
	Status        string    `json:"status"`
	Version       int       `json:"version"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type TransferEvidence struct {
	ID              int64     `json:"id"`
	TransferID      int64     `json:"transfer_id"`
	EvidenceType    string    `json:"evidence_type"`
	OperatorID      int64     `json:"operator_id"`
	OperatorName    string    `json:"operator_name"`
	OperatorRole    string    `json:"operator_role"`
	EvidenceContent string    `json:"evidence_content"`
	Remark          string    `json:"remark"`
	CreatedAt       time.Time `json:"created_at"`
}

type BatchOperation struct {
	ID            int64     `json:"id"`
	BatchNo       string    `json:"batch_no"`
	OperationType string    `json:"operation_type"`
	OperatorID    int64     `json:"operator_id"`
	OperatorName  string    `json:"operator_name"`
	TotalCount    int       `json:"total_count"`
	SuccessCount  int       `json:"success_count"`
	FailCount     int       `json:"fail_count"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
}

type BatchItem struct {
	ID            int64     `json:"id"`
	BatchID       int64     `json:"batch_id"`
	TransferID    int64     `json:"transfer_id"`
	TransferNo    string    `json:"transfer_no,omitempty"`
	Status        string    `json:"status"`
	ErrorMessage  string    `json:"error_message"`
	ResultData    string    `json:"result_data"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type AuditLog struct {
	ID         int64     `json:"id"`
	UserID     int64     `json:"user_id"`
	UserName   string    `json:"user_name"`
	Role       string    `json:"role"`
	Action     string    `json:"action"`
	TargetType string    `json:"target_type"`
	TargetID   int64     `json:"target_id"`
	OldValue   string    `json:"old_value"`
	NewValue   string    `json:"new_value"`
	IPAddress  string    `json:"ip_address"`
	CreatedAt  time.Time `json:"created_at"`
}

type MedicineItem struct {
	Name     string  `json:"name"`
	Spec     string  `json:"spec"`
	Quantity int     `json:"quantity"`
	Price    float64 `json:"price"`
}
