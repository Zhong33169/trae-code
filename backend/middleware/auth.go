package middleware

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"inventory-adjust-system/models"
)

type UserContext struct {
	UserID   int64
	Username string
	RealName string
	Role     models.Role
}

const UserContextKey = "user_context"

func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr := c.GetHeader("X-User-ID")
		userRole := c.GetHeader("X-User-Role")
		realName := c.GetHeader("X-User-Name")
		username := c.GetHeader("X-Username")

		if userIDStr == "" || userRole == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "未授权访问，请先登录",
				"details": "缺少用户认证信息",
			})
			c.Abort()
			return
		}

		userID, err := strconv.ParseInt(userIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "用户ID格式无效",
				"details": err.Error(),
			})
			c.Abort()
			return
		}

		validRoles := map[models.Role]bool{
			models.RoleWarehouseKeeper:    true,
			models.RoleWarehouseSupervisor: true,
			models.RoleOperationManager:   true,
		}

		if !validRoles[models.Role(userRole)] {
			c.JSON(http.StatusForbidden, gin.H{
				"code":    403,
				"message": "无效的用户角色",
				"details": "角色: " + userRole + " 不是系统有效角色",
			})
			c.Abort()
			return
		}

		ctx := &UserContext{
			UserID:   userID,
			Username: username,
			RealName: realName,
			Role:     models.Role(userRole),
		}

		c.Set(UserContextKey, ctx)
		c.Next()
	}
}

func RequireRoles(roles ...models.Role) gin.HandlerFunc {
	return func(c *gin.Context) {
		userCtx, exists := c.Get(UserContextKey)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "未授权访问",
				"details": "用户上下文不存在",
			})
			c.Abort()
			return
		}

		ctx := userCtx.(*UserContext)
		hasRole := false
		for _, r := range roles {
			if ctx.Role == r {
				hasRole = true
				break
			}
		}

		if !hasRole {
			roleNames := make([]string, len(roles))
			for i, r := range roles {
				roleNames[i] = string(r)
			}
			c.JSON(http.StatusForbidden, gin.H{
				"code":    403,
				"message": "权限不足，无法执行此操作",
				"details": "当前角色: " + string(ctx.Role) + "，需要角色: " + strings.Join(roleNames, "/"),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func GetUserContext(c *gin.Context) *UserContext {
	userCtx, exists := c.Get(UserContextKey)
	if !exists {
		return nil
	}
	return userCtx.(*UserContext)
}
