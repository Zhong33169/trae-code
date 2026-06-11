package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"

	"subcontract-system/models"
)

var jwtSecret = []byte("subcontract-system-secret-key-2025")

type JWTCustomClaims struct {
	UserID string      `json:"user_id"`
	Role   models.Role `json:"role"`
	Name   string      `json:"name"`
	jwt.RegisteredClaims
}

func GenerateToken(user *models.User) (string, error) {
	claims := &JWTCustomClaims{
		UserID: user.ID,
		Role:   user.Role,
		Name:   user.Name,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func JWTAuth() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
					Code:    401,
					Message: "未提供认证令牌",
					Reason:  "missing_token",
				})
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
					Code:    401,
					Message: "认证令牌格式错误",
					Reason:  "invalid_token_format",
				})
			}

			tokenStr := parts[1]
			claims := &JWTCustomClaims{}
			token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
				return jwtSecret, nil
			})

			if err != nil || !token.Valid {
				return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
					Code:    401,
					Message: "认证令牌无效或已过期",
					Reason:  "invalid_or_expired_token",
				})
			}

			c.Set("user_id", claims.UserID)
			c.Set("user_role", claims.Role)
			c.Set("user_name", claims.Name)
			return next(c)
		}
	}
}

func RequireRole(roles ...models.Role) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			userRole, ok := c.Get("user_role").(models.Role)
			if !ok {
				return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
					Code:    401,
					Message: "无法获取用户角色",
					Reason:  "missing_role",
				})
			}

			for _, r := range roles {
				if r == userRole {
					return next(c)
				}
			}

			return c.JSON(http.StatusForbidden, models.ErrorResponse{
				Code:    403,
				Message: "当前角色无权限执行此操作",
				Reason:  "insufficient_role",
			})
		}
	}
}

func GetUserID(c echo.Context) string {
	id, _ := c.Get("user_id").(string)
	return id
}

func GetUserRole(c echo.Context) models.Role {
	r, _ := c.Get("user_role").(models.Role)
	return r
}

func GetUserName(c echo.Context) string {
	n, _ := c.Get("user_name").(string)
	return n
}
