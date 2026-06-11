package services

import (
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
	"insurance-app/internal/models"
)

type WorkflowService struct {
	db *gorm.DB
}

func NewWorkflowService(db *gorm.DB) *WorkflowService {
	return &WorkflowService{db: db}
}

type ProcessAction string

const (
	ActionScanPass       ProcessAction = "scan_pass"
	ActionScanFail       ProcessAction = "scan_fail"
	ActionApprove        ProcessAction = "approve"
	ActionReject         ProcessAction = "reject"
	ActionRequestRevise  ProcessAction = "request_revise"
	ActionSubmitRevise   ProcessAction = "submit_revise"
	ActionArchive        ProcessAction = "archive"
)

type TransitionRule struct {
	FromStatus  models.ApplicationStatus
	Action      ProcessAction
	ToStatus    models.ApplicationStatus
	HandlerRole models.Role
}

var transitionRules = []TransitionRule{
	{models.StatusPendingScan, ActionScanPass, models.StatusPendingReview, models.RoleRegistrar},
	{models.StatusPendingScan, ActionScanFail, models.StatusScanFailed, models.RoleRegistrar},
	{models.StatusScanFailed, ActionScanPass, models.StatusPendingReview, models.RoleRegistrar},
	{models.StatusPendingReview, ActionApprove, models.StatusPendingApproval, models.RoleSupervisor},
	{models.StatusPendingReview, ActionReject, models.StatusRejected, models.RoleSupervisor},
	{models.StatusPendingReview, ActionRequestRevise, models.StatusRevisionRequired, models.RoleSupervisor},
	{models.StatusRevisionRequired, ActionSubmitRevise, models.StatusPendingReview, models.RoleRegistrar},
	{models.StatusRevisionRequired, ActionReject, models.StatusRejected, models.RoleSupervisor},
	{models.StatusPendingApproval, ActionApprove, models.StatusArchived, models.RoleReviewer},
	{models.StatusPendingApproval, ActionReject, models.StatusRejected, models.RoleReviewer},
	{models.StatusPendingApproval, ActionRequestRevise, models.StatusRevisionRequired, models.RoleReviewer},
}

func (s *WorkflowService) GetNextHandlerRole(currentStatus models.ApplicationStatus) models.Role {
	switch currentStatus {
	case models.StatusPendingScan, models.StatusScanFailed, models.StatusRevisionRequired:
		return models.RoleRegistrar
	case models.StatusPendingReview:
		return models.RoleSupervisor
	case models.StatusPendingApproval:
		return models.RoleReviewer
	default:
		return ""
	}
}

func (s *WorkflowService) ValidateTransition(app *models.Application, action ProcessAction, userRole models.Role) (*TransitionRule, error) {
	for _, rule := range transitionRules {
		if rule.FromStatus == app.Status && rule.Action == action {
			if rule.HandlerRole != userRole {
				return nil, fmt.Errorf("越权操作：当前角色 %s 无权执行 %s 操作", userRole, action)
			}
			return &rule, nil
		}
	}
	return nil, fmt.Errorf("无效操作：状态 %s 下无法执行 %s 操作", app.Status, action)
}

func (s *WorkflowService) ValidateMaterials(materialsJSON string, insuranceType string) (bool, string, []models.MaterialItem) {
	var materials []models.MaterialItem
	if materialsJSON == "" {
		materials = getDefaultMaterials(insuranceType)
	} else {
		if err := json.Unmarshal([]byte(materialsJSON), &materials); err != nil {
			return false, "材料格式错误", nil
		}
	}

	allRequiredProvided := true
	var missingMaterials []string
	for _, m := range materials {
		if m.Required && !m.Provided {
			allRequiredProvided = false
			missingMaterials = append(missingMaterials, m.Name)
		}
	}

	if !allRequiredProvided {
		msg := fmt.Sprintf("缺少必填材料：%s", joinStrings(missingMaterials, "、"))
		return false, msg, materials
	}

	return true, "", materials
}

func getDefaultMaterials(insuranceType string) []models.MaterialItem {
	materials := []models.MaterialItem{
		{Name: "投保单", Required: true, Provided: true, Verified: true},
		{Name: "身份证复印件", Required: true, Provided: true, Verified: false},
		{Name: "银行卡复印件", Required: true, Provided: true, Verified: false},
	}

	switch insuranceType {
	case "重疾险", "医疗险", "寿险":
		materials = append(materials, models.MaterialItem{Name: "健康告知书", Required: true, Provided: false, Verified: false})
		materials = append(materials, models.MaterialItem{Name: "体检报告", Required: false, Provided: false, Verified: false})
	case "意外险":
		materials = append(materials, models.MaterialItem{Name: "职业证明", Required: false, Provided: false, Verified: false})
	}

	return materials
}

func joinStrings(s []string, sep string) string {
	result := ""
	for i, v := range s {
		if i > 0 {
			result += sep
		}
		result += v
	}
	return result
}

func (s *WorkflowService) CheckDeadline(deadline time.Time) (bool, int) {
	now := time.Now()
	diff := time.Until(deadline)
	hours := int(diff.Hours())
	return now.Before(deadline) || now.Equal(deadline), hours
}

func (s *WorkflowService) TransitionApplication(
	app *models.Application,
	rule *TransitionRule,
	action ProcessAction,
	handlerID uint,
	handlerName string,
	handlerRole models.Role,
	opinion string,
	materialsChecked string,
	startTime time.Time,
) (*models.ProcessRecord, error) {
	fromStatus := app.Status
	toStatus := rule.ToStatus

	processingTime := int(time.Since(startTime).Seconds())
	timeLimitMet, _ := s.CheckDeadline(app.Deadline)

	processRecord := &models.ProcessRecord{
		ApplicationID:    app.ID,
		Action:           string(action),
		FromStatus:       fromStatus,
		ToStatus:         toStatus,
		HandlerRole:      handlerRole,
		HandlerID:        handlerID,
		HandlerName:      handlerName,
		Opinion:          opinion,
		MaterialsChecked: materialsChecked,
		TimeLimitMet:     timeLimitMet,
		ProcessingTime:   processingTime,
		CreatedAt:        time.Now(),
	}

	nextRole := s.GetNextHandlerRole(toStatus)

	app.Status = toStatus
	app.CurrentHandlerRole = nextRole
	if nextRole != "" {
		app.CurrentHandlerID = nil
		app.CurrentHandlerName = ""
	} else {
		app.CurrentHandlerID = nil
		app.CurrentHandlerName = ""
	}
	app.LastProcessResult = opinion
	app.LastProcessedAt = &processRecord.CreatedAt
	app.LastProcessedByID = &handlerID
	app.LastProcessedByName = handlerName
	app.Version++
	app.UpdatedAt = time.Now()

	if action == ActionRequestRevise {
		app.ExceptionReason = opinion
	} else if toStatus == models.StatusRejected {
		app.ExceptionReason = opinion
	} else if toStatus == models.StatusScanFailed {
		app.ExceptionReason = opinion
	} else {
		app.ExceptionReason = ""
	}

	return processRecord, nil
}

func (s *WorkflowService) GetAvailableActions(app *models.Application, userRole models.Role) []ProcessAction {
	var actions []ProcessAction
	for _, rule := range transitionRules {
		if rule.FromStatus == app.Status && rule.HandlerRole == userRole {
			actions = append(actions, rule.Action)
		}
	}
	return actions
}

func (s *WorkflowService) CreateAuditLog(
	db *gorm.DB,
	userID uint,
	username string,
	userRole models.Role,
	action string,
	resourceType string,
	resourceID uint,
	ipAddress string,
	userAgent string,
	details string,
) error {
	auditLog := &models.AuditLog{
		UserID:       userID,
		Username:     username,
		UserRole:     userRole,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
		Details:      details,
		CreatedAt:    time.Now(),
	}
	return db.Create(auditLog).Error
}

func (s *WorkflowService) GetStatistics(db *gorm.DB, userRole models.Role, userID uint) (map[string]interface{}, error) {
	var total int64
	var pendingScan int64
	var pendingReview int64
	var pendingApproval int64
	var revisionRequired int64
	var scanFailed int64
	var approved int64
	var rejected int64
	var archived int64

	db.Model(&models.Application{}).Count(&total)
	db.Model(&models.Application{}).Where("status = ?", models.StatusPendingScan).Count(&pendingScan)
	db.Model(&models.Application{}).Where("status = ?", models.StatusPendingReview).Count(&pendingReview)
	db.Model(&models.Application{}).Where("status = ?", models.StatusPendingApproval).Count(&pendingApproval)
	db.Model(&models.Application{}).Where("status = ?", models.StatusRevisionRequired).Count(&revisionRequired)
	db.Model(&models.Application{}).Where("status = ?", models.StatusScanFailed).Count(&scanFailed)
	db.Model(&models.Application{}).Where("status = ?", models.StatusApproved).Count(&approved)
	db.Model(&models.Application{}).Where("status = ?", models.StatusRejected).Count(&rejected)
	db.Model(&models.Application{}).Where("status = ?", models.StatusArchived).Count(&archived)

	var myTasks int64
	if userRole != "" {
		db.Model(&models.Application{}).Where(
			"current_handler_role = ? AND (current_handler_id IS NULL OR current_handler_id = ?)",
			userRole, userID,
		).Where("status IN ?", []models.ApplicationStatus{
			models.StatusPendingScan,
			models.StatusPendingReview,
			models.StatusPendingApproval,
			models.StatusRevisionRequired,
			models.StatusScanFailed,
		}).Count(&myTasks)
	}

	var overdue int64
	db.Model(&models.Application{}).Where(
		"deadline < ? AND status IN ?",
		time.Now(),
		[]models.ApplicationStatus{
			models.StatusPendingScan,
			models.StatusPendingReview,
			models.StatusPendingApproval,
			models.StatusRevisionRequired,
			models.StatusScanFailed,
		},
	).Count(&overdue)

	return map[string]interface{}{
		"total":            total,
		"pending_scan":     pendingScan,
		"pending_review":   pendingReview,
		"pending_approval": pendingApproval,
		"revision_required": revisionRequired,
		"scan_failed":      scanFailed,
		"approved":         approved,
		"rejected":         rejected,
		"archived":         archived,
		"my_tasks":         myTasks,
		"overdue":          overdue,
	}, nil
}
