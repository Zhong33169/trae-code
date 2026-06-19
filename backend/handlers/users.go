package handlers

import (
	"database/sql"
	"net/http"

	"aftersales-backend/models"

	"github.com/labstack/echo/v4"
)

func GetUsers(db *sql.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		rows, err := db.Query("SELECT id, name, role, display_name FROM users")
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		defer rows.Close()

		users := []models.User{}
		for rows.Next() {
			var u models.User
			if err := rows.Scan(&u.Id, &u.Name, &u.Role, &u.DisplayName); err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			users = append(users, u)
		}
		return c.JSON(http.StatusOK, users)
	}
}
