package middleware

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"fire-hazard-tracker/db"
	"fire-hazard-tracker/models"
)

type contextKey string

const UserContextKey contextKey = "user"

func Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"未提供认证凭证","code":401}`, http.StatusUnauthorized)
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, `{"error":"认证格式错误","code":401}`, http.StatusUnauthorized)
			return
		}

		token := parts[1]
		user, err := parseToken(token)
		if err != nil {
			http.Error(w, `{"error":"认证凭证无效或已过期","code":401}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func RequireRole(roles ...models.Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserContextKey).(*models.User)
			if !ok {
				http.Error(w, `{"error":"用户信息获取失败","code":401}`, http.StatusUnauthorized)
				return
			}

			for _, role := range roles {
				if user.Role == role {
					next.ServeHTTP(w, r)
					return
				}
			}

			http.Error(w, `{"error":"当前岗位无此操作权限","code":403}`, http.StatusForbidden)
		})
	}
}

func GetUserFromContext(ctx context.Context) *models.User {
	user, _ := ctx.Value(UserContextKey).(*models.User)
	return user
}

func GenerateToken(user *models.User) (string, error) {
	payload := map[string]interface{}{
		"user_id": user.ID,
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(data), nil
}

func parseToken(token string) (*models.User, error) {
	data, err := base64.URLEncoding.DecodeString(token)
	if err != nil {
		return nil, err
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, err
	}

	exp, ok := payload["exp"].(float64)
	if !ok || time.Now().Unix() > int64(exp) {
		return nil, http.ErrNoCookie
	}

	userID, ok := payload["user_id"].(float64)
	if !ok {
		return nil, http.ErrNoCookie
	}

	var user models.User
	err = db.DB.QueryRow(
		"SELECT id, username, password, name, role, station, created_at FROM users WHERE id = ?",
		int64(userID),
	).Scan(&user.ID, &user.Username, &user.Password, &user.Name, &user.Role, &user.Station, &user.CreatedAt)
	if err != nil {
		return nil, err
	}

	return &user, nil
}
