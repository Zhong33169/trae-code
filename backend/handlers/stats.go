package handlers

import (
	"net/http"
	"repair-platform/database"
	"repair-platform/models"

	"github.com/labstack/echo/v4"
)

func GetStatistics(c echo.Context) error {
	type countRow struct {
		Status string
		Count  int
	}

	statusList := []string{
		models.StatusDraft,
		models.StatusPendingQuote,
		models.StatusQuoted,
		models.StatusConfirmed,
		models.StatusCustomerPaid,
		models.StatusRepairing,
		models.StatusReturned,
		models.StatusCompleted,
		models.StatusCancelled,
	}

	statusCounts := make(map[string]int)
	for _, s := range statusList {
		statusCounts[s] = 0
	}

	rows, err := database.DB.Query("SELECT status, COUNT(*) FROM repair_quotes GROUP BY status")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "统计查询失败"})
	}
	for rows.Next() {
		var r countRow
		rows.Scan(&r.Status, &r.Count)
		statusCounts[r.Status] = r.Count
	}
	rows.Close()

	statusListDisplay := make([]map[string]interface{}, 0)
	for _, s := range statusList {
		statusListDisplay = append(statusListDisplay, map[string]interface{}{
			"code":  s,
			"name":  models.StatusDisplayNames[s],
			"count": statusCounts[s],
		})
	}

	var total, activeCount, pendingQuoteCount, toConfirmCount, toPayCount, repairingCount, returnedCount, completedCount, cancelledCount int
	database.DB.QueryRow("SELECT COUNT(*) FROM repair_quotes").Scan(&total)
	database.DB.QueryRow("SELECT COUNT(*) FROM repair_quotes WHERE status NOT IN ('completed', 'cancelled')").Scan(&activeCount)
	pendingQuoteCount = statusCounts[models.StatusPendingQuote]
	toConfirmCount = statusCounts[models.StatusQuoted]
	toPayCount = statusCounts[models.StatusConfirmed]
	repairingCount = statusCounts[models.StatusRepairing]
	returnedCount = statusCounts[models.StatusReturned]
	completedCount = statusCounts[models.StatusCompleted]
	cancelledCount = statusCounts[models.StatusCancelled]

	var pendingHandovers int
	database.DB.QueryRow("SELECT COUNT(*) FROM shift_handovers WHERE status = 'pending'").Scan(&pendingHandovers)

	var totalEstimate, totalActual, totalPaid float64
	rows2, _ := database.DB.Query(`SELECT 
		COALESCE(SUM(estimate_amount), 0),
		COALESCE(SUM(actual_amount), 0),
		COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN actual_amount ELSE 0 END), 0)
		FROM repair_quotes`)
	if rows2.Next() {
		rows2.Scan(&totalEstimate, &totalActual, &totalPaid)
	}
	rows2.Close()

	roleCounts := make(map[string]int)
	rows3, _ := database.DB.Query(`SELECT u.role, COUNT(*) as cnt FROM users u GROUP BY u.role`)
	for rows3.Next() {
		var role string
		var cnt int
		rows3.Scan(&role, &cnt)
		roleCounts[role] = cnt
	}
	rows3.Close()

	userActiveCounts := make([]map[string]interface{}, 0)
	rows4, _ := database.DB.Query(`SELECT current_handler, current_handler_id, COUNT(*) as cnt
		FROM repair_quotes
		WHERE status NOT IN ('completed', 'cancelled') AND current_handler_id > 0
		GROUP BY current_handler, current_handler_id
		ORDER BY cnt DESC
		LIMIT 10`)
	for rows4.Next() {
		var name string
		var id, cnt int64
		rows4.Scan(&name, &id, &cnt)
		userActiveCounts = append(userActiveCounts, map[string]interface{}{
			"handler_name": name,
			"handler_id":   id,
			"active_count": cnt,
		})
	}
	rows4.Close()

	shiftCounts := make([]map[string]interface{}, 0)
	rows5, _ := database.DB.Query(`SELECT shift, COUNT(*) as cnt
		FROM repair_quotes WHERE status NOT IN ('completed', 'cancelled')
		GROUP BY shift ORDER BY cnt DESC`)
	for rows5.Next() {
		var shift string
		var cnt int
		rows5.Scan(&shift, &cnt)
		name, ok := models.ShiftDisplayNames[shift]
		if !ok {
			name = shift
		}
		shiftCounts = append(shiftCounts, map[string]interface{}{
			"shift": shift,
			"name":  name,
			"count": cnt,
		})
	}
	rows5.Close()

	deviceTypeCounts := make([]map[string]interface{}, 0)
	rows6, _ := database.DB.Query(`SELECT device_type, COUNT(*) as cnt
		FROM repair_quotes GROUP BY device_type ORDER BY cnt DESC LIMIT 8`)
	for rows6.Next() {
		var dt string
		var cnt int
		rows6.Scan(&dt, &cnt)
		deviceTypeCounts = append(deviceTypeCounts, map[string]interface{}{
			"device_type": dt,
			"count":       cnt,
		})
	}
	rows6.Close()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"summary": map[string]interface{}{
			"total":             total,
			"active":            activeCount,
			"pending_quote":     pendingQuoteCount,
			"to_confirm":        toConfirmCount,
			"to_pay":            toPayCount,
			"repairing":         repairingCount,
			"returned":          returnedCount,
			"completed":         completedCount,
			"cancelled":         cancelledCount,
			"pending_handovers": pendingHandovers,
		},
		"amount": map[string]interface{}{
			"total_estimate": totalEstimate,
			"total_actual":   totalActual,
			"total_paid":     totalPaid,
			"unpaid":         totalActual - totalPaid,
		},
		"user_distribution": map[string]interface{}{
			"service_manager_count":  roleCounts[models.RoleServiceManager],
			"dispatcher_count":       roleCounts[models.RoleDispatcher],
			"customer_service_count": roleCounts[models.RoleCustomerService],
			"technician_count":       roleCounts[models.RoleTechnician],
		},
		"status_breakdown":  statusListDisplay,
		"active_by_handler": userActiveCounts,
		"active_by_shift":   shiftCounts,
		"active_by_device":  deviceTypeCounts,
	})
}
