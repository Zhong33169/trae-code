package handlers

import (
	"database/sql"
	"net/http"

	"github.com/labstack/echo/v4"

	"subcontract-system/db"
	"subcontract-system/middleware"
	"subcontract-system/models"
	"subcontract-system/utils"
)

func Login(c echo.Context) error {
	var req models.LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    400,
			Message: "请求参数格式错误",
			Reason:  "invalid_request",
		})
	}

	if req.Username == "" || req.Password == "" {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    400,
			Message: "用户名和密码不能为空",
			Reason:  "empty_credentials",
		})
	}

	var user models.User
	err := db.DB.QueryRow("SELECT id, username, password, name, role, created_at FROM users WHERE username = ?", req.Username).
		Scan(&user.ID, &user.Username, &user.Password, &user.Name, &user.Role, &user.CreatedAt)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Code:    401,
			Message: "用户不存在",
			Reason:  "user_not_found",
		})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Code:    500,
			Message: "数据库查询失败",
			Reason:  "db_error",
		})
	}

	if !utils.VerifyPassword(req.Password, user.Password) {
		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Code:    401,
			Message: "密码错误",
			Reason:  "wrong_password",
		})
	}

	token, err := middleware.GenerateToken(&user)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Code:    500,
			Message: "生成令牌失败",
			Reason:  "token_error",
		})
	}

	return c.JSON(http.StatusOK, models.LoginResponse{Token: token, User: user})
}

func GetCurrentUser(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"id":   middleware.GetUserID(c),
		"role": middleware.GetUserRole(c),
		"name": middleware.GetUserName(c),
	})
}

func ListUsers(c echo.Context) error {
	rows, err := db.DB.Query("SELECT id, username, name, role, created_at FROM users ORDER BY role, username")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: "查询用户列表失败"})
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		var u models.User
		rows.Scan(&u.ID, &u.Username, &u.Name, &u.Role, &u.CreatedAt)
		users = append(users, u)
	}
	return c.JSON(http.StatusOK, users)
}
