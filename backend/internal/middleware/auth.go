package middleware

import (
	"net/http"
	"strings"

	"live-selection-backend/internal/db"
	"live-selection-backend/internal/model"

	"github.com/labstack/echo/v4"
)

type contextKey string

const UserContextKey contextKey = "current_user"

func AuthMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Request().Header.Get("X-User-ID")
		if userID == "" {
			userID = c.QueryParam("user_id")
		}
		if userID == "" {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "未提供用户身份"})
		}
		user, err := db.GetUserByID(userID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "用户查询失败"})
		}
		if user == nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "用户不存在"})
		}
		c.Set(string(UserContextKey), user)
		return next(c)
	}
}

func RequireRole(roles ...model.Role) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user, ok := c.Get(string(UserContextKey)).(*model.User)
			if !ok || user == nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "未认证"})
			}
			for _, r := range roles {
				if user.Role == r {
					return next(c)
				}
			}
			return c.JSON(http.StatusForbidden, map[string]string{
				"error": "无权限操作，需要角色: " + joinRoles(roles),
			})
		}
	}
}

func joinRoles(roles []model.Role) string {
	names := make([]string, len(roles))
	for i, r := range roles {
		names[i] = string(r)
	}
	return strings.Join(names, "/")
}

func GetCurrentUser(c echo.Context) *model.User {
	u, _ := c.Get(string(UserContextKey)).(*model.User)
	return u
}
