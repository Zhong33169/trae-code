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

func scanOrder(row interface {
	Scan(dest ...interface{}) error
}) (*models.AfterSaleOrder, error) {
	var o models.AfterSaleOrder
	err := row.Scan(
		&o.Id, &o.OrderNo, &o.CustomerName, &o.ProductName,
		&o.OrderAmount, &o.RefundAmount, &o.RiskLevel,
		&o.CurrentStage, &o.CurrentStep, &o.Status,
		&o.HandlerRole, &o.HandlerName,
		&o.RequiredEvidence, &o.EvidenceProvided,
		&o.Version, &o.Deadline, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func scanRecord(row interface {
	Scan(dest ...interface{}) error
}) (*models.ProcessingRecord, error) {
	var r models.ProcessingRecord
	err := row.Scan(
		&r.Id, &r.OrderId, &r.Stage, &r.Step,
		&r.Action, &r.HandlerRole, &r.HandlerName,
		&r.Opinion, &r.Result, &r.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func writeValidationRecord(db *sql.DB, order *models.AfterSaleOrder, action, result string) {
	db.Exec(
		`INSERT INTO processing_records (order_id, stage, step, action, handler_role, handler_name, opinion, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		order.Id, order.CurrentStage, order.CurrentStep, action, order.HandlerRole, order.HandlerName, "", result, time.Now(),
	)
}

func writeValidationRecordWithUser(db *sql.DB, order *models.AfterSaleOrder, user *models.User, action, result string) (models.ProcessingRecord, error) {
	var record models.ProcessingRecord
	now := time.Now()
	err := db.QueryRow(
		`INSERT INTO processing_records (order_id, stage, step, action, handler_role, handler_name, opinion, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, order_id, stage, step, action, handler_role, handler_name, opinion, result, created_at`,
		order.Id, order.CurrentStage, order.CurrentStep, action, user.Role, user.DisplayName, "", result, now,
	).Scan(
		&record.Id, &record.OrderId, &record.Stage, &record.Step,
		&record.Action, &record.HandlerRole, &record.HandlerName,
		&record.Opinion, &record.Result, &record.CreatedAt,
	)
	return record, err
}

func GetOrders(db *sql.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		query := "SELECT id, order_no, customer_name, product_name, order_amount, refund_amount, risk_level, current_stage, current_step, status, handler_role, handler_name, required_evidence, evidence_provided, version, deadline, created_at, updated_at FROM after_sale_orders WHERE 1=1"
		args := []interface{}{}

		if riskLevel := c.QueryParam("risk_level"); riskLevel != "" {
			query += " AND risk_level = ?"
			args = append(args, riskLevel)
		}
		if stage := c.QueryParam("stage"); stage != "" {
			query += " AND current_stage = ?"
			args = append(args, stage)
		}
		if status := c.QueryParam("status"); status != "" {
			query += " AND status = ?"
			args = append(args, status)
		}
		if handlerRole := c.QueryParam("handler_role"); handlerRole != "" {
			query += " AND handler_role = ?"
			args = append(args, handlerRole)
		}
		if keyword := c.QueryParam("keyword"); keyword != "" {
			query += " AND (customer_name LIKE ? OR product_name LIKE ? OR order_no LIKE ?)"
			like := "%" + keyword + "%"
			args = append(args, like, like, like)
		}

		countQuery := strings.Replace(query, "SELECT id, order_no, customer_name, product_name, order_amount, refund_amount, risk_level, current_stage, current_step, status, handler_role, handler_name, required_evidence, evidence_provided, version, deadline, created_at, updated_at", "SELECT COUNT(*)", 1)
		var total int
		if err := db.QueryRow(countQuery, args...).Scan(&total); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		query += " ORDER BY created_at DESC"
		rows, err := db.Query(query, args...)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		defer rows.Close()

		orders := []models.AfterSaleOrder{}
		for rows.Next() {
			o, err := scanOrder(rows)
			if err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			orders = append(orders, *o)
		}

		return c.JSON(http.StatusOK, map[string]interface{}{
			"data":  orders,
			"total": total,
		})
	}
}

func GetOrderDetail(db *sql.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		id := c.Param("id")

		var o models.AfterSaleOrder
		err := db.QueryRow(
			"SELECT id, order_no, customer_name, product_name, order_amount, refund_amount, risk_level, current_stage, current_step, status, handler_role, handler_name, required_evidence, evidence_provided, version, deadline, created_at, updated_at FROM after_sale_orders WHERE id = ?",
			id,
		).Scan(
			&o.Id, &o.OrderNo, &o.CustomerName, &o.ProductName,
			&o.OrderAmount, &o.RefundAmount, &o.RiskLevel,
			&o.CurrentStage, &o.CurrentStep, &o.Status,
			&o.HandlerRole, &o.HandlerName,
			&o.RequiredEvidence, &o.EvidenceProvided,
			&o.Version, &o.Deadline, &o.CreatedAt, &o.UpdatedAt,
		)
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "订单不存在"})
		}
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		rows, err := db.Query(
			"SELECT id, order_id, stage, step, action, handler_role, handler_name, opinion, result, created_at FROM processing_records WHERE order_id = ? ORDER BY created_at",
			id,
		)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		defer rows.Close()

		records := []models.ProcessingRecord{}
		for rows.Next() {
			r, err := scanRecord(rows)
			if err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			records = append(records, *r)
		}

		riskRows, err := db.Query(
			"SELECT id, order_id, old_level, new_level, reason, operator, operator_role, created_at FROM risk_change_logs WHERE order_id = ? ORDER BY created_at",
			id,
		)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		defer riskRows.Close()

		riskLogs := []models.RiskChangeLog{}
		for riskRows.Next() {
			var rl models.RiskChangeLog
			if err := riskRows.Scan(&rl.Id, &rl.OrderId, &rl.OldLevel, &rl.NewLevel, &rl.Reason, &rl.Operator, &rl.OperatorRole, &rl.CreatedAt); err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			riskLogs = append(riskLogs, rl)
		}

		return c.JSON(http.StatusOK, models.OrderDetailResponse{
			Order:    o,
			Records:  records,
			RiskLogs: riskLogs,
		})
	}
}

func CreateOrder(db *sql.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		var req models.CreateOrderRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "无效的请求数据"})
		}

		now := time.Now()
		datePrefix := fmt.Sprintf("AS%s", now.Format("20060102"))
		orderNo := fmt.Sprintf("%s%03d", datePrefix, 1)

		var maxSuffix int
		err := db.QueryRow(
			"SELECT COALESCE(MAX(CAST(SUBSTR(order_no, 11) AS INTEGER)), 0) FROM after_sale_orders WHERE order_no LIKE ?",
			datePrefix+"%",
		).Scan(&maxSuffix)
		if err == nil && maxSuffix >= 0 {
			orderNo = fmt.Sprintf("%s%03d", datePrefix, maxSuffix+1)
		}

		reqJSON, _ := json.Marshal(req.RequiredEvidence)
		eviJSON, _ := json.Marshal([]string{})
		deadline := now.Add(7 * 24 * time.Hour)

		result, err := db.Exec(
			`INSERT INTO after_sale_orders (order_no, customer_name, product_name, order_amount, refund_amount, risk_level, current_stage, current_step, status, handler_role, handler_name, required_evidence, evidence_provided, version, deadline, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			orderNo, req.CustomerName, req.ProductName, req.OrderAmount, req.RefundAmount,
			req.RiskLevel, "refund", "initiate", "draft", "clerk", "",
			string(reqJSON), string(eviJSON), 1, deadline, now, now,
		)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		insertedID, _ := result.LastInsertId()

		var order models.AfterSaleOrder
		err = db.QueryRow(
			"SELECT id, order_no, customer_name, product_name, order_amount, refund_amount, risk_level, current_stage, current_step, status, handler_role, handler_name, required_evidence, evidence_provided, version, deadline, created_at, updated_at FROM after_sale_orders WHERE id = ?",
			insertedID,
		).Scan(
			&order.Id, &order.OrderNo, &order.CustomerName, &order.ProductName,
			&order.OrderAmount, &order.RefundAmount, &order.RiskLevel,
			&order.CurrentStage, &order.CurrentStep, &order.Status,
			&order.HandlerRole, &order.HandlerName,
			&order.RequiredEvidence, &order.EvidenceProvided,
			&order.Version, &order.Deadline, &order.CreatedAt, &order.UpdatedAt,
		)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		return c.JSON(http.StatusCreated, order)
	}
}

func ActionOrder(db *sql.DB) echo.HandlerFunc {
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

		var req models.ActionRequest
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

		if user.Role != order.HandlerRole {
			record, recErr := writeValidationRecordWithUser(db, &order, &user, "validation_failed", "角色不匹配")
			if recErr != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": recErr.Error()})
			}
			return c.JSON(http.StatusForbidden, map[string]interface{}{
				"error":  "角色不匹配",
				"order":  order,
				"record": record,
			})
		}

		allowed := false
		newStatus := order.Status
		newHandlerRole := order.HandlerRole
		newHandlerName := order.HandlerName
		newStage := order.CurrentStage
		newStep := order.CurrentStep
		stageAdvanced := false

		switch {
		case order.Status == "draft" && order.HandlerRole == "clerk" && req.Action == "initiate":
			allowed = true
			newStatus = "pending_process"
			newHandlerRole = "supervisor"
			newHandlerName = ""
			newStep = "process"
		case order.Status == "pending_process" && order.HandlerRole == "supervisor" && req.Action == "process":
			allowed = true
			newStatus = "pending_review"
			newHandlerRole = "reviewer"
			newHandlerName = ""
			newStep = "review"
		case order.Status == "pending_process" && order.HandlerRole == "supervisor" && req.Action == "return":
			allowed = true
			newStatus = "returned"
			newHandlerRole = "clerk"
			newHandlerName = ""
			newStep = "initiate"
		case order.Status == "pending_review" && order.HandlerRole == "reviewer" && req.Action == "review_archive":
			allowed = true
			switch order.CurrentStage {
			case "refund":
				newStage = "warehouse"
				stageAdvanced = true
			case "warehouse":
				newStage = "followup"
				stageAdvanced = true
			case "followup":
				newStatus = "completed"
			}
			if stageAdvanced {
				newStep = "initiate"
				newHandlerRole = "clerk"
				newHandlerName = ""
				newStatus = "draft"
			}
		case order.Status == "pending_review" && order.HandlerRole == "reviewer" && req.Action == "return":
			allowed = true
			newStatus = "returned"
			newHandlerRole = "clerk"
			newHandlerName = ""
			newStep = "initiate"
		case order.Status == "returned" && order.HandlerRole == "clerk" && req.Action == "correct":
			allowed = true
			newStatus = "pending_process"
			newHandlerRole = "supervisor"
			newStep = "process"
		}

		if !allowed {
			record, recErr := writeValidationRecordWithUser(db, &order, &user, "validation_failed", "操作不被允许")
			if recErr != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": recErr.Error()})
			}
			return c.JSON(http.StatusBadRequest, map[string]interface{}{
				"error":  "操作不被允许",
				"order":  order,
				"record": record,
			})
		}

		if req.Version != order.Version {
			record, recErr := writeValidationRecordWithUser(db, &order, &user, "validation_failed", "版本冲突")
			if recErr != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": recErr.Error()})
			}
			return c.JSON(http.StatusConflict, map[string]interface{}{
				"error":  "版本冲突",
				"order":  order,
				"record": record,
			})
		}

		var requiredEvidence []string
		json.Unmarshal([]byte(order.RequiredEvidence), &requiredEvidence)
		var evidenceProvided []string
		json.Unmarshal([]byte(order.EvidenceProvided), &evidenceProvided)

		if len(requiredEvidence) > 0 {
			providedSet := make(map[string]bool)
			for _, e := range evidenceProvided {
				providedSet[e] = true
			}
			missing := []string{}
			for _, req := range requiredEvidence {
				if !providedSet[req] {
					missing = append(missing, req)
				}
			}
			if len(missing) > 0 {
				record, recErr := writeValidationRecordWithUser(db, &order, &user, "validation_failed", fmt.Sprintf("缺少必要证据: %s", strings.Join(missing, "、")))
				if recErr != nil {
					return c.JSON(http.StatusInternalServerError, map[string]string{"error": recErr.Error()})
				}
				return c.JSON(http.StatusBadRequest, map[string]interface{}{
					"error":   "缺少必要证据",
					"missing": missing,
					"order":   order,
					"record":  record,
				})
			}
		}

		now := time.Now()

		if newHandlerRole != order.HandlerRole {
			newHandlerName = ""
		} else if newHandlerRole == user.Role {
			newHandlerName = user.DisplayName
		}

		_, err = db.Exec(
			`UPDATE after_sale_orders SET status = ?, handler_role = ?, handler_name = ?, current_stage = ?, current_step = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?`,
			newStatus, newHandlerRole, newHandlerName, newStage, newStep, now, order.Id, order.Version,
		)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		resultText := "操作成功"
		switch req.Action {
		case "initiate":
			resultText = "已提交审核"
		case "process":
			resultText = "审核通过"
		case "return":
			resultText = "已退回"
		case "review_archive":
			if stageAdvanced {
				resultText = "复核通过，进入下一阶段"
			} else if newStatus == "completed" {
				resultText = "复核通过，工单已完成"
			} else {
				resultText = "复核通过"
			}
		case "correct":
			resultText = "已修正并重新提交"
		}

		var record models.ProcessingRecord
		err = db.QueryRow(
			`INSERT INTO processing_records (order_id, stage, step, action, handler_role, handler_name, opinion, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, order_id, stage, step, action, handler_role, handler_name, opinion, result, created_at`,
			order.Id, newStage, newStep, req.Action, user.Role, user.DisplayName, req.Opinion, resultText, now,
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
