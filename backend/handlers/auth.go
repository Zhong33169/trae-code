package handlers

import (
	"database/sql"
	"net/http"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
	"transfer-system/db"
	"transfer-system/middleware"
	"transfer-system/models"
	"transfer-system/utils"
)

func Login(c echo.Context) error {
	var req models.LoginRequest
	if err := c.Bind(&req); err != nil {
		return utils.ErrorMsg(c, "请求参数错误")
	}

	if req.Username == "" || req.Password == "" {
		return utils.ErrorMsg(c, "用户名和密码不能为空")
	}

	var user models.User
	var hashedPwd string
	err := db.DB.QueryRow(
		"SELECT id, username, password, real_name, role FROM users WHERE username = ?",
		req.Username,
	).Scan(&user.ID, &user.Username, &hashedPwd, &user.RealName, &user.Role)

	if err == sql.ErrNoRows {
		return utils.Fail(c, http.StatusUnauthorized, "用户不存在")
	}
	if err != nil {
		return utils.Fail(c, http.StatusInternalServerError, "查询用户失败")
	}

	if err = bcrypt.CompareHashAndPassword([]byte(hashedPwd), []byte(req.Password)); err != nil {
		return utils.Fail(c, http.StatusUnauthorized, "密码错误")
	}

	token, err := utils.GenerateToken(user.ID, user.Username, user.RealName, string(user.Role))
	if err != nil {
		return utils.Fail(c, http.StatusInternalServerError, "生成token失败")
	}

	_, _ = db.DB.Exec(
		"INSERT INTO operation_logs (user_id, action, detail) VALUES (?, ?, ?)",
		user.ID, "login", "用户登录成功",
	)

	return utils.Success(c, models.LoginResponse{
		Token: token,
		User:  &user,
	})
}

func GetCurrentUser(c echo.Context) error {
	uc := middleware.GetUserContext(c)
	if uc == nil {
		return utils.Fail(c, http.StatusUnauthorized, "未登录")
	}

	var user models.User
	err := db.DB.QueryRow(
		"SELECT id, username, real_name, role FROM users WHERE id = ?",
		uc.UserID,
	).Scan(&user.ID, &user.Username, &user.RealName, &user.Role)

	if err != nil {
		return utils.Fail(c, http.StatusInternalServerError, "获取用户信息失败")
	}

	return utils.Success(c, user)
}
