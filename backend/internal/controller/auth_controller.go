package controller

import (
	"database/sql"
	"net/http"

	"knowledge-revision-system/internal/model"

	"github.com/gin-gonic/gin"
)

type AuthController struct {
	DB *sql.DB
}

func NewAuthController(db *sql.DB) *AuthController {
	return &AuthController{DB: db}
}

type SwitchRoleRequest struct {
	Role   string `json:"role" binding:"required"`
	UserID string `json:"user_id" binding:"required"`
}

func (ac *AuthController) SwitchRole(c *gin.Context) {
	var req SwitchRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.APIResponse{Code: 400, Message: "请求参数错误", Data: err.Error()})
		return
	}

	validRoles := map[string]bool{
		"clerk":      true,
		"supervisor": true,
		"reviewer":   true,
	}

	if !validRoles[req.Role] {
		c.JSON(http.StatusBadRequest, model.APIResponse{Code: 400, Message: "无效的角色类型"})
		return
	}

	var user model.User
	err := ac.DB.QueryRow("SELECT id, name, role FROM users WHERE id = $1 AND role = $2", req.UserID, req.Role).
		Scan(&user.ID, &user.Name, &user.Role)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, model.APIResponse{Code: 404, Message: "用户不存在或角色不匹配"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.APIResponse{Code: 500, Message: "查询用户失败", Data: err.Error()})
		return
	}

	c.JSON(http.StatusOK, model.APIResponse{Code: 0, Message: "切换角色成功", Data: user})
}

func (ac *AuthController) GetCurrentUser(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	role := c.GetHeader("X-Role")

	if userID == "" || role == "" {
		c.JSON(http.StatusUnauthorized, model.APIResponse{Code: 401, Message: "未登录"})
		return
	}

	var user model.User
	err := ac.DB.QueryRow("SELECT id, name, role FROM users WHERE id = $1", userID).
		Scan(&user.ID, &user.Name, &user.Role)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, model.APIResponse{Code: 404, Message: "用户不存在"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.APIResponse{Code: 500, Message: "查询用户失败", Data: err.Error()})
		return
	}

	c.JSON(http.StatusOK, model.APIResponse{Code: 0, Message: "success", Data: user})
}
