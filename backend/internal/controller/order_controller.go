package controller

import (
	"database/sql"
	"net/http"

	"knowledge-revision-system/internal/model"
	"knowledge-revision-system/internal/service"

	"github.com/gin-gonic/gin"
)

type OrderController struct {
	DB *sql.DB
}

func NewOrderController(db *sql.DB) *OrderController {
	return &OrderController{DB: db}
}

func (oc *OrderController) ListOrders(c *gin.Context) {
	var query model.OrderListQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, model.APIResponse{Code: 400, Message: "查询参数错误", Data: err.Error()})
		return
	}

	orders, total, err := service.ListOrders(oc.DB, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.APIResponse{Code: 500, Message: "查询工单列表失败", Data: err.Error()})
		return
	}

	if orders == nil {
		orders = []model.KnowledgeRevisionOrder{}
	}

	c.JSON(http.StatusOK, model.APIResponse{
		Code:    0,
		Message: "success",
		Data: gin.H{
			"list":      orders,
			"total":     total,
			"page":      query.Page,
			"page_size": query.PageSize,
		},
	})
}

func (oc *OrderController) GetOrder(c *gin.Context) {
	id := c.Param("id")
	order, err := service.GetOrder(oc.DB, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.APIResponse{Code: 500, Message: "查询工单失败", Data: err.Error()})
		return
	}
	if order == nil {
		c.JSON(http.StatusNotFound, model.APIResponse{Code: 404, Message: "工单不存在"})
		return
	}

	c.JSON(http.StatusOK, model.APIResponse{Code: 0, Message: "success", Data: order})
}

func (oc *OrderController) CreateOrder(c *gin.Context) {
	var req model.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.APIResponse{Code: 400, Message: "请求参数错误", Data: err.Error()})
		return
	}

	creatorID, _ := c.Get("userID")
	role, _ := c.Get("role")

	var creatorName string
	var user model.User
	row := oc.DB.QueryRow("SELECT id, name, role FROM users WHERE id = $1", creatorID)
	if err := row.Scan(&user.ID, &user.Name, &user.Role); err == nil {
		creatorName = user.Name
	}

	order, err := service.CreateOrder(oc.DB, req, creatorID.(string), creatorName, role.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.APIResponse{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, model.APIResponse{Code: 0, Message: "创建成功", Data: order})
}

func (oc *OrderController) AdvanceOrder(c *gin.Context) {
	id := c.Param("id")
	var req model.AdvanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.APIResponse{Code: 400, Message: "请求参数错误", Data: err.Error()})
		return
	}

	actorID, _ := c.Get("userID")
	role, _ := c.Get("role")

	var actorName string
	row := oc.DB.QueryRow("SELECT name FROM users WHERE id = $1", actorID)
	row.Scan(&actorName)

	order, err := service.AdvanceOrder(oc.DB, id, req, actorID.(string), actorName, role.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.APIResponse{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, model.APIResponse{Code: 0, Message: "推进成功", Data: order})
}

func (oc *OrderController) ReturnOrder(c *gin.Context) {
	id := c.Param("id")
	var req model.ReturnRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.APIResponse{Code: 400, Message: "请求参数错误", Data: err.Error()})
		return
	}

	actorID, _ := c.Get("userID")
	role, _ := c.Get("role")

	var actorName string
	row := oc.DB.QueryRow("SELECT name FROM users WHERE id = $1", actorID)
	row.Scan(&actorName)

	order, err := service.ReturnOrder(oc.DB, id, req, actorID.(string), actorName, role.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.APIResponse{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, model.APIResponse{Code: 0, Message: "退回成功", Data: order})
}

func (oc *OrderController) CorrectOrder(c *gin.Context) {
	id := c.Param("id")
	var req model.CorrectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.APIResponse{Code: 400, Message: "请求参数错误", Data: err.Error()})
		return
	}

	actorID, _ := c.Get("userID")
	role, _ := c.Get("role")

	var actorName string
	row := oc.DB.QueryRow("SELECT name FROM users WHERE id = $1", actorID)
	row.Scan(&actorName)

	order, err := service.CorrectOrder(oc.DB, id, req, actorID.(string), actorName, role.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.APIResponse{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, model.APIResponse{Code: 0, Message: "补正成功", Data: order})
}

func (oc *OrderController) BatchAdvance(c *gin.Context) {
	var req model.BatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.APIResponse{Code: 400, Message: "请求参数错误", Data: err.Error()})
		return
	}

	actorID, _ := c.Get("userID")
	role, _ := c.Get("role")

	var actorName string
	row := oc.DB.QueryRow("SELECT name FROM users WHERE id = $1", actorID)
	row.Scan(&actorName)

	succeeded, failed := service.BatchAdvance(oc.DB, req, actorID.(string), actorName, role.(string))

	c.JSON(http.StatusOK, model.APIResponse{
		Code:    0,
		Message: "批量推进完成",
		Data: gin.H{
			"succeeded": succeeded,
			"failed":    failed,
		},
	})
}

func (oc *OrderController) BatchReturn(c *gin.Context) {
	var req model.BatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.APIResponse{Code: 400, Message: "请求参数错误", Data: err.Error()})
		return
	}

	actorID, _ := c.Get("userID")
	role, _ := c.Get("role")

	var actorName string
	row := oc.DB.QueryRow("SELECT name FROM users WHERE id = $1", actorID)
	row.Scan(&actorName)

	succeeded, failed := service.BatchReturn(oc.DB, req, actorID.(string), actorName, role.(string))

	c.JSON(http.StatusOK, model.APIResponse{
		Code:    0,
		Message: "批量退回完成",
		Data: gin.H{
			"succeeded": succeeded,
			"failed":    failed,
		},
	})
}
