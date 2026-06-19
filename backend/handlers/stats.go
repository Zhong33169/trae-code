package handlers

import (
	"database/sql"
	"net/http"

	"aftersales-backend/models"

	"github.com/labstack/echo/v4"
)

func GetStats(db *sql.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		stats := models.StatsResponse{
			ByRisk:   make(map[string]int),
			ByStage:  make(map[string]int),
			ByStatus: make(map[string]int),
		}

		err := db.QueryRow("SELECT COUNT(*) FROM after_sale_orders").Scan(&stats.Total)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		riskRows, err := db.Query("SELECT risk_level, COUNT(*) FROM after_sale_orders GROUP BY risk_level")
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		defer riskRows.Close()
		for riskRows.Next() {
			var level string
			var count int
			if err := riskRows.Scan(&level, &count); err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			stats.ByRisk[level] = count
		}

		stageRows, err := db.Query("SELECT current_stage, COUNT(*) FROM after_sale_orders GROUP BY current_stage")
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		defer stageRows.Close()
		for stageRows.Next() {
			var stage string
			var count int
			if err := stageRows.Scan(&stage, &count); err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			stats.ByStage[stage] = count
		}

		statusRows, err := db.Query("SELECT status, COUNT(*) FROM after_sale_orders GROUP BY status")
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		defer statusRows.Close()
		for statusRows.Next() {
			var status string
			var count int
			if err := statusRows.Scan(&status, &count); err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			stats.ByStatus[status] = count
		}

		return c.JSON(http.StatusOK, stats)
	}
}
