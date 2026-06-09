package handler

import (
	"database/sql"
	"net/http"
	"strconv"

	"prescription-transfer/internal/service"
	"prescription-transfer/internal/util"
)

type AuditHandler struct {
	db      *sql.DB
	service *service.AuditService
}

func NewAuditHandler(db *sql.DB) *AuditHandler {
	return &AuditHandler{
		db:      db,
		service: service.NewAuditService(db),
	}
}

func (h *AuditHandler) List(w http.ResponseWriter, r *http.Request) {
	page, pageSize := util.GetPageAndSize(r)
	action := r.URL.Query().Get("action")

	userID := int64(0)
	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr != "" {
		if id, err := strconv.ParseInt(userIDStr, 10, 64); err == nil {
			userID = id
		}
	}

	items, total, err := h.service.List(service.AuditListFilter{
		Page:     page,
		PageSize: pageSize,
		Action:   action,
		UserID:   userID,
	})
	if err != nil {
		util.RespondError(w, http.StatusInternalServerError, "查询失败")
		return
	}

	util.RespondJSON(w, http.StatusOK, util.ListResponse{
		List:       items,
		Pagination: util.CalcPagination(total, page, pageSize),
	})
}
