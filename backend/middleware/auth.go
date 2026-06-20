package middleware

import (
	"errors"
	"net/http"
	"repair-platform/models"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

var JWTSecret = []byte("repair-platform-secret-key-2024")

type Claims struct {
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	RealName string `json:"real_name"`
	Role     string `json:"role"`
	Shift    string `json:"shift"`
	jwt.RegisteredClaims
}

type UserContext struct {
	echo.Context
	User *UserInfo
}

type UserInfo struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	RealName string `json:"real_name"`
	Role     string `json:"role"`
	Shift    string `json:"shift"`
}

func GenerateToken(u *models.User) (string, error) {
	claims := Claims{
		UserID:   u.ID,
		Username: u.Username,
		RealName: u.RealName,
		Role:     u.Role,
		Shift:    u.Shift,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(JWTSecret)
}

func JWTAuth() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "缺少认证令牌"})
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "认证令牌格式错误"})
			}

			tokenStr := parts[1]
			claims := &Claims{}
			token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, errors.New("无效的签名方法")
				}
				return JWTSecret, nil
			})

			if err != nil || !token.Valid {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "认证令牌无效或已过期"})
			}

			user := &UserInfo{
				ID:       claims.UserID,
				Username: claims.Username,
				RealName: claims.RealName,
				Role:     claims.Role,
				Shift:    claims.Shift,
			}

			ctx := &UserContext{
				Context: c,
				User:    user,
			}
			return next(ctx)
		}
	}
}

func RequireRole(roles ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			uc, ok := c.(*UserContext)
			if !ok || uc.User == nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "未登录"})
			}

			for _, r := range roles {
				if uc.User.Role == r {
					return next(c)
				}
			}

			roleNames := make([]string, 0, len(roles))
			for _, r := range roles {
				if name, ok := models.RoleDisplayNames[r]; ok {
					roleNames = append(roleNames, name)
				} else {
					roleNames = append(roleNames, r)
				}
			}
			return c.JSON(http.StatusForbidden, map[string]string{
				"error": "权限不足，该操作仅允许以下角色执行: " + strings.Join(roleNames, "、"),
			})
		}
	}
}

func GetUser(c echo.Context) *UserInfo {
	if uc, ok := c.(*UserContext); ok {
		return uc.User
	}
	return nil
}
