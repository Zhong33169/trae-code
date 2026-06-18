package main

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc  *Service
	repo *Repository
}

func NewHandler(svc *Service, repo *Repository) *Handler {
	return &Handler{svc: svc, repo: repo}
}

func writeErr(c *gin.Context, aerr *ApiError) {
	c.AbortWithStatusJSON(statusFor(aerr.Code), gin_H{"error": aerr})
}

func ok(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin_H{"data": data})
}

func atoiDefault(s string, d int) int {
	if s == "" {
		return d
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return d
	}
	return v
}

func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeErr(c, apiErr("BAD_REQUEST", "请求格式错误"))
		return
	}
	user, hash, err := h.repo.GetUserByUsername(req.Username)
	if err != nil || !verifyPassword(hash, req.Password) {
		writeErr(c, apiErr("UNAUTHORIZED", "用户名或密码错误"))
		return
	}
	token, err := issueToken(user)
	if err != nil {
		writeErr(c, apiErr("INTERNAL", "签发令牌失败"))
		return
	}
	ok(c, gin_H{"token": token, "user": user})
}

func (h *Handler) Me(c *gin.Context) {
	p := currentPrincipal(c)
	ok(c, gin_H{"id": p.ID, "username": p.Username, "role": p.Role, "displayName": p.DisplayName})
}

func (h *Handler) ListTasks(c *gin.Context) {
	q := TaskListQuery{
		Status:  c.Query("status"),
		BatchID: c.Query("batchId"),
		Q:       c.Query("q"),
		Page:    atoiDefault(c.Query("page"), 1),
		Size:    atoiDefault(c.Query("size"), 50),
	}
	tasks, total, err := h.repo.ListTasks(q)
	if err != nil {
		writeErr(c, apiErr("INTERNAL", err.Error()))
		return
	}
	if tasks == nil {
		tasks = []Task{}
	}
	ok(c, gin_H{"items": tasks, "total": total})
}

func (h *Handler) GetTask(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		writeErr(c, apiErr("BAD_REQUEST", "任务ID无效"))
		return
	}
	task, err := h.repo.GetTaskByID(id)
	if err != nil {
		writeErr(c, apiErr("NOT_FOUND", "任务不存在"))
		return
	}
	logs, _ := h.repo.ListAudit("", strconv.Itoa(id))
	if logs == nil {
		logs = []AuditLog{}
	}
	ok(c, gin_H{"task": task, "auditLogs": logs})
}

func (h *Handler) CreateTask(c *gin.Context) {
	p := currentPrincipal(c)
	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeErr(c, apiErr("BAD_REQUEST", "请求格式错误"))
		return
	}
	task, aerr := h.svc.CreateTask(req, p)
	if aerr != nil {
		writeErr(c, aerr)
		return
	}
	c.JSON(http.StatusCreated, gin_H{"data": task})
}

func (h *Handler) UpdateTask(c *gin.Context) {
	p := currentPrincipal(c)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		writeErr(c, apiErr("BAD_REQUEST", "任务ID无效"))
		return
	}
	var req UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeErr(c, apiErr("BAD_REQUEST", "请求格式错误"))
		return
	}
	task, aerr := h.svc.UpdateTask(id, req, p)
	if aerr != nil {
		writeErr(c, aerr)
		return
	}
	ok(c, task)
}

func (h *Handler) Transition(c *gin.Context) {
	p := currentPrincipal(c)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		writeErr(c, apiErr("BAD_REQUEST", "任务ID无效"))
		return
	}
	var req TransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeErr(c, apiErr("BAD_REQUEST", "请求格式错误"))
		return
	}
	task, aerr := h.svc.Transition(id, req, p)
	if aerr != nil {
		writeErr(c, aerr)
		return
	}
	ok(c, task)
}

func (h *Handler) CreateBatch(c *gin.Context) {
	p := currentPrincipal(c)
	var req BatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeErr(c, apiErr("BAD_REQUEST", "请求格式错误"))
		return
	}
	batch, items, aerr := h.svc.BatchTransition(req, p)
	if aerr != nil {
		writeErr(c, aerr)
		return
	}
	if items == nil {
		items = []BatchItem{}
	}
	c.JSON(http.StatusCreated, gin_H{"data": gin_H{"batch": batch, "items": items}})
}

func (h *Handler) ListBatches(c *gin.Context) {
	batches, err := h.repo.ListBatches()
	if err != nil {
		writeErr(c, apiErr("INTERNAL", err.Error()))
		return
	}
	if batches == nil {
		batches = []Batch{}
	}
	ok(c, batches)
}

func (h *Handler) GetBatch(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		writeErr(c, apiErr("BAD_REQUEST", "批次ID无效"))
		return
	}
	batch, err := h.repo.GetBatch(id)
	if err != nil {
		writeErr(c, apiErr("NOT_FOUND", "批次不存在"))
		return
	}
	items, _ := h.repo.ListBatchItems(id)
	if items == nil {
		items = []BatchItem{}
	}
	audit, _ := h.repo.ListAudit(strconv.Itoa(id), "")
	if audit == nil {
		audit = []AuditLog{}
	}
	ok(c, gin_H{"batch": batch, "items": items, "auditLogs": audit})
}

func (h *Handler) RetryBatch(c *gin.Context) {
	p := currentPrincipal(c)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		writeErr(c, apiErr("BAD_REQUEST", "批次ID无效"))
		return
	}
	var req RetryRequest
	_ = c.ShouldBindJSON(&req)
	batch, items, aerr := h.svc.RetryBatch(id, req, p)
	if aerr != nil {
		writeErr(c, aerr)
		return
	}
	if items == nil {
		items = []BatchItem{}
	}
	ok(c, gin_H{"batch": batch, "items": items})
}

func (h *Handler) Audit(c *gin.Context) {
	batchID := c.Query("batchId")
	taskID := c.Query("taskId")
	if batchID == "" && taskID == "" {
		writeErr(c, apiErr("BAD_REQUEST", "请提供 batchId 或 taskId 查询参数"))
		return
	}
	logs, err := h.repo.ListAudit(batchID, taskID)
	if err != nil {
		writeErr(c, apiErr("INTERNAL", err.Error()))
		return
	}
	if logs == nil {
		logs = []AuditLog{}
	}
	ok(c, logs)
}
