package middleware

import (
	"member-service/internal/database"
	"member-service/internal/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:3005")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Role, X-User-ID")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func GetCurrentUser(c *gin.Context) (int64, string, string) {
	userIDStr := c.GetHeader("X-User-ID")
	userRole := c.GetHeader("X-User-Role")

	if userIDStr == "" {
		return 1, "李登记", "registrar"
	}

	id, err := strconv.ParseInt(userIDStr, 10, 64)
	if err != nil {
		return 1, "李登记", "registrar"
	}

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		return id, "", userRole
	}

	if userRole == "" {
		userRole = string(user.Role)
	}

	return id, user.Name, userRole
}
