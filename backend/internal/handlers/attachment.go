package handlers

import (
	"member-service/internal/database"
	"member-service/internal/middleware"
	"member-service/internal/models"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func GetAttachments(c *gin.Context) {
	orderID := c.Param("orderId")

	var attachments []models.Attachment
	database.DB.Where("order_id = ?", orderID).Order("created_at DESC").Find(&attachments)

	c.JSON(http.StatusOK, attachments)
}

func UploadAttachment(c *gin.Context) {
	orderIDStr := c.Param("orderId")
	orderID, err := strconv.ParseInt(orderIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	userID, userName, _ := middleware.GetCurrentUser(c)

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	attachment := models.Attachment{
		OrderID:        orderID,
		FileName:       file.Filename,
		FileType:       file.Header.Get("Content-Type"),
		FileSize:       file.Size,
		UploadedBy:     userID,
		UploadedByName: userName,
		Status:         "pending",
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := database.DB.Create(&attachment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var order models.MemberServiceOrder
	database.DB.First(&order, orderID)
	order.UpdatedAt = time.Now()
	database.DB.Save(&order)

	addAuditLog(orderID, "上传附件", userID, userName, "registrar", "上传附件: "+file.Filename, "", "")

	c.JSON(http.StatusOK, attachment)
}

func RejectAttachment(c *gin.Context) {
	id := c.Param("id")
	userID, userName, userRole := middleware.GetCurrentUser(c)

	if userRole != "auditor" && userRole != "reviewer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权限操作"})
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var attachment models.Attachment
	if err := database.DB.First(&attachment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Attachment not found"})
		return
	}

	attachment.Status = "rejected"
	attachment.RejectReason = req.Reason
	attachment.UpdatedAt = time.Now()
	database.DB.Save(&attachment)

	addAuditLog(attachment.OrderID, "驳回附件", userID, userName, userRole,
		"附件["+attachment.FileName+"]被驳回: "+req.Reason, "", "")

	c.JSON(http.StatusOK, attachment)
}

func ApproveAttachment(c *gin.Context) {
	id := c.Param("id")
	userID, userName, userRole := middleware.GetCurrentUser(c)

	if userRole != "auditor" && userRole != "reviewer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权限操作"})
		return
	}

	var attachment models.Attachment
	if err := database.DB.First(&attachment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Attachment not found"})
		return
	}

	attachment.Status = "approved"
	attachment.RejectReason = ""
	attachment.UpdatedAt = time.Now()
	database.DB.Save(&attachment)

	addAuditLog(attachment.OrderID, "通过附件", userID, userName, userRole,
		"附件["+attachment.FileName+"]审核通过", "", "")

	c.JSON(http.StatusOK, attachment)
}

func DeleteAttachment(c *gin.Context) {
	id := c.Param("id")
	userID, userName, userRole := middleware.GetCurrentUser(c)

	var attachment models.Attachment
	if err := database.DB.First(&attachment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Attachment not found"})
		return
	}

	if userRole != "registrar" || attachment.UploadedBy != userID {
		if userRole != "registrar" {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权限操作"})
			return
		}
	}

	database.DB.Delete(&attachment)

	addAuditLog(attachment.OrderID, "删除附件", userID, userName, userRole,
		"删除附件: "+attachment.FileName, "", "")

	c.JSON(http.StatusOK, gin.H{"message": "Deleted successfully"})
}
