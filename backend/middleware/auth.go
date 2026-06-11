package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"water-office/models"
	"water-office/utils"
)

type contextKey string

const (
	ContextUserKey contextKey = "current_user"
)

type sessionStore struct {
	token     string
	user      models.User
	expiresAt time.Time
}

var sessions = make(map[string]sessionStore)

func SetSession(token string, user models.User) {
	sessions[token] = sessionStore{
		token:     token,
		user:      user,
		expiresAt: time.Now().Add(24 * time.Hour),
	}
}

func ClearSession(token string) {
	delete(sessions, token)
}

func GetSessionUser(r *http.Request) *models.User {
	token := extractToken(r)
	if token == "" {
		return nil
	}
	s, ok := sessions[token]
	if !ok {
		return nil
	}
	if time.Now().After(s.expiresAt) {
		delete(sessions, token)
		return nil
	}
	user := s.user
	user.RoleDisplay = user.Role.DisplayName()
	return &user
}

func extractToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	if cookie, err := r.Cookie("auth_token"); err == nil {
		return cookie.Value
	}
	return ""
}

func AuthRequired(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := GetSessionUser(r)
		if user == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(utils.Fail(utils.CodeAuthUnauthorized, "未登录或登录已过期，请重新登录"))
			return
		}
		ctx := context.WithValue(r.Context(), ContextUserKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func RoleRequired(allowedRoles ...models.Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, _ := r.Context().Value(ContextUserKey).(*models.User)
			if user == nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(utils.Fail(utils.CodeAuthUnauthorized, "未登录或登录已过期"))
				return
			}
			allowed := false
			for _, ar := range allowedRoles {
				if user.Role == ar {
					allowed = true
					break
				}
			}
			if !allowed {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				json.NewEncoder(w).Encode(utils.Fail(utils.CodeAuthForbidden, "权限不足，当前岗位["+user.Role.DisplayName()+"]无法执行此操作"))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
