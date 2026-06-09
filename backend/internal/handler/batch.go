package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"prescription-transfer/internal/middleware"
	"prescription-transfer/internal/service"
	"prescription-transfer/internal/util"
)

type BatchHandler struct {
	db      *sql.DB
	service *service.BatchService
}

func NewBatchHandler(db *sql.DB) *BatchHandler {
	return &BatchHandler{
		db:      db,
		service: service.NewBatchService(db),
	}
}

type BatchRequest struct {
	TransferIDs     []int64 `json:"transfer_ids"`
	EvidenceContent string  `json:"evidence_content"`
	Remark          string  `json:"remark"`
}

func (h *BatchHandler) BatchRegister(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		util.RespondError(w, http.StatusUnauthorized, "未授权访问")
		return
	}

	var req BatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.RespondError(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	batch, err := h.service.BatchRegister(service.BatchOperationRequest{
		TransferIDs:     req.TransferIDs,
		EvidenceContent: req.EvidenceContent,
		Remark:          req.Remark,
	}, user)

	if errors.Is(err, service.ErrForbidden) {
		util.RespondError(w, http.StatusForbidden, err.Error())
		return
	}
	if errors.Is(err, service.ErrEvidenceRequired) {
		util.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		util.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}

	util.RespondJSON(w, http.StatusOK, batch)
}

func (h *BatchHandler) BatchVerify(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		util.RespondError(w, http.StatusUnauthorized, "未授权访问")
		return
	}

	var req BatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.RespondError(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	batch, err := h.service.BatchVerify(service.BatchOperationRequest{
		TransferIDs:     req.TransferIDs,
		EvidenceContent: req.EvidenceContent,
		Remark:          req.Remark,
	}, user)

	if errors.Is(err, service.ErrForbidden) {
		util.RespondError(w, http.StatusForbidden, err.Error())
		return
	}
	if errors.Is(err, service.ErrEvidenceRequired) {
		util.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		util.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}

	util.RespondJSON(w, http.StatusOK, batch)
}

func (h *BatchHandler) BatchReview(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		util.RespondError(w, http.StatusUnauthorized, "未授权访问")
		return
	}

	var req BatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.RespondError(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	batch, err := h.service.BatchReview(service.BatchOperationRequest{
		TransferIDs:     req.TransferIDs,
		EvidenceContent: req.EvidenceContent,
		Remark:          req.Remark,
	}, user)

	if errors.Is(err, service.ErrForbidden) {
		util.RespondError(w, http.StatusForbidden, err.Error())
		return
	}
	if errors.Is(err, service.ErrEvidenceRequired) {
		util.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		util.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}

	util.RespondJSON(w, http.StatusOK, batch)
}

func (h *BatchHandler) GetBatch(w http.ResponseWriter, r *http.Request) {
	batchNo := chi.URLParam(r, "batch_no")
	if batchNo == "" {
		util.RespondError(w, http.StatusBadRequest, "批次号不能为空")
		return
	}

	result, err := h.service.GetBatch(batchNo)
	if errors.Is(err, service.ErrNotFound) {
		util.RespondError(w, http.StatusNotFound, "批次不存在")
		return
	}
	if err != nil {
		util.RespondError(w, http.StatusInternalServerError, "查询失败")
		return
	}

	util.RespondJSON(w, http.StatusOK, result)
}

func (h *BatchHandler) RetryBatch(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		util.RespondError(w, http.StatusUnauthorized, "未授权访问")
		return
	}

	batchNo := chi.URLParam(r, "batch_no")
	if batchNo == "" {
		util.RespondError(w, http.StatusBadRequest, "批次号不能为空")
		return
	}

	result, err := h.service.RetryBatch(batchNo, user)
	if errors.Is(err, service.ErrForbidden) {
		util.RespondError(w, http.StatusForbidden, err.Error())
		return
	}
	if errors.Is(err, service.ErrNotFound) {
		util.RespondError(w, http.StatusNotFound, "批次不存在")
		return
	}
	if err != nil {
		util.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}

	util.RespondJSON(w, http.StatusOK, result)
}

func (h *BatchHandler) ListBatches(w http.ResponseWriter, r *http.Request) {
	page, pageSize := util.GetPageAndSize(r)

	items, total, err := h.service.ListBatches(service.BatchListFilter{
		Page:     page,
		PageSize: pageSize,
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
