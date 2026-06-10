package handlers

import (
	"cross-border-order/middleware"
	"cross-border-order/models"
	"cross-border-order/store"
	"time"

	"github.com/gofiber/fiber/v2"
)

func GetAuditLogs(c *fiber.Ctx) error {
	orderID := c.Params("orderId")
	logs := store.GetStore().GetAuditLogs(orderID)
	
	user := middleware.GetCurrentUser(c)
	_ = user
	
	return c.JSON(logs)
}

func GetStatistics(c *fiber.Ctx) error {
	store.GetStore().CheckAndUpdateOverdue()
	user := middleware.GetCurrentUser(c)
	orders := store.GetStore().ListOrders()
	
	stats := &models.Statistics{}
	
	for _, order := range orders {
		visible := false
		switch user.Role {
		case models.RoleRegistrar:
			visible = order.RegistrarID == user.ID || order.Status == models.StatusPending || order.Status == models.StatusReturned || order.Status == models.StatusDraft
		case models.RoleSupervisor:
			visible = order.Status == models.StatusPending || order.Status == models.StatusProcessing || order.Status == models.StatusReturned
		case models.RoleReviewer:
			visible = order.Status == models.StatusProcessing || order.Status == models.StatusReviewed || order.Status == models.StatusArchived
		}
		
		if !visible {
			continue
		}
		
		stats.TotalCount++
		
		switch order.Status {
		case models.StatusPending:
			stats.PendingCount++
		case models.StatusProcessing:
			stats.ProcessingCount++
		case models.StatusArchived:
			stats.ArchivedCount++
		}
		
		if order.IsOverdue {
			stats.OverdueCount++
		}
		
		if order.Status != models.StatusArchived && !order.IsOverdue {
			if isWarning(order) {
				stats.WarningCount++
			}
		}
	}
	
	return c.JSON(stats)
}

func isWarning(order *models.CrossBorderOrder) bool {
	if order.Status == models.StatusArchived {
		return false
	}
	warningDuration := time.Duration(order.WarningHours) * time.Hour
	timeUntilDeadline := time.Until(order.Deadline)
	return timeUntilDeadline > 0 && timeUntilDeadline <= warningDuration
}
