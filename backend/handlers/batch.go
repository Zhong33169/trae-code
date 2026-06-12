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
			result.Success = false
			result.Message = "当前状态不允许审核"
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
			result.Message = "审核失败"
			result.NeedRetry = true
			failCount++
			results = append(results, result)
			continue
		}

		action := config.ActionSupervisorPass
		remark := "主管审核通过"
		if !item.Pass {
			action = config.ActionSupervisorReject
			remark = "主管审核驳回：" + item.Reason
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
			result.Success = false
			result.Message = "当前状态不允许复核"
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
			database.DB.Model(&models.Evidence{}).Where("task_id = ? AND type = ?", task.ID, config.EvidenceTypeReview).Count(&count)
			if count == 0 {
				result.Success = false
				result.Message = "归档必须有复核证据"
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
			result.Message = "复核失败"
			result.NeedRetry = true
			failCount++
			results = append(results, result)
			continue
		}

		action := config.ActionReviewerApprove
		remark := "复核通过归档"
		if !item.Pass {
			action = config.ActionReviewerReturn
			remark = "复核退回：" + item.Reason
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
