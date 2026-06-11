package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"

	"golang.org/x/crypto/bcrypt"

	"water-office/db"
	"water-office/middleware"
	"water-office/models"
	"water-office/utils"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

func Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "请求参数格式错误"))
		return
	}
	if req.Username == "" || req.Password == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "用户名和密码不能为空"))
		return
	}

	var user models.User
	err := db.DB.QueryRow(
		"SELECT id, username, password, real_name, role, shift, created_at FROM users WHERE username = ?",
		req.Username,
	).Scan(&user.ID, &user.Username, &user.Password, &user.RealName, &user.Role, &user.Shift, &user.CreatedAt)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(utils.Fail(1003, "用户名或密码错误"))
		return
	}

	if err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(utils.Fail(1003, "用户名或密码错误"))
		return
	}

	tokenBytes := make([]byte, 32)
	rand.Read(tokenBytes)
	token := hex.EncodeToString(tokenBytes)

	user.RoleDisplay = user.Role.DisplayName()
	middleware.SetSession(token, user)
	user.Password = ""

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.Success(LoginResponse{
		Token: token,
		User:  user,
	}))
}

func Logout(w http.ResponseWriter, r *http.Request) {
	auth := r.Header.Get("Authorization")
	token := ""
	if len(auth) > 7 && auth[:7] == "Bearer " {
		token = auth[7:]
	}
	if token != "" {
		middleware.ClearSession(token)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.SuccessMsg("退出登录成功", nil))
}

func CurrentUser(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(middleware.ContextUserKey).(*models.User)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.Success(user))
}

func ListUsers(w http.ResponseWriter, r *http.Request) {
	roleFilter := r.URL.Query().Get("role")
	query := "SELECT id, username, real_name, role, shift, created_at FROM users WHERE 1=1"
	args := []interface{}{}
	if roleFilter != "" {
		query += " AND role = ?"
		args = append(args, roleFilter)
	}
	query += " ORDER BY id"

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "查询用户列表失败: "+err.Error()))
		return
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.RealName, &u.Role, &u.Shift, &u.CreatedAt); err != nil {
			continue
		}
		u.RoleDisplay = u.Role.DisplayName()
		users = append(users, u)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.Success(users))
}
