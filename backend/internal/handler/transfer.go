package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"prescription-transfer/internal/middleware"
	"prescription-transfer/internal/service"
	"prescription-transfer/internal/util"
)

type TransferHandler struct {
	db      *sql.DB
	service *service.TransferService
}

func NewTransferHandler(db *sql.DB) *TransferHandler {
	return &TransferHandler{
		db:      db,
		service: service.NewTransferService(db),
	}
}

type CreateTransferRequest struct {
	PatientName  string  `json:"patient_name"`
	IDCard       string  `json:"id_card"`
	Department   string  `json:"department"`
	DoctorName   string  `json:"doctor_name"`
	MedicineList string  `json:"medicine_list"`
	TotalAmount  float64 `json:"total_amount"`
}

type OperationRequest struct {
	Version         int    `json:"version"`
	EvidenceContent string `json:"evidence_content"`
	Remark          string `json:"remark"`
}

func (h *TransferHandler) List(w http.ResponseWriter, r *http.Request) {
	page, pageSize := util.GetPageAndSize(r)
	status := r.URL.Query().Get("status")
	keyword := r.URL.Query().Get("keyword")

	items, total, err := h.service.List(service.TransferListFilter{
		Status:   status,
		Keyword:  keyword,
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

func (h *TransferHandler) Get(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		util.RespondError(w, http.StatusBadRequest, "无效的ID")
		return
	}

	transfer, err := h.service.GetByID(id)
	if errors.Is(err, service.ErrNotFound) {
		util.RespondError(w, http.StatusNotFound, "记录不存在")
		return
	}
	if err != nil {
		util.RespondError(w, http.StatusInternalServerError, "查询失败")
		return
	}

	util.RespondJSON(w, http.StatusOK, transfer)
}

func (h *TransferHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		util.RespondError(w, http.StatusUnauthorized, "未授权访问")
		return
	}

	var req CreateTransferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.RespondError(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	if req.PatientName == "" || req.IDCard == "" || req.Department == "" || req.DoctorName == "" {
		util.RespondError(w, http.StatusBadRequest, "必填字段不能为空")
		return
	}

	transfer, err := h.service.Create(service.CreateTransferRequest{
		PatientName:  req.PatientName,
		IDCard:       req.IDCard,
		Department:   req.Department,
		DoctorName:   req.DoctorName,
		MedicineList: req.MedicineList,
		TotalAmount:  req.TotalAmount,
	}, user)
	if err != nil {
		util.RespondError(w, http.StatusInternalServerError, "创建失败")
		return
	}

	util.RespondJSON(w, http.StatusCreated, transfer)
}

func (h *TransferHandler) Register(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		util.RespondError(w, http.StatusUnauthorized, "未授权访问")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		util.RespondError(w, http.StatusBadRequest, "无效的ID")
		return
	}

	var req OperationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.RespondError(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	transfer, err := h.service.Register(id, req.Version, req.EvidenceContent, req.Remark, user)
	if errors.Is(err, service.ErrForbidden) {
		util.RespondError(w, http.StatusForbidden, err.Error())
		return
	}
	if errors.Is(err, service.ErrEvidenceRequired) {
		util.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, service.ErrInvalidStatus) {
		util.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, service.ErrVersionConflict) {
		util.RespondError(w, http.StatusConflict, err.Error())
		return
	}
	if errors.Is(err, service.ErrNotFound) {
		util.RespondError(w, http.StatusNotFound, "记录不存在")
		return
	}
	if err != nil {
		util.RespondError(w, http.StatusInternalServerError, "操作失败")
		return
	}

	util.RespondJSON(w, http.StatusOK, transfer)
}

func (h *TransferHandler) Verify(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		util.RespondError(w, http.StatusUnauthorized, "未授权访问")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		util.RespondError(w, http.StatusBadRequest, "无效的ID")
		return
	}

	var req OperationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.RespondError(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	transfer, err := h.service.Verify(id, req.Version, req.EvidenceContent, req.Remark, user)
	if errors.Is(err, service.ErrForbidden) {
		util.RespondError(w, http.StatusForbidden, err.Error())
		return
	}
	if errors.Is(err, service.ErrEvidenceRequired) {
		util.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, service.ErrInvalidStatus) {
		util.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, service.ErrVersionConflict) {
		util.RespondError(w, http.StatusConflict, err.Error())
		return
	}
	if errors.Is(err, service.ErrNotFound) {
		util.RespondError(w, http.StatusNotFound, "记录不存在")
		return
	}
	if err != nil {
		util.RespondError(w, http.StatusInternalServerError, "操作失败")
		return
	}

	util.RespondJSON(w, http.StatusOK, transfer)
}

func (h *TransferHandler) Review(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		util.RespondError(w, http.StatusUnauthorized, "未授权访问")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		util.RespondError(w, http.StatusBadRequest, "无效的ID")
		return
	}

	var req OperationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.RespondError(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	transfer, err := h.service.Review(id, req.Version, req.EvidenceContent, req.Remark, user)
	if errors.Is(err, service.ErrForbidden) {
		util.RespondError(w, http.StatusForbidden, err.Error())
		return
	}
	if errors.Is(err, service.ErrEvidenceRequired) {
		util.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, service.ErrInvalidStatus) {
		util.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, service.ErrVersionConflict) {
		util.RespondError(w, http.StatusConflict, err.Error())
		return
	}
	if errors.Is(err, service.ErrNotFound) {
		util.RespondError(w, http.StatusNotFound, "记录不存在")
		return
	}
	if err != nil {
		util.RespondError(w, http.StatusInternalServerError, "操作失败")
		return
	}

	util.RespondJSON(w, http.StatusOK, transfer)
}

func (h *TransferHandler) ListEvidences(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		util.RespondError(w, http.StatusBadRequest, "无效的ID")
		return
	}

	evidences, err := h.service.ListEvidences(id)
	if err != nil {
		util.RespondError(w, http.StatusInternalServerError, "查询失败")
		return
	}

	util.RespondJSON(w, http.StatusOK, evidences)
}
