package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
	"zqzl/backend/database"
	"zqzl/backend/models"

	"github.com/gin-gonic/gin"
)

func UploadAttachment(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userName, _ := c.Get("username")
	userRole, _ := c.Get("role")

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var enrollment models.Enrollment
	if err := database.DB.First(&enrollment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "报名单不存在"})
		return
	}

	if enrollment.Status != models.StatusDraft && enrollment.Status != models.StatusPendingCorrection {
		c.JSON(http.StatusBadRequest, gin.H{"error": "当前状态不能上传附件"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请选择文件"})
		return
	}

	attachType := c.PostForm("type")
	attachName := c.PostForm("name")
	if attachName == "" {
		attachName = file.Filename
	}

	os.MkdirAll("uploads", 0755)

	fileKey := fmt.Sprintf("uploads/%d_%d_%s", id, time.Now().Unix(), file.Filename)
	if err := c.SaveUploadedFile(file, fileKey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "文件保存失败"})
		return
	}

	var user models.User
	database.DB.First(&user, userID)

	if attachType != "" && attachType != "other" {
		database.DB.Model(&models.Attachment{}).
			Where("enrollment_id = ? AND type = ? AND is_active = ?", uint(id), attachType, true).
			Update("is_active", false)
	}

	attachment := models.Attachment{
		EnrollmentID:   uint(id),
		Name:           attachName,
		Type:           attachType,
		FileKey:        fileKey,
		Status:         models.AttachPending,
		UploadedBy:     user.ID,
		UploadedByName: user.Name,
		IsActive:       true,
	}

	database.DB.Create(&attachment)

	addAuditLog(uint(id), userID.(uint), userName.(string), userRole.(string),
		"上传附件: "+attachName+" ("+attachType+")", "", "", "")

	c.JSON(http.StatusOK, attachment)
}

func GetAttachments(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var attachments []models.Attachment
	database.DB.Where("enrollment_id = ?", id).Order("created_at desc").Find(&attachments)

	c.JSON(http.StatusOK, attachments)
}

func RejectAttachment(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userName, _ := c.Get("username")
	userRole, _ := c.Get("role")

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	var attachment models.Attachment
	if err := database.DB.First(&attachment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "附件不存在"})
		return
	}

	attachment.Status = models.AttachRejected
	attachment.RejectReason = req.Reason
	database.DB.Save(&attachment)

	addAuditLog(attachment.EnrollmentID, userID.(uint), userName.(string), userRole.(string),
		"驳回附件: "+attachment.Name, req.Reason, "", "")

	c.JSON(http.StatusOK, attachment)
}

func ApproveAttachment(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userName, _ := c.Get("username")
	userRole, _ := c.Get("role")

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var attachment models.Attachment
	if err := database.DB.First(&attachment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "附件不存在"})
		return
	}

	attachment.Status = models.AttachApproved
	attachment.RejectReason = ""
	database.DB.Save(&attachment)

	addAuditLog(attachment.EnrollmentID, userID.(uint), userName.(string), userRole.(string),
		"通过附件: "+attachment.Name, "", "", "")

	c.JSON(http.StatusOK, attachment)
}

func DeleteAttachment(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userName, _ := c.Get("username")
	userRole, _ := c.Get("role")

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var attachment models.Attachment
	if err := database.DB.First(&attachment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "附件不存在"})
		return
	}

	var enrollment models.Enrollment
	database.DB.First(&enrollment, attachment.EnrollmentID)

	if enrollment.Status != models.StatusDraft && enrollment.Status != models.StatusPendingCorrection {
		c.JSON(http.StatusBadRequest, gin.H{"error": "当前状态不能删除附件"})
		return
	}

	if attachment.FileKey != "" {
		os.Remove(attachment.FileKey)
	}

	database.DB.Delete(&attachment)

	addAuditLog(attachment.EnrollmentID, userID.(uint), userName.(string), userRole.(string),
		"删除附件: "+attachment.Name, "", "", "")

	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}

func DownloadAttachment(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var attachment models.Attachment
	if err := database.DB.First(&attachment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "附件不存在"})
		return
	}

	if _, err := os.Stat(attachment.FileKey); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "文件不存在"})
		return
	}

	c.FileAttachment(attachment.FileKey, filepath.Base(attachment.FileKey))
}
