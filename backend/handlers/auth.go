package handlers

import (
	"cross-border-order/models"
	"cross-border-order/store"

	"github.com/gofiber/fiber/v2"
)

type LoginRequest struct {
	Username string `json:"username"`
	Role     string `json:"role"`
}

type LoginResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

func Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "请求格式错误",
		})
	}

	user := store.GetStore().GetUserByUsername(req.Username)
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "用户名不存在",
		})
	}

	token := store.GetStore().CreateToken(user.ID)

	return c.JSON(LoginResponse{
		Token: token,
		User:  *user,
	})
}

func Logout(c *fiber.Ctx) error {
	token, ok := c.Locals("token").(string)
	if ok {
		store.GetStore().RemoveToken(token)
	}
	return c.JSON(fiber.Map{
		"message": "登出成功",
	})
}

func GetCurrentUser(c *fiber.Ctx) error {
	user := c.Locals("user").(*models.User)
	return c.JSON(user)
}

func ListUsers(c *fiber.Ctx) error {
	userList := []models.User{
		{ID: "u1", Username: "registrar", Role: models.RoleRegistrar, Name: "张伟-跨境登记员"},
		{ID: "u2", Username: "supervisor", Role: models.RoleSupervisor, Name: "李娜-跨境审核主管"},
		{ID: "u3", Username: "reviewer", Role: models.RoleReviewer, Name: "王强-跨境电商复核负责人"},
	}
	return c.JSON(userList)
}
