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
	u := middleware.GetCurrentUser(c)
	list, err := db.GetSelections(status, string(u.Role), u.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, list)
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
	if s.Status == model.StatusMissingAttachment {
		atts, err := db.GetAttachments(id)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		valid := 0
		for _, a := range atts {
			if !a.Rejected {
				valid++
			}
		}
		if valid < 2 {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "至少需要 2 份有效附件（品牌授权书、质检报告等），补齐后才能回到处理队列"})
		}
	}
	now := time.Now()
	if err := db.UpdateSelectionStatus(id, model.StatusPending, "", s.ProcessResult, s.AuditNote, now); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	addAudit(id, u, "提交审核", "选品单提交至审核主管处理")
	return c.JSON(http.StatusOK, map[string]string{"message": "已提交审核"})
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
	addAudit(id, u, "复核归档", req.Note)
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
	addAudit(id, u, "复核退回", req.Reason)
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
		switch body.Action {
		case "approve":
			if u.Role != model.RoleSupervisor {
				item["success"] = false
				item["message"] = "无权限"
			} else if s.Status != model.StatusPending && s.Status != model.StatusMissingAttachment {
				item["success"] = false
				item["message"] = "状态不允许审核: " + s.Status
			} else {
				now := time.Now()
				db.UpdateSelectionStatus(id, model.StatusApproved, "", body.Reason, s.AuditNote, now)
				addAudit(id, u, "批量审核通过", body.Reason)
				item["success"] = true
				item["message"] = "已通过"
			}
		case "reject":
			if u.Role != model.RoleSupervisor {
				item["success"] = false
				item["message"] = "无权限"
			} else if s.Status != model.StatusPending && s.Status != model.StatusMissingAttachment {
				item["success"] = false
				item["message"] = "状态不允许退回: " + s.Status
			} else {
				now := time.Now()
				db.UpdateSelectionStatus(id, model.StatusRejected, body.Reason, "", s.AuditNote, now)
				addAudit(id, u, "批量退回", body.Reason)
				item["success"] = true
				item["message"] = "已退回: " + body.Reason
			}
		case "archive":
			if u.Role != model.RoleReviewer {
				item["success"] = false
				item["message"] = "无权限"
			} else if s.Status != model.StatusApproved && s.Status != model.StatusTimeout {
				item["success"] = false
				item["message"] = "状态不允许归档: " + s.Status
			} else {
				now := time.Now()
				db.UpdateSelectionStatus(id, model.StatusArchived, s.RejectReason, s.ProcessResult, s.AuditNote, now)
				addAudit(id, u, "批量归档", body.Reason)
				item["success"] = true
				item["message"] = "已归档"
			}
		default:
			item["success"] = false
			item["message"] = "未知操作: " + body.Action
		}
		results = append(results, item)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"results": results})
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
