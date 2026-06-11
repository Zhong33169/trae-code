package models

import "time"

type User struct {
	ID        int       `json:"id"`
	Username  string    `json:"username"`
	Role      string    `json:"role"`
	RealName  string    `json:"real_name"`
	CreatedAt time.Time `json:"created_at"`
}

type CheckinRecord struct {
	ID               int        `json:"id"`
	BatchNo          string     `json:"batch_no"`
	FlightNo         string     `json:"flight_no"`
	FlightDate       string     `json:"flight_date"`
	PassengerName    string     `json:"passenger_name"`
	IDCardNo         string     `json:"id_card_no"`
	SeatNo           string     `json:"seat_no"`
	BoardingGate     string     `json:"boarding_gate"`
	CheckinTime      *string    `json:"checkin_time"`
	Source           string     `json:"source"`
	Status           string     `json:"status"`
	MaterialComplete int        `json:"material_complete"`
	IsOvertime       int        `json:"is_overtime"`
	IsAbnormal       int        `json:"is_abnormal"`
	AbnormalReason   string     `json:"abnormal_reason"`
	Result           string     `json:"result"`
	ReturnReason     string     `json:"return_reason"`
	AuditRemark      string     `json:"audit_remark"`
	InitiatorID      *int       `json:"initiator_id"`
	HandlerID        *int       `json:"handler_id"`
	ReviewerID       *int       `json:"reviewer_id"`
	InitiatorName    string     `json:"initiator_name"`
	HandlerName      string     `json:"handler_name"`
	ReviewerName     string     `json:"reviewer_name"`
	InitiatedAt      *string    `json:"initiated_at"`
	HandledAt        *string    `json:"handled_at"`
	ReviewedAt       *string    `json:"reviewed_at"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	Attachments      []Attachment `json:"attachments,omitempty"`
	AuditLogs        []AuditLog   `json:"audit_logs,omitempty"`
}

type Attachment struct {
	ID          int       `json:"id"`
	RecordID    int       `json:"checkin_record_id"`
	FileName    string    `json:"file_name"`
	FilePath    string    `json:"file_path"`
	FileType    string    `json:"file_type"`
	FileSize    int       `json:"file_size"`
	UploadedBy  int       `json:"uploaded_by"`
	UploaderName string   `json:"uploader_name"`
	UploadedAt  time.Time `json:"uploaded_at"`
}

type AuditLog struct {
	ID            int       `json:"id"`
	RecordID      *int      `json:"checkin_record_id"`
	UserID        int       `json:"user_id"`
	UserName      string    `json:"user_name"`
	Action        string    `json:"action"`
	OldStatus     string    `json:"old_status"`
	NewStatus     string    `json:"new_status"`
	Detail        string    `json:"detail"`
	FailureReason string    `json:"failure_reason"`
	CreatedAt     time.Time `json:"created_at"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type BatchHandleRequest struct {
	IDs        []int  `json:"ids"`
	Action     string `json:"action"`
	Result     string `json:"result"`
	Remark     string `json:"remark"`
	ReturnReason string `json:"return_reason"`
}

type BatchResultItem struct {
	ID      int    `json:"id"`
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type BatchHandleResponse struct {
	Results []BatchResultItem `json:"results"`
	Total   int               `json:"total"`
	Success int               `json:"success"`
	Failed  int               `json:"failed"`
}

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type ConsistencyIssue struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}
