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
	"gorm.io/gorm"
)

type TaskListQuery struct {
	Status  string `form:"status"`
	Keyword string `form:"keyword"`
	Page    int    `form:"page,default=1"`
	Size    int    `form:"size,default=10"`
}

type CreateTaskRequest struct {
	TaskNo         string                `json:"task_no" binding:"required"`
	ProjectName    string                `json:"project_name" binding:"required"`
	SampleLocation string                `json:"sample_location" binding:"required"`
	SampleType     string                `json:"sample_type" binding:"required"`
	Evidences      []CreateEvidenceRequest `json:"evidences" binding:"required,min=1"`
}

type UpdateTaskRequest struct {
	TaskNo         string                `json:"task_no"`
	ProjectName    string                `json:"project_name"`
	SampleLocation string                `json:"sample_location"`
	SampleType     string                `json:"sample_type"`
	Version        int                   `json:"version" binding:"required"`
	Evidences      []CreateEvidenceRequest `json:"evidences"`
}

type SubmitTaskRequest struct {
	Version int `json:"version" binding:"required"`
}

type SupervisorReviewRequest struct {
	Version  int    `json:"version" binding:"required"`
	Pass     bool   `json:"pass"`
	Reason   string `json:"reason"`
}

type ReviewerReviewRequest struct {
	Version int    `json:"version" binding:"required"`
	Approve bool   `json:"approve"`
	Reason  string `json:"reason"`
}

func GetTaskList(c *gin.Context) {
	var query TaskListQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		utils.ParamError(c, "参数错误")
		return
	}

	db := database.DB.Model(&models.SamplingTask{})

	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}

	if query.Keyword != "" {
		keyword := "%" + query.Keyword + "%"
		db = db.Where("task_no LIKE ? OR project_name LIKE ? OR sample_location LIKE ?", keyword, keyword, keyword)
	}

	var total int64
	db.Count(&total)

	var tasks []models.SamplingTask
	offset := (query.Page - 1) * query.Size
	db.Order("created_at desc").Offset(offset).Limit(query.Size).Find(&tasks)

	utils.Success(c, gin.H{
		"list":  tasks,
		"total": total,
		"page":  query.Page,
		"size":  query.Size,
	})
}

func GetTaskDetail(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.ParamError(c, "无效的任务ID")
		return
	}

	var task models.SamplingTask
	result := database.DB.Preload("Evidences", func(db *gorm.DB) *gorm.DB {
		return db.Order("created_at asc")
	}).Preload("Logs", func(db *gorm.DB) *gorm.DB {
		return db.Order("created_at asc")
	}).First(&task, uint(taskID))

	if result.Error != nil {
		utils.NotFoundError(c, "任务不存在")
		return
	}

	utils.Success(c, task)
}

func CreateTask(c *gin.Context) {
	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ParamError(c, "参数错误")
		return
	}

	hasRegEvidence := false
	for _, ev := range req.Evidences {
		if ev.Type == config.EvidenceTypeRegistration {
			hasRegEvidence = true
			break
		}
	}
	if !hasRegEvidence {
		utils.MissingEvidenceError(c, "创建任务必须至少有一个登记证据")
		return
	}

	user := middleware.GetCurrentUser(c)

	var existingTask models.SamplingTask
	result := database.DB.Where("task_no = ?", req.TaskNo).First(&existingTask)
	if result.Error == nil {
		utils.ParamError(c, "任务编号已存在")
		return
	}

	tx := database.DB.Begin()

	task := models.SamplingTask{
		TaskNo:         req.TaskNo,
		ProjectName:    req.ProjectName,
		SampleLocation: req.SampleLocation,
		SampleType:     req.SampleType,
		Status:         config.StatusDraft,
		Version:        1,
		RegistrarID:    user.ID,
		RegistrarName:  user.Name,
	}

	if err := tx.Create(&task).Error; err != nil {
		tx.Rollback()
		utils.ServerError(c, "创建任务失败")
		return
	}

	for _, ev := range req.Evidences {
		if ev.Type != config.EvidenceTypeRegistration {
			continue
		}
		evidence := models.Evidence{
			TaskID:      task.ID,
			Type:        ev.Type,
			Title:       ev.Title,
			Description: ev.Description,
			FileURL:     ev.FileURL,
			UploadedBy:  user.Name,
			UploadedAt:  time.Now(),
		}
		if err := tx.Create(&evidence).Error; err != nil {
			tx.Rollback()
			utils.ServerError(c, "创建证据失败")
			return
		}
	}

	log := models.TaskLog{
		TaskID:       task.ID,
		Action:       config.ActionCreate,
		OperatorID:   user.ID,
		OperatorName: user.Name,
		OperatorRole: user.Role,
		Remark:       "创建采样任务（草稿）",
		CreatedAt:    time.Now(),
	}
	if err := tx.Create(&log).Error; err != nil {
		tx.Rollback()
		utils.ServerError(c, "创建日志失败")
		return
	}

	tx.Commit()

	database.DB.Preload("Evidences").First(&task, task.ID)
	utils.Success(c, task)
}

func UpdateTask(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.ParamError(c, "无效的任务ID")
		return
	}

	var req UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ParamError(c, "参数错误")
		return
	}

	user := middleware.GetCurrentUser(c)

	var task models.SamplingTask
	result := database.DB.First(&task, uint(taskID))
	if result.Error != nil {
		utils.NotFoundError(c, "任务不存在")
		return
	}

	if task.Status != config.StatusDraft &&
		task.Status != config.StatusReviewRejected &&
		task.Status != config.StatusReviewReturned {
		utils.StatusError(c, "当前状态不允许修改")
		return
	}

	if task.Version != req.Version {
		utils.VersionConflictError(c)
		return
	}

	tx := database.DB.Begin()

	if req.TaskNo != "" {
		task.TaskNo = req.TaskNo
	}
	if req.ProjectName != "" {
		task.ProjectName = req.ProjectName
	}
	if req.SampleLocation != "" {
		task.SampleLocation = req.SampleLocation
	}
	if req.SampleType != "" {
		task.SampleType = req.SampleType
	}
	task.Version++
	task.RejectReason = ""
	task.ReturnReason = ""

	if err := tx.Save(&task).Error; err != nil {
		tx.Rollback()
		utils.ServerError(c, "更新任务失败")
		return
	}

	for _, ev := range req.Evidences {
		if ev.Type != config.EvidenceTypeRegistration {
			continue
		}
		evidence := models.Evidence{
			TaskID:      task.ID,
			Type:        ev.Type,
			Title:       ev.Title,
			Description: ev.Description,
			FileURL:     ev.FileURL,
			UploadedBy:  user.Name,
			UploadedAt:  time.Now(),
		}
		if err := tx.Create(&evidence).Error; err != nil {
			tx.Rollback()
			utils.ServerError(c, "创建证据失败")
			return
		}
	}

	log := models.TaskLog{
		TaskID:       task.ID,
		Action:       config.ActionUpdate,
		OperatorID:   user.ID,
		OperatorName: user.Name,
		OperatorRole: user.Role,
		Remark:       "补正任务信息",
		CreatedAt:    time.Now(),
	}
	if err := tx.Create(&log).Error; err != nil {
		tx.Rollback()
		utils.ServerError(c, "创建日志失败")
		return
	}

	tx.Commit()

	database.DB.Preload("Evidences").First(&task, task.ID)
	utils.Success(c, task)
}

func SubmitTask(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.ParamError(c, "无效的任务ID")
		return
	}

	var req SubmitTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ParamError(c, "参数错误")
		return
	}

	user := middleware.GetCurrentUser(c)

	var task models.SamplingTask
	result := database.DB.First(&task, uint(taskID))
	if result.Error != nil {
		utils.NotFoundError(c, "任务不存在")
		return
	}

	if task.Status != config.StatusDraft &&
		task.Status != config.StatusReviewRejected &&
		task.Status != config.StatusReviewReturned {
		utils.StatusError(c, "当前状态不允许提交")
		return
	}

	if task.Version != req.Version {
		utils.VersionConflictError(c)
		return
	}

	var regCount int64
	database.DB.Model(&models.Evidence{}).Where("task_id = ? AND type = ?", task.ID, config.EvidenceTypeRegistration).Count(&regCount)
	if regCount == 0 {
		utils.MissingEvidenceError(c, "提交审核必须有登记证据")
		return
	}

	tx := database.DB.Begin()

	task.Status = config.StatusPendingReview
	task.Version++
	task.RejectReason = ""
	task.ReturnReason = ""

	if err := tx.Save(&task).Error; err != nil {
		tx.Rollback()
		utils.ServerError(c, "提交任务失败")
		return
	}

	log := models.TaskLog{
		TaskID:       task.ID,
		Action:       config.ActionSubmit,
		OperatorID:   user.ID,
		OperatorName: user.Name,
		OperatorRole: user.Role,
		Remark:       "提交审核",
		CreatedAt:    time.Now(),
	}
	if err := tx.Create(&log).Error; err != nil {
		tx.Rollback()
		utils.ServerError(c, "创建日志失败")
		return
	}

	tx.Commit()

	utils.Success(c, task)
}

func SupervisorReview(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.ParamError(c, "无效的任务ID")
		return
	}

	var req SupervisorReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ParamError(c, "参数错误")
		return
	}

	user := middleware.GetCurrentUser(c)

	var task models.SamplingTask
	result := database.DB.First(&task, uint(taskID))
	if result.Error != nil {
		utils.NotFoundError(c, "任务不存在")
		return
	}

	if task.Status != config.StatusPendingReview {
		utils.StatusError(c, "当前状态不允许审核")
		return
	}

	if task.Version != req.Version {
		utils.VersionConflictError(c)
		return
	}

	if req.Pass {
		var count int64
		database.DB.Model(&models.Evidence{}).Where("task_id = ? AND type = ?", task.ID, config.EvidenceTypeProcess).Count(&count)
		if count == 0 {
			utils.MissingEvidenceError(c, "审核通过必须有过程核验证据")
			return
		}
	}

	tx := database.DB.Begin()

	supervisorID := user.ID
	task.SupervisorID = &supervisorID
	task.SupervisorName = user.Name
	task.Version++

	if req.Pass {
		task.Status = config.StatusReviewPassed
	} else {
		task.Status = config.StatusReviewRejected
		task.RejectReason = req.Reason
	}

	if err := tx.Save(&task).Error; err != nil {
		tx.Rollback()
		utils.ServerError(c, "审核失败")
		return
	}

	action := config.ActionSupervisorPass
	remark := "主管审核通过"
	if !req.Pass {
		action = config.ActionSupervisorReject
		remark = "主管审核驳回：" + req.Reason
	}

	log := models.TaskLog{
		TaskID:       task.ID,
		Action:       action,
		OperatorID:   user.ID,
		OperatorName: user.Name,
		OperatorRole: user.Role,
		Remark:       remark,
		CreatedAt:    time.Now(),
	}
	if err := tx.Create(&log).Error; err != nil {
		tx.Rollback()
		utils.ServerError(c, "创建日志失败")
		return
	}

	tx.Commit()

	utils.Success(c, task)
}

func ReviewerReview(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.ParamError(c, "无效的任务ID")
		return
	}

	var req ReviewerReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ParamError(c, "参数错误")
		return
	}

	user := middleware.GetCurrentUser(c)

	var task models.SamplingTask
	result := database.DB.First(&task, uint(taskID))
	if result.Error != nil {
		utils.NotFoundError(c, "任务不存在")
		return
	}

	if task.Status != config.StatusReviewPassed {
		utils.StatusError(c, "当前状态不允许复核")
		return
	}

	if task.Version != req.Version {
		utils.VersionConflictError(c)
		return
	}

	if req.Approve {
		var processCount int64
		database.DB.Model(&models.Evidence{}).Where("task_id = ? AND type = ?", task.ID, config.EvidenceTypeProcess).Count(&processCount)
		if processCount == 0 {
			utils.MissingEvidenceError(c, "归档被拦截：缺少过程核验证据（主管审核前置不完整）")
			return
		}

		var reviewCount int64
		database.DB.Model(&models.Evidence{}).Where("task_id = ? AND type = ?", task.ID, config.EvidenceTypeReview).Count(&reviewCount)
		if reviewCount == 0 {
			utils.MissingEvidenceError(c, "归档被拦截：缺少复核归档证据")
			return
		}
	}

	tx := database.DB.Begin()

	reviewerID := user.ID
	task.ReviewerID = &reviewerID
	task.ReviewerName = user.Name
	task.Version++

	if req.Approve {
		task.Status = config.StatusReviewApproved
	} else {
		task.Status = config.StatusReviewReturned
		task.ReturnReason = req.Reason
	}

	if err := tx.Save(&task).Error; err != nil {
		tx.Rollback()
		utils.ServerError(c, "复核失败")
		return
	}

	action := config.ActionReviewerApprove
	remark := "复核通过归档"
	if !req.Approve {
		action = config.ActionReviewerReturn
		remark = "复核退回：" + req.Reason
	}

	log := models.TaskLog{
		TaskID:       task.ID,
		Action:       action,
		OperatorID:   user.ID,
		OperatorName: user.Name,
		OperatorRole: user.Role,
		Remark:       remark,
		CreatedAt:    time.Now(),
	}
	if err := tx.Create(&log).Error; err != nil {
		tx.Rollback()
		utils.ServerError(c, "创建日志失败")
		return
	}

	tx.Commit()

	utils.Success(c, task)
}
