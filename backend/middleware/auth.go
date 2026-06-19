package middleware

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"transfer-system/utils"
)

type UserContext struct {
	echo.Context
	UserID   int64
	Username string
	RealName string
	Role     string
}

func AuthMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		authHeader := c.Request().Header.Get("Authorization")
		if authHeader == "" {
			return utils.Fail(c, http.StatusUnauthorized, "未提供认证token")
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return utils.Fail(c, http.StatusUnauthorized, "认证格式错误，应为 Bearer token")
		}

		claims, err := utils.ParseToken(parts[1])
		if err != nil {
			return utils.Fail(c, http.StatusUnauthorized, "token无效或已过期")
		}

		uc := &UserContext{
			Context:  c,
			UserID:   claims.UserID,
			Username: claims.Username,
			RealName: claims.RealName,
			Role:     claims.Role,
		}

		return next(uc)
	}
}

func RoleMiddleware(allowedRoles ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			uc, ok := c.(*UserContext)
			if !ok {
				return utils.Fail(c, http.StatusInternalServerError, "上下文错误")
			}

			for _, role := range allowedRoles {
				if uc.Role == role {
					return next(c)
				}
			}

			return utils.Fail(c, http.StatusForbidden, "当前角色无权限执行此操作")
		}
	}
}

func GetUserContext(c echo.Context) *UserContext {
	if uc, ok := c.(*UserContext); ok {
		return uc
	}
	return nil
}
