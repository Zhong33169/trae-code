package handler

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"

	"prescription-transfer/internal/middleware"
	"prescription-transfer/internal/model"
	"prescription-transfer/internal/util"
)

type AuthHandler struct {
	db *sql.DB
}

func NewAuthHandler(db *sql.DB) *AuthHandler {
	return &AuthHandler{db: db}
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	User  *model.User `json:"user"`
	Token string      `json:"token"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.RespondError(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	if req.Username == "" || req.Password == "" {
		util.RespondError(w, http.StatusBadRequest, "用户名和密码不能为空")
		return
	}

	var user model.User
	err := h.db.QueryRow(
		"SELECT id, username, password_hash, role, name, created_at FROM users WHERE username = ?",
		req.Username,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role, &user.Name, &user.CreatedAt)

	if err == sql.ErrNoRows {
		util.RespondError(w, http.StatusUnauthorized, "用户名或密码错误")
		return
	}
	if err != nil {
		util.RespondError(w, http.StatusInternalServerError, "系统错误")
		return
	}

	passwordHash := hashPassword(req.Password)
	if user.PasswordHash != passwordHash {
		util.RespondError(w, http.StatusUnauthorized, "用户名或密码错误")
		return
	}

	token := middleware.GenerateToken(&user)

	util.RespondJSON(w, http.StatusOK, LoginResponse{
		User:  &user,
		Token: token,
	})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		util.RespondError(w, http.StatusUnauthorized, "未授权访问")
		return
	}
	util.RespondJSON(w, http.StatusOK, user)
}

func hashPassword(password string) string {
	h := sha256.Sum256([]byte(password))
	return hex.EncodeToString(h[:])
}
