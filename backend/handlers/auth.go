package handlers

import (
	"database/sql"
	"net/http"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"

	"checkin-system/database"
	"checkin-system/middleware"
	"checkin-system/models"
)

func Login(c echo.Context) error {
	var req models.LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if req.Username == "" || req.Password == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "username and password are required"})
	}

	var user models.User
	var hashedPwd string
	err := database.DB.QueryRow(
		"SELECT id, username, password, role, real_name FROM users WHERE username = ?",
		req.Username,
	).Scan(&user.ID, &user.Username, &hashedPwd, &user.Role, &user.RealName)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid username or password"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "database error"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hashedPwd), []byte(req.Password)); err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid username or password"})
	}

	token, err := middleware.GenerateToken(user.ID, user.Username, user.Role)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to generate token"})
	}

	return c.JSON(http.StatusOK, models.LoginResponse{Token: token, User: user})
}

func GetCurrentUser(c echo.Context) error {
	userID, _ := c.Get("user_id").(int)
	username, _ := c.Get("username").(string)
	role, _ := c.Get("role").(string)

	var realName string
	database.DB.QueryRow("SELECT real_name FROM users WHERE id = ?", userID).Scan(&realName)

	return c.JSON(http.StatusOK, models.User{
		ID:       userID,
		Username: username,
		Role:     role,
		RealName: realName,
	})
}
