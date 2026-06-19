package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"aftersales-backend/models"

	"github.com/labstack/echo/v4"
)

func ChangeRiskLevel(db *sql.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		id := c.Param("id")

		var order models.AfterSaleOrder
		err := db.QueryRow(
			"SELECT id, order_no, customer_name, product_name, order_amount, refund_amount, risk_level, current_stage, current_step, status, handler_role, handler_name, required_evidence, evidence_provided, version, deadline, created_at, updated_at FROM after_sale_orders WHERE id = ?",
			id,
		).Scan(
			&order.Id, &order.OrderNo, &order.CustomerName, &order.ProductName,
			&order.OrderAmount, &order.RefundAmount, &order.RiskLevel,
			&order.CurrentStage, &order.CurrentStep, &order.Status,
			&order.HandlerRole, &order.HandlerName,
			&order.RequiredEvidence, &order.EvidenceProvided,
			&order.Version, &order.Deadline, &order.CreatedAt, &order.UpdatedAt,
		)
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "订单不存在"})
		}
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		var req models.RiskChangeRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "无效的请求数据"})
		}

		if req.NewLevel == order.RiskLevel {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "新风险等级与当前等级相同"})
		}

		var user models.User
		err = db.QueryRow("SELECT id, name, role, display_name FROM users WHERE id = ?", req.OperatorId).Scan(&user.Id, &user.Name, &user.Role, &user.DisplayName)
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "操作用户不存在"})
		}
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		now := time.Now()

		_, err = db.Exec("UPDATE after_sale_orders SET risk_level = ?, updated_at = ? WHERE id = ?", req.NewLevel, now, order.Id)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		var riskLog models.RiskChangeLog
		err = db.QueryRow(
			`INSERT INTO risk_change_logs (order_id, old_level, new_level, reason, operator, operator_role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, order_id, old_level, new_level, reason, operator, operator_role, created_at`,
			order.Id, order.RiskLevel, req.NewLevel, req.Reason, user.DisplayName, user.Role, now,
		).Scan(
			&riskLog.Id, &riskLog.OrderId, &riskLog.OldLevel, &riskLog.NewLevel,
			&riskLog.Reason, &riskLog.Operator, &riskLog.OperatorRole, &riskLog.CreatedAt,
		)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		_, err = db.Exec(
			`INSERT INTO processing_records (order_id, stage, step, action, handler_role, handler_name, opinion, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			order.Id, order.CurrentStage, order.CurrentStep, "risk_change", user.Role, user.DisplayName,
			req.Reason, "风险等级从"+order.RiskLevel+"变更为"+req.NewLevel, now,
		)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		return c.JSON(http.StatusOK, riskLog)
	}
}
