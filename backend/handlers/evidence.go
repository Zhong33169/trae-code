package handlers

import (
	"backend/config"
	"backend/database"
	"backend/middleware"
	"backend/models"
	"backend/utils"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type CreateEvidenceRequest struct {
	Type        string `json:"type" binding:"required"`
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	FileURL     string `json:"file_url"`
}

func canUploadEvidence(userRole string, taskStatus string, evidenceType string) (bool, string) {
	switch evidenceType {
	case config.EvidenceTypeRegistration:
		if userRole != config.RoleRegistrar {
			return false, "仅登记员可上传登记证据"
		}
		if taskStatus != config.StatusDraft &&
			taskStatus != config.StatusReviewRejected &&
			taskStatus != config.StatusReviewReturned {
			return false, "仅草稿、驳回或退回状态可上传登记证据"
		}
		return true, ""

	case config.EvidenceTypeProcess:
		if userRole != config.RoleSupervisor {
			return false, "仅主管可上传过程核验证据"
		}
		if taskStatus != config.StatusPendingReview {
			return false, "仅待审核状态可上传过程核验证据"
		}
		return true, ""

	case config.EvidenceTypeReview:
		if userRole != config.RoleReviewer {
			return false, "仅复核负责人可上传复核证据"
		}
		if taskStatus != config.StatusReviewPassed {
			return false, "仅审核通过待复核状态可上传复核证据"
		}
		return true, ""

	default:
		return false, "无效的证据类型"
	}
}

func GetEvidences(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.ParamError(c, "无效的任务ID")
		return
	}

	var task models.SamplingTask
	result := database.DB.First(&task, uint(taskID))
	if result.Error != nil {
		utils.NotFoundError(c, "任务不存在")
		return
	}

	var evidences []models.Evidence
	database.DB.Where("task_id = ?", taskID).Order("created_at asc").Find(&evidences)

	utils.Success(c, evidences)
}

func CreateEvidence(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.ParamError(c, "无效的任务ID")
		return
	}

	var task models.SamplingTask
	result := database.DB.First(&task, uint(taskID))
	if result.Error != nil {
		utils.NotFoundError(c, "任务不存在")
		return
	}

	var req CreateEvidenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ParamError(c, "参数错误")
		return
	}

	if req.Type != config.EvidenceTypeRegistration &&
		req.Type != config.EvidenceTypeProcess &&
		req.Type != config.EvidenceTypeReview {
		utils.ParamError(c, "无效的证据类型")
		return
	}

	user := middleware.GetCurrentUser(c)

	ok, msg := canUploadEvidence(user.Role, task.Status, req.Type)
	if !ok {
		utils.ForbiddenError(c, msg)
		return
	}

	tx := database.DB.Begin()

	evidence := models.Evidence{
		TaskID:      uint(taskID),
		Type:        req.Type,
		Title:       req.Title,
		Description: req.Description,
		FileURL:     req.FileURL,
		UploadedBy:  user.Name,
		UploadedAt:  time.Now(),
	}

	if err := tx.Create(&evidence).Error; err != nil {
		tx.Rollback()
		utils.ServerError(c, "创建证据失败")
		return
	}

	log := models.TaskLog{
		TaskID:       uint(taskID),
		Action:       "upload_evidence",
		OperatorID:   user.ID,
		OperatorName: user.Name,
		OperatorRole: user.Role,
		Remark:       "上传证据：" + req.Title + "（" + req.Type + "）",
		CreatedAt:    time.Now(),
	}
	if err := tx.Create(&log).Error; err != nil {
		tx.Rollback()
		utils.ServerError(c, "创建日志失败")
		return
	}

	tx.Commit()

	utils.Success(c, evidence)
}
