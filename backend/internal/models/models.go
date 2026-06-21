package models

import "time"

type Role string

const (
	RoleRegistrar   Role = "registrar"
	RoleAuditor     Role = "auditor"
	RoleReviewer    Role = "reviewer"
)

type OrderStatus string

const (
	StatusDraft          OrderStatus = "draft"
	StatusPending        OrderStatus = "pending"
	StatusSupplement     OrderStatus = "supplement"
	StatusProcessing     OrderStatus = "processing"
	StatusReview         OrderStatus = "review"
	StatusCompleted      OrderStatus = "completed"
	StatusRejected       OrderStatus = "rejected"
	StatusReturned       OrderStatus = "returned"
)

type User struct {
	ID       int64  `json:"id" gorm:"primaryKey"`
	Username string `json:"username" gorm:"uniqueIndex"`
	Name     string `json:"name"`
	Role     Role   `json:"role"`
}

type MemberServiceOrder struct {
	ID             int64       `json:"id" gorm:"primaryKey"`
	OrderNo        string      `json:"order_no" gorm:"uniqueIndex"`
	MemberName     string      `json:"member_name"`
	MemberPhone    string      `json:"member_phone"`
	ServiceType    string      `json:"service_type"`
	Status         OrderStatus `json:"status"`
	Priority       string      `json:"priority"`
	Description    string      `json:"description"`
	RejectReason   string      `json:"reject_reason,omitempty"`
	ReturnReason   string      `json:"return_reason,omitempty"`
	AuditRemark    string      `json:"audit_remark,omitempty"`
	Result         string      `json:"result,omitempty"`
	CreatedBy      int64       `json:"created_by"`
	CreatedByName  string      `json:"created_by_name"`
	CurrentHandler int64       `json:"current_handler"`
	HandlerName    string      `json:"handler_name"`
	DueAt          *time.Time  `json:"due_at,omitempty"`
	CompletedAt    *time.Time  `json:"completed_at,omitempty"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
	Attachments    []Attachment `json:"attachments,omitempty" gorm:"foreignKey:OrderID"`
	Logs           []AuditLog   `json:"logs,omitempty" gorm:"foreignKey:OrderID"`
}

type Attachment struct {
	ID           int64     `json:"id" gorm:"primaryKey"`
	OrderID      int64     `json:"order_id"`
	FileName     string    `json:"file_name"`
	FileType     string    `json:"file_type"`
	FileSize     int64     `json:"file_size"`
	MaterialType string    `json:"material_type"`
	UploadedBy   int64     `json:"uploaded_by"`
	UploadedByName string  `json:"uploaded_by_name"`
	Status       string    `json:"status"`
	RejectReason string    `json:"reject_reason,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type AuditLog struct {
	ID         int64     `json:"id" gorm:"primaryKey"`
	OrderID    int64     `json:"order_id"`
	Action     string    `json:"action"`
	OperatorID int64     `json:"operator_id"`
	Operator   string    `json:"operator"`
	Role       string    `json:"role"`
	Remark     string    `json:"remark,omitempty"`
	FromStatus string    `json:"from_status,omitempty"`
	ToStatus   string    `json:"to_status,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type OrderListRequest struct {
	Status   string `form:"status"`
	Keyword  string `form:"keyword"`
	Page     int    `form:"page"`
	PageSize int    `form:"page_size"`
}

type OrderListResponse struct {
	Total int64               `json:"total"`
	List  []MemberServiceOrder `json:"list"`
}

type CreateOrderRequest struct {
	MemberName  string `json:"member_name" binding:"required"`
	MemberPhone string `json:"member_phone" binding:"required"`
	ServiceType string `json:"service_type" binding:"required"`
	Priority    string `json:"priority"`
	Description string `json:"description"`
}

type ProcessOrderRequest struct {
	Action string `json:"action" binding:"required"`
	Remark string `json:"remark"`
	Result string `json:"result"`
	Reason string `json:"reason"`
}

type BatchProcessRequest struct {
	Action  string  `json:"action" binding:"required"`
	OrderIDs []int64 `json:"order_ids" binding:"required,min=1"`
	Remark  string  `json:"remark"`
	Result  string  `json:"result"`
	Reason  string  `json:"reason"`
}

type BatchProcessResult struct {
	OrderID  int64  `json:"order_id"`
	OrderNo  string `json:"order_no"`
	Success  bool   `json:"success"`
	Message  string `json:"message"`
	Status   string `json:"status,omitempty"`
}

type BatchProcessResponse struct {
	Total   int                 `json:"total"`
	Success int                 `json:"success"`
	Failed  int                 `json:"failed"`
	Results []BatchProcessResult `json:"results"`
}

type RequiredMaterial struct {
	Type     string `json:"type"`
	Name     string `json:"name"`
	Required bool   `json:"required"`
}

func GetRequiredMaterials(serviceType string) []RequiredMaterial {
	materials := map[string][]RequiredMaterial{
		"洁牙服务": {
			{Type: "member_card", Name: "会员卡", Required: true},
			{Type: "id_card", Name: "身份证", Required: true},
			{Type: "health_declaration", Name: "健康声明", Required: false},
		},
		"正畸咨询": {
			{Type: "member_card", Name: "会员卡", Required: true},
			{Type: "id_card", Name: "身份证", Required: true},
			{Type: "oral_report", Name: "口腔检查报告", Required: true},
			{Type: "x_ray", Name: "X光片", Required: false},
		},
		"种植牙服务": {
			{Type: "member_card", Name: "会员卡", Required: true},
			{Type: "id_card", Name: "身份证", Required: true},
			{Type: "oral_report", Name: "口腔检查报告", Required: true},
			{Type: "x_ray", Name: "全景X光片", Required: true},
			{Type: "blood_test", Name: "血液检查报告", Required: false},
		},
		"儿童涂氟": {
			{Type: "member_card", Name: "会员卡", Required: true},
			{Type: "guardian_id", Name: "监护人身份证", Required: true},
			{Type: "birth_cert", Name: "出生证明", Required: false},
		},
		"根管治疗": {
			{Type: "member_card", Name: "会员卡", Required: true},
			{Type: "id_card", Name: "身份证", Required: true},
			{Type: "oral_report", Name: "口腔检查报告", Required: true},
			{Type: "x_ray", Name: "牙根尖片", Required: true},
		},
		"美白牙齿": {
			{Type: "member_card", Name: "会员卡", Required: true},
			{Type: "id_card", Name: "身份证", Required: true},
			{Type: "oral_report", Name: "口腔检查报告", Required: true},
		},
		"镶牙服务": {
			{Type: "member_card", Name: "会员卡", Required: true},
			{Type: "id_card", Name: "身份证", Required: true},
			{Type: "oral_report", Name: "口腔检查报告", Required: true},
			{Type: "mold_record", Name: "取模记录", Required: false},
		},
	}
	if mats, ok := materials[serviceType]; ok {
		return mats
	}
	return []RequiredMaterial{
		{Type: "member_card", Name: "会员卡", Required: true},
		{Type: "id_card", Name: "身份证", Required: true},
	}
}
