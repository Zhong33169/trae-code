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
	if err := database.DB.First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	fromStatus := string(order.Status)
	action := req.Action

	switch action {
	case "submit":
		if userRole != "registrar" {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权限操作"})
			return
		}
		if order.Status != models.StatusDraft && order.Status != models.StatusSupplement && order.Status != models.StatusReturned {
			c.JSON(http.StatusBadRequest, gin.H{"error": "当前状态不可提交"})
			return
		}

		var pendingAttachments int64
		database.DB.Model(&models.Attachment{}).Where("order_id = ? AND status = ?", order.ID, "pending").Count(&pendingAttachments)

		var totalAttachments int64
		database.DB.Model(&models.Attachment{}).Where("order_id = ?", order.ID).Count(&totalAttachments)

		if totalAttachments == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请先上传附件后再提交"})
			return
		}

		var rejectedAttachments int64
		database.DB.Model(&models.Attachment{}).Where("order_id = ? AND status = ?", order.ID, "rejected").Count(&rejectedAttachments)
		if rejectedAttachments > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "存在被驳回的附件，请修正后再提交"})
			return
		}

		order.Status = models.StatusPending
		order.CurrentHandler = 2
		order.HandlerName = "王审核"
		addAuditLog(order.ID, "提交审核", userID, userName, userRole, req.Remark, fromStatus, string(models.StatusPending))

	case "start_process":
		if userRole != "auditor" {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权限操作"})
			return
		}
		if order.Status != models.StatusPending {
			c.JSON(http.StatusBadRequest, gin.H{"error": "当前状态不可处理"})
			return
		}
		order.Status = models.StatusProcessing
		order.CurrentHandler = userID
		order.HandlerName = userName
		addAuditLog(order.ID, "开始审核", userID, userName, userRole, req.Remark, fromStatus, string(models.StatusProcessing))

	case "approve":
		if userRole != "auditor" {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权限操作"})
			return
		}
		if order.Status != models.StatusProcessing {
			c.JSON(http.StatusBadRequest, gin.H{"error": "当前状态不可审核通过"})
			return
		}
		order.Status = models.StatusReview
		order.Result = req.Result
		order.CurrentHandler = 3
		order.HandlerName = "张复核"
		addAuditLog(order.ID, "审核通过", userID, userName, userRole, req.Remark, fromStatus, string(models.StatusReview))

	case "reject":
		if userRole != "auditor" {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权限操作"})
			return
		}
		if order.Status != models.StatusProcessing && order.Status != models.StatusPending {
			c.JSON(http.StatusBadRequest, gin.H{"error": "当前状态不可驳回"})
			return
		}
		order.Status = models.StatusRejected
		order.RejectReason = req.Reason
		order.CurrentHandler = 0
		order.HandlerName = ""
		addAuditLog(order.ID, "审核驳回", userID, userName, userRole, req.Reason, fromStatus, string(models.StatusRejected))

	case "return_supplement":
		if userRole != "auditor" {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权限操作"})
			return
		}
		if order.Status != models.StatusProcessing && order.Status != models.StatusPending {
			c.JSON(http.StatusBadRequest, gin.H{"error": "当前状态不可退回补正"})
			return
		}
		order.Status = models.StatusSupplement
		order.RejectReason = req.Reason
		order.CurrentHandler = order.CreatedBy
		order.HandlerName = order.CreatedByName
		addAuditLog(order.ID, "退回补正", userID, userName, userRole, req.Reason, fromStatus, string(models.StatusSupplement))

	case "review_approve":
		if userRole != "reviewer" {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权限操作"})
			return
		}
		if order.Status != models.StatusReview {
			c.JSON(http.StatusBadRequest, gin.H{"error": "当前状态不可复核"})
			return
		}
		now := time.Now()
		order.Status = models.StatusCompleted
		order.AuditRemark = req.Remark
		order.CompletedAt = &now
		order.CurrentHandler = 0
		order.HandlerName = ""
		addAuditLog(order.ID, "复核归档", userID, userName, userRole, req.Remark, fromStatus, string(models.StatusCompleted))

	case "review_return":
		if userRole != "reviewer" {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权限操作"})
			return
		}
		if order.Status != models.StatusReview {
			c.JSON(http.StatusBadRequest, gin.H{"error": "当前状态不可退回"})
			return
		}
		order.Status = models.StatusReturned
		order.ReturnReason = req.Reason
		order.CurrentHandler = order.CreatedBy
		order.HandlerName = order.CreatedByName
		addAuditLog(order.ID, "复核退回", userID, userName, userRole, req.Reason, fromStatus, string(models.StatusReturned))

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "未知操作"})
		return
	}

	order.UpdatedAt = time.Now()
	database.DB.Save(&order)

	c.JSON(http.StatusOK, order)
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
