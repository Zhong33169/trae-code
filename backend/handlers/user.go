package handlers

import (
	"database/sql"
	"repair-platform/database"
	"repair-platform/models"

	"github.com/gofiber/fiber/v2"
)

func GetCurrentUser(c *fiber.Ctx) error {
	userID := c.Locals("userID").(int)

	var user models.User
	err := database.DB.QueryRow(`
		SELECT id, username, name, role, created_at
		FROM users WHERE id = ?
	`, userID).Scan(&user.ID, &user.Username, &user.Name, &user.Role, &user.CreatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(404).JSON(fiber.Map{"error": "用户不存在"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "查询失败: " + err.Error()})
	}

	return c.JSON(user)
}

func GetAllUsers(c *fiber.Ctx) error {
	rows, err := database.DB.Query(`
		SELECT id, username, name, role, created_at
		FROM users ORDER BY id
	`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "查询失败: " + err.Error()})
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Name, &u.Role, &u.CreatedAt); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "扫描失败: " + err.Error()})
		}
		users = append(users, u)
	}

	return c.JSON(users)
}
