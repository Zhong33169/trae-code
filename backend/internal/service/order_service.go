package service

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"knowledge-revision-system/internal/model"
	"knowledge-revision-system/internal/repository"

	"github.com/google/uuid"
)

func CreateFailureAuditLog(db *sql.DB, order *model.KnowledgeRevisionOrder, action string, actorID, actorName, actorRole string, failureReason string) error {
	if order == nil {
		return nil
	}
	now := time.Now().Format("2006-01-02 15:04:05")
	auditLog := &model.AuditLog{
		ID:            uuid.New().String(),
		OrderID:       order.ID,
		OrderNo:       order.OrderNo,
		Action:        action + "_failed",
		ActorID:       actorID,
		ActorName:     actorName,
		ActorRole:     actorRole,
		FromStatus:    order.Status,
		ToStatus:      "",
		FailureReason: failureReason,
		CreatedAt:     now,
	}
	return repository.CreateAuditLog(db, auditLog)
}

func ClassifyFailure(err error) string {
	errStr := err.Error()
	switch {
	case strings.Contains(errStr, "无权") || strings.Contains(errStr, "角色"):
		return "越权操作：" + errStr
	case strings.Contains(errStr, "状态") || strings.Contains(errStr, "不允许"):
		return "顺序错误：" + errStr
	case strings.Contains(errStr, "材料") || strings.Contains(errStr, "反馈") || strings.Contains(errStr, "不能为空") || strings.Contains(errStr, "必须填写"):
		return "证据缺失：" + errStr
	case strings.Contains(errStr, "版本冲突"):
		return "版本冲突：" + errStr
	default:
		return "操作失败：" + errStr
	}
}

func ListOrders(db *sql.DB, query model.OrderListQuery) ([]model.KnowledgeRevisionOrder, int, error) {
	return repository.GetOrders(db, query)
}

func GetOrder(db *sql.DB, id string) (*model.KnowledgeRevisionOrder, error) {
	return repository.GetOrderByID(db, id)
}

func CreateOrder(db *sql.DB, req model.CreateOrderRequest, creatorID, creatorName, creatorRole string) (*model.KnowledgeRevisionOrder, error) {
	if req.Title == "" {
		return nil, fmt.Errorf("工单标题不能为空")
	}
	if req.KnowledgeItemID == "" {
		return nil, fmt.Errorf("关联知识条目不能为空")
	}
	if req.TimeLimitHours <= 0 {
		return nil, fmt.Errorf("时限小时数必须大于0")
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	deadline := time.Now().Add(time.Duration(req.TimeLimitHours) * time.Hour).Format("2006-01-02 15:04:05")
	orderNo := fmt.Sprintf("KSX-%s", time.Now().Format("20060102150405"))

	supervisors, err := repository.GetUsersByRole(db, "supervisor")
	if err != nil {
		return nil, fmt.Errorf("查询主管失败: %w", err)
	}
	handlerID := creatorID
	if len(supervisors) > 0 {
		handlerID = supervisors[0].ID
	}

	order := &model.KnowledgeRevisionOrder{
		ID:                 uuid.New().String(),
		OrderNo:            orderNo,
		Title:              req.Title,
		KnowledgeItemID:    req.KnowledgeItemID,
		Status:             "pending_review",
		IsOverdue:          false,
		OverdueDays:        0,
		CreatorID:          creatorID,
		CurrentHandlerID:   handlerID,
		CurrentHandlerRole: "supervisor",
		TimeLimitHours:     req.TimeLimitHours,
		Deadline:           deadline,
		RevisionBefore:     req.RevisionBefore,
		RevisionAfter:      req.RevisionAfter,
		RevisionDesc:       req.RevisionDesc,
		Version:            1,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, fmt.Errorf("开启事务失败: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO knowledge_revision_orders (
			id, order_no, title, knowledge_item_id, status,
			is_overdue, overdue_days, overdue_reason, overdue_action,
			creator_id, current_handler_id, current_handler_role,
			time_limit_hours, deadline,
			revision_before, revision_after, revision_description, processing_opinion,
			version, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
	`,
		order.ID, order.OrderNo, order.Title, order.KnowledgeItemID, order.Status,
		order.IsOverdue, order.OverdueDays, order.OverdueReason, order.OverdueAction,
		order.CreatorID, order.CurrentHandlerID, order.CurrentHandlerRole,
		order.TimeLimitHours, order.Deadline,
		order.RevisionBefore, order.RevisionAfter, order.RevisionDesc, order.ProcessingOpinion,
		order.Version, order.CreatedAt, order.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("创建工单失败: %w", err)
	}

	for _, m := range req.Materials {
		materialID := uuid.New().String()
		_, err = tx.Exec(`
			INSERT INTO materials (id, order_id, name, file_type, is_complete, uploaded_at)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, materialID, order.ID, m.Name, m.FileType, m.IsComplete, now)
		if err != nil {
			return nil, fmt.Errorf("创建材料失败: %w", err)
		}
	}

	for _, f := range req.Feedbacks {
		feedbackID := uuid.New().String()
		var resolvedAt *string
		if f.IsResolved {
			resolvedAt = &now
		}
		_, err = tx.Exec(`
			INSERT INTO knowledge_feedbacks (id, order_id, content, is_resolved, resolved_at)
			VALUES ($1, $2, $3, $4, $5)
		`, feedbackID, order.ID, f.Content, f.IsResolved, resolvedAt)
		if err != nil {
			return nil, fmt.Errorf("创建反馈失败: %w", err)
		}
	}

	auditLog := &model.AuditLog{
		ID:         uuid.New().String(),
		OrderID:    order.ID,
		OrderNo:    order.OrderNo,
		Action:     "create",
		ActorID:    creatorID,
		ActorName:  creatorName,
		ActorRole:  creatorRole,
		FromStatus: "",
		ToStatus:   "pending_review",
		CreatedAt:  now,
	}
	_, err = tx.Exec(`
		INSERT INTO audit_logs (
			id, order_id, order_no, action,
			actor_id, actor_name, actor_role,
			from_status, to_status, opinion, reason, failure_reason, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`,
		auditLog.ID, auditLog.OrderID, auditLog.OrderNo, auditLog.Action,
		auditLog.ActorID, auditLog.ActorName, auditLog.ActorRole,
		auditLog.FromStatus, auditLog.ToStatus, auditLog.Opinion, auditLog.Reason, auditLog.FailureReason, auditLog.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("创建审计日志失败: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("提交事务失败: %w", err)
	}

	order.Materials, _ = repository.GetMaterialsByOrderID(db, order.ID)
	order.Feedbacks, _ = repository.GetFeedbacksByOrderID(db, order.ID)
	order.CreatorName = creatorName

	return order, nil
}

func AdvanceOrder(db *sql.DB, orderID string, req model.AdvanceRequest, actorID, actorName, actorRole string) (*model.KnowledgeRevisionOrder, error) {
	order, err := repository.GetOrderByID(db, orderID)
	if err != nil {
		return nil, fmt.Errorf("查询工单失败: %w", err)
	}
	if order == nil {
		return nil, fmt.Errorf("工单不存在")
	}

	if req.Opinion == "" {
		err := fmt.Errorf("审批意见不能为空")
		CreateFailureAuditLog(db, order, "advance", actorID, actorName, actorRole, ClassifyFailure(err))
		return nil, err
	}

	if req.Version != order.Version {
		err := fmt.Errorf("版本冲突：工单版本已变更，当前版本为 %d，请求版本为 %d", order.Version, req.Version)
		CreateFailureAuditLog(db, order, "advance", actorID, actorName, actorRole, ClassifyFailure(err))
		return nil, err
	}

	var toStatus string
	switch order.Status {
	case "pending_review":
		toStatus = "pending_final_review"
	case "pending_final_review":
		toStatus = "archived"
	default:
		err := fmt.Errorf("当前状态 %s 不允许推进操作", order.Status)
		CreateFailureAuditLog(db, order, "advance", actorID, actorName, actorRole, ClassifyFailure(err))
		return nil, err
	}

	if err := ValidateTransition(order.Status, toStatus, actorRole); err != nil {
		CreateFailureAuditLog(db, order, "advance", actorID, actorName, actorRole, ClassifyFailure(err))
		return nil, err
	}

	for _, m := range order.Materials {
		if !m.IsComplete {
			err := fmt.Errorf("存在未完成的材料（%s），无法推进", m.Name)
			CreateFailureAuditLog(db, order, "advance", actorID, actorName, actorRole, ClassifyFailure(err))
			return nil, err
		}
	}

	for _, f := range order.Feedbacks {
		if !f.IsResolved {
			err := fmt.Errorf("存在未解决的反馈（%s），无法推进", f.Content)
			CreateFailureAuditLog(db, order, "advance", actorID, actorName, actorRole, ClassifyFailure(err))
			return nil, err
		}
	}

	if order.IsOverdue {
		if req.OverdueReason == "" {
			err := fmt.Errorf("逾期工单必须填写逾期原因")
			CreateFailureAuditLog(db, order, "advance", actorID, actorName, actorRole, ClassifyFailure(err))
			return nil, err
		}
		if req.OverdueAction == "" {
			err := fmt.Errorf("逾期工单必须填写逾期处理措施")
			CreateFailureAuditLog(db, order, "advance", actorID, actorName, actorRole, ClassifyFailure(err))
			return nil, err
		}
	}

	now := time.Now().Format("2006-01-02 15:04:05")

	var nextHandlerRole string
	var nextHandlerID string

	if toStatus == "pending_final_review" {
		nextHandlerRole = "reviewer"
		reviewers, err := repository.GetUsersByRole(db, "reviewer")
		if err != nil {
			return nil, fmt.Errorf("查询复核员失败: %w", err)
		}
		if len(reviewers) > 0 {
			nextHandlerID = reviewers[0].ID
		}
	} else if toStatus == "archived" {
		nextHandlerRole = ""
		nextHandlerID = ""
	}

	fromStatus := order.Status

	order.Status = toStatus
	order.CurrentHandlerID = nextHandlerID
	order.CurrentHandlerRole = nextHandlerRole
	order.UpdatedAt = now

	if order.IsOverdue {
		order.OverdueReason = req.OverdueReason
		order.OverdueAction = req.OverdueAction
	}

	if toStatus == "archived" {
		order.ProcessingOpinion = req.Opinion
	}

	if err := repository.UpdateOrder(db, order); err != nil {
		CreateFailureAuditLog(db, order, "advance", actorID, actorName, actorRole, ClassifyFailure(err))
		return nil, err
	}

	action := "advance"
	if order.IsOverdue {
		action = "overdue_process"
	}

	auditLog := &model.AuditLog{
		ID:         uuid.New().String(),
		OrderID:    order.ID,
		OrderNo:    order.OrderNo,
		Action:     action,
		ActorID:    actorID,
		ActorName:  actorName,
		ActorRole:  actorRole,
		FromStatus: fromStatus,
		ToStatus:   toStatus,
		Opinion:    req.Opinion,
		CreatedAt:  now,
	}

	if order.IsOverdue {
		auditLog.Reason = req.OverdueReason
	}

	repository.CreateAuditLog(db, auditLog)

	updated, err := repository.GetOrderByID(db, orderID)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func ReturnOrder(db *sql.DB, orderID string, req model.ReturnRequest, actorID, actorName, actorRole string) (*model.KnowledgeRevisionOrder, error) {
	order, err := repository.GetOrderByID(db, orderID)
	if err != nil {
		return nil, fmt.Errorf("查询工单失败: %w", err)
	}
	if order == nil {
		return nil, fmt.Errorf("工单不存在")
	}

	if req.Reason == "" {
		err := fmt.Errorf("退回原因不能为空")
		CreateFailureAuditLog(db, order, "return", actorID, actorName, actorRole, ClassifyFailure(err))
		return nil, err
	}

	if req.Version != order.Version {
		err := fmt.Errorf("版本冲突：工单版本已变更，当前版本为 %d，请求版本为 %d", order.Version, req.Version)
		CreateFailureAuditLog(db, order, "return", actorID, actorName, actorRole, ClassifyFailure(err))
		return nil, err
	}

	var toStatus string
	switch order.Status {
	case "pending_review":
		toStatus = "pending_correction"
	case "pending_final_review":
		toStatus = "pending_review"
	default:
		err := fmt.Errorf("当前状态 %s 不允许退回操作", order.Status)
		CreateFailureAuditLog(db, order, "return", actorID, actorName, actorRole, ClassifyFailure(err))
		return nil, err
	}

	if err := ValidateTransition(order.Status, toStatus, actorRole); err != nil {
		CreateFailureAuditLog(db, order, "return", actorID, actorName, actorRole, ClassifyFailure(err))
		return nil, err
	}

	now := time.Now().Format("2006-01-02 15:04:05")

	var nextHandlerRole string
	var nextHandlerID string

	if toStatus == "pending_correction" {
		nextHandlerRole = "clerk"
		nextHandlerID = order.CreatorID
	} else if toStatus == "pending_review" {
		nextHandlerRole = "supervisor"
		supervisors, err := repository.GetUsersByRole(db, "supervisor")
		if err != nil {
			return nil, fmt.Errorf("查询主管失败: %w", err)
		}
		if len(supervisors) > 0 {
			nextHandlerID = supervisors[0].ID
		}
	}

	fromStatus := order.Status
	order.Status = toStatus
	order.CurrentHandlerID = nextHandlerID
	order.CurrentHandlerRole = nextHandlerRole
	order.UpdatedAt = now

	if err := repository.UpdateOrder(db, order); err != nil {
		CreateFailureAuditLog(db, order, "return", actorID, actorName, actorRole, ClassifyFailure(err))
		return nil, err
	}

	auditLog := &model.AuditLog{
		ID:         uuid.New().String(),
		OrderID:    order.ID,
		OrderNo:    order.OrderNo,
		Action:     "return",
		ActorID:    actorID,
		ActorName:  actorName,
		ActorRole:  actorRole,
		FromStatus: fromStatus,
		ToStatus:   toStatus,
		Reason:     req.Reason,
		CreatedAt:  now,
	}

	repository.CreateAuditLog(db, auditLog)

	updated, err := repository.GetOrderByID(db, orderID)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func CorrectOrder(db *sql.DB, orderID string, req model.CorrectRequest, actorID, actorName, actorRole string) (*model.KnowledgeRevisionOrder, error) {
	order, err := repository.GetOrderByID(db, orderID)
	if err != nil {
		return nil, fmt.Errorf("查询工单失败: %w", err)
	}
	if order == nil {
		return nil, fmt.Errorf("工单不存在")
	}

	if req.Version != order.Version {
		err := fmt.Errorf("版本冲突：工单版本已变更，当前版本为 %d，请求版本为 %d", order.Version, req.Version)
		CreateFailureAuditLog(db, order, "correct", actorID, actorName, actorRole, ClassifyFailure(err))
		return nil, err
	}

	if err := ValidateTransition(order.Status, "pending_review", actorRole); err != nil {
		CreateFailureAuditLog(db, order, "correct", actorID, actorName, actorRole, ClassifyFailure(err))
		return nil, err
	}

	if order.Status != "pending_correction" {
		err := fmt.Errorf("只有待补正状态的工单才能补正")
		CreateFailureAuditLog(db, order, "correct", actorID, actorName, actorRole, ClassifyFailure(err))
		return nil, err
	}

	now := time.Now().Format("2006-01-02 15:04:05")

	order.Status = "pending_review"
	order.RevisionBefore = req.RevisionBefore
	order.RevisionAfter = req.RevisionAfter
	order.RevisionDesc = req.RevisionDesc
	order.UpdatedAt = now

	supervisors, err := repository.GetUsersByRole(db, "supervisor")
	if err != nil {
		return nil, fmt.Errorf("查询主管失败: %w", err)
	}
	if len(supervisors) > 0 {
		order.CurrentHandlerID = supervisors[0].ID
	}
	order.CurrentHandlerRole = "supervisor"

	if err := repository.UpdateOrder(db, order); err != nil {
		CreateFailureAuditLog(db, order, "correct", actorID, actorName, actorRole, ClassifyFailure(err))
		return nil, err
	}

	if err := repository.DeleteMaterialsByOrderID(db, orderID); err != nil {
		return nil, err
	}

	for _, m := range req.Materials {
		materialID := uuid.New().String()
		material := &model.Material{
			ID:         materialID,
			OrderID:    orderID,
			Name:       m.Name,
			FileType:   m.FileType,
			IsComplete: m.IsComplete,
			UploadedAt: now,
		}
		if err := repository.CreateMaterial(db, material); err != nil {
			return nil, err
		}
	}

	if err := repository.DeleteFeedbacksByOrderID(db, orderID); err != nil {
		return nil, err
	}

	for _, f := range req.Feedbacks {
		feedbackID := uuid.New().String()
		var resolvedAt *string
		if f.IsResolved {
			resolvedAt = &now
		}
		feedback := &model.KnowledgeFeedback{
			ID:         feedbackID,
			OrderID:    orderID,
			Content:    f.Content,
			IsResolved: f.IsResolved,
			ResolvedAt: resolvedAt,
		}
		if err := repository.CreateFeedback(db, feedback); err != nil {
			return nil, err
		}
	}

	auditLog := &model.AuditLog{
		ID:         uuid.New().String(),
		OrderID:    order.ID,
		OrderNo:    order.OrderNo,
		Action:     "correct",
		ActorID:    actorID,
		ActorName:  actorName,
		ActorRole:  actorRole,
		FromStatus: "pending_correction",
		ToStatus:   "pending_review",
		Opinion:    req.CorrectionNote,
		CreatedAt:  now,
	}

	repository.CreateAuditLog(db, auditLog)

	updated, err := repository.GetOrderByID(db, orderID)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func BatchAdvance(db *sql.DB, req model.BatchRequest, actorID, actorName, actorRole string) ([]*model.KnowledgeRevisionOrder, []string) {
	var succeeded []*model.KnowledgeRevisionOrder
	var failed []string

	advanceReq := model.AdvanceRequest{
		Opinion:       req.OpinionOrReason,
		OverdueReason: "",
		OverdueAction: "",
	}

	for _, id := range req.OrderIDs {
		order, err := repository.GetOrderByID(db, id)
		if err != nil || order == nil {
			failed = append(failed, fmt.Sprintf("%s: 工单不存在", id))
			continue
		}

		advanceReq.Version = order.Version

		if order.IsOverdue {
			advanceReq.OverdueReason = "批量处理逾期"
			advanceReq.OverdueAction = "批量推进"
		}

		updated, err := AdvanceOrder(db, id, advanceReq, actorID, actorName, actorRole)
		if err != nil {
			failed = append(failed, fmt.Sprintf("%s: %s", order.OrderNo, err.Error()))
			continue
		}
		succeeded = append(succeeded, updated)
	}

	return succeeded, failed
}

func BatchReturn(db *sql.DB, req model.BatchRequest, actorID, actorName, actorRole string) ([]*model.KnowledgeRevisionOrder, []string) {
	var succeeded []*model.KnowledgeRevisionOrder
	var failed []string

	returnReq := model.ReturnRequest{
		Reason: req.OpinionOrReason,
	}

	for _, id := range req.OrderIDs {
		order, err := repository.GetOrderByID(db, id)
		if err != nil || order == nil {
			failed = append(failed, fmt.Sprintf("%s: 工单不存在", id))
			continue
		}

		returnReq.Version = order.Version

		updated, err := ReturnOrder(db, id, returnReq, actorID, actorName, actorRole)
		if err != nil {
			failed = append(failed, fmt.Sprintf("%s: %s", order.OrderNo, err.Error()))
			continue
		}
		succeeded = append(succeeded, updated)
	}

	return succeeded, failed
}

func CheckAndUpdateOverdue(db *sql.DB) error {
	return repository.UpdateOverdueStatus(db)
}

func GetStats(db *sql.DB) (*model.StatsResponse, error) {
	stats := &model.StatsResponse{}

	err := db.QueryRow("SELECT COUNT(*) FROM knowledge_revision_orders").Scan(&stats.Total)
	if err != nil {
		return nil, fmt.Errorf("统计总数失败: %w", err)
	}

	err = db.QueryRow("SELECT COUNT(*) FROM knowledge_revision_orders WHERE status = 'pending_review'").Scan(&stats.PendingReview)
	if err != nil {
		return nil, fmt.Errorf("统计待审核数失败: %w", err)
	}

	err = db.QueryRow("SELECT COUNT(*) FROM knowledge_revision_orders WHERE status = 'pending_correction'").Scan(&stats.PendingCorrection)
	if err != nil {
		return nil, fmt.Errorf("统计待补正数失败: %w", err)
	}

	err = db.QueryRow("SELECT COUNT(*) FROM knowledge_revision_orders WHERE status = 'pending_final_review'").Scan(&stats.PendingFinalReview)
	if err != nil {
		return nil, fmt.Errorf("统计待复核数失败: %w", err)
	}

	err = db.QueryRow("SELECT COUNT(*) FROM knowledge_revision_orders WHERE status = 'archived'").Scan(&stats.Archived)
	if err != nil {
		return nil, fmt.Errorf("统计已归档数失败: %w", err)
	}

	err = db.QueryRow("SELECT COUNT(*) FROM knowledge_revision_orders WHERE is_overdue = 1 AND status != 'archived'").Scan(&stats.Overdue)
	if err != nil {
		return nil, fmt.Errorf("统计逾期数失败: %w", err)
	}

	return stats, nil
}
