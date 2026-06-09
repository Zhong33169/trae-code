package middleware

import (
	"consultation-system/internal/models"
	"strings"

	"github.com/gofiber/fiber/v2"
)

type UserContext struct {
	UserID   string
	UserName string
	Role     string
	RoleName string
}

const userContextKey = "currentUser"

func AuthRequired(c *fiber.Ctx) error {
	userID := c.Get("X-User-ID")
	userRole := c.Get("X-User-Role")

	if userID == "" || userRole == "" {
		return c.Status(401).JSON(fiber.Map{
			"error": "未授权访问，请提供用户信息",
		})
	}

	user, err := findUser(userID)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{
			"error": "用户信息无效",
		})
	}

	if user.Role != userRole {
		return c.Status(403).JSON(fiber.Map{
			"error": "用户角色不匹配",
		})
	}

	c.Locals(userContextKey, &UserContext{
		UserID:   user.ID,
		UserName: user.Name,
		Role:     user.Role,
		RoleName: user.RoleName,
	})

	return c.Next()
}

func GetCurrentUser(c *fiber.Ctx) *UserContext {
	user, ok := c.Locals(userContextKey).(*UserContext)
	if !ok {
		return nil
	}
	return user
}

func findUser(userID string) (*models.User, error) {
	var user models.User
	err := models.DB.QueryRow(
		"SELECT id, name, role, role_name, dept FROM users WHERE id = ?",
		userID,
	).Scan(&user.ID, &user.Name, &user.Role, &user.RoleName, &user.Dept)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func RequireRole(roles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		user := GetCurrentUser(c)
		if user == nil {
			return c.Status(401).JSON(fiber.Map{"error": "未授权"})
		}

		allowed := false
		for _, role := range roles {
			if user.Role == role {
				allowed = true
				break
			}
		}

		if !allowed {
			roleNames := make([]string, len(roles))
			for i, r := range roles {
				roleNames[i] = roleToName(r)
			}
			return c.Status(403).JSON(fiber.Map{
				"error": "权限不足，需要角色: " + strings.Join(roleNames, "、"),
			})
		}

		return c.Next()
	}
}

func roleToName(role string) string {
	switch role {
	case models.RoleRegistrar:
		return "会诊申请登记员"
	case models.RoleReviewer:
		return "会诊申请审核主管"
	case models.RoleDirector:
		return "医务部复核负责人"
	default:
		return role
	}
}
