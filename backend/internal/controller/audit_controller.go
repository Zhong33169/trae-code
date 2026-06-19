package controller

import (
	"database/sql"
	"net/http"
	"strconv"

	"knowledge-revision-system/internal/model"
	"knowledge-revision-system/internal/service"

	"github.com/gin-gonic/gin"
)

type AuditController struct {
	DB *sql.DB
}

func NewAuditController(db *sql.DB) *AuditController {
	return &AuditController{DB: db}
}

func (ac *AuditController) ListAuditLogs(c *gin.Context) {
	orderID := c.Query("order_id")
	actorID := c.Query("actor_id")
	action := c.Query("action")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	logs, total, err := service.ListAuditLogs(ac.DB, orderID, actorID, action, startDate, endDate, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.APIResponse{Code: 500, Message: "查询审计日志失败", Data: err.Error()})
		return
	}

	if logs == nil {
		logs = []model.AuditLog{}
	}

	c.JSON(http.StatusOK, model.APIResponse{
		Code:    0,
		Message: "success",
		Data: gin.H{
			"list":      logs,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

func (ac *AuditController) GetAuditLogsByOrder(c *gin.Context) {
	orderID := c.Param("id")

	logs, err := service.GetAuditLogsByOrder(ac.DB, orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.APIResponse{Code: 500, Message: "查询审计日志失败", Data: err.Error()})
		return
	}

	if logs == nil {
		logs = []model.AuditLog{}
	}

	c.JSON(http.StatusOK, model.APIResponse{Code: 0, Message: "success", Data: logs})
}
