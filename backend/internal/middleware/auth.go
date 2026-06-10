package middleware

import (
	"context"
	"net/http"
	"repair-system/internal/database"
	"repair-system/internal/models"
	"strconv"

	"gorm.io/gorm"
)

type contextKey string

const (
	ContextKeyUser    contextKey = "current_user"
	ContextKeyUserID  contextKey = "user_id"
	ContextKeyUserRole contextKey = "user_role"
)

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userIdStr := r.Header.Get("X-User-Id")
		if userIdStr == "" {
			http.Error(w, `{"error": "未登录，请设置 X-User-Id header"}`, http.StatusUnauthorized)
			return
		}

		userId, err := strconv.ParseUint(userIdStr, 10, 32)
		if err != nil {
			http.Error(w, `{"error": "X-User-Id 格式错误"}`, http.StatusUnauthorized)
			return
		}

		var user models.User
		result := database.DB.First(&user, uint(userId))
		if result.Error != nil {
			if result.Error == gorm.ErrRecordNotFound {
				http.Error(w, `{"error": "用户不存在"}`, http.StatusUnauthorized)
				return
			}
			http.Error(w, `{"error": "数据库错误"}`, http.StatusInternalServerError)
			return
		}

		ctx := context.WithValue(r.Context(), ContextKeyUser, &user)
		ctx = context.WithValue(ctx, ContextKeyUserID, user.ID)
		ctx = context.WithValue(ctx, ContextKeyUserRole, user.Role)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetCurrentUser(ctx context.Context) *models.User {
	user, ok := ctx.Value(ContextKeyUser).(*models.User)
	if !ok {
		return nil
	}
	return user
}

func GetCurrentUserID(ctx context.Context) uint {
	id, ok := ctx.Value(ContextKeyUserID).(uint)
	if !ok {
		return 0
	}
	return id
}

func GetCurrentUserRole(ctx context.Context) string {
	role, ok := ctx.Value(ContextKeyUserRole).(string)
	if !ok {
		return ""
	}
	return role
}
