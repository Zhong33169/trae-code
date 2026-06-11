package handler

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"live-selection-backend/internal/db"
	"live-selection-backend/internal/middleware"
	"live-selection-backend/internal/model"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

func ListUsers(c echo.Context) error {
	users, err := db.GetUsers()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, users)
}

func CurrentUser(c echo.Context) error {
	u := middleware.GetCurrentUser(c)
	return c.JSON(http.StatusOK, u)
}

func ListSelections(c echo.Context) error {
	status := c.QueryParam("status")
	exception := c.QueryParam("exception") == "1"
	u := middleware.GetCurrentUser(c)
	list, err := db.GetSelections(status, string(u.Role), u.ID, exception)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, list)
}

func GetStats(c echo.Context) error {
	u := middleware.GetCurrentUser(c)
	all, err := db.GetSelections("", string(u.Role), u.ID, false)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	exceptionList, err := db.GetSelections("", string(u.Role), u.ID, true)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	statusCount := map[string]int{}
	for _, s := range all {
		statusCount[string(s.Status)]++
	}
	byStatus := map[string][]model.Selection{}
	for _, s := range exceptionList {
		key := string(s.Status)
		byStatus[key] = append(byStatus[key], s)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"total":            len(all),
		"exception_total":  len(exceptionList),
		"status_count":     statusCount,
		"exception_by_status": byStatus,
	})
}

func GetSelection(c echo.Context) error {
	id := c.Param("id")
	s, err := db.GetSelectionByID(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if s == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "选品单不存在"})
	}
	atts, err := db.GetAttachments(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	s.Attachments = atts
	logs, err := db.GetAuditLogs(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	s.AuditLogs = logs
	return c.JSON(http.StatusOK, s)
}

func CreateSelection(c echo.Context) error {
	u := middleware.GetCurrentUser(c)
	var req model.CreateSelectionRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "参数错误: " + err.Error()})
	}
	if strings.TrimSpace(req.ProductName) == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "商品名称不能为空"})
	}
	now := time.Now()
	s := &model.Selection{
		ID:              "sel_" + uuid.New().String()[:8],
		ProductName:     req.ProductName,
		ProductCategory: req.ProductCategory,
		Brand:           req.Brand,
		Supplier:        req.Supplier,
		EstimatedPrice:  req.EstimatedPrice,
		CommissionRate:  req.CommissionRate,
		Description:     req.Description,
		Status:          model.StatusDraft,
		CreatedBy:       u.ID,
		CreatedByName:   u.Name,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := db.CreateSelection(s); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	addAudit(s.ID, u, "创建选品单", fmt.Sprintf("创建商品：%s (%s)", s.ProductName, s.Brand))
	return c.JSON(http.StatusCreated, s)
}

func SubmitForReview(c echo.Context) error {
	u := middleware.GetCurrentUser(c)
	id := c.Param("id")
	s, err := db.GetSelectionByID(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if s == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "选品单不存在"})
	}
	if s.CreatedBy != u.ID {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "只能提交自己创建的选品单"})
	}
	if s.Status != model.StatusDraft && s.Status != model.StatusMissingAttachment && s.Status != model.StatusRejected {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "当前状态不允许提交审核"})
	}

	atts, err := db.GetAttachments(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	total := len(atts)
	validCount := 0
	rejectedCount := 0
	for _, a := range atts {
		if a.Rejected {
			rejectedCount++
		} else {
			validCount++
		}
	}

	var failReason string
	switch {
	case total == 0:
		failReason = "未上传任何附件，至少需要 2 份有效附件（品牌授权书、质检报告等）"
	case validCount == 0:
		failReason = fmt.Sprintf("全部 %d 份附件均已被驳回（%d 份驳回/0 份有效），请重新上传有效附件后再提交", rejectedCount, rejectedCount)
	case validCount < 2:
		failReason = fmt.Sprintf("有效附件仅 %d 份，至少需要 2 份有效附件才能回到处理队列（当前：%d 份有效 / %d 份驳回）", validCount, validCount, rejectedCount)
	}
	if failReason != "" {
		now := time.Now()
		note := s.AuditNote
		appendNote := fmt.Sprintf("[补正提交失败 %s] %s", now.Format("2006-01-02 15:04"), failReason)
		if note != "" {
			note = note + "\n" + appendNote
		} else {
			note = appendNote
		}
		if err := db.UpdateSelectionStatus(id, s.Status, s.RejectReason, s.ProcessResult, note, now); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		addAudit(id, u, "补正提交失败", failReason)
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error":        failReason,
			"valid_count":  fmt.Sprintf("%d", validCount),
			"total_count":  fmt.Sprintf("%d", total),
			"rejected_count": fmt.Sprintf("%d", rejectedCount),
		})
	}

	now := time.Now()
	detail := fmt.Sprintf("选品单提交至审核主管处理（有效附件 %d 份 / 驳回 %d 份）", validCount, rejectedCount)
	if s.Status == model.StatusMissingAttachment {
		detail = "补正完成，" + detail
	} else if s.Status == model.StatusRejected {
		detail = "重新提交，" + detail
	}
	if err := db.UpdateSelectionStatus(id, model.StatusPending, "", s.ProcessResult, s.AuditNote, now); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	addAudit(id, u, "提交审核", detail)
	return c.JSON(http.StatusOK, map[string]string{
		"message":       "已提交审核",
		"valid_count":   fmt.Sprintf("%d", validCount),
		"rejected_count": fmt.Sprintf("%d", rejectedCount),
	})
}

func ReviewSelection(c echo.Context) error {
	u := middleware.GetCurrentUser(c)
	id := c.Param("id")
	s, err := db.GetSelectionByID(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if s == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "选品单不存在"})
	}
	if s.Status != model.StatusPending && s.Status != model.StatusMissingAttachment {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "当前状态不允许审核"})
	}
	var req model.ReviewRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "参数错误"})
	}
	now := time.Now()

	if len(req.RejectAttachIDs) > 0 {
		for _, aid := range req.RejectAttachIDs {
			reason := "附件不合规"
			if r, ok := req.AttachReasons[aid]; ok && r != "" {
				reason = r
			}
			if err := db.RejectAttachment(aid, reason, u.ID, now); err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": "驳回附件失败: " + err.Error()})
			}
		}
		rejNames := []string{}
		if atts, err := db.GetAttachments(id); err == nil {
			for _, a := range atts {
				for _, aid := range req.RejectAttachIDs {
					if a.ID == aid {
						r := "无原因"
						if a.RejectReason != "" {
							r = a.RejectReason
						}
						rejNames = append(rejNames, a.Name+": "+r)
					}
				}
			}
		}
		if len(rejNames) > 0 {
			addAudit(id, u, "驳回附件", strings.Join(rejNames, "; "))
		}
	}

	if req.Approved {
		if err := db.UpdateSelectionStatus(id, model.StatusApproved, "", req.Reason, s.AuditNote, now); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		detail := "审核通过"
		if req.Reason != "" {
			detail += " - " + req.Reason
		}
		addAudit(id, u, "审核通过", detail)
	} else {
		if len(req.RejectAttachIDs) > 0 {
			if err := db.UpdateSelectionStatus(id, model.StatusMissingAttachment, req.Reason, s.ProcessResult, s.AuditNote, now); err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			detail := "标记附件缺失，要求补正"
			if req.Reason != "" {
				detail += "：" + req.Reason
			}
			addAudit(id, u, "标记缺材料", detail)
		} else {
			if err := db.UpdateSelectionStatus(id, model.StatusRejected, req.Reason, "", s.AuditNote, now); err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			detail := "退回选品单"
			if req.Reason != "" {
				detail += "：" + req.Reason
			}
			addAudit(id, u, "退回选品单", detail)
		}
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "审核完成"})
}

func SetProcessResult(c echo.Context) error {
	u := middleware.GetCurrentUser(c)
	id := c.Param("id")
	s, err := db.GetSelectionByID(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if s == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "选品单不存在"})
	}
	var req model.ProcessResultRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "参数错误"})
	}
	now := time.Now()
	note := s.AuditNote
	if req.Note != "" {
		if note != "" {
			note = note + "\n[" + u.Name + " " + now.Format("2006-01-02 15:04") + "] " + req.Note
		} else {
			note = "[" + u.Name + " " + now.Format("2006-01-02 15:04") + "] " + req.Note
		}
	}
	if err := db.UpdateSelectionStatus(id, s.Status, s.RejectReason, req.Result, note, now); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	addAudit(id, u, "更新处理结果/备注", fmt.Sprintf("结果: %s; 备注: %s", req.Result, req.Note))
	return c.JSON(http.StatusOK, map[string]string{"message": "已更新"})
}

func ArchiveSelection(c echo.Context) error {
	u := middleware.GetCurrentUser(c)
	id := c.Param("id")
	s, err := db.GetSelectionByID(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if s == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "选品单不存在"})
	}
	if s.Status != model.StatusApproved && s.Status != model.StatusTimeout {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "只有已通过或超时的选品单可以归档"})
	}
	var req model.ArchiveRequest
	if err := c.Bind(&req); err != nil {
		req = model.ArchiveRequest{}
	}
	now := time.Now()
	note := s.AuditNote
	if req.Note != "" {
		if note != "" {
			note = note + "\n[" + u.Name + " 归档] " + req.Note
		} else {
			note = "[" + u.Name + " 归档] " + req.Note
		}
	}
	if err := db.UpdateSelectionStatus(id, model.StatusArchived, s.RejectReason, s.ProcessResult, note, now); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	detail := "归档前状态: " + string(s.Status)
	if s.ProcessResult != "" {
		detail += " | 原处理结果: " + s.ProcessResult
	}
	if req.Note != "" {
		detail += " | 归档备注: " + req.Note
	}
	addAudit(id, u, "复核归档", detail)
	return c.JSON(http.StatusOK, map[string]string{"message": "已归档"})
}

func ReturnSelection(c echo.Context) error {
	u := middleware.GetCurrentUser(c)
	id := c.Param("id")
	s, err := db.GetSelectionByID(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if s == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "选品单不存在"})
	}
	if s.Status != model.StatusApproved {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "只能退回已通过的选品单"})
	}
	var req model.ReturnRequest
	if err := c.Bind(&req); err != nil || req.Reason == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "退回原因必填"})
	}
	now := time.Now()
	if err := db.UpdateSelectionStatus(id, model.StatusRejected, req.Reason, s.ProcessResult, s.AuditNote, now); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	detail := "退回原因: " + req.Reason
	if s.ProcessResult != "" {
		detail += " | 退回前处理结果: " + s.ProcessResult
	}
	addAudit(id, u, "复核退回", detail)
	return c.JSON(http.StatusOK, map[string]string{"message": "已退回"})
}

func AddAttachment(c echo.Context) error {
	u := middleware.GetCurrentUser(c)
	id := c.Param("id")
	s, err := db.GetSelectionByID(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if s == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "选品单不存在"})
	}
	if s.CreatedBy != u.ID {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "只能为自己创建的选品单上传附件"})
	}
	var req model.AddAttachmentRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "参数错误"})
	}
	if req.Name == "" || req.URL == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "附件名称和地址必填"})
	}
	a := &model.Attachment{
		ID:          "att_" + uuid.New().String()[:8],
		SelectionID: id,
		Name:        req.Name,
		Type:        req.Type,
		URL:         req.URL,
		UploadedBy:  u.ID,
		UploadedAt:  time.Now(),
	}
	if err := db.AddAttachment(a); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	addAudit(id, u, "上传附件", fmt.Sprintf("附件: %s (%s)", a.Name, a.Type))
	return c.JSON(http.StatusCreated, a)
}

func BatchProcess(c echo.Context) error {
	u := middleware.GetCurrentUser(c)
	var body struct {
		IDs    []string `json:"ids"`
		Action string   `json:"action"`
		Reason string   `json:"reason,omitempty"`
		Result string   `json:"result,omitempty"`
		Note   string   `json:"note,omitempty"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "参数错误"})
	}
	if len(body.IDs) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请选择选品单"})
	}
	results := make([]map[string]interface{}, 0, len(body.IDs))
	for _, id := range body.IDs {
		item := map[string]interface{}{"id": id}
		s, err := db.GetSelectionByID(id)
		if err != nil {
			item["success"] = false
			item["message"] = "查询失败: " + err.Error()
			results = append(results, item)
			continue
		}
		if s == nil {
			item["success"] = false
			item["message"] = "选品单不存在"
			results = append(results, item)
			continue
		}
		item["product_name"] = s.ProductName
		now := time.Now()

		buildDetail := func(extra ...string) string {
			parts := []string{}
			if body.Reason != "" {
				parts = append(parts, "原因: "+body.Reason)
			}
			if body.Result != "" {
				parts = append(parts, "处理结果: "+body.Result)
			}
			if body.Note != "" {
				parts = append(parts, "审计备注: "+body.Note)
			}
			parts = append(parts, extra...)
			return strings.Join(parts, " | ")
		}

		switch body.Action {
		case "approve":
			if u.Role != model.RoleSupervisor {
				item["success"] = false
				item["message"] = "无权限：只有审核主管可批量审核通过"
			} else if s.Status != model.StatusPending && s.Status != model.StatusMissingAttachment {
				item["success"] = false
				item["message"] = fmt.Sprintf("状态不允许审核：当前为 %s，仅待审核/缺材料可通过", s.Status)
			} else {
				atts, attErr := db.GetAttachments(id)
				validCount := 0
				rejectedCount := 0
				if attErr == nil {
					for _, a := range atts {
						if a.Rejected {
							rejectedCount++
						} else {
							validCount++
						}
					}
				}
				if validCount < 2 {
					item["success"] = false
					item["message"] = fmt.Sprintf("有效附件仅 %d 份（驳回 %d 份），至少 2 份有效附件才能通过审核", validCount, rejectedCount)
					addAudit(id, u, "批量审核通过失败", fmt.Sprintf("有效附件=%d，不足2份 | %s", validCount, buildDetail()))
				} else {
					note := s.AuditNote
					if body.Note != "" {
						if note != "" {
							note += "\n"
						}
						note += fmt.Sprintf("[%s 批量审核 %s] %s", u.Name, now.Format("2006-01-02 15:04"), body.Note)
					}
					updErr := db.UpdateSelectionStatus(id, model.StatusApproved, "", body.Result, note, now)
					if updErr != nil {
						item["success"] = false
						item["message"] = "更新状态失败: " + updErr.Error()
					} else {
						addAudit(id, u, "批量审核通过", buildDetail())
						item["success"] = true
						msg := "已通过审核"
						if body.Result != "" {
							msg += "，处理结果：" + body.Result
						}
						item["message"] = msg
					}
				}
			}
		case "reject":
			if u.Role != model.RoleSupervisor {
				item["success"] = false
				item["message"] = "无权限：只有审核主管可批量退回"
			} else if s.Status != model.StatusPending && s.Status != model.StatusMissingAttachment {
				item["success"] = false
				item["message"] = fmt.Sprintf("状态不允许退回：当前为 %s，仅待审核/缺材料可退回", s.Status)
			} else if body.Reason == "" {
				item["success"] = false
				item["message"] = "退回原因必填"
			} else {
				note := s.AuditNote
				if note != "" {
					note += "\n"
				}
				note += fmt.Sprintf("[%s 批量退回 %s] %s", u.Name, now.Format("2006-01-02 15:04"), body.Reason)
				updErr := db.UpdateSelectionStatus(id, model.StatusRejected, body.Reason, body.Result, note, now)
				if updErr != nil {
					item["success"] = false
					item["message"] = "更新状态失败: " + updErr.Error()
				} else {
					addAudit(id, u, "批量退回", buildDetail())
					item["success"] = true
					item["message"] = "已退回：" + body.Reason
				}
			}
		case "return":
			if u.Role != model.RoleReviewer {
				item["success"] = false
				item["message"] = "无权限：只有复核负责人可批量复核退回"
			} else if s.Status != model.StatusApproved {
				item["success"] = false
				item["message"] = fmt.Sprintf("状态不允许复核退回：当前为 %s，仅审核通过可退回", s.Status)
			} else if body.Reason == "" {
				item["success"] = false
				item["message"] = "复核退回原因必填"
			} else {
				note := s.AuditNote
				if note != "" {
					note += "\n"
				}
				note += fmt.Sprintf("[%s 复核退回 %s] %s", u.Name, now.Format("2006-01-02 15:04"), body.Reason)
				updErr := db.UpdateSelectionStatus(id, model.StatusRejected, body.Reason, s.ProcessResult, note, now)
				if updErr != nil {
					item["success"] = false
					item["message"] = "更新状态失败: " + updErr.Error()
				} else {
					addAudit(id, u, "批量复核退回", buildDetail())
					item["success"] = true
					item["message"] = "已复核退回：" + body.Reason
				}
			}
		case "archive":
			if u.Role != model.RoleReviewer {
				item["success"] = false
				item["message"] = "无权限：只有复核负责人可批量归档"
			} else if s.Status != model.StatusApproved && s.Status != model.StatusTimeout {
				item["success"] = false
				item["message"] = fmt.Sprintf("状态不允许归档：当前为 %s，仅审核通过/超时可归档", s.Status)
			} else {
				note := s.AuditNote
				if body.Note != "" {
					if note != "" {
						note += "\n"
					}
					note += fmt.Sprintf("[%s 批量归档 %s] %s", u.Name, now.Format("2006-01-02 15:04"), body.Note)
				}
				updErr := db.UpdateSelectionStatus(id, model.StatusArchived, s.RejectReason, s.ProcessResult, note, now)
				if updErr != nil {
					item["success"] = false
					item["message"] = "更新状态失败: " + updErr.Error()
				} else {
					addAudit(id, u, "批量归档", buildDetail("归档前状态: "+string(s.Status)))
					item["success"] = true
					msg := "已归档"
					if body.Note != "" {
						msg += "，备注：" + body.Note
					}
					item["message"] = msg
				}
			}
		default:
			item["success"] = false
			item["message"] = "未知操作: " + body.Action
		}
		results = append(results, item)
	}
	succ := 0
	for _, r := range results {
		if ok, _ := r["success"].(bool); ok {
			succ++
		}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success_count": succ,
		"total_count":   len(results),
		"results":       results,
	})
}

func addAudit(selID string, u *model.User, action, detail string) {
	log := &model.AuditLog{
		ID:          "audit_" + uuid.New().String()[:8],
		SelectionID: selID,
		UserID:      u.ID,
		UserName:    u.Name,
		Action:      action,
		Detail:      detail,
		CreatedAt:   time.Now(),
	}
	_ = db.AddAuditLog(log)
}
