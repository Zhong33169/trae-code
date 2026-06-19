package middleware

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"knowledge-revision-system/internal/model"
	"knowledge-revision-system/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func writeAuthFailureAuditLog(db *sql.DB, orderID, actorID, actorName, actorRole string, failureReason string) {
	var orderNo string
	var fromStatus string
	row := db.QueryRow("SELECT order_no, status FROM knowledge_revision_orders WHERE id = $1", orderID)
	if err := row.Scan(&orderNo, &fromStatus); err != nil {
		return
	}
	now := time.Now().Format("2006-01-02 15:04:05")
	auditLog := &model.AuditLog{
		ID:            uuid.New().String(),
		OrderID:       orderID,
		OrderNo:       orderNo,
		Action:        "auth_failed",
		ActorID:       actorID,
		ActorName:     actorName,
		ActorRole:     actorRole,
		FromStatus:    fromStatus,
		ToStatus:      "",
		FailureReason: failureReason,
		CreatedAt:     now,
	}
	repository.CreateAuditLog(db, auditLog)
}

func extractOrderID(path string) string {
	prefix := "/api/orders/"
	if !strings.HasPrefix(path, prefix) {
		return ""
	}
	rest := strings.TrimPrefix(path, prefix)
	parts := strings.Split(rest, "/")
	if len(parts) == 0 {
		return ""
	}
	candidate := parts[0]
	if candidate == "batch-advance" || candidate == "batch-return" {
		return ""
	}
	return candidate
}

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
			orderID := extractOrderID(c.Request.URL.Path)
			if orderID != "" {
				writeAuthFailureAuditLog(db, orderID, userID, "", role,
					fmt.Sprintf("无效身份：角色类型 %s 不合法", role))
			}
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "未授权：无效的角色类型",
				"data": gin.H{
					"failure_type":   "unauthorized",
					"failure_reason": fmt.Sprintf("无效身份：角色类型 %s 不合法", role),
				},
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
			orderID := extractOrderID(c.Request.URL.Path)
			if orderID != "" {
				writeAuthFailureAuditLog(db, orderID, userID, "", role,
					fmt.Sprintf("无效身份：用户 %s 不存在", userID))
			}
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "未授权：用户不存在",
				"data": gin.H{
					"failure_type":   "unauthorized",
					"failure_reason": fmt.Sprintf("无效身份：用户 %s 不存在", userID),
				},
			})
			c.Abort()
			return
		}

		if user.Role != role {
			orderID := extractOrderID(c.Request.URL.Path)
			if orderID != "" {
				writeAuthFailureAuditLog(db, orderID, userID, user.Name, role,
					fmt.Sprintf("伪造角色：用户 %s 实际角色为 %s，请求角色为 %s", userID, user.Role, role))
			}
			c.JSON(http.StatusForbidden, gin.H{
				"code":    403,
				"message": "未授权：角色与用户不匹配，拒绝伪造角色",
				"data": gin.H{
					"failure_type":   "unauthorized",
					"failure_reason": fmt.Sprintf("伪造角色：用户 %s 实际角色为 %s，请求角色为 %s", userID, user.Role, role),
				},
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
