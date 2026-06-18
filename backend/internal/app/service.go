package app

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type Service struct {
	repo *Repo
}

func NewService(repo *Repo) *Service {
	return &Service{repo: repo}
}

type CreateOrderRequest struct {
	Title         string `json:"title"`
	CustomerName  string `json:"customerName"`
	CustomerPhone string `json:"customerPhone"`
	Address       string `json:"address"`
	RepairType    string `json:"repairType"`
	Priority      string `json:"priority"`
	SlaHours      int    `json:"slaHours"`
	CreatedBy     int    `json:"createdBy"`
}

type StageActionRequest struct {
	Action            string     `json:"action"`
	ActorRole         Role       `json:"actorRole"`
	ActorID           int        `json:"actorId"`
	Materials         []Material `json:"materials"`
	ProcessingOpinion string     `json:"processingOpinion"`
	ReviewComment     string     `json:"reviewComment"`
	Version           int        `json:"version"`
}

type BatchItem struct {
	ID      int `json:"id"`
	Version int `json:"version"`
}

type BatchRequest struct {
	Items         []BatchItem `json:"items"`
	Action        string      `json:"action"`
	ActorRole     Role        `json:"actorRole"`
	ActorID       int         `json:"actorId"`
	ReviewComment string      `json:"reviewComment"`
}

type BatchResultItem struct {
	ID      int    `json:"id"`
	OrderNo string `json:"orderNo"`
	Success bool   `json:"success"`
	Reason  string `json:"reason,omitempty"`
	Message string `json:"message,omitempty"`
}

func defaultMaterials(stage Stage) []Material {
	switch stage {
	case StageRegistration:
		return []Material{
			{Name: "现场勘察照片", Required: true, Provided: false},
			{Name: "客户报修单", Required: true, Provided: false},
			{Name: "现场签字确认", Required: false, Provided: false},
		}
	case StageVerification:
		return []Material{
			{Name: "核验记录单", Required: true, Provided: false},
			{Name: "复测照片", Required: true, Provided: false},
			{Name: "材料清点单", Required: false, Provided: false},
		}
	case StageArchiving:
		return []Material{
			{Name: "归档凭证", Required: true, Provided: false},
			{Name: "费用结算单", Required: true, Provided: false},
			{Name: "回访记录", Required: false, Provided: false},
		}
	}
	return nil
}

func defaultTimeLimit(stage Stage) int {
	switch stage {
	case StageRegistration:
		return 48
	case StageVerification:
		return 48
	case StageArchiving:
		return 72
	}
	return 48
}

func (s *Service) CreateOrder(ctx context.Context, req CreateOrderRequest) (*OrderDetail, error) {
	if strings.TrimSpace(req.Title) == "" || strings.TrimSpace(req.CustomerName) == "" || strings.TrimSpace(req.Address) == "" {
		return nil, ErrInvalidInput("标题、客户名称、地址不能为空")
	}
	if req.SlaHours <= 0 {
		req.SlaHours = 72
	}
	user, err := s.repo.Queries().GetUser(ctx, req.CreatedBy)
	if err != nil {
		return nil, err
	}
	if user.Role != RoleWindowStaff {
		return nil, ErrForbidden("仅窗口人员可建单（越权）")
	}
	now := time.Now()
	deadline := now.Add(time.Duration(req.SlaHours) * time.Hour)
	order := &WorkOrder{
		OrderNo:       genOrderNo(now),
		Title:         req.Title,
		CustomerName:  req.CustomerName,
		CustomerPhone: req.CustomerPhone,
		Address:       req.Address,
		RepairType:    req.RepairType,
		Priority:      req.Priority,
		Status:        StatusPendingReview,
		CurrentStage:  StageRegistration,
		Deadline:      deadline,
		SlaHours:      req.SlaHours,
		CreatedBy:     req.CreatedBy,
		Version:       1,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	var newID int
	err = s.repo.WithTx(ctx, func(q *Queries) error {
		id, err := q.CreateOrder(ctx, order)
		if err != nil {
			return err
		}
		newID = id
		for _, st := range []Stage{StageRegistration, StageVerification, StageArchiving} {
			if err := q.CreateStage(ctx, id, st, StageRole(st), defaultMaterials(st), defaultTimeLimit(st)); err != nil {
				return err
			}
		}
		v := 1
		return q.InsertAuditLog(ctx, AuditLog{
			OrderID: id, Action: "create", ActorID: &req.CreatedBy, ActorRole: user.Role,
			ToStatus: ptr(StatusPendingReview), ToStage: ptr(StageRegistration),
			Detail: "窗口人员创建抢修工单", VersionBefore: nil, VersionAfter: &v,
		})
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrderDetail(ctx, newID)
}

func ptr[T any](v T) *T { return &v }

func genOrderNo(now time.Time) string {
	return fmt.Sprintf("WX%s", now.UTC().Format("20060102150405"))
}

func (s *Service) GetOrderDetail(ctx context.Context, id int) (*OrderDetail, error) {
	q := s.repo.Queries()
	order, err := q.GetOrder(ctx, id)
	if err != nil {
		return nil, err
	}
	stages, err := q.ListStagesByOrder(ctx, id)
	if err != nil {
		return nil, err
	}
	logs, err := q.ListAuditLogs(ctx, id)
	if err != nil {
		return nil, err
	}
	var current *StageRecord
	for i := range stages {
		if stages[i].Stage == order.CurrentStage {
			current = &stages[i]
			break
		}
	}
	return &OrderDetail{
		Order:              order,
		Stages:             stages,
		AuditLogs:          logs,
		Warning:            ComputeWarning(order.Deadline, time.Now()),
		CurrentStageRecord: current,
	}, nil
}

func (s *Service) ListOrders(ctx context.Context, role Role, status, stage, warning string) ([]OrderListItem, error) {
	return s.repo.Queries().ListOrders(ctx, role, status, stage, warning, time.Now())
}

func (s *Service) GetStats(ctx context.Context) (Stats, error) {
	return s.repo.Queries().CountStats(ctx, time.Now())
}

func (s *Service) ListWarnings(ctx context.Context) (map[string][]OrderListItem, error) {
	items, err := s.repo.Queries().ListOrders(ctx, "", "", "", "", time.Now())
	if err != nil {
		return nil, err
	}
	nearDue := []OrderListItem{}
	overdue := []OrderListItem{}
	for _, it := range items {
		if it.Warning.Level == WarningNearDue {
			nearDue = append(nearDue, it)
		}
		if it.Warning.Level == WarningOverdue {
			overdue = append(overdue, it)
		}
	}
	return map[string][]OrderListItem{"near_due": nearDue, "overdue": overdue}, nil
}

func checkEvidence(materials []Material, stored []Material, opinion string, requireOpinion bool) error {
	src := materials
	if len(src) == 0 {
		src = stored
	}
	merged := mergeMaterials(src, stored)
	for _, m := range merged {
		if m.Required && !m.Provided {
			return ErrMissingEvidence("必填材料未提供：" + m.Name)
		}
	}
	if requireOpinion && strings.TrimSpace(opinion) == "" {
		return ErrMissingEvidence("处理意见不能为空")
	}
	return nil
}

func mergeMaterials(src, stored []Material) []Material {
	if len(src) == 0 {
		return stored
	}
	if len(stored) == 0 {
		return src
	}
	out := []Material{}
	byName := map[string]Material{}
	for _, m := range stored {
		byName[m.Name] = m
	}
	for _, m := range src {
		if base, ok := byName[m.Name]; ok {
			merged := base
			merged.Provided = m.Provided
			byName[m.Name] = merged
		} else {
			byName[m.Name] = m
		}
	}
	for _, m := range stored {
		if v, ok := byName[m.Name]; ok {
			out = append(out, v)
		}
	}
	if len(out) == 0 {
		return src
	}
	return out
}

func materialChangeSummary(merged, stored []Material) string {
	changed := []string{}
	storedMap := map[string]bool{}
	for _, m := range stored {
		storedMap[m.Name] = m.Provided
	}
	for _, m := range merged {
		if prev, ok := storedMap[m.Name]; ok {
			if prev != m.Provided {
				if m.Provided {
					changed = append(changed, "补齐"+m.Name)
				} else {
					changed = append(changed, "撤销"+m.Name)
				}
			}
		}
	}
	if len(changed) == 0 {
		return "材料无变更"
	}
	return "材料变更：" + strings.Join(changed, "、")
}

func overStageTime(stageRec StageRecord, now time.Time) bool {
	if stageRec.TimeLimitHours <= 0 || stageRec.StartedAt.IsZero() {
		return false
	}
	return now.Sub(stageRec.StartedAt) > time.Duration(stageRec.TimeLimitHours)*time.Hour
}

func (s *Service) ProcessStage(ctx context.Context, orderID int, stage Stage, req StageActionRequest) (*OrderDetail, error) {
	if req.Action != "submit" && req.Action != "approve" && req.Action != "reject" {
		return nil, ErrInvalidInput("action 必须为 submit/approve/reject")
	}
	err := s.repo.WithTx(ctx, func(q *Queries) error {
		order, err := q.GetOrder(ctx, orderID)
		if err != nil {
			return err
		}
		// 1. permission
		if StageRole(stage) != req.ActorRole {
			return ErrForbidden(fmt.Sprintf("当前岗位 %s 无权操作 %s 阶段（越权）", req.ActorRole, StageLabel(stage)))
		}
		// 2. order/sequence
		if order.CurrentStage != stage {
			return ErrWrongOrder(fmt.Sprintf("工单当前处于 %s 阶段，无法在 %s 阶段操作（顺序有误）", StageLabel(order.CurrentStage), StageLabel(stage)))
		}
		stageRec, err := q.GetStage(ctx, orderID, stage)
		if err != nil {
			return err
		}
		now := time.Now()
		vBefore := order.Version

		switch req.Action {
		case "submit":
			if stage != StageRegistration {
				return ErrWrongOrder("仅登记阶段支持 submit 提交操作")
			}
			if err := checkEvidence(req.Materials, stageRec.Materials, req.ProcessingOpinion, true); err != nil {
				return err
			}
			if overStageTime(stageRec, now) {
				return ErrStageTimeout(fmt.Sprintf("%s 阶段已超出 %d 小时时限，请退回后重新提交", StageLabel(stage), stageRec.TimeLimitHours))
			}
			mergedMats := mergeMaterials(req.Materials, stageRec.Materials)
			if err := q.UpdateStageSubmit(ctx, orderID, stage, req.ActorID, mergedMats, req.ProcessingOpinion); err != nil {
				return err
			}
			affected, err := q.UpdateOrderState(ctx, orderID, req.Version, StageVerification, StatusPendingReview)
			if err != nil {
				return err
			}
			if affected == 0 {
				return ErrConcurrency("")
			}
			vAfter := vBefore + 1
			return q.InsertAuditLog(ctx, AuditLog{
				OrderID: orderID, Action: "submit_registration", ActorID: &req.ActorID, ActorRole: req.ActorRole,
				FromStatus: ptr(order.Status), ToStatus: ptr(StatusPendingReview),
				FromStage: ptr(StageRegistration), ToStage: ptr(StageVerification),
				Detail:        materialChangeSummary(mergedMats, stageRec.Materials) + "；处理意见：" + req.ProcessingOpinion,
				VersionBefore: &vBefore, VersionAfter: &vAfter,
			})

		case "approve":
			if stage != StageVerification && stage != StageArchiving {
				return ErrWrongOrder("仅核验/归档阶段支持 approve 审批操作")
			}
			if err := checkEvidence(req.Materials, stageRec.Materials, req.ProcessingOpinion, true); err != nil {
				return err
			}
			if overStageTime(stageRec, now) {
				return ErrStageTimeout(fmt.Sprintf("%s 阶段已超出 %d 小时时限，请退回后重新处理", StageLabel(stage), stageRec.TimeLimitHours))
			}
			opinion := req.ProcessingOpinion
			if strings.TrimSpace(opinion) == "" {
				opinion = req.ReviewComment
			}
			var newStage Stage
			var newStatus OrderStatus
			var action string
			switch stage {
			case StageVerification:
				newStage, newStatus, action = StageArchiving, StatusApproved, "approve_verification"
			case StageArchiving:
				newStage, newStatus, action = StageArchiving, StatusSynced, "sync_archiving"
			default:
				return ErrWrongOrder("该阶段不支持 approve 操作")
			}
			mergedMats := mergeMaterials(req.Materials, stageRec.Materials)
			if err := q.UpdateStageSubmit(ctx, orderID, stage, req.ActorID, mergedMats, opinion); err != nil {
				return err
			}
			if err := q.UpdateStageReview(ctx, orderID, stage, req.ActorID, StageStatusApproved, req.ReviewComment); err != nil {
				return err
			}
			affected, err := q.UpdateOrderState(ctx, orderID, req.Version, newStage, newStatus)
			if err != nil {
				return err
			}
			if affected == 0 {
				return ErrConcurrency("")
			}
			vAfter := vBefore + 1
			return q.InsertAuditLog(ctx, AuditLog{
				OrderID: orderID, Action: action, ActorID: &req.ActorID, ActorRole: req.ActorRole,
				FromStatus: ptr(order.Status), ToStatus: ptr(newStatus),
				FromStage: ptr(stage), ToStage: ptr(newStage),
				Detail:        materialChangeSummary(mergedMats, stageRec.Materials) + "；处理意见：" + opinion + "；复核备注：" + req.ReviewComment,
				VersionBefore: &vBefore, VersionAfter: &vAfter,
			})

		case "reject":
			if stage != StageVerification && stage != StageArchiving {
				return ErrWrongOrder("仅核验/归档阶段支持 reject 退回操作")
			}
			if strings.TrimSpace(req.ReviewComment) == "" {
				return ErrMissingEvidence("退回原因不能为空")
			}
			var newStage Stage
			switch stage {
			case StageVerification:
				newStage = StageRegistration
			case StageArchiving:
				newStage = StageVerification
			default:
				return ErrWrongOrder("该阶段不支持 reject 操作")
			}
			if err := q.UpdateStageReview(ctx, orderID, stage, req.ActorID, StageStatusRejected, req.ReviewComment); err != nil {
				return err
			}
			if err := q.ReactivateStage(ctx, orderID, newStage); err != nil {
				return err
			}
			affected, err := q.UpdateOrderState(ctx, orderID, req.Version, newStage, StatusPendingReview)
			if err != nil {
				return err
			}
			if affected == 0 {
				return ErrConcurrency("")
			}
			vAfter := vBefore + 1
			return q.InsertAuditLog(ctx, AuditLog{
				OrderID: orderID, Action: "reject_" + string(stage), ActorID: &req.ActorID, ActorRole: req.ActorRole,
				FromStatus: ptr(order.Status), ToStatus: ptr(StatusPendingReview),
				FromStage: ptr(stage), ToStage: ptr(newStage),
				Detail:        "退回原因：" + req.ReviewComment + "（v" + fmt.Sprintf("%d", vBefore) + "→v" + fmt.Sprintf("%d", vAfter) + "）",
				VersionBefore: &vBefore, VersionAfter: &vAfter,
			})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrderDetail(ctx, orderID)
}

func (s *Service) BatchProcess(ctx context.Context, req BatchRequest) ([]BatchResultItem, error) {
	results := make([]BatchResultItem, 0, len(req.Items))
	for _, item := range req.Items {
		res := BatchResultItem{ID: item.ID}
		err := s.repo.WithTx(ctx, func(q *Queries) error {
			order, err := q.GetOrder(ctx, item.ID)
			if err != nil {
				return err
			}
			res.OrderNo = order.OrderNo
			stage := order.CurrentStage
			if StageRole(stage) != req.ActorRole {
				return ErrForbidden(fmt.Sprintf("工单 %s 当前为 %s 阶段，当前岗位无权操作（越权）", order.OrderNo, StageLabel(stage)))
			}
			stageRec, err := q.GetStage(ctx, item.ID, stage)
			if err != nil {
				return err
			}
			now := time.Now()
			vBefore := order.Version
			switch req.Action {
			case "approve":
				if err := checkEvidence(nil, stageRec.Materials, req.ReviewComment, true); err != nil {
					return err
				}
				if overStageTime(stageRec, now) {
					return ErrStageTimeout(fmt.Sprintf("%s 阶段已超时限", StageLabel(stage)))
				}
				var newStage Stage
				var newStatus OrderStatus
				var action string
				switch stage {
				case StageVerification:
					newStage, newStatus, action = StageArchiving, StatusApproved, "batch_approve_verification"
				case StageArchiving:
					newStage, newStatus, action = StageArchiving, StatusSynced, "batch_sync_archiving"
				case StageRegistration:
					return ErrWrongOrder("登记阶段需提交材料，不支持批量推进")
				}
				if err := q.UpdateStageSubmit(ctx, item.ID, stage, req.ActorID, stageRec.Materials, req.ReviewComment); err != nil {
					return err
				}
				if err := q.UpdateStageReview(ctx, item.ID, stage, req.ActorID, StageStatusApproved, req.ReviewComment); err != nil {
					return err
				}
				affected, err := q.UpdateOrderState(ctx, item.ID, item.Version, newStage, newStatus)
				if err != nil {
					return err
				}
				if affected == 0 {
					return ErrConcurrency("")
				}
				vAfter := vBefore + 1
				return q.InsertAuditLog(ctx, AuditLog{
					OrderID: item.ID, Action: action, ActorID: &req.ActorID, ActorRole: req.ActorRole,
					FromStatus: ptr(order.Status), ToStatus: ptr(newStatus),
					FromStage: ptr(stage), ToStage: ptr(newStage),
					Detail: "批量处理意见：" + req.ReviewComment, VersionBefore: &vBefore, VersionAfter: &vAfter,
				})
			case "reject":
				if strings.TrimSpace(req.ReviewComment) == "" {
					return ErrMissingEvidence("退回原因不能为空")
				}
				var newStage Stage
				switch stage {
				case StageVerification:
					newStage = StageRegistration
				case StageArchiving:
					newStage = StageVerification
				default:
					return ErrWrongOrder("该阶段不支持批量退回")
				}
				if err := q.UpdateStageReview(ctx, item.ID, stage, req.ActorID, StageStatusRejected, req.ReviewComment); err != nil {
					return err
				}
				if err := q.ReactivateStage(ctx, item.ID, newStage); err != nil {
					return err
				}
				affected, err := q.UpdateOrderState(ctx, item.ID, item.Version, newStage, StatusPendingReview)
				if err != nil {
					return err
				}
				if affected == 0 {
					return ErrConcurrency("")
				}
				vAfter := vBefore + 1
				return q.InsertAuditLog(ctx, AuditLog{
					OrderID: item.ID, Action: "batch_reject_" + string(stage), ActorID: &req.ActorID, ActorRole: req.ActorRole,
					FromStatus: ptr(order.Status), ToStatus: ptr(StatusPendingReview),
					FromStage: ptr(stage), ToStage: ptr(newStage),
					Detail: "批量退回原因：" + req.ReviewComment + "（v" + fmt.Sprintf("%d", vBefore) + "→v" + fmt.Sprintf("%d", vAfter) + "）", VersionBefore: &vBefore, VersionAfter: &vAfter,
				})
			default:
				return ErrInvalidInput("批量 action 必须为 approve/reject")
			}
		})
		if err != nil {
			ae, ok := err.(*AppError)
			if ok {
				res.Reason = ae.Reason
				res.Message = ae.Err
			} else {
				res.Reason = ReasonInternal
				res.Message = err.Error()
			}
			res.Success = false
		} else {
			res.Success = true
		}
		results = append(results, res)
	}
	return results, nil
}
