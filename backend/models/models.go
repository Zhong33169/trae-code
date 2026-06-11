package models

import "time"

type User struct {
	ID          int    `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	RoleLabel   string `json:"role_label"`
}

type Order struct {
	ID                  int       `json:"id"`
	OrderNo             string    `json:"order_no"`
	ProductName         string    `json:"product_name"`
	Supplier            string    `json:"supplier"`
	TemperatureRange    string    `json:"temperature_range"`
	StorageLocation     string    `json:"storage_location"`
	RiskLevel           string    `json:"risk_level"`
	RiskLevelLabel      string    `json:"risk_level_label"`
	Status              string    `json:"status"`
	StatusLabel         string    `json:"status_label"`
	CurrentHandlerID    int       `json:"current_handler_id"`
	CurrentHandlerName  string    `json:"current_handler_name"`
	CurrentHandlerRole  string    `json:"current_handler_role"`
	Version             int       `json:"version"`
	CreatedBy           int       `json:"created_by"`
	CreatedByName       string    `json:"created_by_name"`
	EvidenceTemperature bool      `json:"evidence_temperature"`
	EvidenceQuality     bool      `json:"evidence_quality"`
	EvidenceQuantity    bool      `json:"evidence_quantity"`
	Notes               string    `json:"notes"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type OperationRecord struct {
	ID          int       `json:"id"`
	OrderID     int       `json:"order_id"`
	HandlerID   int       `json:"handler_id"`
	HandlerName string    `json:"handler_name"`
	HandlerRole string    `json:"handler_role"`
	RoleLabel   string    `json:"role_label"`
	Action      string    `json:"action"`
	ActionLabel string    `json:"action_label"`
	Opinion     string    `json:"opinion"`
	Result      string    `json:"result"`
	ResultLabel string    `json:"result_label"`
	CreatedAt   time.Time `json:"created_at"`
}

type CreateOrderRequest struct {
	ProductName      string `json:"product_name" binding:"required"`
	Supplier         string `json:"supplier" binding:"required"`
	TemperatureRange string `json:"temperature_range" binding:"required"`
	StorageLocation  string `json:"storage_location" binding:"required"`
	RiskLevel        string `json:"risk_level" binding:"required"`
	Notes            string `json:"notes"`
	CreatedBy        int    `json:"created_by" binding:"required"`
}

type ProcessOrderRequest struct {
	HandlerID            int    `json:"handler_id" binding:"required"`
	Action               string `json:"action" binding:"required"`
	Opinion              string `json:"opinion" binding:"required"`
	Result               string `json:"result" binding:"required"`
	Version              int    `json:"version" binding:"required"`
	EvidenceTemperature  *bool  `json:"evidence_temperature"`
	EvidenceQuality      *bool  `json:"evidence_quality"`
	EvidenceQuantity     *bool  `json:"evidence_quantity"`
}

type Stats struct {
	Total        int            `json:"total"`
	ByStatus     map[string]int `json:"by_status"`
	ByRiskLevel  map[string]int `json:"by_risk_level"`
	HighRiskPend int            `json:"high_risk_pending"`
	Overdue      int            `json:"overdue"`
}

var RoleLabels = map[string]string{
	"warehouse_keeper":   "仓管员",
	"temp_supervisor":    "温控主管",
	"warehouse_manager":  "仓储经理",
}

var StatusLabels = map[string]string{
	"registered": "登记",
	"verifying":  "核验",
	"archived":   "归档",
	"returned":   "退回补正",
	"overdue":    "逾期",
	"conflict":   "冲突",
}

var RiskLevelLabels = map[string]string{
	"high":   "高风险",
	"medium": "中风险",
	"low":    "低风险",
}

var ActionLabels = map[string]string{
	"submit":     "提交登记",
	"advance":    "推进处理",
	"return":     "退回补正",
	"approve":    "复核通过",
	"reject":     "驳回",
	"correct":    "补正提交",
	"force_fix":  "强制修复冲突",
}

var ResultLabels = map[string]string{
	"passed":       "通过",
	"returned":     "退回",
	"rejected":     "驳回",
	"corrected":    "已补正",
	"conflict":     "冲突",
	"force_fixed":  "已强制修复",
}

var RiskPriority = map[string]int{
	"high":   0,
	"medium": 1,
	"low":    2,
}

var StatusFlow = map[string]map[string]string{
	"registered": {
		"advance":  "verifying",
		"return":   "returned",
	},
	"verifying": {
		"advance":  "archived",
		"return":   "returned",
	},
	"returned": {
		"correct": "registered",
	},
	"archived": {},
	"overdue": {
		"advance": "verifying",
	},
	"conflict": {
		"force_fix": "registered",
	},
}

var ExpectedRoleForStatus = map[string]string{
	"registered": "warehouse_keeper",
	"verifying":  "temp_supervisor",
	"archived":   "warehouse_manager",
	"returned":   "warehouse_keeper",
	"overdue":    "temp_supervisor",
	"conflict":   "warehouse_manager",
}
