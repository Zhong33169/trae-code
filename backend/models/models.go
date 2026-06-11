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
	HandlerID           int    `json:"handler_id" binding:"required"`
	Action              string `json:"action" binding:"required"`
	Opinion             string `json:"opinion" binding:"required"`
	Result              string `json:"result"`
	Version             int    `json:"version" binding:"required"`
	EvidenceTemperature *bool  `json:"evidence_temperature"`
	EvidenceQuality     *bool  `json:"evidence_quality"`
	EvidenceQuantity    *bool  `json:"evidence_quantity"`
}

type Stats struct {
	Total          int            `json:"total"`
	ByStatus       map[string]int `json:"by_status"`
	ByRiskLevel    map[string]int `json:"by_risk_level"`
	HighRiskPend   int            `json:"high_risk_pending"`
	Overdue        int            `json:"overdue"`
	ReviewingCount int            `json:"reviewing_count"`
	RejectedCount  int            `json:"rejected_count"`
}

type ManagerTodoItem struct {
	ID                  int      `json:"id"`
	OrderNo             string   `json:"order_no"`
	ProductName         string   `json:"product_name"`
	Supplier            string   `json:"supplier"`
	TemperatureRange    string   `json:"temperature_range"`
	RiskLevel           string   `json:"risk_level"`
	RiskLevelLabel      string   `json:"risk_level_label"`
	Status              string   `json:"status"`
	StatusLabel         string   `json:"status_label"`
	CurrentHandlerID    int      `json:"current_handler_id"`
	CurrentHandlerName  string   `json:"current_handler_name"`
	CurrentHandlerRole  string   `json:"current_handler_role"`
	Version             int      `json:"version"`
	EvidenceTemperature bool     `json:"evidence_temperature"`
	EvidenceQuality     bool     `json:"evidence_quality"`
	EvidenceQuantity    bool     `json:"evidence_quantity"`
	UpdatedAt           time.Time `json:"updated_at"`

	AvailableActions    []ActionDef `json:"available_actions"`
	LastOpinion         string      `json:"last_opinion"`
	LastHandlerName     string      `json:"last_handler_name"`
	LastActionLabel     string      `json:"last_action_label"`
	LastResultLabel     string      `json:"last_result_label"`
	RequiredEvidence    []string    `json:"required_evidence"`
	RequiredEvidenceCN  []string    `json:"required_evidence_cn"`
}

type ActionDef struct {
	Action string `json:"action"`
	Label  string `json:"label"`
	Icon   string `json:"icon"`
}

type ManagerWorkbench struct {
	UserID    int                     `json:"user_id"`
	UserName  string                  `json:"user_name"`
	TodoCount int                     `json:"todo_count"`
	Counters  map[string]int          `json:"counters"`
	Items     map[string][]ManagerTodoItem `json:"items"`
}

var RoleLabels = map[string]string{
	"warehouse_keeper":  "仓管员",
	"temp_supervisor":   "温控主管",
	"warehouse_manager": "仓储经理",
}

var StatusLabels = map[string]string{
	"registered": "登记",
	"verifying":  "核验",
	"reviewing":  "待复核",
	"archived":   "归档",
	"rejected":   "驳回",
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
	"submit":      "提交登记",
	"advance":     "推进处理",
	"return":      "退回补正",
	"approve":     "复核通过",
	"reject":      "驳回",
	"correct":     "补正提交",
	"force_fix":   "强制修复冲突",
	"to_verify":   "推进核验",
	"to_review":   "提交复核",
}

var ResultLabels = map[string]string{
	"passed":      "通过",
	"returned":    "退回",
	"rejected":    "驳回",
	"corrected":   "已补正",
	"conflict":    "冲突",
	"force_fixed": "已强制修复",
}

var RiskPriority = map[string]int{
	"high":   0,
	"medium": 1,
	"low":    2,
}

var StatusFlow = map[string]map[string]string{
	"registered": {
		"advance": "verifying",
		"return":  "returned",
	},
	"verifying": {
		"advance": "reviewing",
		"return":  "returned",
	},
	"reviewing": {
		"approve": "archived",
		"reject":  "rejected",
		"return":  "returned",
	},
	"rejected": {
		"force_fix": "registered",
		"correct":   "verifying",
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
	"reviewing":  "warehouse_manager",
	"archived":   "warehouse_manager",
	"rejected":   "warehouse_manager",
	"returned":   "warehouse_keeper",
	"overdue":    "temp_supervisor",
	"conflict":   "warehouse_manager",
}

var EvidenceRequiredForStatus = map[string]map[string][]string{
	"verifying": {
		"advance": {"temperature"},
	},
	"reviewing": {
		"approve": {"temperature"},
	},
}

var RiskEvidenceRequirement = map[string][]string{
	"high":   {"temperature", "quality", "quantity"},
	"medium": {"temperature"},
	"low":    {},
}

type StatusActionDef struct {
	Action string
	Label  string
	Icon   string
}

var StatusActions = map[string][]StatusActionDef{
	"registered": {
		{Action: "advance", Label: "推进至核验", Icon: "➡️"},
		{Action: "return", Label: "退回补正", Icon: "↩️"},
	},
	"verifying": {
		{Action: "advance", Label: "推进至经理复核", Icon: "➡️"},
		{Action: "return", Label: "退回补正", Icon: "↩️"},
	},
	"reviewing": {
		{Action: "approve", Label: "复核通过归档", Icon: "✅"},
		{Action: "reject", Label: "经理驳回", Icon: "❌"},
		{Action: "return", Label: "退回补正", Icon: "↩️"},
	},
	"rejected": {
		{Action: "correct", Label: "经理特批回核验", Icon: "🔄"},
		{Action: "force_fix", Label: "强制回登记重走", Icon: "🔧"},
	},
	"returned": {
		{Action: "correct", Label: "补正提交", Icon: "🔄"},
	},
	"overdue": {
		{Action: "advance", Label: "推进至核验", Icon: "➡️"},
	},
	"conflict": {
		{Action: "force_fix", Label: "强制修复（回登记）", Icon: "🔧"},
	},
	"archived": {},
}
