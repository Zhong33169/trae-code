package middleware

import (
	"database/sql"
	"net/http"
	"strings"

	"knowledge-revision-system/internal/repository"

	"github.com/gin-gonic/gin"
)

func Auth(db *sql.DB) gin.HandlerFunc {
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

		user, err := repository.GetUserByID(db, userID)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "未授权：用户查询失败",
			})
			c.Abort()
			return
		}
		if user == nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "未授权：用户不存在",
			})
			c.Abort()
			return
		}

		if user.Role != role {
			c.JSON(http.StatusForbidden, gin.H{
				"code":    403,
				"message": "未授权：角色与用户不匹配，拒绝伪造角色",
			})
			c.Abort()
			return
		}

		c.Set("role", role)
		c.Set("userID", userID)
		c.Set("userName", user.Name)
		c.Next()
	}
}
