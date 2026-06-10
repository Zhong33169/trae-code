package handlers

import (
	"net/http"
	"strconv"
	"time"

	"backend/internal/database"
	"backend/internal/middleware"
	"backend/internal/models"

	"github.com/gin-gonic/gin"
)

func GetStatistics(c *gin.Context) {
	userID, _, _, role := middleware.GetCurrentUser(c)

	baseQuery := database.DB.Model(&models.LeaseApplication{})
	if role == models.RoleRegistrar {
		baseQuery = baseQuery.Where("created_by = ?", userID)
	}

	var total int64
	baseQuery.Count(&total)

	statusQuery := database.DB.Model(&models.LeaseApplication{})
	if role == models.RoleRegistrar {
		statusQuery = statusQuery.Where("created_by = ?", userID)
	}

	statusCounts := []struct {
		Status string `json:"status"`
		Count  int64  `json:"count"`
	}{}
	statusQuery.Select("status, COUNT(*) as count").
		Group("status").
		Scan(&statusCounts)

	statusMap := make(map[string]int64)
	for _, s := range statusCounts {
		statusMap[s.Status] = s.Count
	}

	nodeQuery := database.DB.Model(&models.LeaseApplication{})
	if role == models.RoleRegistrar {
		nodeQuery = nodeQuery.Where("created_by = ?", userID)
	}

	nodeCounts := []struct {
		CurrentNode string `json:"currentNode"`
		Count       int64  `json:"count"`
	}{}
	nodeQuery.Select("current_node, COUNT(*) as count").
		Group("current_node").
		Scan(&nodeCounts)

	nodeMap := make(map[string]int64)
	for _, n := range nodeCounts {
		nodeMap[n.CurrentNode] = n.Count
	}

	overdueQuery := database.DB.Model(&models.LeaseApplication{})
	if role == models.RoleRegistrar {
		overdueQuery = overdueQuery.Where("created_by = ?", userID)
	}
	var overdueCount int64
	overdueQuery.Where("is_overdue = ?", true).Count(&overdueCount)

	auditQuery := database.DB.Model(&models.OverdueAudit{})
	if role == models.RoleRegistrar {
		auditQuery = auditQuery.Where(
			"application_id IN (SELECT id FROM lease_applications WHERE created_by = ?)",
			userID,
		)
	}
	var overdueBlockedCount int64
	var overdueSupplementedCount int64
	auditQuery.Where("audit_type = ?", string(models.AuditTypeBlocked)).Count(&overdueBlockedCount)
	auditQuery = database.DB.Model(&models.OverdueAudit{})
	if role == models.RoleRegistrar {
		auditQuery = auditQuery.Where(
			"application_id IN (SELECT id FROM lease_applications WHERE created_by = ?)",
			userID,
		)
	}
	auditQuery.Where("audit_type = ?", string(models.AuditTypeSupplemented)).Count(&overdueSupplementedCount)

	auditByNode := []struct {
		NodeType string `json:"nodeType"`
		NodeName string `json:"nodeName"`
		Blocked  int64  `json:"blocked"`
	}{}
	auditQuery = database.DB.Model(&models.OverdueAudit{})
	if role == models.RoleRegistrar {
		auditQuery = auditQuery.Where(
			"application_id IN (SELECT id FROM lease_applications WHERE created_by = ?)",
			userID,
		)
	}
	auditQuery.
		Select("node_type as node_type, node_name as node_name, COUNT(*) as blocked").
		Where("audit_type = ?", string(models.AuditTypeBlocked)).
		Group("node_type, node_name").
		Scan(&auditByNode)

	now := time.Now()
	thirtyDaysAgo := now.AddDate(0, 0, -30)

	newMonthQuery := database.DB.Model(&models.LeaseApplication{})
	if role == models.RoleRegistrar {
		newMonthQuery = newMonthQuery.Where("created_by = ?", userID)
	}
	var newThisMonth int64
	newMonthQuery.Where("created_at >= ?", thirtyDaysAgo).Count(&newThisMonth)

	completedMonthQuery := database.DB.Model(&models.LeaseApplication{})
	if role == models.RoleRegistrar {
		completedMonthQuery = completedMonthQuery.Where("created_by = ?", userID)
	}
	var completedThisMonth int64
	completedMonthQuery.Where("completed_at >= ?", thirtyDaysAgo).
		Where("status = ?", models.StatusCompleted).
		Count(&completedThisMonth)

	rentQuery := database.DB.Model(&models.LeaseApplication{})
	if role == models.RoleRegistrar {
		rentQuery = rentQuery.Where("created_by = ?", userID)
	}
	var totalRent float64
	rentQuery.Select("COALESCE(SUM(monthly_rent), 0)").Scan(&totalRent)

	aptQuery := database.DB.Model(&models.LeaseApplication{})
	if role == models.RoleRegistrar {
		aptQuery = aptQuery.Where("created_by = ?", userID)
	}
	apartmentStats := []struct {
		ApartmentName string  `json:"apartmentName"`
		Count         int64   `json:"count"`
		TotalRent     float64 `json:"totalRent"`
	}{}
	aptQuery.Select("apartment_name, COUNT(*) as count, COALESCE(SUM(monthly_rent), 0) as total_rent").
		Group("apartment_name").
		Order("count DESC").
		Limit(10).
		Scan(&apartmentStats)

	myPending := make(map[string]int64)
	switch role {
	case models.RoleRegistrar:
		var draftCount int64
		database.DB.Model(&models.LeaseApplication{}).
			Where("created_by = ? AND status = ?", userID, models.StatusDraft).
			Count(&draftCount)
		myPending["draft"] = draftCount

		var returnedCount int64
		database.DB.Model(&models.LeaseApplication{}).
			Where("created_by = ? AND status = ?", userID, models.StatusReturned).
			Count(&returnedCount)
		myPending["returned"] = returnedCount

	case models.RoleAuditor:
		var reviewCount int64
		database.DB.Model(&models.LeaseApplication{}).
			Where("status = ?", models.StatusPendingReview).
			Count(&reviewCount)
		myPending["pendingReview"] = reviewCount

		var confirmCount int64
		database.DB.Model(&models.LeaseApplication{}).
			Where("status = ?", models.StatusPendingConfirm).
			Count(&confirmCount)
		myPending["pendingConfirm"] = confirmCount

		var handoverCount int64
		database.DB.Model(&models.LeaseApplication{}).
			Where("status = ?", models.StatusPendingHandover).
			Count(&handoverCount)
		myPending["pendingHandover"] = handoverCount

	case models.RoleReviewer:
		var archiveCount int64
		database.DB.Model(&models.LeaseApplication{}).
			Where("status = ?", models.StatusRoomConfirmed).
			Count(&archiveCount)
		myPending["pendingArchive"] = archiveCount
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取统计成功",
		"data": gin.H{
			"total":            total,
			"totalRent":        totalRent,
			"newThisMonth":     newThisMonth,
			"completedThisMonth": completedThisMonth,
			"overdueCount":     overdueCount,
			"overdueBlockedCount":     overdueBlockedCount,
			"overdueSupplementedCount": overdueSupplementedCount,
			"overdueBlockedByNode":     auditByNode,
			"statusStats": gin.H{
				"draft":            statusMap[string(models.StatusDraft)],
				"pendingReview":    statusMap[string(models.StatusPendingReview)],
				"returned":         statusMap[string(models.StatusReturned)],
				"reviewed":         statusMap[string(models.StatusReviewed)],
				"pendingConfirm":   statusMap[string(models.StatusPendingConfirm)],
				"roomConfirmed":    statusMap[string(models.StatusRoomConfirmed)],
				"pendingHandover":  statusMap[string(models.StatusPendingHandover)],
				"completed":        statusMap[string(models.StatusCompleted)],
				"rejected":         statusMap[string(models.StatusRejected)],
			},
			"statusNames": gin.H{
				"draft":            models.GetStatusName(models.StatusDraft),
				"pendingReview":    models.GetStatusName(models.StatusPendingReview),
				"returned":         models.GetStatusName(models.StatusReturned),
				"reviewed":         models.GetStatusName(models.StatusReviewed),
				"pendingConfirm":   models.GetStatusName(models.StatusPendingConfirm),
				"roomConfirmed":    models.GetStatusName(models.StatusRoomConfirmed),
				"pendingHandover":  models.GetStatusName(models.StatusPendingHandover),
				"completed":        models.GetStatusName(models.StatusCompleted),
				"rejected":         models.GetStatusName(models.StatusRejected),
			},
			"nodeStats": gin.H{
				"contractSigning": nodeMap[string(models.NodeContractSigning)],
				"review":          nodeMap[string(models.NodeReview)],
				"roomConfirm":     nodeMap[string(models.NodeRoomConfirm)],
				"handover":        nodeMap[string(models.NodeHandover)],
				"archive":         nodeMap[string(models.NodeArchive)],
			},
			"apartmentStats": apartmentStats,
			"myPending":      myPending,
		},
	})
}

func GetOperationLogs(c *gin.Context) {

	appIDStr := c.Query("applicationId")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	query := database.DB.Model(&models.OperationLog{})
	if appIDStr != "" {
		appID, _ := strconv.ParseUint(appIDStr, 10, 32)
		query = query.Where("application_id = ?", appID)
	}

	var total int64
	query.Count(&total)

	var logs []models.OperationLog
	offset := (page - 1) * pageSize
	query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&logs)

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取操作记录成功",
		"data": gin.H{
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
			"items":    logs,
		},
	})
}
