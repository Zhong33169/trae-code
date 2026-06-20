package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"inventory-adjust-system/middleware"
	"inventory-adjust-system/models"
	"inventory-adjust-system/services"
)

var (
	orderService = services.NewOrderService()
	userService  = services.NewUserService()
)

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	Details string      `json:"details,omitempty"`
}

func responseSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:    200,
		Message: "success",
		Data:    data,
	})
}

func responseError(c *gin.Context, code int, message string, details string) {
	c.JSON(code, Response{
		Code:    code,
		Message: message,
		Details: details,
	})
}

func Login(c *gin.Context) {
	var req services.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		responseError(c, http.StatusBadRequest, "参数错误", err.Error())
		return
	}

	user, err := userService.Login(&req)
	if err != nil {
		responseError(c, http.StatusUnauthorized, "登录失败", err.Error())
		return
	}

	responseSuccess(c, gin.H{
		"user": user,
		"token": "demo-token-" + strconv.FormatInt(user.ID, 10),
	})
}

func GetUsers(c *gin.Context) {
	users, err := userService.GetUserList()
	if err != nil {
		responseError(c, http.StatusInternalServerError, "获取用户列表失败", err.Error())
		return
	}
	responseSuccess(c, users)
}

func GetOrderList(c *gin.Context) {
	var query services.OrderQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		responseError(c, http.StatusBadRequest, "参数错误", err.Error())
		return
	}

	userCtx := middleware.GetUserContext(c)
	result, err := orderService.GetOrderList(&query, userCtx)
	if err != nil {
		responseError(c, http.StatusInternalServerError, "查询订单列表失败", err.Error())
		return
	}

	responseSuccess(c, result)
}

func GetOrderDetail(c *gin.Context) {
	orderIDStr := c.Param("id")
	orderID, err := strconv.ParseInt(orderIDStr, 10, 64)
	if err != nil {
		responseError(c, http.StatusBadRequest, "订单ID格式错误", err.Error())
		return
	}

	result, err := orderService.GetOrderDetail(orderID)
	if err != nil {
		responseError(c, http.StatusNotFound, "获取订单详情失败", err.Error())
		return
	}

	responseSuccess(c, result)
}

func SubmitOrder(c *gin.Context) {
	var req services.SubmitOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		responseError(c, http.StatusBadRequest, "参数错误", err.Error())
		return
	}

	userCtx := middleware.GetUserContext(c)
	order, err := orderService.SubmitOrder(&req, userCtx.UserID, userCtx.RealName, userCtx.Role)
	if err != nil {
		responseError(c, http.StatusBadRequest, "提交失败", err.Error())
		return
	}

	responseSuccess(c, order)
}

func ResubmitOrder(c *gin.Context) {
	var req services.SubmitOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		responseError(c, http.StatusBadRequest, "参数错误", err.Error())
		return
	}

	userCtx := middleware.GetUserContext(c)
	order, err := orderService.ResubmitOrder(&req, userCtx.UserID, userCtx.RealName, userCtx.Role)
	if err != nil {
		responseError(c, http.StatusBadRequest, "重新提交失败", err.Error())
		return
	}

	responseSuccess(c, order)
}

func VerifyOrder(c *gin.Context) {
	var req services.VerifyOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		responseError(c, http.StatusBadRequest, "参数错误", err.Error())
		return
	}

	userCtx := middleware.GetUserContext(c)
	order, err := orderService.VerifyOrder(&req, userCtx.UserID, userCtx.RealName, userCtx.Role)
	if err != nil {
		responseError(c, http.StatusBadRequest, "核验失败", err.Error())
		return
	}

	responseSuccess(c, order)
}

func ReviewOrder(c *gin.Context) {
	var req services.ReviewOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		responseError(c, http.StatusBadRequest, "参数错误", err.Error())
		return
	}

	userCtx := middleware.GetUserContext(c)
	order, err := orderService.ReviewOrder(&req, userCtx.UserID, userCtx.RealName, userCtx.Role)
	if err != nil {
		responseError(c, http.StatusBadRequest, "复核失败", err.Error())
		return
	}

	responseSuccess(c, order)
}

func ArchiveOrder(c *gin.Context) {
	var req services.ArchiveOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		responseError(c, http.StatusBadRequest, "参数错误", err.Error())
		return
	}

	userCtx := middleware.GetUserContext(c)
	order, err := orderService.ArchiveOrder(&req, userCtx.UserID, userCtx.RealName, userCtx.Role)
	if err != nil {
		responseError(c, http.StatusBadRequest, "归档失败", err.Error())
		return
	}

	responseSuccess(c, order)
}

func AddSupplement(c *gin.Context) {
	var req services.SupplementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		responseError(c, http.StatusBadRequest, "参数错误", err.Error())
		return
	}

	userCtx := middleware.GetUserContext(c)
	supplement, err := orderService.AddSupplement(&req, userCtx.UserID, userCtx.RealName, userCtx.Role)
	if err != nil {
		responseError(c, http.StatusBadRequest, "补录失败", err.Error())
		return
	}

	responseSuccess(c, supplement)
}

func AddEvidence(c *gin.Context) {
	var req services.AddEvidenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		responseError(c, http.StatusBadRequest, "参数错误", err.Error())
		return
	}

	userCtx := middleware.GetUserContext(c)
	evidence, err := orderService.AddEvidence(&req, userCtx.UserID, userCtx.RealName, userCtx.Role)
	if err != nil {
		responseError(c, http.StatusBadRequest, "补充证据失败", err.Error())
		return
	}

	responseSuccess(c, evidence)
}

func BatchSubmit(c *gin.Context) {
	var req services.BatchSubmitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		responseError(c, http.StatusBadRequest, "参数错误", err.Error())
		return
	}

	userCtx := middleware.GetUserContext(c)
	result, err := orderService.BatchSubmit(&req, userCtx.UserID, userCtx.RealName, userCtx.Role)
	if err != nil {
		responseError(c, http.StatusBadRequest, "批量提交失败", err.Error())
		return
	}

	responseSuccess(c, result)
}

func GetStatistics(c *gin.Context) {
	stats, err := orderService.GetStatistics()
	if err != nil {
		responseError(c, http.StatusInternalServerError, "获取统计数据失败", err.Error())
		return
	}

	responseSuccess(c, stats)
}

func GetRoleInfo(c *gin.Context) {
	userCtx := middleware.GetUserContext(c)
	if userCtx == nil {
		responseError(c, http.StatusUnauthorized, "未登录", "")
		return
	}

	roleText := map[models.Role]string{
		models.RoleWarehouseKeeper:    "库管员",
		models.RoleWarehouseSupervisor: "仓储主管",
		models.RoleOperationManager:   "运营经理",
	}

	responseSuccess(c, gin.H{
		"user_id":    userCtx.UserID,
		"username":   userCtx.Username,
		"real_name":  userCtx.RealName,
		"role":       userCtx.Role,
		"role_text":  roleText[userCtx.Role],
	})
}
