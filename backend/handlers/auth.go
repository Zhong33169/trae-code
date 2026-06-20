package handlers

import (
	"database/sql"
	"net/http"
	"repair-platform/database"
	"repair-platform/middleware"
	"repair-platform/models"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string               `json:"token"`
	User  *middleware.UserInfo `json:"user"`
}

func Login(c echo.Context) error {
	req := new(LoginRequest)
	if err := c.Bind(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求参数格式错误"})
	}
	if req.Username == "" || req.Password == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "用户名和密码不能为空"})
	}

	var u models.User
	err := database.DB.QueryRow(
		"SELECT id, username, password_hash, real_name, role, phone, shift FROM users WHERE username = ?",
		req.Username,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.RealName, &u.Role, &u.Phone, &u.Shift)

	if err == sql.ErrNoRows {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "用户名或密码错误"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "数据库查询失败"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password)); err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "用户名或密码错误"})
	}

	token, err := middleware.GenerateToken(&u)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "生成令牌失败"})
	}

	return c.JSON(http.StatusOK, LoginResponse{
		Token: token,
		User: &middleware.UserInfo{
			ID:       u.ID,
			Username: u.Username,
			RealName: u.RealName,
			Role:     u.Role,
			Shift:    u.Shift,
		},
	})
}

func GetCurrentUser(c echo.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "未登录"})
	}

	var shift string
	database.DB.QueryRow("SELECT shift FROM users WHERE id = ?", user.ID).Scan(&shift)
	user.Shift = shift

	return c.JSON(http.StatusOK, map[string]interface{}{
		"user":          user,
		"role_display":  models.RoleDisplayNames[user.Role],
		"shift_display": models.ShiftDisplayNames[user.Shift],
	})
}

func ListUsers(c echo.Context) error {
	role := c.QueryParam("role")
	shift := c.QueryParam("shift")

	query := "SELECT id, username, real_name, role, phone, shift FROM users WHERE 1=1"
	var args []interface{}

	if role != "" {
		query += " AND role = ?"
		args = append(args, role)
	}
	if shift != "" {
		query += " AND shift = ?"
		args = append(args, shift)
	}
	query += " ORDER BY id ASC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "查询用户列表失败"})
	}
	defer rows.Close()

	users := make([]map[string]interface{}, 0)
	for rows.Next() {
		var u models.User
		rows.Scan(&u.ID, &u.Username, &u.RealName, &u.Role, &u.Phone, &u.Shift)
		users = append(users, map[string]interface{}{
			"id":            u.ID,
			"username":      u.Username,
			"real_name":     u.RealName,
			"role":          u.Role,
			"role_display":  models.RoleDisplayNames[u.Role],
			"phone":         u.Phone,
			"shift":         u.Shift,
			"shift_display": models.ShiftDisplayNames[u.Shift],
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"users": users})
}
