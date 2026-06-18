package app

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeOK(w http.ResponseWriter, data interface{}) {
	writeJSON(w, http.StatusOK, map[string]interface{}{"code": 0, "data": data})
}

func writeErr(w http.ResponseWriter, err error) {
	if ae, ok := err.(*AppError); ok {
		status := http.StatusBadRequest
		switch ae.Code {
		case CodeConflict:
			status = http.StatusConflict
		case CodeNotFound:
			status = http.StatusNotFound
		case CodeInternal:
			status = http.StatusInternalServerError
		}
		writeJSON(w, status, map[string]interface{}{"code": ae.Code, "error": ae.Err, "reason": ae.Reason})
		return
	}
	writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"code": CodeInternal, "error": err.Error(), "reason": ReasonInternal})
}

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.svc.repo.Queries().ListUsers(r.Context())
	if err != nil {
		writeErr(w, err)
		return
	}
	writeOK(w, users)
}

func (h *Handler) ListOrders(w http.ResponseWriter, r *http.Request) {
	role := Role(r.URL.Query().Get("role"))
	status := r.URL.Query().Get("status")
	stage := r.URL.Query().Get("stage")
	warning := r.URL.Query().Get("warning")
	items, err := h.svc.ListOrders(r.Context(), role, status, stage, warning)
	if err != nil {
		writeErr(w, err)
		return
	}
	for i := range items {
		items[i].ActionLabel = actionLabelFor(items[i].CurrentStage)
		items[i].CanAct = true
	}
	writeOK(w, items)
}

func actionLabelFor(stage Stage) string {
	switch stage {
	case StageRegistration:
		return "提交登记"
	case StageVerification:
		return "核验推进"
	case StageArchiving:
		return "归档同步"
	}
	return ""
}

func (h *Handler) GetOrder(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, ErrInvalidInput("id 参数有误"))
		return
	}
	detail, err := h.svc.GetOrderDetail(r.Context(), id)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeOK(w, detail)
}

func (h *Handler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, ErrInvalidInput("请求体解析失败"))
		return
	}
	detail, err := h.svc.CreateOrder(r.Context(), req)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"code": 0, "data": detail})
}

func (h *Handler) ProcessStage(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, ErrInvalidInput("id 参数有误"))
		return
	}
	stage := Stage(chi.URLParam(r, "stage"))
	var req StageActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, ErrInvalidInput("请求体解析失败"))
		return
	}
	detail, err := h.svc.ProcessStage(r.Context(), id, stage, req)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeOK(w, detail)
}

func (h *Handler) BatchProcess(w http.ResponseWriter, r *http.Request) {
	var req BatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, ErrInvalidInput("请求体解析失败"))
		return
	}
	results, err := h.svc.BatchProcess(r.Context(), req)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeOK(w, results)
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.svc.GetStats(r.Context())
	if err != nil {
		writeErr(w, err)
		return
	}
	writeOK(w, stats)
}

func (h *Handler) ListWarnings(w http.ResponseWriter, r *http.Request) {
	groups, err := h.svc.ListWarnings(r.Context())
	if err != nil {
		writeErr(w, err)
		return
	}
	writeOK(w, groups)
}
