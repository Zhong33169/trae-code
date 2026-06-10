package handlers

import (
	"net/http"
	"strconv"
	"zqzl/backend/database"
	"zqzl/backend/models"

	"github.com/gin-gonic/gin"
)

func GetAuditLogs(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var logs []models.AuditLog
	database.DB.Where("enrollment_id = ?", id).Order("created_at desc").Find(&logs)

	c.JSON(http.StatusOK, logs)
}

func GetAllAuditLogs(c *gin.Context) {
	var logs []models.AuditLog
	query := database.DB.Model(&models.AuditLog{})

	userName := c.Query("user")
	if userName != "" {
		query = query.Where("user_name LIKE ?", "%"+userName+"%")
	}

	query.Order("created_at desc").Limit(100).Find(&logs)

	c.JSON(http.StatusOK, logs)
}

func GetStats(c *gin.Context) {
	var total int64
	database.DB.Model(&models.Enrollment{}).Count(&total)

	var pendingVerify int64
	database.DB.Model(&models.Enrollment{}).Where("status = ?", "pending_verify").Count(&pendingVerify)

	var pendingCorrection int64
	database.DB.Model(&models.Enrollment{}).Where("status = ?", "pending_correction").Count(&pendingCorrection)

	var pendingReview int64
	database.DB.Model(&models.Enrollment{}).Where("status = ?", "pending_review").Count(&pendingReview)

	var archived int64
	database.DB.Model(&models.Enrollment{}).Where("status = ?", "archived").Count(&archived)

	var rejected int64
	database.DB.Model(&models.Enrollment{}).Where("status = ?", "rejected").Count(&rejected)

	c.JSON(http.StatusOK, gin.H{
		"total":             total,
		"pending_verify":    pendingVerify,
		"pending_correction": pendingCorrection,
		"pending_review":    pendingReview,
		"archived":          archived,
		"rejected":          rejected,
	})
}
