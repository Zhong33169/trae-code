package middleware

import (
	"github.com/gofiber/fiber/v2"
	"strconv"
	"strings"
)

func Auth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(401).JSON(fiber.Map{"error": "未提供认证信息"})
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(401).JSON(fiber.Map{"error": "认证格式错误"})
		}

		userID, err := strconv.Atoi(parts[1])
		if err != nil || userID < 1 || userID > 6 {
			return c.Status(401).JSON(fiber.Map{"error": "无效的用户ID"})
		}

		c.Locals("userID", userID)
		return c.Next()
	}
}

func GetUserID(c *fiber.Ctx) int {
	if id, ok := c.Locals("userID").(int); ok {
		return id
	}
	return 0
}
