package handlers

import (
	"encoding/json"
	"net/http"

	"fire-hazard-tracker/db"
	"fire-hazard-tracker/middleware"
	"fire-hazard-tracker/models"
)

type APIError struct {
	Error   string `json:"error"`
	Code    int    `json:"code"`
	Detail  string `json:"detail,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, errMsg string, detail ...string) {
	apiErr := APIError{Error: errMsg, Code: status}
	if len(detail) > 0 {
		apiErr.Detail = detail[0]
	}
	writeJSON(w, status, apiErr)
}

func Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数格式错误")
		return
	}

	if req.Username == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "用户名和密码不能为空")
		return
	}

	var user models.User
	err := db.DB.QueryRow(
		"SELECT id, username, password, name, role, station, created_at FROM users WHERE username = ?",
		req.Username,
	).Scan(&user.ID, &user.Username, &user.Password, &user.Name, &user.Role, &user.Station, &user.CreatedAt)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "用户名或密码错误")
		return
	}

	if user.Password != req.Password {
		writeError(w, http.StatusUnauthorized, "用户名或密码错误")
		return
	}

	token, err := middleware.GenerateToken(&user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成登录凭证失败")
		return
	}

	writeJSON(w, http.StatusOK, models.LoginResponse{Token: token, User: &user})
}

func GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		writeError(w, http.StatusUnauthorized, "未登录")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func GetAllUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := db.DB.Query(
		"SELECT id, username, name, role, station, created_at FROM users ORDER BY role, id",
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询用户列表失败")
		return
	}
	defer rows.Close()

	users := make([]*models.User, 0)
	for rows.Next() {
		u := &models.User{}
		err := rows.Scan(&u.ID, &u.Username, &u.Name, &u.Role, &u.Station, &u.CreatedAt)
		if err != nil {
			continue
		}
		users = append(users, u)
	}
	writeJSON(w, http.StatusOK, users)
}
