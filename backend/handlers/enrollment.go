package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"
	"zqzl/backend/database"
	"zqzl/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetEnrollments(c *gin.Context) {
	status := c.Query("status")
	isOverdue := c.Query("overdue")
	keyword := c.Query("keyword")

	var enrollments []models.Enrollment
	query := database.DB.Model(&models.Enrollment{})

	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}

	if keyword != "" {
		query = query.Where("student_name LIKE ? OR phone LIKE ? OR major LIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	query.Order("created_at desc").Find(&enrollments)

	now := time.Now()
	for i := range enrollments {
		if enrollments[i].Deadline != nil && enrollments[i].Deadline.Before(now) &&
			(enrollments[i].Status == models.StatusPendingCorrection || enrollments[i].Status == models.StatusPendingVerify) {
			enrollments[i].IsOverdue = true
		}
	}

	if isOverdue == "true" {
		var filtered []models.Enrollment
		for _, e := range enrollments {
			if e.IsOverdue {
				filtered = append(filtered, e)
			}
		}
		enrollments = filtered
	}

	c.JSON(http.StatusOK, enrollments)
}

func GetEnrollment(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var enrollment models.Enrollment
	result := database.DB.Preload("Attachments").Preload("AuditLogs", func(db *gorm.DB) *gorm.DB {
		return db.Order("created_at desc")
	}).First(&enrollment, id)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "报名单不存在"})
		return
	}

	now := time.Now()
	if enrollment.Deadline != nil && enrollment.Deadline.Before(now) &&
		(enrollment.Status == models.StatusPendingCorrection || enrollment.Status == models.StatusPendingVerify) {
		enrollment.IsOverdue = true
	}

	c.JSON(http.StatusOK, enrollment)
}

func CreateEnrollment(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req models.EnrollmentCreate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	var user models.User
	database.DB.First(&user, userID)

	enrollment := models.Enrollment{
		StudentName:   req.StudentName,
		IDCard:        req.IDCard,
		Phone:         req.Phone,
		Major:         req.Major,
		Status:        models.StatusDraft,
		CreatedBy:     user.ID,
		CreatedByName: user.Name,
	}

	database.DB.Create(&enrollment)

	addAuditLog(enrollment.ID, user.ID, user.Name, string(user.Role), "创建报名单", "", "", string(models.StatusDraft))

	c.JSON(http.StatusOK, enrollment)
}

func SubmitEnrollment(c *gin.Context) {
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "当前状态不能提交"})
		return
	}

	materialStatus := checkMaterialStatus(uint(id))

	if !materialStatus.CanSubmit {
		var errMsg string
		if materialStatus.MissingCount > 0 && materialStatus.RejectedCount > 0 {
			errMsg = fmt.Sprintf("还有 %d 项必备材料缺失，%d 项材料被驳回，请补齐后再提交",
				materialStatus.MissingCount, materialStatus.RejectedCount)
		} else if materialStatus.MissingCount > 0 {
			errMsg = fmt.Sprintf("还有 %d 项必备材料缺失，请补齐后再提交", materialStatus.MissingCount)
		} else if materialStatus.RejectedCount > 0 {
			errMsg = fmt.Sprintf("还有 %d 项材料被驳回，请修改后再提交", materialStatus.RejectedCount)
		}

		addAuditLog(uint(id), userID.(uint), userName.(string), userRole.(string),
			"提交核验失败", errMsg, string(enrollment.Status), string(enrollment.Status))

		c.JSON(http.StatusBadRequest, gin.H{"error": errMsg, "material_status": materialStatus})
		return
	}

	fromStatus := string(enrollment.Status)
	enrollment.Status = models.StatusPendingVerify
	enrollment.RejectReason = ""

	if enrollment.Deadline == nil {
		deadline := time.Now().AddDate(0, 0, 7)
		enrollment.Deadline = &deadline
	}

	database.DB.Save(&enrollment)

	addAuditLog(enrollment.ID, userID.(uint), userName.(string), userRole.(string),
		"提交核验", "", fromStatus, string(models.StatusPendingVerify))

	c.JSON(http.StatusOK, enrollment)
}

func VerifyEnrollment(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userName, _ := c.Get("username")
	userRole, _ := c.Get("role")

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req models.VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	var enrollment models.Enrollment
	if err := database.DB.First(&enrollment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "报名单不存在"})
		return
	}

	if enrollment.Status != models.StatusPendingVerify {
		c.JSON(http.StatusBadRequest, gin.H{"error": "当前状态不能核验"})
		return
	}

	fromStatus := string(enrollment.Status)
	action := ""

	if req.Pass {
		enrollment.Status = models.StatusPendingReview
		action = "核验通过"
	} else {
		if isMaterialMissing(&enrollment) {
			enrollment.Status = models.StatusPendingCorrection
			enrollment.RejectReason = req.Reason
			action = "退回补正"
		} else {
			enrollment.Status = models.StatusRejected
			enrollment.RejectReason = req.Reason
			action = "核验不通过"
		}
	}

	database.DB.Save(&enrollment)

	addAuditLog(enrollment.ID, userID.(uint), userName.(string), userRole.(string), action, req.Reason, fromStatus, string(enrollment.Status))

	c.JSON(http.StatusOK, enrollment)
}

func ReviewEnrollment(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userName, _ := c.Get("username")
	userRole, _ := c.Get("role")

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req models.ReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	var enrollment models.Enrollment
	if err := database.DB.First(&enrollment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "报名单不存在"})
		return
	}

	if enrollment.Status != models.StatusPendingReview {
		c.JSON(http.StatusBadRequest, gin.H{"error": "当前状态不能复核"})
		return
	}

	fromStatus := string(enrollment.Status)
	action := ""

	if req.Pass {
		enrollment.Status = models.StatusArchived
		enrollment.AdminRemark = req.Remark
		action = "复核归档"
	} else {
		enrollment.Status = models.StatusPendingCorrection
		enrollment.RejectReason = req.Reason
		action = "退回补正"
	}

	if req.Remark != "" {
		enrollment.AuditRemark = req.Remark
	}

	database.DB.Save(&enrollment)

	addAuditLog(enrollment.ID, userID.(uint), userName.(string), userRole.(string), action, req.Reason, fromStatus, string(enrollment.Status))

	c.JSON(http.StatusOK, enrollment)
}

func BatchVerify(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userName, _ := c.Get("username")
	userRole, _ := c.Get("role")

	var req struct {
		IDs    []uint `json:"ids" binding:"required"`
		Pass   bool   `json:"pass"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	var results []models.BatchResult

	for _, id := range req.IDs {
		var enrollment models.Enrollment
		if err := database.DB.First(&enrollment, id).Error; err != nil {
			results = append(results, models.BatchResult{ID: id, Success: false, Message: "报名单不存在"})
			continue
		}

		if enrollment.Status != models.StatusPendingVerify {
			results = append(results, models.BatchResult{ID: id, Success: false, Message: "当前状态不能核验"})
			continue
		}

		fromStatus := string(enrollment.Status)
		action := ""

		if req.Pass {
			enrollment.Status = models.StatusPendingReview
			action = "核验通过"
			results = append(results, models.BatchResult{ID: id, Success: true, Message: "核验通过"})
		} else {
			if isMaterialMissing(&enrollment) {
				enrollment.Status = models.StatusPendingCorrection
				enrollment.RejectReason = req.Reason
				action = "退回补正"
				results = append(results, models.BatchResult{ID: id, Success: true, Message: "已退回补正: " + req.Reason})
			} else {
				enrollment.Status = models.StatusRejected
				enrollment.RejectReason = req.Reason
				action = "核验不通过"
				results = append(results, models.BatchResult{ID: id, Success: true, Message: "已驳回: " + req.Reason})
			}
		}

		database.DB.Save(&enrollment)
		addAuditLog(enrollment.ID, userID.(uint), userName.(string), userRole.(string), action, req.Reason, fromStatus, string(enrollment.Status))
	}

	c.JSON(http.StatusOK, results)
}

func isMaterialMissing(e *models.Enrollment) bool {
	var count int64
	database.DB.Model(&models.Attachment{}).Where("enrollment_id = ? AND status = ?", e.ID, models.AttachRejected).Count(&count)
	return count > 0 || e.Status == models.StatusPendingCorrection
}

func addAuditLog(enrollmentID, userID uint, userName, userRole, action, reason, fromStatus, toStatus string) {
	log := models.AuditLog{
		EnrollmentID: enrollmentID,
		UserID:       userID,
		UserName:     userName,
		UserRole:     userRole,
		Action:       action,
		Reason:       reason,
		FromStatus:   fromStatus,
		ToStatus:     toStatus,
	}
	database.DB.Create(&log)
}

func CheckMaterialStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	status := checkMaterialStatus(uint(id))
	c.JSON(http.StatusOK, status)
}

func checkMaterialStatus(enrollmentID uint) models.EnrollmentMaterialStatus {
	var attachments []models.Attachment
	database.DB.Where("enrollment_id = ? AND is_active = ?", enrollmentID, true).Find(&attachments)

	attachMap := make(map[string]models.Attachment)
	for _, att := range attachments {
		attachMap[att.Type] = att
	}

	var results []models.MaterialCheckResult
	missingCount := 0
	rejectedCount := 0

	for _, mat := range models.RequiredMaterials {
		att, exists := attachMap[mat.Type]
		result := models.MaterialCheckResult{
			Type:          mat.Type,
			Name:          mat.Name,
			Required:      mat.Required,
			HasAttachment: exists,
		}

		if exists {
			result.AttachmentID = att.ID
			result.Status = string(att.Status)
			result.IsRejected = att.Status == models.AttachRejected
			if att.Status == models.AttachRejected {
				result.RejectReason = att.RejectReason
				rejectedCount++
			}
		} else if mat.Required {
			missingCount++
		}

		results = append(results, result)
	}

	canSubmit := missingCount == 0 && rejectedCount == 0

	return models.EnrollmentMaterialStatus{
		CanSubmit:     canSubmit,
		MissingCount:  missingCount,
		RejectedCount: rejectedCount,
		Materials:     results,
	}
}
