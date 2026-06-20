package models

import "time"

const (
	RoleServiceManager  = "service_manager"
	RoleDispatcher      = "dispatcher"
	RoleCustomerService = "customer_service"
	RoleTechnician      = "technician"

	StatusDraft        = "draft"
	StatusPendingQuote = "pending_quote"
	StatusQuoted       = "quoted"
	StatusConfirmed    = "confirmed"
	StatusCustomerPaid = "customer_paid"
	StatusRepairing    = "repairing"
	StatusReturned     = "returned"
	StatusCompleted    = "completed"
	StatusCancelled    = "cancelled"

	ShiftMorning   = "morning"
	ShiftAfternoon = "afternoon"
	ShiftNight     = "night"
)

type User struct {
	ID           int64     `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	RealName     string    `json:"real_name"`
	Role         string    `json:"role"`
	Phone        string    `json:"phone"`
	Shift        string    `json:"shift"`
	CreatedAt    time.Time `json:"created_at"`
}

type RepairQuote struct {
	ID               int64  `json:"id"`
	QuoteNo          string `json:"quote_no"`
	CustomerName     string `json:"customer_name"`
	CustomerPhone    string `json:"customer_phone"`
	DeviceType       string `json:"device_type"`
	DeviceModel      string `json:"device_model"`
	FaultDescription string `json:"fault_description"`

	Status           string `json:"status"`
	CurrentHandlerID int64  `json:"current_handler_id"`
	CurrentHandler   string `json:"current_handler"`
	Shift            string `json:"shift"`

	EstimateAmount float64 `json:"estimate_amount"`
	ActualAmount   float64 `json:"actual_amount"`
	PaymentStatus  string  `json:"payment_status"`
	PaymentMethod  string  `json:"payment_method"`

	QuoteDetail string     `json:"quote_detail"`
	ConfirmedAt *time.Time `json:"confirmed_at"`
	PaidAt      *time.Time `json:"paid_at"`
	CompletedAt *time.Time `json:"completed_at"`

	AssignedTechnicianID int64  `json:"assigned_technician_id"`
	AssignedTechnician   string `json:"assigned_technician"`

	CreatorID     int64     `json:"creator_id"`
	CreatorName   string    `json:"creator_name"`
	HandoverCount int       `json:"handover_count"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type OperationLog struct {
	ID           int64     `json:"id"`
	QuoteID      int64     `json:"quote_id"`
	Operation    string    `json:"operation"`
	OldStatus    string    `json:"old_status"`
	NewStatus    string    `json:"new_status"`
	OperatorID   int64     `json:"operator_id"`
	OperatorName string    `json:"operator_name"`
	OperatorRole string    `json:"operator_role"`
	Remark       string    `json:"remark"`
	CreatedAt    time.Time `json:"created_at"`
}

type ShiftHandover struct {
	ID             int64      `json:"id"`
	QuoteID        int64      `json:"quote_id"`
	FromUserID     int64      `json:"from_user_id"`
	FromUserName   string     `json:"from_user_name"`
	FromUserRole   string     `json:"from_user_role"`
	FromShift      string     `json:"from_shift"`
	ToUserID       int64      `json:"to_user_id"`
	ToUserName     string     `json:"to_user_name"`
	ToUserRole     string     `json:"to_user_role"`
	ToShift        string     `json:"to_shift"`
	HandoverRemark string     `json:"handover_remark"`
	ConfirmedAt    *time.Time `json:"confirmed_at"`
	Status         string     `json:"status"`
	CreatedAt      time.Time  `json:"created_at"`
}

type RoleDisplayNameMap = map[string]string
type StatusDisplayNameMap = map[string]string
type ShiftDisplayNameMap = map[string]string

var RoleDisplayNames = RoleDisplayNameMap{
	RoleServiceManager:  "服务经理",
	RoleDispatcher:      "调度专员",
	RoleCustomerService: "客服专员",
	RoleTechnician:      "维修师傅",
}

var StatusDisplayNames = StatusDisplayNameMap{
	StatusDraft:        "草稿",
	StatusPendingQuote: "待报价",
	StatusQuoted:       "已报价待确认",
	StatusConfirmed:    "客户已确认",
	StatusCustomerPaid: "客户已支付",
	StatusRepairing:    "维修中",
	StatusReturned:     "已退回",
	StatusCompleted:    "已完成归档",
	StatusCancelled:    "已取消",
}

var ShiftDisplayNames = ShiftDisplayNameMap{
	ShiftMorning:   "白班(08:00-16:00)",
	ShiftAfternoon: "中班(16:00-24:00)",
	ShiftNight:     "夜班(00:00-08:00)",
}
