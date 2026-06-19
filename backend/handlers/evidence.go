package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"aftersales-backend/models"

	"github.com/labstack/echo/v4"
)

func UpdateEvidence(db *sql.DB) echo.HandlerFunc {
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

		var req models.EvidenceUpdateRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "无效的请求数据"})
		}

		var user models.User
		err = db.QueryRow("SELECT id, name, role, display_name FROM users WHERE id = ?", req.HandlerId).Scan(&user.Id, &user.Name, &user.Role, &user.DisplayName)
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "用户不存在"})
		}
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		if user.Role != "clerk" {
			writeValidationRecord(db, &order, "evidence_update_failed", fmt.Sprintf("越权变更证据: 角色 %s 不允许操作", user.Role))
			return c.JSON(http.StatusForbidden, map[string]string{"error": "只有登记员可以维护证据"})
		}

		if user.Role != order.HandlerRole {
			writeValidationRecord(db, &order, "evidence_update_failed", "处理人角色不匹配")
			return c.JSON(http.StatusForbidden, map[string]string{"error": "当前处理人不是登记员"})
		}

		if order.Status != "draft" && order.Status != "returned" {
			writeValidationRecord(db, &order, "evidence_update_failed", fmt.Sprintf("状态 %s 不允许维护证据", order.Status))
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "当前状态不允许维护证据"})
		}

		if req.Version != 0 && req.Version != order.Version {
			writeValidationRecord(db, &order, "evidence_update_failed", "版本冲突")
			return c.JSON(http.StatusConflict, map[string]string{"error": "版本冲突"})
		}

		var requiredEvidence []string
		json.Unmarshal([]byte(order.RequiredEvidence), &requiredEvidence)

		if len(requiredEvidence) > 0 {
			providedSet := make(map[string]bool)
			for _, e := range req.Evidence {
				providedSet[e] = true
			}
			missing := []string{}
			for _, re := range requiredEvidence {
				if !providedSet[re] {
					missing = append(missing, re)
				}
			}
			if len(missing) > 0 {
				writeValidationRecord(db, &order, "evidence_update_failed", fmt.Sprintf("证据未覆盖必填项: %s", strings.Join(missing, "、")))
				return c.JSON(http.StatusBadRequest, map[string]interface{}{
					"error":   "必填证据未全部提供",
					"missing": missing,
				})
			}
		}

		eviJSON, _ := json.Marshal(req.Evidence)
		now := time.Now()

		_, err = db.Exec("UPDATE after_sale_orders SET evidence_provided = ?, updated_at = ? WHERE id = ?", string(eviJSON), now, order.Id)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		var record models.ProcessingRecord
		evidenceDesc := strings.Join(req.Evidence, "、")
		if evidenceDesc == "" {
			evidenceDesc = "无"
		}
		err = db.QueryRow(
			`INSERT INTO processing_records (order_id, stage, step, action, handler_role, handler_name, opinion, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, order_id, stage, step, action, handler_role, handler_name, opinion, result, created_at`,
			order.Id, order.CurrentStage, order.CurrentStep, "update_evidence", user.Role, user.DisplayName,
			"", fmt.Sprintf("更新证据材料: %s", evidenceDesc), now,
		).Scan(
			&record.Id, &record.OrderId, &record.Stage, &record.Step,
			&record.Action, &record.HandlerRole, &record.HandlerName,
			&record.Opinion, &record.Result, &record.CreatedAt,
		)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		var updatedOrder models.AfterSaleOrder
		err = db.QueryRow(
			"SELECT id, order_no, customer_name, product_name, order_amount, refund_amount, risk_level, current_stage, current_step, status, handler_role, handler_name, required_evidence, evidence_provided, version, deadline, created_at, updated_at FROM after_sale_orders WHERE id = ?",
			order.Id,
		).Scan(
			&updatedOrder.Id, &updatedOrder.OrderNo, &updatedOrder.CustomerName, &updatedOrder.ProductName,
			&updatedOrder.OrderAmount, &updatedOrder.RefundAmount, &updatedOrder.RiskLevel,
			&updatedOrder.CurrentStage, &updatedOrder.CurrentStep, &updatedOrder.Status,
			&updatedOrder.HandlerRole, &updatedOrder.HandlerName,
			&updatedOrder.RequiredEvidence, &updatedOrder.EvidenceProvided,
			&updatedOrder.Version, &updatedOrder.Deadline, &updatedOrder.CreatedAt, &updatedOrder.UpdatedAt,
		)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		return c.JSON(http.StatusOK, map[string]interface{}{
			"order":  updatedOrder,
			"record": record,
		})
	}
}
