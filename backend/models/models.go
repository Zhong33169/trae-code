package models

import "time"

type Role string

const (
	RoleRegistrar    Role = "registrar"
	RoleSupervisor   Role = "supervisor"
	RoleReviewer     Role = "reviewer"
)

type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Role     Role   `json:"role"`
	Name     string `json:"name"`
}

type OrderStatus string

const (
	StatusDraft        OrderStatus = "draft"
	StatusPending      OrderStatus = "pending"
	StatusReturned     OrderStatus = "returned"
	StatusProcessing   OrderStatus = "processing"
	StatusReviewed     OrderStatus = "reviewed"
	StatusArchived     OrderStatus = "archived"
)

type Material struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Type   string `json:"type"`
	Uploaded bool   `json:"uploaded"`
	Required bool   `json:"required"`
}

type OrderOpinion struct {
	UserID   string    `json:"userId"`
	UserName string    `json:"userName"`
	Role     Role      `json:"role"`
	Content  string    `json:"content"`
	Time     time.Time `json:"time"`
	Pass     bool      `json:"pass"`
}

type CrossBorderOrder struct {
	ID             string        `json:"id"`
	OrderNo        string        `json:"orderNo"`
	ProductName    string        `json:"productName"`
	ProductSKU     string        `json:"productSku"`
	Quantity       int           `json:"quantity"`
	Amount         float64       `json:"amount"`
	Currency       string        `json:"currency"`
	Platform       string        `json:"platform"`
	BuyerCountry   string        `json:"buyerCountry"`
	Status         OrderStatus   `json:"status"`
	RegistrarID    string        `json:"registrarId"`
	RegistrarName  string        `json:"registrarName"`
	SupervisorID   string        `json:"supervisorId"`
	SupervisorName string        `json:"supervisorName"`
	ReviewerID     string        `json:"reviewerId"`
	ReviewerName   string        `json:"reviewerName"`
	Materials      []Material    `json:"materials"`
	Opinions       []OrderOpinion `json:"opinions"`
	CreatedAt      time.Time     `json:"createdAt"`
	UpdatedAt      time.Time     `json:"updatedAt"`
	Deadline       time.Time     `json:"deadline"`
	WarningHours   int           `json:"warningHours"`
	IsOverdue      bool          `json:"isOverdue"`
	OverdueReason  string        `json:"overdueReason"`
	NextAction     string        `json:"nextAction"`
	Version        int           `json:"version"`
	Remark         string        `json:"remark"`
	ReturnReason   string        `json:"returnReason"`
}

type AuditLog struct {
	ID        string      `json:"id"`
	OrderID   string      `json:"orderId"`
	OrderNo   string      `json:"orderNo"`
	UserID    string      `json:"userId"`
	UserName  string      `json:"userName"`
	Role      Role        `json:"role"`
	Action    string      `json:"action"`
	Detail    string      `json:"detail"`
	OldStatus OrderStatus `json:"oldStatus"`
	NewStatus OrderStatus `json:"newStatus"`
	Time      time.Time   `json:"time"`
	IP        string      `json:"ip"`
}

type BatchResultItem struct {
	OrderID    string `json:"orderId"`
	OrderNo    string `json:"orderNo"`
	Success    bool   `json:"success"`
	Reason     string `json:"reason"`
	NextStep   string `json:"nextStep"`
}

type BatchResult struct {
	Total     int               `json:"total"`
	Success   int               `json:"success"`
	Failed    int               `json:"failed"`
	Items     []BatchResultItem `json:"items"`
}

type Statistics struct {
	TotalCount      int `json:"totalCount"`
	PendingCount    int `json:"pendingCount"`
	ProcessingCount int `json:"processingCount"`
	OverdueCount    int `json:"overdueCount"`
	ArchivedCount   int `json:"archivedCount"`
	WarningCount    int `json:"warningCount"`
}
