package handlers

import (
	"encoding/json"
	"net/http"
	"repair-system/internal/database"
	"repair-system/internal/middleware"
	"repair-system/internal/models"
	"strconv"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetCurrentUser(r.Context())
	if user == nil {
		http.Error(w, `{"error": "未登录"}`, http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func GetAllUsers(w http.ResponseWriter, r *http.Request) {
	var users []models.User
	result := database.DB.Find(&users)
	if result.Error != nil {
		http.Error(w, `{"error": "查询用户失败"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "请求参数错误"}`, http.StatusBadRequest)
		return
	}

	var user models.User
	result := database.DB.Where("username = ?", req.Username).First(&user)
	if result.Error != nil {
		http.Error(w, `{"error": "用户名或密码错误"}`, http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "登录成功，请在后续请求中设置 X-User-Id header",
		"user":    user,
		"tip":     "使用方式: 在请求头中添加 X-User-Id: " + strconv.Itoa(int(user.ID)),
	})
}
