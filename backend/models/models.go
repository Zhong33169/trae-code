package models

import "time"

type User struct {
	Id          int    `json:"id"`
	Name        string `json:"name"`
	Role        string `json:"role"`
	DisplayName string `json:"display_name"`
}

type AfterSaleOrder struct {
	Id               int       `json:"id"`
	OrderNo          string    `json:"order_no"`
	CustomerName     string    `json:"customer_name"`
	ProductName      string    `json:"product_name"`
	OrderAmount      float64   `json:"order_amount"`
	RefundAmount     float64   `json:"refund_amount"`
	RiskLevel        string    `json:"risk_level"`
	CurrentStage     string    `json:"current_stage"`
	CurrentStep      string    `json:"current_step"`
	Status           string    `json:"status"`
	HandlerRole      string    `json:"handler_role"`
	HandlerName      string    `json:"handler_name"`
	RequiredEvidence string    `json:"required_evidence"`
	EvidenceProvided string    `json:"evidence_provided"`
	Version          int       `json:"version"`
	Deadline         time.Time `json:"deadline"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type ProcessingRecord struct {
	Id          int       `json:"id"`
	OrderId     int       `json:"order_id"`
	Stage       string    `json:"stage"`
	Step        string    `json:"step"`
	Action      string    `json:"action"`
	HandlerRole string    `json:"handler_role"`
	HandlerName string    `json:"handler_name"`
	Opinion     string    `json:"opinion"`
	Result      string    `json:"result"`
	CreatedAt   time.Time `json:"created_at"`
}

type RiskChangeLog struct {
	Id           int       `json:"id"`
	OrderId      int       `json:"order_id"`
	OldLevel     string    `json:"old_level"`
	NewLevel     string    `json:"new_level"`
	Reason       string    `json:"reason"`
	Operator     string    `json:"operator"`
	OperatorRole string    `json:"operator_role"`
	CreatedAt    time.Time `json:"created_at"`
}

type ActionRequest struct {
	Action    string   `json:"action"`
	HandlerId int      `json:"handler_id"`
	Opinion   string   `json:"opinion"`
	Evidence  []string `json:"evidence"`
	Version   int      `json:"version"`
}

type RiskChangeRequest struct {
	NewLevel   string `json:"new_level"`
	Reason     string `json:"reason"`
	OperatorId int    `json:"operator_id"`
}

type CreateOrderRequest struct {
	CustomerName     string   `json:"customer_name"`
	ProductName      string   `json:"product_name"`
	OrderAmount      float64  `json:"order_amount"`
	RefundAmount     float64  `json:"refund_amount"`
	RiskLevel        string   `json:"risk_level"`
	RequiredEvidence []string `json:"required_evidence"`
}

type StatsResponse struct {
	Total    int            `json:"total"`
	ByRisk   map[string]int `json:"by_risk"`
	ByStage  map[string]int `json:"by_stage"`
	ByStatus map[string]int `json:"by_status"`
}

type OrderDetailResponse struct {
	Order    AfterSaleOrder     `json:"order"`
	Records  []ProcessingRecord `json:"records"`
	RiskLogs []RiskChangeLog    `json:"risk_logs"`
}

type EvidenceUpdateRequest struct {
	Evidence  []string `json:"evidence"`
	HandlerId int      `json:"handler_id"`
	Version   int      `json:"version"`
}
