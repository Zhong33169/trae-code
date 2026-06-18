package main

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service { return &Service{repo: repo} }

type transitionSpec struct {
	role        string
	fromStatus  string
	toStatus    string
	evidenceCol string
	nextHandler string
}

var transitionSpecs = map[string]transitionSpec{
	"submit":  {RoleCustomerManager, StatusDraft, StatusSubmitted, "reg_evidence", RoleUnderwritingSpecialist},
	"review":  {RoleUnderwritingSpecialist, StatusSubmitted, StatusReviewed, "verify_evidence", RoleBusinessOwner},
	"confirm": {RoleBusinessOwner, StatusReviewed, StatusConfirmed, "archive_evidence", ""},
	"archive": {RoleBusinessOwner, StatusConfirmed, StatusArchived, "", ""},
}

var rejectRoles = map[string]string{
	StatusSubmitted: RoleUnderwritingSpecialist,
	StatusReviewed:  RoleBusinessOwner,
}

func canRejectTask(status string, currentHandlerRole string, userRole string) (bool, string) {
	// 1. 状态不允许驳回
	reqRole, ok := rejectRoles[status]
	if !ok {
		return false, fmt.Sprintf("任务状态为【%s】，不允许驳回", statusLabel(status))
	}
	// 2. 当前办理岗位必须与用户角色一致（草稿除外，但草稿根本不会到 reject）
	if status != StatusDraft && currentHandlerRole != userRole {
		return false, fmt.Sprintf("当前办理岗位为【%s】，您的角色无权办理", roleLabel(currentHandlerRole))
	}
	// 3. 用户角色必须是该状态下允许驳回的角色
	if userRole != reqRole {
		return false, fmt.Sprintf("驳回【%s】状态要求【%s】角色，当前角色无权驳回", statusLabel(status), roleLabel(reqRole))
	}
	return true, ""
}

var actionLabels = map[string]string{
	"submit": "提交", "review": "复核", "confirm": "确认", "archive": "归档", "reject": "驳回",
}

func actionLabel(a string) string {
	if l, ok := actionLabels[a]; ok {
		return l
	}
	return a
}

func apiErr(code, msg string) *ApiError { return &ApiError{Code: code, Message: msg} }

type transitionResult struct {
	newStatus   string
	evidenceCol string
	evidenceVal sql.NullString
	nextHandler string
	detail      string
}

func (t *Task) evidenceContent(col string) string {
	switch col {
	case "reg_evidence":
		if t.RegEvidence != nil {
			return t.RegEvidence.Content
		}
	case "verify_evidence":
		if t.VerifyEvidence != nil {
			return t.VerifyEvidence.Content
		}
	case "archive_evidence":
		if t.ArchiveEvidence != nil {
			return t.ArchiveEvidence.Content
		}
	}
	return ""
}

// validate 执行四类校验：错角色 → 旧版本 → 错状态 → 缺证据
func (s *Service) validate(action string, task *Task, user principal, version int, evidenceContent, reason string) (transitionResult, *ApiError) {
	now := time.Now().Format("2006-01-02 15:04:05")

	if action == "reject" {
		reqRole, ok := rejectRoles[task.Status]
		if !ok {
			return transitionResult{}, apiErr("INVALID_STATUS", fmt.Sprintf("任务状态为【%s】，不允许驳回", statusLabel(task.Status)))
		}
		if user.Role != reqRole {
			return transitionResult{}, apiErr("FORBIDDEN_ROLE", fmt.Sprintf("当前角色【%s】无权驳回，需要【%s】", roleLabel(user.Role), roleLabel(reqRole)))
		}
		if version > 0 && version != task.Version {
			return transitionResult{}, apiErr("STALE_VERSION", fmt.Sprintf("任务版本已过期（提交 v%d，服务端 v%d），请刷新后重试", version, task.Version))
		}
		if strings.TrimSpace(reason) == "" {
			return transitionResult{}, apiErr("MISSING_REASON", "驳回原因必填，请填写后再驳回")
		}
		return transitionResult{newStatus: StatusRejected, detail: "驳回：" + reason}, nil
	}

	spec, ok := transitionSpecs[action]
	if !ok {
		return transitionResult{}, apiErr("BAD_REQUEST", fmt.Sprintf("未知动作【%s】", action))
	}

	if user.Role != spec.role {
		return transitionResult{}, apiErr("FORBIDDEN_ROLE", fmt.Sprintf("当前角色【%s】无权执行【%s】，需要【%s】", roleLabel(user.Role), actionLabel(action), roleLabel(spec.role)))
	}
	if version > 0 && version != task.Version {
		return transitionResult{}, apiErr("STALE_VERSION", fmt.Sprintf("任务版本已过期（提交 v%d，服务端 v%d），请刷新后重试", version, task.Version))
	}
	if task.Status != spec.fromStatus {
		return transitionResult{}, apiErr("INVALID_STATUS", fmt.Sprintf("任务状态为【%s】，无法执行【%s】（需状态【%s】）", statusLabel(task.Status), actionLabel(action), statusLabel(spec.fromStatus)))
	}

	var evidenceVal sql.NullString
	if spec.evidenceCol != "" {
		effective := evidenceContent
		if effective == "" {
			effective = task.evidenceContent(spec.evidenceCol)
		}
		if effective == "" {
			return transitionResult{}, apiErr("MISSING_EVIDENCE", fmt.Sprintf("缺少【%s】，请补充后再%s", evidenceLabels[spec.evidenceCol], actionLabel(action)))
		}
		ev, _ := marshalEvidence(effective, user.DisplayName, user.ID, now)
		evidenceVal = ev
	}

	detail := actionLabel(action) + "完成"
	return transitionResult{
		newStatus:   spec.toStatus,
		evidenceCol: spec.evidenceCol,
		evidenceVal: evidenceVal,
		nextHandler: spec.nextHandler,
		detail:      detail,
	}, nil
}

func (s *Service) Transition(taskID int, req TransitionRequest, user principal) (*Task, *ApiError) {
	task, err := s.repo.GetTaskByID(taskID)
	if err != nil {
		return nil, apiErr("NOT_FOUND", "任务不存在")
	}
	if req.Version != 0 && req.Version != task.Version {
		return nil, apiErr("STALE_VERSION", fmt.Sprintf("任务版本已过期（提交 v%d，服务端 v%d），请刷新后重试", req.Version, task.Version))
	}
	if task.Status != StatusDraft && task.CurrentHandlerRole != user.Role {
		return nil, apiErr("FORBIDDEN_ROLE", fmt.Sprintf("当前任务办理岗位为【%s】，您的角色无权办理", roleLabel(task.CurrentHandlerRole)))
	}
	res, aerr := s.validate(req.Action, task, user, req.Version, req.Evidence, req.Reason)
	if aerr != nil {
		return nil, aerr
	}
	if err := s.repo.ApplyTransition(task.ID, res.evidenceCol, res.evidenceVal, res.newStatus, res.nextHandler); err != nil {
		return nil, apiErr("INTERNAL", "流转失败: "+err.Error())
	}
	_ = s.repo.InsertAudit(sql.NullInt64{}, task.ID, task.TaskNo, req.Action, user, task.Status, res.newStatus, res.detail)
	updated, _ := s.repo.GetTaskByID(taskID)
	return updated, nil
}

func (s *Service) CreateTask(req CreateTaskRequest, user principal) (*Task, *ApiError) {
	if user.Role != RoleCustomerManager {
		return nil, apiErr("FORBIDDEN_ROLE", fmt.Sprintf("仅【%s】可登记续保任务", roleLabel(RoleCustomerManager)))
	}
	if req.PolicyNo == "" || req.CustomerName == "" || req.Product == "" {
		return nil, apiErr("BAD_REQUEST", "保单号、客户名称、产品不能为空")
	}
	t, err := s.repo.CreateTask(req, user.ID, user.DisplayName)
	if err != nil {
		return nil, apiErr("INTERNAL", "创建失败: "+err.Error())
	}
	return t, nil
}

func (s *Service) UpdateTask(taskID int, req UpdateTaskRequest, user principal) (*Task, *ApiError) {
	if user.Role != RoleCustomerManager {
		return nil, apiErr("FORBIDDEN_ROLE", fmt.Sprintf("仅【%s】可修改续保任务", roleLabel(RoleCustomerManager)))
	}
	task, err := s.repo.GetTaskByID(taskID)
	if err != nil {
		return nil, apiErr("NOT_FOUND", "任务不存在")
	}
	if task.Status != StatusDraft {
		return nil, apiErr("INVALID_STATUS", fmt.Sprintf("仅草稿任务可修改，当前状态【%s】", statusLabel(task.Status)))
	}
	if err := s.repo.UpdateTask(req, task, user.ID, user.DisplayName); err != nil {
		return nil, apiErr("INTERNAL", "修改失败: "+err.Error())
	}
	updated, _ := s.repo.GetTaskByID(taskID)
	return updated, nil
}

func (s *Service) BatchTransition(req BatchRequest, user principal) (*Batch, []BatchItem, *ApiError) {
	if len(req.TaskIDs) == 0 {
		return nil, nil, apiErr("BAD_REQUEST", "请选择至少一个任务")
	}
	_, isNormal := transitionSpecs[req.Action]
	isReject := req.Action == "reject"
	if !isNormal && !isReject {
		return nil, nil, apiErr("BAD_REQUEST", "批量仅支持 submit/review/confirm/archive/reject")
	}

	batchNo := s.repo.nextBatchNo()
	batchID, err := s.repo.CreateBatch(batchNo, req.Action, user, len(req.TaskIDs))
	if err != nil {
		return nil, nil, apiErr("INTERNAL", "创建批次失败: "+err.Error())
	}

	success, fail := 0, 0
	for _, taskID := range req.TaskIDs {
		task, err := s.repo.GetTaskByID(taskID)
		if err != nil {
			_ = s.repo.InsertBatchItem(batchID, taskID, 0, "", "failed", "NOT_FOUND", "任务不存在", 0)
			fail++
			continue
		}
		version, hasVersion := req.Versions[taskID]
		if !hasVersion {
			msg := fmt.Sprintf("缺少任务【%s】的请求版本（versions map 未提供该任务的版本号）", task.TaskNo)
			_ = s.repo.InsertBatchItem(batchID, task.ID, 0, task.TaskNo, "failed", "MISSING_VERSION", msg, 0)
			fail++
			continue
		}
		if version != task.Version {
			msg := fmt.Sprintf("任务【%s】版本已过期（请求 v%d，服务端 v%d），请刷新后重试", task.TaskNo, version, task.Version)
			_ = s.repo.InsertBatchItem(batchID, task.ID, version, task.TaskNo, "failed", "STALE_VERSION", msg, 0)
			fail++
			continue
		}
		if task.Status != StatusDraft && task.CurrentHandlerRole != user.Role {
			msg := fmt.Sprintf("任务【%s】当前办理岗位为【%s】，当前角色无权办理", task.TaskNo, roleLabel(task.CurrentHandlerRole))
			_ = s.repo.InsertBatchItem(batchID, task.ID, version, task.TaskNo, "failed", "FORBIDDEN_ROLE", msg, 0)
			fail++
			continue
		}
		if isReject {
			if ok, msg := canRejectTask(task.Status, task.CurrentHandlerRole, user.Role); !ok {
				code := "INVALID_STATUS"
				if strings.Contains(msg, "角色") || strings.Contains(msg, "无权办理") {
					code = "FORBIDDEN_ROLE"
				}
				_ = s.repo.InsertBatchItem(batchID, task.ID, version, task.TaskNo, "failed", code, msg, 0)
				fail++
				continue
			}
			if strings.TrimSpace(req.Reason) == "" {
				msg := fmt.Sprintf("任务【%s】驳回原因必填，请填写后再批量驳回", task.TaskNo)
				_ = s.repo.InsertBatchItem(batchID, task.ID, version, task.TaskNo, "failed", "MISSING_REASON", msg, 0)
				fail++
				continue
			}
		}
		res, aerr := s.validate(req.Action, task, user, version, req.Evidence, req.Reason)
		if aerr != nil {
			_ = s.repo.InsertBatchItem(batchID, task.ID, version, task.TaskNo, "failed", aerr.Code, aerr.Message, 0)
			fail++
			continue
		}
		_ = s.repo.ApplyTransition(task.ID, res.evidenceCol, res.evidenceVal, res.newStatus, res.nextHandler)
		_ = s.repo.SetTaskLastBatch(task.ID, batchID)
		_ = s.repo.InsertAudit(sql.NullInt64{Int64: int64(batchID), Valid: true}, task.ID, task.TaskNo, req.Action, user, task.Status, res.newStatus, "批量"+actionLabel(req.Action))
		_ = s.repo.InsertBatchItem(batchID, task.ID, version, task.TaskNo, "success", "", "", 0)
		success++
	}

	_ = s.repo.UpdateBatchCounts(batchID, success, fail)
	batch, _ := s.repo.GetBatch(batchID)
	items, _ := s.repo.ListBatchItems(batchID)
	if batch == nil {
		batch = &Batch{}
	}
	return batch, items, nil
}

func (s *Service) RetryBatch(batchID int, req RetryRequest, user principal) (*Batch, []BatchItem, *ApiError) {
	batch, err := s.repo.GetBatch(batchID)
	if err != nil {
		return nil, nil, apiErr("NOT_FOUND", "批次不存在")
	}
	_, isNormal := transitionSpecs[batch.Action]
	isReject := batch.Action == "reject"
	if !isNormal && !isReject {
		return nil, nil, apiErr("BAD_REQUEST", "该批次动作不支持重试")
	}
	if len(req.ItemIDs) == 0 {
		return nil, nil, apiErr("BAD_REQUEST", "请选择需要重试的失败项")
	}
	batchRef := sql.NullInt64{Int64: int64(batchID), Valid: true}

	for _, itemID := range req.ItemIDs {
		item, err := s.repo.GetBatchItem(itemID)
		if err != nil || item.BatchID != batchID {
			continue
		}
		if item.Status != "failed" {
			continue
		}
		task, err := s.repo.GetTaskByID(item.TaskID)
		nextRetry := item.RetryCount + 1
		if err != nil {
			_ = s.repo.UpdateBatchItem(itemID, "failed", "NOT_FOUND", "任务不存在", nextRetry, 0)
			_ = s.repo.InsertAudit(batchRef, item.TaskID, item.TaskNo, "retry_fail", user, "", "", fmt.Sprintf("重试#%d：任务不存在", nextRetry))
			continue
		}
		// 强制校验 versions：缺版本 / 旧版本 / 错角色
		requestVersion, hasVersion := req.Versions[task.ID]
		if !hasVersion {
			msg := fmt.Sprintf("缺少任务【%s】的请求版本（重试 versions map 未提供该任务的版本号）", task.TaskNo)
			_ = s.repo.UpdateBatchItem(itemID, "failed", "MISSING_VERSION", msg, nextRetry, 0)
			_ = s.repo.InsertAudit(batchRef, task.ID, task.TaskNo, "retry_fail", user, task.Status, task.Status, fmt.Sprintf("重试#%d：MISSING_VERSION", nextRetry))
			continue
		}
		if requestVersion != task.Version {
			msg := fmt.Sprintf("任务【%s】版本已过期（请求 v%d，服务端 v%d），请刷新后重试", task.TaskNo, requestVersion, task.Version)
			_ = s.repo.UpdateBatchItem(itemID, "failed", "STALE_VERSION", msg, nextRetry, requestVersion)
			_ = s.repo.InsertAudit(batchRef, task.ID, task.TaskNo, "retry_fail", user, task.Status, task.Status, fmt.Sprintf("重试#%d：STALE_VERSION v%d→v%d", nextRetry, requestVersion, task.Version))
			continue
		}
		if task.Status != StatusDraft && task.CurrentHandlerRole != user.Role {
			msg := fmt.Sprintf("任务【%s】当前办理岗位为【%s】，当前角色无权办理", task.TaskNo, roleLabel(task.CurrentHandlerRole))
			_ = s.repo.UpdateBatchItem(itemID, "failed", "FORBIDDEN_ROLE", msg, nextRetry, requestVersion)
			_ = s.repo.InsertAudit(batchRef, task.ID, task.TaskNo, "retry_fail", user, task.Status, task.Status, fmt.Sprintf("重试#%d：FORBIDDEN_ROLE", nextRetry))
			continue
		}
		if isReject {
			if ok, msg := canRejectTask(task.Status, task.CurrentHandlerRole, user.Role); !ok {
				code := "INVALID_STATUS"
				if strings.Contains(msg, "角色") || strings.Contains(msg, "无权办理") {
					code = "FORBIDDEN_ROLE"
				}
				_ = s.repo.UpdateBatchItem(itemID, "failed", code, msg, nextRetry, requestVersion)
				_ = s.repo.InsertAudit(batchRef, task.ID, task.TaskNo, "retry_fail", user, task.Status, task.Status, fmt.Sprintf("重试#%d：%s %s", nextRetry, code, msg))
				continue
			}
			if strings.TrimSpace(req.Reason) == "" {
				msg := fmt.Sprintf("任务【%s】驳回原因必填，请填写后再重试", task.TaskNo)
				_ = s.repo.UpdateBatchItem(itemID, "failed", "MISSING_REASON", msg, nextRetry, requestVersion)
				_ = s.repo.InsertAudit(batchRef, task.ID, task.TaskNo, "retry_fail", user, task.Status, task.Status, fmt.Sprintf("重试#%d：MISSING_REASON", nextRetry))
				continue
			}
		}
		res, aerr := s.validate(batch.Action, task, user, requestVersion, req.Evidence, req.Reason)
		if aerr != nil {
			_ = s.repo.UpdateBatchItem(itemID, "failed", aerr.Code, aerr.Message, nextRetry, requestVersion)
			_ = s.repo.InsertAudit(batchRef, task.ID, task.TaskNo, "retry_fail", user, task.Status, task.Status, fmt.Sprintf("重试#%d：%s %s", nextRetry, aerr.Code, aerr.Message))
			continue
		}
		_ = s.repo.ApplyTransition(task.ID, res.evidenceCol, res.evidenceVal, res.newStatus, res.nextHandler)
		_ = s.repo.SetTaskLastBatch(task.ID, batchID)
		_ = s.repo.InsertAudit(batchRef, task.ID, task.TaskNo, batch.Action, user, task.Status, res.newStatus, fmt.Sprintf("重试#%d：%s成功", nextRetry, actionLabel(batch.Action)))
		_ = s.repo.UpdateBatchItem(itemID, "success", "", "", nextRetry, requestVersion)
	}

	_ = s.repo.RecomputeBatchCounts(batchID)
	batch, _ = s.repo.GetBatch(batchID)
	items, _ := s.repo.ListBatchItems(batchID)
	return batch, items, nil
}
