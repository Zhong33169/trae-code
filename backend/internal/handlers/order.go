package handlers

import (
	"fmt"
	"member-service/internal/database"
	"member-service/internal/middleware"
	"member-service/internal/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetOrders(c *gin.Context) {
	var req models.OrderListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 10
	}

	query := database.DB.Model(&models.MemberServiceOrder{})

	if req.Status != "" && req.Status != "all" {
		query = query.Where("status = ?", req.Status)
	}

	if req.Keyword != "" {
		query = query.Where("order_no LIKE ? OR member_name LIKE ? OR member_phone LIKE ?",
			"%"+req.Keyword+"%", "%"+req.Keyword+"%", "%"+req.Keyword+"%")
	}

	var total int64
	query.Count(&total)

	var orders []models.MemberServiceOrder
	offset := (req.Page - 1) * req.PageSize
	query.Order("created_at DESC").Offset(offset).Limit(req.PageSize).Find(&orders)

	c.JSON(http.StatusOK, models.OrderListResponse{
		Total: total,
		List:  orders,
	})
}

func GetOrder(c *gin.Context) {
	id := c.Param("id")

	var order models.MemberServiceOrder
	if err := database.DB.Preload("Attachments").Preload("Logs", func(db *gorm.DB) *gorm.DB {
		return db.Order("created_at DESC")
	}).First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	c.JSON(http.StatusOK, order)
}

func GetRequiredMaterials(c *gin.Context) {
	serviceType := c.Query("service_type")
	materials := models.GetRequiredMaterials(serviceType)
	c.JSON(http.StatusOK, materials)
}

func GetAttachmentStatus(c *gin.Context) {
	id := c.Param("id")

	var order models.MemberServiceOrder
	if err := database.DB.Preload("Attachments").First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	requiredMaterials := models.GetRequiredMaterials(order.ServiceType)
	materialsMap := make(map[string]map[string]interface{})
	missingRequired := make([]map[string]interface{}, 0)
	hasRejected := false

	for _, mat := range requiredMaterials {
		item := map[string]interface{}{
			"type":          mat.Type,
			"name":          mat.Name,
			"required":      mat.Required,
			"status":        "missing",
			"file":          nil,
			"reject_reason": "",
		}

		for _, att := range order.Attachments {
			if att.MaterialType == mat.Type {
				item["status"] = att.Status
				item["file"] = att
				if att.RejectReason != "" {
					item["reject_reason"] = att.RejectReason
					hasRejected = true
				}
				break
			}
		}

		if mat.Required && item["status"] == "missing" {
			missingRequired = append(missingRequired, map[string]interface{}{
				"type": mat.Type,
				"name": mat.Name,
			})
		}

		materialsMap[mat.Type] = item
	}

	allApproved := checkAllRequiredComplete(order.Attachments, order.ServiceType)

	c.JSON(http.StatusOK, gin.H{
		"service_type":     order.ServiceType,
		"materials":        materialsMap,
		"all_approved":     allApproved,
		"missing_required": missingRequired,
		"has_rejected":     hasRejected,
	})
}

func checkAllRequiredComplete(attachments []models.Attachment, serviceType string) bool {
	requiredMaterials := models.GetRequiredMaterials(serviceType)
	for _, mat := range requiredMaterials {
		if !mat.Required {
			continue
		}
		found := false
		for _, att := range attachments {
			if att.MaterialType == mat.Type && att.Status == "approved" {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

func checkHasRejectedAttachment(attachments []models.Attachment) bool {
	for _, att := range attachments {
		if att.Status == "rejected" {
			return true
		}
	}
	return false
}

func CreateOrder(c *gin.Context) {
	var req models.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, userName, _ := middleware.GetCurrentUser(c)

	now := time.Now()
	orderNo := fmt.Sprintf("MSO%s%03d", now.Format("20060102"), time.Now().Unix()%1000)

	dueAt := now.Add(24 * time.Hour)

	order := models.MemberServiceOrder{
		OrderNo:        orderNo,
		MemberName:     req.MemberName,
		MemberPhone:    req.MemberPhone,
		ServiceType:    req.ServiceType,
		Status:         models.StatusPending,
		Priority:       req.Priority,
		Description:    req.Description,
		CreatedBy:      userID,
		CreatedByName:  userName,
		CurrentHandler: 2,
		HandlerName:    "王审核",
		DueAt:          &dueAt,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := database.DB.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	addAuditLog(order.ID, "创建工单", userID, userName, "registrar", "提交会员服务单申请", "", string(models.StatusPending))

	c.JSON(http.StatusOK, order)
}

func ProcessOrder(c *gin.Context) {
	id := c.Param("id")
	userID, userName, userRole := middleware.GetCurrentUser(c)

	var req models.ProcessOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var order models.MemberServiceOrder
	if err := database.DB.Preload("Attachments").First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	result := processSingleOrder(&order, req.Action, req.Remark, req.Result, req.Reason, userID, userName, userRole)

	if !result.Success {
		c.JSON(http.StatusBadRequest, gin.H{"error": result.Message})
		return
	}

	c.JSON(http.StatusOK, order)
}

func BatchProcessOrders(c *gin.Context) {
	userID, userName, userRole := middleware.GetCurrentUser(c)

	var req models.BatchProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	results := make([]models.BatchProcessResult, 0)
	successCount := 0
	failedCount := 0

	for _, orderID := range req.OrderIDs {
		var order models.MemberServiceOrder
		if err := database.DB.Preload("Attachments").First(&order, orderID).Error; err != nil {
			results = append(results, models.BatchProcessResult{
				OrderID: orderID,
				OrderNo: "",
				Success: false,
				Message: "工单不存在",
			})
			failedCount++
			continue
		}

		result := processSingleOrder(&order, req.Action, req.Remark, req.Result, req.Reason, userID, userName, userRole)

		batchResult := models.BatchProcessResult{
			OrderID: order.ID,
			OrderNo: order.OrderNo,
			Success: result.Success,
			Message: result.Message,
			Status:  string(order.Status),
		}
		results = append(results, batchResult)

		if result.Success {
			successCount++
		} else {
			failedCount++
		}
	}

	addBatchAuditLog(req.Action, userID, userName, userRole, results)

	response := models.BatchProcessResponse{
		Total:   len(req.OrderIDs),
		Success: successCount,
		Failed:  failedCount,
		Results: results,
	}

	c.JSON(http.StatusOK, response)
}

type processResult struct {
	Success bool
	Message string
}

func processSingleOrder(order *models.MemberServiceOrder, action, remark, result, reason string, userID int64, userName, userRole string) processResult {
	fromStatus := string(order.Status)

	switch action {
	case "submit":
		if userRole != "registrar" {
			return processResult{Success: false, Message: "无权限操作"}
		}
		if order.Status != models.StatusDraft && order.Status != models.StatusSupplement && order.Status != models.StatusReturned {
			return processResult{Success: false, Message: "当前状态不可提交"}
		}

		if len(order.Attachments) == 0 {
			return processResult{Success: false, Message: "请先上传附件后再提交"}
		}

		if checkHasRejectedAttachment(order.Attachments) {
			return processResult{Success: false, Message: "存在被驳回的附件，请修正后再提交"}
		}

		if !checkAllRequiredComplete(order.Attachments, order.ServiceType) {
			return processResult{Success: false, Message: "必需材料不齐全，请补齐所有必需材料后再提交"}
		}

		order.Status = models.StatusPending
		order.CurrentHandler = 2
		order.HandlerName = "王审核"
		addAuditLog(order.ID, "提交审核", userID, userName, userRole, remark, fromStatus, string(models.StatusPending))

	case "start_process":
		if userRole != "auditor" {
			return processResult{Success: false, Message: "无权限操作"}
		}
		if order.Status != models.StatusPending {
			return processResult{Success: false, Message: "当前状态不可处理"}
		}
		order.Status = models.StatusProcessing
		order.CurrentHandler = userID
		order.HandlerName = userName
		addAuditLog(order.ID, "开始审核", userID, userName, userRole, remark, fromStatus, string(models.StatusProcessing))

	case "approve":
		if userRole != "auditor" {
			return processResult{Success: false, Message: "无权限操作"}
		}
		if order.Status != models.StatusProcessing {
			return processResult{Success: false, Message: "当前状态不可审核通过"}
		}

		if !checkAllRequiredComplete(order.Attachments, order.ServiceType) {
			return processResult{Success: false, Message: "必需材料不齐全，无法审核通过"}
		}

		order.Status = models.StatusReview
		order.Result = result
		order.CurrentHandler = 3
		order.HandlerName = "张复核"
		addAuditLog(order.ID, "审核通过", userID, userName, userRole, remark, fromStatus, string(models.StatusReview))

	case "reject":
		if userRole != "auditor" {
			return processResult{Success: false, Message: "无权限操作"}
		}
		if order.Status != models.StatusProcessing && order.Status != models.StatusPending {
			return processResult{Success: false, Message: "当前状态不可驳回"}
		}
		if reason == "" {
			return processResult{Success: false, Message: "请填写驳回原因"}
		}
		order.Status = models.StatusRejected
		order.RejectReason = reason
		order.CurrentHandler = 0
		order.HandlerName = ""
		addAuditLog(order.ID, "审核驳回", userID, userName, userRole, reason, fromStatus, string(models.StatusRejected))

	case "return_supplement":
		if userRole != "auditor" {
			return processResult{Success: false, Message: "无权限操作"}
		}
		if order.Status != models.StatusProcessing && order.Status != models.StatusPending {
			return processResult{Success: false, Message: "当前状态不可退回补正"}
		}
		if reason == "" {
			return processResult{Success: false, Message: "请填写退回原因"}
		}
		order.Status = models.StatusSupplement
		order.RejectReason = reason
		order.CurrentHandler = order.CreatedBy
		order.HandlerName = order.CreatedByName
		addAuditLog(order.ID, "退回补正", userID, userName, userRole, reason, fromStatus, string(models.StatusSupplement))

	case "review_approve":
		if userRole != "reviewer" {
			return processResult{Success: false, Message: "无权限操作"}
		}
		if order.Status != models.StatusReview {
			return processResult{Success: false, Message: "当前状态不可复核"}
		}

		if !checkAllRequiredComplete(order.Attachments, order.ServiceType) {
			return processResult{Success: false, Message: "必需材料不齐全，无法复核归档"}
		}

		now := time.Now()
		order.Status = models.StatusCompleted
		order.AuditRemark = remark
		order.CompletedAt = &now
		order.CurrentHandler = 0
		order.HandlerName = ""
		addAuditLog(order.ID, "复核归档", userID, userName, userRole, remark, fromStatus, string(models.StatusCompleted))

	case "review_return":
		if userRole != "reviewer" {
			return processResult{Success: false, Message: "无权限操作"}
		}
		if order.Status != models.StatusReview {
			return processResult{Success: false, Message: "当前状态不可退回"}
		}
		if reason == "" {
			return processResult{Success: false, Message: "请填写退回原因"}
		}
		order.Status = models.StatusReturned
		order.ReturnReason = reason
		order.CurrentHandler = order.CreatedBy
		order.HandlerName = order.CreatedByName
		addAuditLog(order.ID, "复核退回", userID, userName, userRole, reason, fromStatus, string(models.StatusReturned))

	default:
		return processResult{Success: false, Message: "未知操作"}
	}

	order.UpdatedAt = time.Now()
	database.DB.Save(order)

	return processResult{Success: true, Message: "操作成功"}
}

func addAuditLog(orderID int64, action string, operatorID int64, operator string, role string, remark string, fromStatus string, toStatus string) {
	log := models.AuditLog{
		OrderID:    orderID,
		Action:     action,
		OperatorID: operatorID,
		Operator:   operator,
		Role:       role,
		Remark:     remark,
		FromStatus: fromStatus,
		ToStatus:   toStatus,
		CreatedAt:  time.Now(),
	}
	database.DB.Create(&log)
}

func addBatchAuditLog(action string, operatorID int64, operator string, role string, results []models.BatchProcessResult) {
	successCount := 0
	failedCount := 0
	failedDetails := ""
	for _, r := range results {
		if r.Success {
			successCount++
		} else {
			failedCount++
			if failedDetails != "" {
				failedDetails += "; "
			}
			failedDetails += fmt.Sprintf("%s: %s", r.OrderNo, r.Message)
		}
	}

	remark := fmt.Sprintf("批量处理 %d 单，成功 %d 单，失败 %d 单", len(results), successCount, failedCount)
	if failedCount > 0 {
		remark += "。失败详情: " + failedDetails
	}

	log := models.AuditLog{
		OrderID:    0,
		Action:     "批量" + getActionName(action),
		OperatorID: operatorID,
		Operator:   operator,
		Role:       role,
		Remark:     remark,
		CreatedAt:  time.Now(),
	}
	database.DB.Create(&log)
}

func getActionName(action string) string {
	names := map[string]string{
		"submit":            "提交",
		"start_process":     "开始审核",
		"approve":           "审核通过",
		"reject":            "驳回",
		"return_supplement": "退回补正",
		"review_approve":    "复核归档",
		"review_return":     "复核退回",
	}
	if name, ok := names[action]; ok {
		return name
	}
	return action
}
