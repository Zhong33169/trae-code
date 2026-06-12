package handlers

import (
	"backend/config"
	"backend/database"
	"backend/middleware"
	"backend/models"
	"backend/utils"
	"time"

	"github.com/gin-gonic/gin"
)

type BatchReviewItem struct {
	TaskID  uint   `json:"task_id" binding:"-"`
	ID      uint   `json:"id"`
	Version int    `json:"version"`
	Pass    bool   `json:"pass"`
	Reason  string `json:"reason"`
}

type BatchSubmitItem struct {
	ID      uint `json:"id" binding:"required"`
	Version int  `json:"version" binding:"required"`
}

type BatchResult struct {
	TaskID    uint   `json:"task_id"`
	TaskNo    string `json:"task_no"`
	Status    string `json:"status"`
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	NeedRetry bool   `json:"need_retry"`
}

type BatchResponse struct {
	SuccessCount int           `json:"success_count"`
	FailCount    int           `json:"fail_count"`
	Results      []BatchResult `json:"results"`
}

func BatchRegistrarSubmit(c *gin.Context) {
	var items []BatchSubmitItem
	if err := c.ShouldBindJSON(&items); err != nil {
		utils.ParamError(c, "参数错误")
		return
	}

	user := middleware.GetCurrentUser(c)

	results := make([]BatchResult, 0, len(items))
	successCount := 0
	failCount := 0

	for _, item := range items {
		taskID := item.ID

		result := BatchResult{
			TaskID: taskID,
		}

		var task models.SamplingTask
		dbResult := database.DB.First(&task, taskID)
		if dbResult.Error != nil {
			result.Success = false
			result.Message = "任务不存在"
			result.NeedRetry = false
			failCount++
			results = append(results, result)
			continue
		}

		result.TaskNo = task.TaskNo
		result.Status = task.Status

		if task.Status != config.StatusDraft &&
			task.Status != config.StatusReviewRejected &&
			task.Status != config.StatusReviewReturned {
			result.Success = false
			result.Message = "当前状态不允许提交（仅草稿、驳回、退回可提交）"
			result.NeedRetry = false
			failCount++
			results = append(results, result)
			continue
		}

		if task.Version != item.Version {
			result.Success = false
			result.Message = "版本冲突，请刷新后重试"
			result.NeedRetry = true
			failCount++
			results = append(results, result)
			continue
		}

		var regCount int64
		database.DB.Model(&models.Evidence{}).Where("task_id = ? AND type = ?", task.ID, config.EvidenceTypeRegistration).Count(&regCount)
		if regCount == 0 {
			result.Success = false
			result.Message = "提交审核必须有登记证据"
			result.NeedRetry = false
			failCount++
			results = append(results, result)
			continue
		}

		tx := database.DB.Begin()

		task.Status = config.StatusPendingReview
		task.Version++
		task.RejectReason = ""
		task.ReturnReason = ""

		if err := tx.Save(&task).Error; err != nil {
			tx.Rollback()
			result.Success = false
			result.Message = "提交失败：数据库错误"
			result.NeedRetry = true
			failCount++
			results = append(results, result)
			continue
		}

		log := models.TaskLog{
			TaskID:       task.ID,
			Action:       config.ActionSubmit,
			OperatorID:   user.ID,
			OperatorName: user.Name,
			OperatorRole: user.Role,
			Remark:       "批量提交审核",
			CreatedAt:    time.Now(),
		}
		if err := tx.Create(&log).Error; err != nil {
			tx.Rollback()
			result.Success = false
			result.Message = "创建日志失败"
			result.NeedRetry = true
			failCount++
			results = append(results, result)
			continue
		}

		tx.Commit()

		result.Success = true
		result.Status = task.Status
		result.Message = "提交成功"
		successCount++
		results = append(results, result)
	}

	utils.Success(c, BatchResponse{
		SuccessCount: successCount,
		FailCount:    failCount,
		Results:      results,
	})
}

func BatchSupervisorReview(c *gin.Context) {
	var items []BatchReviewItem
	if err := c.ShouldBindJSON(&items); err != nil {
		utils.ParamError(c, "参数错误")
		return
	}

	user := middleware.GetCurrentUser(c)

	results := make([]BatchResult, 0, len(items))
	successCount := 0
	failCount := 0

	for _, item := range items {
		taskID := item.ID
		if item.TaskID > 0 {
			taskID = item.TaskID
		}

		result := BatchResult{
			TaskID: taskID,
		}

		var task models.SamplingTask
		dbResult := database.DB.First(&task, taskID)
		if dbResult.Error != nil {
			result.Success = false
			result.Message = "任务不存在"
			result.NeedRetry = false
			failCount++
			results = append(results, result)
			continue
		}

		result.TaskNo = task.TaskNo
		result.Status = task.Status

		if task.Status != config.StatusPendingReview {
			reason := ""
			switch task.Status {
			case config.StatusDraft:
				reason = "任务仍为草稿，需登记员先提交"
			case config.StatusReviewPassed:
				reason = "任务已审核通过，不能重复审核"
			case config.StatusReviewRejected:
				reason = "任务已被驳回，需登记员补正后重提"
			case config.StatusReviewReturned:
				reason = "任务已被复核退回，需登记员补正后重提"
			case config.StatusReviewApproved:
				reason = "任务已归档"
			default:
				reason = "当前状态不允许审核"
			}
			result.Success = false
			result.Message = reason
			result.NeedRetry = false
			failCount++
			results = append(results, result)
			continue
		}

		if task.Version != item.Version {
			result.Success = false
			result.Message = "版本冲突，请刷新后重试"
			result.NeedRetry = true
			failCount++
			results = append(results, result)
			continue
		}

		if item.Pass {
			var count int64
			database.DB.Model(&models.Evidence{}).Where("task_id = ? AND type = ?", task.ID, config.EvidenceTypeProcess).Count(&count)
			if count == 0 {
				result.Success = false
				result.Message = "审核通过必须有过程核验证据"
				result.NeedRetry = false
				failCount++
				results = append(results, result)
				continue
			}
		} else {
			if item.Reason == "" {
				result.Success = false
				result.Message = "驳回必须填写原因"
				result.NeedRetry = false
				failCount++
				results = append(results, result)
				continue
			}
		}

		tx := database.DB.Begin()

		supervisorID := user.ID
		task.SupervisorID = &supervisorID
		task.SupervisorName = user.Name
		task.Version++

		if item.Pass {
			task.Status = config.StatusReviewPassed
		} else {
			task.Status = config.StatusReviewRejected
			task.RejectReason = item.Reason
		}

		if err := tx.Save(&task).Error; err != nil {
			tx.Rollback()
			result.Success = false
			result.Message = "审核失败：数据库错误"
			result.NeedRetry = true
			failCount++
			results = append(results, result)
			continue
		}

		action := config.ActionSupervisorPass
		remark := "主管批量审核通过"
		if !item.Pass {
			action = config.ActionSupervisorReject
			remark = "主管批量审核驳回：" + item.Reason
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
			result.Success = false
			result.Message = "创建日志失败"
			result.NeedRetry = true
			failCount++
			results = append(results, result)
			continue
		}

		tx.Commit()

		result.Success = true
		result.Status = task.Status
		result.Message = "操作成功"
		successCount++
		results = append(results, result)
	}

	utils.Success(c, BatchResponse{
		SuccessCount: successCount,
		FailCount:    failCount,
		Results:      results,
	})
}

func BatchReviewerReview(c *gin.Context) {
	var items []BatchReviewItem
	if err := c.ShouldBindJSON(&items); err != nil {
		utils.ParamError(c, "参数错误")
		return
	}

	user := middleware.GetCurrentUser(c)

	results := make([]BatchResult, 0, len(items))
	successCount := 0
	failCount := 0

	for _, item := range items {
		taskID := item.ID
		if item.TaskID > 0 {
			taskID = item.TaskID
		}

		result := BatchResult{
			TaskID: taskID,
		}

		var task models.SamplingTask
		dbResult := database.DB.First(&task, taskID)
		if dbResult.Error != nil {
			result.Success = false
			result.Message = "任务不存在"
			result.NeedRetry = false
			failCount++
			results = append(results, result)
			continue
		}

		result.TaskNo = task.TaskNo
		result.Status = task.Status

		if task.Status != config.StatusReviewPassed {
			reason := ""
			switch task.Status {
			case config.StatusDraft:
				reason = "任务仍为草稿，尚未进入审核流程"
			case config.StatusPendingReview:
				reason = "任务待主管审核中，尚未审核通过"
			case config.StatusReviewRejected:
				reason = "任务已被主管驳回"
			case config.StatusReviewReturned:
				reason = "任务已被复核退回，需登记员补正后重提"
			case config.StatusReviewApproved:
				reason = "任务已归档，不能重复复核"
			default:
				reason = "当前状态不允许复核"
			}
			result.Success = false
			result.Message = reason
			result.NeedRetry = false
			failCount++
			results = append(results, result)
			continue
		}

		if task.Version != item.Version {
			result.Success = false
			result.Message = "版本冲突，请刷新后重试"
			result.NeedRetry = true
			failCount++
			results = append(results, result)
			continue
		}

		if item.Pass {
			var processCount int64
			database.DB.Model(&models.Evidence{}).Where("task_id = ? AND type = ?", task.ID, config.EvidenceTypeProcess).Count(&processCount)
			if processCount == 0 {
				result.Success = false
				result.Message = "归档被拦截：缺少过程核验证据（主管审核前置不完整）"
				result.NeedRetry = false
				failCount++
				results = append(results, result)
				continue
			}

			var reviewCount int64
			database.DB.Model(&models.Evidence{}).Where("task_id = ? AND type = ?", task.ID, config.EvidenceTypeReview).Count(&reviewCount)
			if reviewCount == 0 {
				result.Success = false
				result.Message = "归档被拦截：缺少复核归档证据"
				result.NeedRetry = false
				failCount++
				results = append(results, result)
				continue
			}
		} else {
			if item.Reason == "" {
				result.Success = false
				result.Message = "退回必须填写原因"
				result.NeedRetry = false
				failCount++
				results = append(results, result)
				continue
			}
		}

		tx := database.DB.Begin()

		reviewerID := user.ID
		task.ReviewerID = &reviewerID
		task.ReviewerName = user.Name
		task.Version++

		if item.Pass {
			task.Status = config.StatusReviewApproved
		} else {
			task.Status = config.StatusReviewReturned
			task.ReturnReason = item.Reason
		}

		if err := tx.Save(&task).Error; err != nil {
			tx.Rollback()
			result.Success = false
			result.Message = "复核失败：数据库错误"
			result.NeedRetry = true
			failCount++
			results = append(results, result)
			continue
		}

		action := config.ActionReviewerApprove
		remark := "复核批量通过归档"
		if !item.Pass {
			action = config.ActionReviewerReturn
			remark = "复核批量退回：" + item.Reason
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
			result.Success = false
			result.Message = "创建日志失败"
			result.NeedRetry = true
			failCount++
			results = append(results, result)
			continue
		}

		tx.Commit()

		result.Success = true
		result.Status = task.Status
		result.Message = "操作成功"
		successCount++
		results = append(results, result)
	}

	utils.Success(c, BatchResponse{
		SuccessCount: successCount,
		FailCount:    failCount,
		Results:      results,
	})
}
