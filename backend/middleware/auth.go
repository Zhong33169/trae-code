package middleware

import (
	"cross-border-order/models"
	"cross-border-order/store"
	"strings"

	"github.com/gofiber/fiber/v2"
)

func AuthRequired() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "未提供认证令牌",
			})
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "认证令牌格式错误",
			})
		}

		token := parts[1]
		user := store.GetStore().GetUserByToken(token)
		if user == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "认证令牌无效",
			})
		}

		c.Locals("user", user)
		c.Locals("token", token)
		return c.Next()
	}
}

func RoleRequired(roles ...models.Role) fiber.Handler {
	return func(c *fiber.Ctx) error {
		user, ok := c.Locals("user").(*models.User)
		if !ok || user == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "未认证",
			})
		}

		for _, role := range roles {
			if user.Role == role {
				return c.Next()
			}
		}

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "权限不足，当前角色无法执行此操作",
		})
	}
}

func GetCurrentUser(c *fiber.Ctx) *models.User {
	user, ok := c.Locals("user").(*models.User)
	if !ok {
		return nil
	}
	return user
}
