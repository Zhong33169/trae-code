package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"repair-system/internal/database"
	"repair-system/internal/middleware"
	"repair-system/internal/models"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CreateOrderRequest struct {
	CustomerName       string    `json:"customer_name"`
	Phone              string    `json:"phone"`
	VehiclePlate       string    `json:"vehicle_plate"`
	VehicleModel       string    `json:"vehicle_model"`
	Mileage            int       `json:"mileage"`
	AppointmentType    string    `json:"appointment_type"`
	ProblemDescription string    `json:"problem_description"`
	RiskLevel          string    `json:"risk_level"`
	RiskReason         string    `json:"risk_reason"`
	RepairItems        string    `json:"repair_items"`
	EstimatedCost      float64   `json:"estimated_cost"`
	EvidenceSubmitted  bool      `json:"evidence_submitted"`
	EvidenceList       string    `json:"evidence_list"`
	Deadline           time.Time `json:"deadline"`
}

type VersionedRequest struct {
	Version int `json:"version"`
}

type SubmitOrderRequest struct {
	Version int `json:"version"`
}

type SupervisorReviewRequest struct {
	Version      int    `json:"version"`
	Action       string `json:"action"`
	Opinion      string `json:"opinion"`
	Result       string `json:"result"`
	RiskOverride string `json:"risk_override"`
}

type ReviewerReviewRequest struct {
	Version int     `json:"version"`
	Action  string  `json:"action"`
	Opinion string  `json:"opinion"`
	Result  string  `json:"result"`
	FinalCost float64 `json:"final_cost"`
}

type RectifyOrderRequest struct {
	Version            int     `json:"version"`
	CustomerName       string  `json:"customer_name"`
	Phone              string  `json:"phone"`
	VehiclePlate       string  `json:"vehicle_plate"`
	VehicleModel       string  `json:"vehicle_model"`
	Mileage            int     `json:"mileage"`
	ProblemDescription string  `json:"problem_description"`
	RepairItems        string  `json:"repair_items"`
	EstimatedCost      float64 `json:"estimated_cost"`
	EvidenceSubmitted  bool    `json:"evidence_submitted"`
	EvidenceList       string  `json:"evidence_list"`
	Opinion            string  `json:"opinion"`
}

type RiskChangeRequest struct {
	FromLevel string `json:"from_level"`
	ToLevel   string `json:"to_level"`
	Reason    string `json:"reason"`
	Version   int    `json:"version"`
}

func generateOrderNo() string {
	now := time.Now()
	prefix := fmt.Sprintf("WO%s%02d%02d", now.Format("2006"), now.Month(), now.Day())
	suffix := uuid.New().String()[:8]
	return prefix + strings.ToUpper(suffix)
}

func CreateOrder(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetCurrentUser(r.Context())
	if currentUser == nil {
		http.Error(w, `{"error": "未登录"}`, http.StatusUnauthorized)
		return
	}
	if currentUser.Role != models.RoleRegistrar {
		http.Error(w, `{"error": "只有登记员可以创建工单"}`, http.StatusForbidden)
		return
	}

	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "请求参数错误: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if req.CustomerName == "" || req.VehiclePlate == "" {
		http.Error(w, `{"error": "客户姓名和车牌号不能为空"}`, http.StatusBadRequest)
		return
	}

	riskLevel := req.RiskLevel
	if riskLevel == "" {
		riskLevel = models.RiskLow
	}

	order := &models.RepairOrder{
		OrderNo:            generateOrderNo(),
		CustomerName:       req.CustomerName,
		Phone:              req.Phone,
		VehiclePlate:       req.VehiclePlate,
		VehicleModel:       req.VehicleModel,
		Mileage:            req.Mileage,
		AppointmentType:    req.AppointmentType,
		ProblemDescription: req.ProblemDescription,
		Status:             models.StatusDraft,
		RiskLevel:          riskLevel,
		RiskReason:         req.RiskReason,
		Stage:              models.StageAppointment,
		RepairItems:        req.RepairItems,
		EstimatedCost:      req.EstimatedCost,
		EvidenceSubmitted:  req.EvidenceSubmitted,
		EvidenceList:       req.EvidenceList,
		Deadline:           req.Deadline,
		CurrentHandler:     models.RoleRegistrar,
		Version:            1,
		CreatedByID:        currentUser.ID,
	}

	if order.Deadline.IsZero() {
		order.Deadline = time.Now().AddDate(0, 0, 3)
	}

	result := database.DB.Create(order)
	if result.Error != nil {
		http.Error(w, `{"error": "创建工单失败: `+result.Error.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	op := &models.OrderOperation{
		OrderID:        order.ID,
		OperatorID:     currentUser.ID,
		OperatorName:   currentUser.RealName,
		OperatorRole:   currentUser.Role,
		Action:         "create",
		FromStatus:     "",
		ToStatus:       models.StatusDraft,
		Opinion:        "创建工单",
		Result:         "创建成功",
		RiskChange:     fmt.Sprintf("none->%s", riskLevel),
		EvidenceCheck:  fmt.Sprintf("submitted=%v", req.EvidenceSubmitted),
		VersionChecked: 0,
		IpAddress:      getClientIP(r),
	}
	database.DB.Create(op)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(order)
}

func ListOrders(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetCurrentUser(r.Context())
	if currentUser == nil {
		http.Error(w, `{"error": "未登录"}`, http.StatusUnauthorized)
		return
	}

	query := database.DB.Preload("CreatedBy")

	viewFilter := r.URL.Query().Get("view")
	statusFilter := r.URL.Query().Get("status")
	riskFilter := r.URL.Query().Get("risk")
	stageFilter := r.URL.Query().Get("stage")

	if viewFilter == "todo" {
		switch currentUser.Role {
		case models.RoleRegistrar:
			query = query.Where("status IN ? AND (created_by_id = ? OR current_handler = ?)",
				[]string{models.StatusDraft, models.StatusReturnedToRegistrar, models.StatusSupervisorRejected},
				currentUser.ID, models.RoleRegistrar)
		case models.RoleSupervisor:
			query = query.Where("status IN ? OR current_handler = ?",
				[]string{models.StatusSubmitted, models.StatusResubmitted, models.StatusHighRiskEscalated, models.StatusReviewerRejected},
				models.RoleSupervisor)
		case models.RoleReviewer:
			query = query.Where("status = ? OR current_handler = ?",
				models.StatusSupervisorApproved, models.RoleReviewer)
		}
	} else if viewFilter == "my" {
		query = query.Where("created_by_id = ?", currentUser.ID)
	}

	if statusFilter != "" {
		query = query.Where("status = ?", statusFilter)
	}
	if riskFilter != "" {
		query = query.Where("risk_level = ?", riskFilter)
	}
	if stageFilter != "" {
		query = query.Where("stage = ?", stageFilter)
	}

	var orders []models.RepairOrder
	result := query.Order("created_at DESC").Find(&orders)
	if result.Error != nil {
		http.Error(w, `{"error": "查询工单失败"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orders)
}

func GetOrder(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error": "无效的工单ID"}`, http.StatusBadRequest)
		return
	}

	var order models.RepairOrder
	result := database.DB.Preload("CreatedBy").Preload("Operations", func(db *gorm.DB) *gorm.DB {
		return db.Order("created_at ASC")
	}).First(&order, uint(id))

	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			http.Error(w, `{"error": "工单不存在"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error": "查询工单失败"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(order)
}

func SubmitOrder(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetCurrentUser(r.Context())
	if currentUser == nil {
		http.Error(w, `{"error": "未登录"}`, http.StatusUnauthorized)
		return
	}
	if currentUser.Role != models.RoleRegistrar {
		http.Error(w, `{"error": "只有登记员可以提交工单"}`, http.StatusForbidden)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error": "无效的工单ID"}`, http.StatusBadRequest)
		return
	}

	var req SubmitOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "请求参数错误"}`, http.StatusBadRequest)
		return
	}

	var order models.RepairOrder
	if err := database.DB.First(&order, uint(id)).Error; err != nil {
		http.Error(w, `{"error": "工单不存在"}`, http.StatusNotFound)
		return
	}

	if order.CreatedByID != currentUser.ID {
		http.Error(w, `{"error": "只能提交自己创建的工单"}`, http.StatusForbidden)
		return
	}

	fromStatus := order.Status

	op := &models.OrderOperation{
		OrderID:        order.ID,
		OperatorID:     currentUser.ID,
		OperatorName:   currentUser.RealName,
		OperatorRole:   currentUser.Role,
		Action:         "submit",
		FromStatus:     fromStatus,
		VersionChecked: req.Version,
		IpAddress:      getClientIP(r),
	}

	if order.Status != models.StatusDraft && order.Status != models.StatusReturnedToRegistrar {
		op.ToStatus = fromStatus
		op.Result = "失败"
		op.Opinion = fmt.Sprintf("状态错误：当前状态%s不允许提交", order.Status)
		database.DB.Create(op)
		http.Error(w, `{"error": "当前状态不允许提交"}`, http.StatusBadRequest)
		return
	}

	if req.Version != order.Version {
		op.ToStatus = fromStatus
		op.Result = "失败"
		op.Opinion = fmt.Sprintf("版本冲突：期望%d，当前%d", req.Version, order.Version)
		database.DB.Create(op)
		http.Error(w, fmt.Sprintf(`{"error": "版本冲突：期望%d，当前%d"}`, req.Version, order.Version), http.StatusConflict)
		return
	}

	if !order.EvidenceSubmitted {
		op.ToStatus = fromStatus
		op.Result = "失败"
		op.EvidenceCheck = "未提交必填证据"
		op.Opinion = "未提交必填证据"
		database.DB.Create(op)
		http.Error(w, `{"error": "请先提交必填证据"}`, http.StatusBadRequest)
		return
	}

	newStatus := models.StatusSubmitted
	if order.Status == models.StatusReturnedToRegistrar {
		newStatus = models.StatusResubmitted
	}

	order.Status = newStatus
	order.Stage = models.StageAppointment
	order.CurrentHandler = models.RoleSupervisor
	order.Version++
	order.LastOpinion = ""
	order.LastResult = "提交审核"

	op.ToStatus = newStatus
	op.Result = "成功"
	op.Opinion = "提交审核"
	op.EvidenceCheck = "证据齐全"

	database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&order).Error; err != nil {
			return err
		}
		return tx.Create(op).Error
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(order)
}

func SupervisorReview(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetCurrentUser(r.Context())
	if currentUser == nil {
		http.Error(w, `{"error": "未登录"}`, http.StatusUnauthorized)
		return
	}
	if currentUser.Role != models.RoleSupervisor {
		http.Error(w, `{"error": "只有主管可以审核"}`, http.StatusForbidden)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error": "无效的工单ID"}`, http.StatusBadRequest)
		return
	}

	var req SupervisorReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "请求参数错误"}`, http.StatusBadRequest)
		return
	}

	var order models.RepairOrder
	if err := database.DB.First(&order, uint(id)).Error; err != nil {
		http.Error(w, `{"error": "工单不存在"}`, http.StatusNotFound)
		return
	}

	fromStatus := order.Status
	fromRisk := order.RiskLevel

	op := &models.OrderOperation{
		OrderID:        order.ID,
		OperatorID:     currentUser.ID,
		OperatorName:   currentUser.RealName,
		OperatorRole:   currentUser.Role,
		Action:         "supervisor_review_" + req.Action,
		FromStatus:     fromStatus,
		VersionChecked: req.Version,
		IpAddress:      getClientIP(r),
		Opinion:        req.Opinion,
		Result:         req.Result,
	}

	validStatuses := []string{
		models.StatusSubmitted,
		models.StatusResubmitted,
		models.StatusHighRiskEscalated,
		models.StatusReviewerRejected,
	}
	statusValid := false
	for _, s := range validStatuses {
		if order.Status == s {
			statusValid = true
			break
		}
	}
	if !statusValid {
		op.ToStatus = fromStatus
		op.Result = "失败"
		op.Opinion = fmt.Sprintf("状态错误：当前状态%s不允许主管审核", order.Status)
		database.DB.Create(op)
		http.Error(w, `{"error": "当前状态不允许主管审核"}`, http.StatusBadRequest)
		return
	}

	if req.Version != order.Version {
		op.ToStatus = fromStatus
		op.Result = "失败"
		op.Opinion = fmt.Sprintf("版本冲突：期望%d，当前%d", req.Version, order.Version)
		database.DB.Create(op)
		http.Error(w, fmt.Sprintf(`{"error": "版本冲突：期望%d，当前%d"}`, req.Version, order.Version), http.StatusConflict)
		return
	}

	var newStatus string
	var newHandler string
	var newStage string
	riskChangeStr := "none"

	switch req.Action {
	case "approve":
		newStatus = models.StatusSupervisorApproved
		newHandler = models.RoleReviewer
		if fromStatus == models.StatusReviewerRejected {
			newStage = models.StageDispatch
		} else {
			newStage = models.StageDispatch
		}
	case "reject":
		if fromStatus == models.StatusReviewerRejected {
			newStatus = models.StatusReturnedToRegistrar
			newHandler = models.RoleRegistrar
			newStage = models.StageAppointment
		} else {
			newStatus = models.StatusReturnedToRegistrar
			newHandler = models.RoleRegistrar
			newStage = models.StageAppointment
		}
	case "escalate_risk":
		newStatus = models.StatusHighRiskEscalated
		newHandler = models.RoleSupervisor
		newStage = models.StageDispatch
	default:
		http.Error(w, `{"error": "无效的审核动作"}`, http.StatusBadRequest)
		return
	}

	if req.RiskOverride != "" && req.RiskOverride != order.RiskLevel {
		if req.RiskOverride == models.RiskLow || req.RiskOverride == models.RiskMedium || req.RiskOverride == models.RiskHigh {
			riskChangeStr = fmt.Sprintf("%s->%s", fromRisk, req.RiskOverride)
			order.RiskLevel = req.RiskOverride
			if req.RiskOverride == models.RiskHigh {
				order.RiskReason = req.Opinion
			}
			if req.Action != "escalate_risk" && req.RiskOverride == models.RiskHigh {
				newStatus = models.StatusHighRiskEscalated
				newHandler = models.RoleSupervisor
			}
		}
	}

	order.Status = newStatus
	order.CurrentHandler = newHandler
	order.Stage = newStage
	order.Version++
	order.LastOpinion = req.Opinion
	order.LastResult = req.Result
	op.ToStatus = newStatus
	op.RiskChange = riskChangeStr

	database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&order).Error; err != nil {
			return err
		}
		return tx.Create(op).Error
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(order)
}

func ReviewerReview(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetCurrentUser(r.Context())
	if currentUser == nil {
		http.Error(w, `{"error": "未登录"}`, http.StatusUnauthorized)
		return
	}
	if currentUser.Role != models.RoleReviewer {
		http.Error(w, `{"error": "只有复核员可以复核归档"}`, http.StatusForbidden)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error": "无效的工单ID"}`, http.StatusBadRequest)
		return
	}

	var req ReviewerReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "请求参数错误"}`, http.StatusBadRequest)
		return
	}

	var order models.RepairOrder
	if err := database.DB.First(&order, uint(id)).Error; err != nil {
		http.Error(w, `{"error": "工单不存在"}`, http.StatusNotFound)
		return
	}

	fromStatus := order.Status

	op := &models.OrderOperation{
		OrderID:        order.ID,
		OperatorID:     currentUser.ID,
		OperatorName:   currentUser.RealName,
		OperatorRole:   currentUser.Role,
		Action:         "reviewer_review_" + req.Action,
		FromStatus:     fromStatus,
		VersionChecked: req.Version,
		IpAddress:      getClientIP(r),
		Opinion:        req.Opinion,
		Result:         req.Result,
	}

	if order.Status != models.StatusSupervisorApproved {
		op.ToStatus = fromStatus
		op.Result = "失败"
		op.Opinion = fmt.Sprintf("状态错误：当前状态%s不允许复核归档", order.Status)
		database.DB.Create(op)
		http.Error(w, `{"error": "当前状态不允许复核归档"}`, http.StatusBadRequest)
		return
	}

	if req.Version != order.Version {
		op.ToStatus = fromStatus
		op.Result = "失败"
		op.Opinion = fmt.Sprintf("版本冲突：期望%d，当前%d", req.Version, order.Version)
		database.DB.Create(op)
		http.Error(w, fmt.Sprintf(`{"error": "版本冲突：期望%d，当前%d"}`, req.Version, order.Version), http.StatusConflict)
		return
	}

	var newStatus string
	var newHandler string
	var newStage string

	switch req.Action {
	case "approve":
		newStatus = models.StatusArchived
		newHandler = ""
		newStage = models.StageDelivery
		if req.FinalCost > 0 {
			order.FinalCost = req.FinalCost
		}
	case "reject":
		newStatus = models.StatusReviewerRejected
		newHandler = models.RoleSupervisor
		newStage = models.StageDispatch
	default:
		http.Error(w, `{"error": "无效的复核动作"}`, http.StatusBadRequest)
		return
	}

	order.Status = newStatus
	order.CurrentHandler = newHandler
	order.Stage = newStage
	order.Version++
	order.LastOpinion = req.Opinion
	order.LastResult = req.Result
	op.ToStatus = newStatus

	database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&order).Error; err != nil {
			return err
		}
		return tx.Create(op).Error
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(order)
}

func RectifyOrder(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetCurrentUser(r.Context())
	if currentUser == nil {
		http.Error(w, `{"error": "未登录"}`, http.StatusUnauthorized)
		return
	}
	if currentUser.Role != models.RoleRegistrar {
		http.Error(w, `{"error": "只有登记员可以补正工单"}`, http.StatusForbidden)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error": "无效的工单ID"}`, http.StatusBadRequest)
		return
	}

	var req RectifyOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "请求参数错误"}`, http.StatusBadRequest)
		return
	}

	var order models.RepairOrder
	if err := database.DB.First(&order, uint(id)).Error; err != nil {
		http.Error(w, `{"error": "工单不存在"}`, http.StatusNotFound)
		return
	}

	if order.CreatedByID != currentUser.ID {
		http.Error(w, `{"error": "只能补正自己创建的工单"}`, http.StatusForbidden)
		return
	}

	fromStatus := order.Status

	op := &models.OrderOperation{
		OrderID:        order.ID,
		OperatorID:     currentUser.ID,
		OperatorName:   currentUser.RealName,
		OperatorRole:   currentUser.Role,
		Action:         "rectify",
		FromStatus:     fromStatus,
		VersionChecked: req.Version,
		IpAddress:      getClientIP(r),
		Opinion:        req.Opinion,
	}

	if order.Status != models.StatusReturnedToRegistrar {
		op.ToStatus = fromStatus
		op.Result = "失败"
		op.Opinion = fmt.Sprintf("状态错误：当前状态%s不允许补正", order.Status)
		database.DB.Create(op)
		http.Error(w, `{"error": "当前状态不允许补正"}`, http.StatusBadRequest)
		return
	}

	if req.Version != order.Version {
		op.ToStatus = fromStatus
		op.Result = "失败"
		op.Opinion = fmt.Sprintf("版本冲突：期望%d，当前%d", req.Version, order.Version)
		database.DB.Create(op)
		http.Error(w, fmt.Sprintf(`{"error": "版本冲突：期望%d，当前%d"}`, req.Version, order.Version), http.StatusConflict)
		return
	}

	if req.CustomerName != "" {
		order.CustomerName = req.CustomerName
	}
	if req.Phone != "" {
		order.Phone = req.Phone
	}
	if req.VehiclePlate != "" {
		order.VehiclePlate = req.VehiclePlate
	}
	if req.VehicleModel != "" {
		order.VehicleModel = req.VehicleModel
	}
	if req.Mileage > 0 {
		order.Mileage = req.Mileage
	}
	if req.ProblemDescription != "" {
		order.ProblemDescription = req.ProblemDescription
	}
	if req.RepairItems != "" {
		order.RepairItems = req.RepairItems
	}
	if req.EstimatedCost > 0 {
		order.EstimatedCost = req.EstimatedCost
	}
	order.EvidenceSubmitted = req.EvidenceSubmitted
	if req.EvidenceList != "" {
		order.EvidenceList = req.EvidenceList
	}

	// 证据双校验：标记 + 清单非空
	evidenceListStr := strings.Trim(order.EvidenceList, " []\"\",")
	if !order.EvidenceSubmitted {
		op.ToStatus = fromStatus
		op.Result = "失败"
		op.EvidenceCheck = "未提交必填证据(evidence_submitted=false)"
		op.Opinion = "补正时未勾选必填证据标记"
		database.DB.Create(op)
		http.Error(w, `{"error": "请先勾选必填证据"}`, http.StatusBadRequest)
		return
	}
	if evidenceListStr == "" {
		op.ToStatus = fromStatus
		op.Result = "失败"
		op.EvidenceCheck = "证据清单为空(evidence_list=[])"
		op.Opinion = "补正时证据清单为空，请至少勾选一项必填证据"
		database.DB.Create(op)
		http.Error(w, `{"error": "证据清单为空，请至少勾选一项必填证据"}`, http.StatusBadRequest)
		return
	}

	newStatus := models.StatusResubmitted
	order.Status = newStatus
	order.CurrentHandler = models.RoleSupervisor
	order.Stage = models.StageAppointment
	order.Version++
	order.LastOpinion = req.Opinion
	order.LastResult = "补正后重新提交"

	op.ToStatus = newStatus
	op.Result = "成功"
	op.EvidenceCheck = fmt.Sprintf("submitted=%v", req.EvidenceSubmitted)

	database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&order).Error; err != nil {
			return err
		}
		return tx.Create(op).Error
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(order)
}

func RiskChange(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetCurrentUser(r.Context())
	if currentUser == nil {
		http.Error(w, `{"error": "未登录"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error": "无效的工单ID"}`, http.StatusBadRequest)
		return
	}

	var req RiskChangeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "请求参数错误"}`, http.StatusBadRequest)
		return
	}

	var order models.RepairOrder
	if err := database.DB.First(&order, uint(id)).Error; err != nil {
		http.Error(w, `{"error": "工单不存在"}`, http.StatusNotFound)
		return
	}

	fromRisk := order.RiskLevel

	op := &models.OrderOperation{
		OrderID:        order.ID,
		OperatorID:     currentUser.ID,
		OperatorName:   currentUser.RealName,
		OperatorRole:   currentUser.Role,
		Action:         "risk_change",
		FromStatus:     order.Status,
		ToStatus:       order.Status,
		VersionChecked: req.Version,
		IpAddress:      getClientIP(r),
		Opinion:        req.Reason,
		RiskChange:     fmt.Sprintf("%s->%s", req.FromLevel, req.ToLevel),
	}

	// 1. 角色校验：只有主管和复核员可以调整风险
	if currentUser.Role != models.RoleSupervisor && currentUser.Role != models.RoleReviewer {
		op.Result = "失败"
		op.Opinion = fmt.Sprintf("角色%s无权限调整风险等级", currentUser.Role)
		database.DB.Create(op)
		http.Error(w, `{"error": "只有主管和复核员可以调整风险等级"}`, http.StatusForbidden)
		return
	}

	// 2. 当前处理人校验：必须是当前工单的处理人
	if order.CurrentHandler != "" && order.CurrentHandler != currentUser.Role {
		op.Result = "失败"
		op.Opinion = fmt.Sprintf("当前处理人是%s，角色%s无权调整", order.CurrentHandler, currentUser.Role)
		database.DB.Create(op)
		http.Error(w, fmt.Sprintf(`{"error": "当前工单由%s办理，请切换到对应角色操作"}`, order.CurrentHandler), http.StatusForbidden)
		return
	}

	// 3. 状态校验：已归档工单不可调整风险
	if order.Status == models.StatusArchived {
		op.Result = "失败"
		op.Opinion = "已归档工单不可调整风险"
		database.DB.Create(op)
		http.Error(w, `{"error": "已归档工单不可调整风险"}`, http.StatusBadRequest)
		return
	}

	// 4. 版本号校验
	if req.Version != order.Version {
		op.Result = "失败"
		op.Opinion = fmt.Sprintf("版本冲突：期望%d，当前%d", req.Version, order.Version)
		database.DB.Create(op)
		http.Error(w, fmt.Sprintf(`{"error": "版本冲突：期望%d，当前%d"}`, req.Version, order.Version), http.StatusConflict)
		return
	}

	// 5. 原因必填校验
	if strings.TrimSpace(req.Reason) == "" {
		op.Result = "失败"
		op.Opinion = "风险调整原因不能为空"
		database.DB.Create(op)
		http.Error(w, `{"error": "请填写风险调整原因"}`, http.StatusBadRequest)
		return
	}

	validLevels := map[string]bool{models.RiskLow: true, models.RiskMedium: true, models.RiskHigh: true}
	if !validLevels[req.ToLevel] {
		op.Result = "失败"
		op.Opinion = fmt.Sprintf("无效的风险等级: %s", req.ToLevel)
		database.DB.Create(op)
		http.Error(w, `{"error": "无效的目标风险等级"}`, http.StatusBadRequest)
		return
	}

	if req.FromLevel != fromRisk {
		op.Result = "失败"
		op.Opinion = fmt.Sprintf("源风险等级不匹配：期望%s，当前%s", req.FromLevel, fromRisk)
		database.DB.Create(op)
		http.Error(w, `{"error": "源风险等级不匹配"}`, http.StatusBadRequest)
		return
	}

	if req.ToLevel == models.RiskHigh {
		order.RiskReason = req.Reason
	}
	order.RiskLevel = req.ToLevel
	order.Version++

	changeType := "none"
	if req.ToLevel != fromRisk {
		if riskPriority(req.ToLevel) > riskPriority(fromRisk) {
			changeType = "upgrade"
		} else {
			changeType = "downgrade"
		}
		if req.ToLevel == models.RiskHigh && order.Status != models.StatusHighRiskEscalated &&
			(order.Status == models.StatusSubmitted || order.Status == models.StatusResubmitted) {
			order.Status = models.StatusHighRiskEscalated
			order.CurrentHandler = models.RoleSupervisor
		}
	}

	op.RiskChange = fmt.Sprintf("%s:%s->%s", changeType, fromRisk, req.ToLevel)
	op.Result = "成功"

	database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&order).Error; err != nil {
			return err
		}
		return tx.Create(op).Error
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(order)
}

func riskPriority(level string) int {
	switch level {
	case models.RiskLow:
		return 1
	case models.RiskMedium:
		return 2
	case models.RiskHigh:
		return 3
	default:
		return 0
	}
}

func getClientIP(r *http.Request) string {
	ip := r.Header.Get("X-Forwarded-For")
	if ip == "" {
		ip = r.Header.Get("X-Real-IP")
	}
	if ip == "" {
		ip = r.RemoteAddr
	}
	return ip
}

func DeleteOrder(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetCurrentUser(r.Context())
	if currentUser == nil {
		http.Error(w, `{"error": "未登录"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error": "无效的工单ID"}`, http.StatusBadRequest)
		return
	}

	var order models.RepairOrder
	if err := database.DB.First(&order, uint(id)).Error; err != nil {
		http.Error(w, `{"error": "工单不存在"}`, http.StatusNotFound)
		return
	}

	if currentUser.Role != models.RoleRegistrar {
		http.Error(w, `{"error": "只有登记员可以删除工单"}`, http.StatusForbidden)
		return
	}

	if order.CreatedByID != currentUser.ID {
		http.Error(w, `{"error": "只能删除自己创建的工单"}`, http.StatusForbidden)
		return
	}

	if order.Status != models.StatusDraft {
		http.Error(w, `{"error": "只能删除草稿状态的工单"}`, http.StatusBadRequest)
		return
	}

	result := database.DB.Delete(&order)
	if result.Error != nil {
		http.Error(w, `{"error": "删除工单失败"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "删除成功"})
}

var _ = errors.New
