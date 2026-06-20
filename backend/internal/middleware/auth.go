package middleware

import (
	"errors"
	"news-clue-backend/internal/config"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

type UserClaims struct {
	UserID   string `json:"userId"`
	Username string `json:"username"`
	RealName string `json:"realName"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func GenerateToken(userID, username, realName, role string, secret string) (string, error) {
	claims := UserClaims{
		UserID:   userID,
		Username: username,
		RealName: realName,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "news-clue",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func AuthMiddleware(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(401).JSON(fiber.Map{"error": "未提供认证凭证"})
		}
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(401).JSON(fiber.Map{"error": "认证格式错误"})
		}
		tokenStr := parts[1]
		token, err := jwt.ParseWithClaims(tokenStr, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.JWTSecret), nil
		})
		if err != nil || !token.Valid {
			return c.Status(401).JSON(fiber.Map{"error": "认证失败或凭证过期"})
		}
		claims, ok := token.Claims.(*UserClaims)
		if !ok {
			return c.Status(401).JSON(fiber.Map{"error": "凭证解析失败"})
		}
		c.Locals("userId", claims.UserID)
		c.Locals("username", claims.Username)
		c.Locals("realName", claims.RealName)
		c.Locals("role", claims.Role)
		return c.Next()
	}
}

func GetCurrentUser(c *fiber.Ctx) (userID, username, realName, role string) {
	userID, _ = c.Locals("userId").(string)
	username, _ = c.Locals("username").(string)
	realName, _ = c.Locals("realName").(string)
	role, _ = c.Locals("role").(string)
	return
}

func RequireRole(allowedRoles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, _, _, role := GetCurrentUser(c)
		for _, r := range allowedRoles {
			if r == role {
				return c.Next()
			}
		}
		return c.Status(403).JSON(fiber.Map{"error": "无权限执行此操作"})
	}
}

func CheckVersion(current int, expected int) error {
	if current != expected {
		return errors.New("单据版本冲突，该单据已被其他操作修改，请刷新后重试")
	}
	return nil
}
