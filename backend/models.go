package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

const (
	RoleCustomerManager        = "customer_manager"
	RoleUnderwritingSpecialist = "underwriting_specialist"
	RoleBusinessOwner          = "business_owner"

	StatusDraft     = "draft"
	StatusSubmitted = "submitted"
	StatusReviewed  = "reviewed"
	StatusConfirmed = "confirmed"
	StatusRejected  = "rejected"
	StatusArchived  = "archived"
)

var roleLabels = map[string]string{
	RoleCustomerManager:        "客户经理",
	RoleUnderwritingSpecialist: "核保专员",
	RoleBusinessOwner:          "业务负责人",
}

func roleLabel(r string) string {
	if l, ok := roleLabels[r]; ok {
		return l
	}
	return r
}

var statusLabels = map[string]string{
	StatusDraft:     "草稿",
	StatusSubmitted: "已提交待复核",
	StatusReviewed:  "已复核待确认",
	StatusConfirmed: "已确认",
	StatusRejected:  "已驳回",
	StatusArchived:  "已归档",
}

func statusLabel(s string) string {
	if l, ok := statusLabels[s]; ok {
		return l
	}
	return s
}

var evidenceLabels = map[string]string{
	"reg_evidence":     "续保任务登记证据",
	"verify_evidence":  "过程核验证据",
	"archive_evidence": "复核归档证据",
}

type User struct {
	ID          int    `json:"id"`
	Username    string `json:"username"`
	Role        string `json:"role"`
	DisplayName string `json:"displayName"`
}

type Evidence struct {
	Content    string `json:"content"`
	Operator   string `json:"operator"`
	OperatorID int    `json:"operatorId"`
	Timestamp  string `json:"ts"`
}

func (e Evidence) IsEmpty() bool { return e.Content == "" && e.Operator == "" }

type Task struct {
	ID                 int       `json:"id"`
	TaskNo             string    `json:"taskNo"`
	PolicyNo           string    `json:"policyNo"`
	CustomerName       string    `json:"customerName"`
	Product            string    `json:"product"`
	RenewalType        string    `json:"renewalType"`
	OriginalPremium    float64   `json:"originalPremium"`
	NewPremium         float64   `json:"newPremium"`
	Status             string    `json:"status"`
	Version            int       `json:"version"`
	SubmitterName      string    `json:"submitterName"`
	CurrentHandlerRole string    `json:"currentHandlerRole"`
	RegEvidence        *Evidence `json:"regEvidence"`
	VerifyEvidence     *Evidence `json:"verifyEvidence"`
	ArchiveEvidence    *Evidence `json:"archiveEvidence"`
	LastBatchNo        string    `json:"lastBatchNo"`
	CreatedAt          string    `json:"createdAt"`
	UpdatedAt          string    `json:"updatedAt"`
}

type Batch struct {
	ID           int    `json:"id"`
	BatchNo      string `json:"batchNo"`
	Action       string `json:"action"`
	OperatorName string `json:"operatorName"`
	OperatorRole string `json:"operatorRole"`
	Total        int    `json:"total"`
	SuccessCount int    `json:"successCount"`
	FailCount    int    `json:"failCount"`
	Status       string `json:"status"`
	CreatedAt    string `json:"createdAt"`
}

type BatchItem struct {
	ID             int    `json:"id"`
	BatchID        int    `json:"batchId"`
	TaskID         int    `json:"taskId"`
	TaskNo         string `json:"taskNo"`
	Status         string `json:"status"`
	RequestVersion int    `json:"requestVersion"`
	ErrorCode      string `json:"errorCode"`
	ErrorReason    string `json:"errorReason"`
	RetryCount     int    `json:"retryCount"`
	ProcessedAt    string `json:"processedAt"`
}

type AuditLog struct {
	ID           int    `json:"id"`
	BatchID      int    `json:"batchId,omitempty"`
	TaskID       int    `json:"taskId"`
	TaskNo       string `json:"taskNo"`
	Action       string `json:"action"`
	OperatorName string `json:"operatorName"`
	OperatorRole string `json:"operatorRole"`
	FromStatus   string `json:"fromStatus"`
	ToStatus     string `json:"toStatus"`
	Detail       string `json:"detail"`
	CreatedAt    string `json:"createdAt"`
}

type ApiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
}

func (e *ApiError) Error() string { return e.Message }

func errResp(code, msg string) gin_H { return gin_H{"error": &ApiError{Code: code, Message: msg}} }

func errRespField(code, msg, field string) gin_H {
	return gin_H{"error": &ApiError{Code: code, Message: msg, Field: field}}
}

func statusFor(code string) int {
	switch code {
	case "FORBIDDEN_ROLE":
		return http.StatusForbidden
	case "STALE_VERSION", "INVALID_STATUS":
		return http.StatusConflict
	case "MISSING_EVIDENCE", "MISSING_VERSION":
		return http.StatusUnprocessableEntity
	case "UNAUTHORIZED":
		return http.StatusUnauthorized
	case "NOT_FOUND":
		return http.StatusNotFound
	case "INTERNAL":
		return http.StatusInternalServerError
	default:
		return http.StatusBadRequest
	}
}

func parseEvidence(ns sql.NullString) *Evidence {
	if !ns.Valid || ns.String == "" {
		return nil
	}
	var e Evidence
	if err := json.Unmarshal([]byte(ns.String), &e); err != nil {
		return nil
	}
	if e.IsEmpty() {
		return nil
	}
	return &e
}

func marshalEvidence(content, operator string, operatorID int, ts string) (sql.NullString, error) {
	if content == "" {
		return sql.NullString{}, nil
	}
	e := Evidence{Content: content, Operator: operator, OperatorID: operatorID, Timestamp: ts}
	b, err := json.Marshal(e)
	if err != nil {
		return sql.NullString{}, err
	}
	return sql.NullString{String: string(b), Valid: true}, nil
}

type gin_H = map[string]interface{}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type CreateTaskRequest struct {
	PolicyNo        string  `json:"policyNo"`
	CustomerName    string  `json:"customerName"`
	Product         string  `json:"product"`
	RenewalType     string  `json:"renewalType"`
	OriginalPremium float64 `json:"originalPremium"`
	NewPremium      float64 `json:"newPremium"`
	RegEvidence     string  `json:"regEvidence"`
}

type UpdateTaskRequest struct {
	PolicyNo        string  `json:"policyNo"`
	CustomerName    string  `json:"customerName"`
	Product         string  `json:"product"`
	RenewalType     string  `json:"renewalType"`
	OriginalPremium float64 `json:"originalPremium"`
	NewPremium      float64 `json:"newPremium"`
	RegEvidence     string  `json:"regEvidence"`
}

type TransitionRequest struct {
	Action   string `json:"action"`
	Evidence string `json:"evidence"`
	Version  int    `json:"version"`
	Reason   string `json:"reason"`
}

type BatchRequest struct {
	TaskIDs  []int       `json:"taskIds"`
	Action   string      `json:"action"`
	Evidence string      `json:"evidence"`
	Reason   string      `json:"reason"`
	Versions map[int]int `json:"versions"`
}

type RetryRequest struct {
	ItemIDs  []int       `json:"itemIds"`
	Evidence string      `json:"evidence"`
	Versions map[int]int `json:"versions"`
}

type TaskListQuery struct {
	Status  string
	BatchID string
	Q       string
	Page    int
	Size    int
}
