package handlers

import (
	"fmt"
	"member-service/internal/database"
	"member-service/internal/middleware"
	"member-service/internal/models"
	"net/http"
	"strings"
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

	query := database.DB.Model(&models.MemberServiceOrder{}).Preload("Attachments").Preload("Logs", func(db *gorm.DB) *gorm.DB {
		return db.Order("created_at DESC")
	})

	if req.Status != "" && req.Status != "all" {
		query = query.Where("status = ?", req.Status)
	}

	if req.Keyword != "" {
		query = query.Where("order_no LIKE ? OR member_name LIKE ? OR member_phone LIKE ?",
			"%"+req.Keyword+"%", "%"+req.Keyword+"%", "%"+req.Keyword+"%")
	}

	var total int64
	var allOrders []models.MemberServiceOrder
	query.Order("created_at DESC").Find(&allOrders)
	total = int64(len(allOrders))

	now := time.Now()
	for i := range allOrders {
		allOrders[i].Exceptions = getOrderExceptions(&allOrders[i], now)
	}

	if req.Exception != "" && req.Exception != "all" {
		filtered := make([]models.MemberServiceOrder, 0)
		for _, order := range allOrders {
			for _, exc := range order.Exceptions {
				if exc.Type == req.Exception {
					filtered = append(filtered, order)
					break
				}
			}
		}
		allOrders = filtered
		total = int64(len(allOrders))
	}

	offset := (req.Page - 1) * req.PageSize
	end := offset + req.PageSize
	if offset > len(allOrders) {
		allOrders = []models.MemberServiceOrder{}
	} else if end > len(allOrders) {
		allOrders = allOrders[offset:]
	} else {
		allOrders = allOrders[offset:end]
	}

	c.JSON(http.StatusOK, models.OrderListResponse{
		Total: total,
		List:  allOrders,
	})
}

func getOrderExceptions(order *models.MemberServiceOrder, now time.Time) []models.ExceptionInfo {
	exceptions := make([]models.ExceptionInfo, 0)

	if order.DueAt != nil && !order.DueAt.IsZero() && now.After(*order.DueAt) &&
		order.Status != models.StatusCompleted && order.Status != models.StatusRejected {
		exceptions = append(exceptions, models.ExceptionInfo{
			Type:  "overdue",
			Label: "超时",
			Color: "#f5222d",
			Desc:  "超过截止时间未处理",
		})
	}

	if order.Status == models.StatusSupplement || order.Status == models.StatusReturned {
		label := "退回补正"
		desc := "需要补充材料"
		if order.Status == models.StatusReturned {
			label = "复核退回"
			desc = "复核未通过，需要修正"
		}
		exceptions = append(exceptions, models.ExceptionInfo{
			Type:  "returned",
			Label: label,
			Color: "#faad14",
			Desc:  desc,
		})
	}

	missing := getMissingRequiredMaterials(order.Attachments, order.ServiceType)
	if len(missing) > 0 && order.Status != models.StatusCompleted && order.Status != models.StatusRejected {
		names := make([]string, 0)
		for _, m := range missing {
			names = append(names, m.Name)
		}
		exceptions = append(exceptions, models.ExceptionInfo{
			Type:  "missing_material",
			Label: "缺必需材料",
			Color: "#fa8c16",
			Desc:  "缺少: " + strings.Join(names, "、"),
		})
	}

	hasBatchFail := false
	for _, log := range order.Logs {
		if strings.Contains(log.Action, "批量") && strings.Contains(log.Action, "失败") {
			hasBatchFail = true
			break
		}
	}
	if hasBatchFail {
		exceptions = append(exceptions, models.ExceptionInfo{
			Type:  "batch_failed",
			Label: "批量失败",
			Color: "#eb2f96",
			Desc:  "批量处理未通过",
		})
	}

	return exceptions
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
	hasUnresolved := false

	for _, mat := range requiredMaterials {
		latestAtt := getLatestAttachmentByType(order.Attachments, mat.Type)
		history := make([]models.Attachment, 0)
		for _, att := range order.Attachments {
			if att.MaterialType == mat.Type {
				history = append(history, att)
			}
		}

		status := "missing"
		var file *models.Attachment
		rejectReason := ""
		hasApproved := false

		if latestAtt != nil {
			status = latestAtt.Status
			file = latestAtt
			rejectReason = latestAtt.RejectReason
		}

		for _, att := range order.Attachments {
			if att.MaterialType == mat.Type && att.Status == "approved" {
				hasApproved = true
				break
			}
		}

		if mat.Required && !hasApproved {
			missingRequired = append(missingRequired, map[string]interface{}{
				"type": mat.Type,
				"name": mat.Name,
			})
			for _, att := range order.Attachments {
				if att.MaterialType == mat.Type && att.Status == "rejected" {
					hasUnresolved = true
					break
				}
			}
		}

		item := map[string]interface{}{
			"type":          mat.Type,
			"name":          mat.Name,
			"required":      mat.Required,
			"status":        status,
			"file":          file,
			"reject_reason": rejectReason,
			"history":       history,
			"has_approved":  hasApproved,
		}
		materialsMap[mat.Type] = item
	}

	allApproved := checkAllRequiredComplete(order.Attachments, order.ServiceType)

	c.JSON(http.StatusOK, gin.H{
		"service_type":     order.ServiceType,
		"materials":        materialsMap,
		"all_approved":     allApproved,
		"missing_required": missingRequired,
		"has_unresolved":   hasUnresolved,
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

func getMissingRequiredMaterials(attachments []models.Attachment, serviceType string) []models.RequiredMaterial {
	requiredMaterials := models.GetRequiredMaterials(serviceType)
	missing := make([]models.RequiredMaterial, 0)
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
			missing = append(missing, mat)
		}
	}
	return missing
}

func getLatestAttachmentByType(attachments []models.Attachment, materialType string) *models.Attachment {
	var latest *models.Attachment
	for i := range attachments {
		if attachments[i].MaterialType == materialType {
			if latest == nil || attachments[i].CreatedAt.After(latest.CreatedAt) {
				latest = &attachments[i]
			}
		}
	}
	return latest
}

func hasUnresolvedRejection(attachments []models.Attachment, serviceType string) bool {
	requiredMaterials := models.GetRequiredMaterials(serviceType)
	for _, mat := range requiredMaterials {
		if !mat.Required {
			continue
		}
		hasApproved := false
		hasRejected := false
		for _, att := range attachments {
			if att.MaterialType == mat.Type {
				if att.Status == "approved" {
					hasApproved = true
				}
				if att.Status == "rejected" {
					hasRejected = true
				}
			}
		}
		if hasRejected && !hasApproved {
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
		processedAt := time.Now()
		if err := database.DB.Preload("Attachments").First(&order, orderID).Error; err != nil {
			batchResult := models.BatchProcessResult{
				OrderID:     orderID,
				OrderNo:     "",
				Success:     false,
				Message:     "工单不存在",
				OperatorID:  userID,
				Operator:    userName,
				Role:        userRole,
				Action:      req.Action,
				ProcessedAt: processedAt.Format(time.RFC3339),
			}
			results = append(results, batchResult)
			failedCount++
			continue
		}

		fromStatus := string(order.Status)
		result := processSingleOrder(&order, req.Action, req.Remark, req.Result, req.Reason, userID, userName, userRole)

		batchResult := models.BatchProcessResult{
			OrderID:     order.ID,
			OrderNo:     order.OrderNo,
			Success:     result.Success,
			Message:     result.Message,
			Status:      string(order.Status),
			OperatorID:  userID,
			Operator:    userName,
			Role:        userRole,
			Action:      req.Action,
			ProcessedAt: processedAt.Format(time.RFC3339),
		}
		results = append(results, batchResult)

		if result.Success {
			successCount++
		} else {
			failedCount++
			actionName := getActionName(req.Action)
			remark := fmt.Sprintf("批量%s失败: %s", actionName, result.Message)
			addAuditLog(order.ID, "批量"+actionName+"失败", userID, userName, userRole, remark, fromStatus, fromStatus)
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

		if hasUnresolvedRejection(order.Attachments, order.ServiceType) {
			missing := getMissingRequiredMaterials(order.Attachments, order.ServiceType)
			if len(missing) > 0 {
				names := make([]string, 0)
				for _, m := range missing {
					names = append(names, m.Name)
				}
				return processResult{Success: false, Message: "必需材料不齐全或存在未修正的驳回附件：" + strings.Join(names, "、")}
			}
		}

		if !checkAllRequiredComplete(order.Attachments, order.ServiceType) {
			missing := getMissingRequiredMaterials(order.Attachments, order.ServiceType)
			names := make([]string, 0)
			for _, m := range missing {
				names = append(names, m.Name)
			}
			return processResult{Success: false, Message: "必需材料不齐全，请补齐：" + strings.Join(names, "、")}
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
