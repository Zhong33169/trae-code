package middleware

import (
	"backend/database"
	"backend/models"
	"backend/utils"
	"strings"

	"github.com/gin-gonic/gin"
)

type contextKey string

const UserContextKey contextKey = "user"

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			utils.UnauthorizedError(c, "未登录")
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			utils.UnauthorizedError(c, "无效的token格式")
			c.Abort()
			return
		}

		token := parts[1]
		claims, err := utils.ParseToken(token)
		if err != nil {
			utils.UnauthorizedError(c, "无效的token")
			c.Abort()
			return
		}

		var user models.User
		result := database.DB.Where("username = ? AND role = ?", claims.Username, claims.Role).First(&user)
		if result.Error != nil {
			utils.UnauthorizedError(c, "用户不存在")
			c.Abort()
			return
		}

		c.Set(string(UserContextKey), &user)
		c.Next()
	}
}

func RoleMiddleware(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, exists := c.Get(string(UserContextKey))
		if !exists {
			utils.UnauthorizedError(c, "未登录")
			c.Abort()
			return
		}

		u := user.(*models.User)
		hasRole := false
		for _, role := range roles {
			if u.Role == role {
				hasRole = true
				break
			}
		}

		if !hasRole {
			utils.ForbiddenError(c, "权限不足")
			c.Abort()
			return
		}

		c.Next()
	}
}

func GetCurrentUser(c *gin.Context) *models.User {
	user, exists := c.Get(string(UserContextKey))
	if !exists {
		return nil
	}
	return user.(*models.User)
}
