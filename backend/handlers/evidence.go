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

	evidence := models.Evidence{
		TaskID:      uint(taskID),
		Type:        req.Type,
		Title:       req.Title,
		Description: req.Description,
		FileURL:     req.FileURL,
		UploadedBy:  user.Name,
		UploadedAt:  time.Now(),
	}

	database.DB.Create(&evidence)

	utils.Success(c, evidence)
}
