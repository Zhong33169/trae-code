package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/auth/") {
			c.Next()
			return
		}

		role := c.GetHeader("X-Role")
		userID := c.GetHeader("X-User-ID")

		if role == "" || userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "未授权：缺少 X-Role 或 X-User-ID 请求头",
			})
			c.Abort()
			return
		}

		validRoles := map[string]bool{
			"clerk":      true,
			"supervisor": true,
			"reviewer":   true,
		}

		if !validRoles[role] {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "未授权：无效的角色类型",
			})
			c.Abort()
			return
		}

		c.Set("role", role)
		c.Set("userID", userID)
		c.Next()
	}
}
