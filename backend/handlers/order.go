package handlers

import (
	"database/sql"
	"fmt"
	"repair-platform/database"
	"repair-platform/models"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type CreateOrderRequest struct {
	Title        string           `json:"title"`
	Description  string           `json:"description"`
	ContactName  string           `json:"contact_name"`
	ContactPhone string           `json:"contact_phone"`
	Address      string           `json:"address"`
	RiskLevel    models.RiskLevel `json:"risk_level"`
	DueDays      int              `json:"due_days"`
}

type ProcessOrderRequest struct {
	Action          string   `json:"action"`
	Opinion         string   `json:"opinion"`
	Version         int      `json:"version"`
	EvidenceTypes   []string `json:"evidence_types"`
	EvidenceDescs   []string `json:"evidence_descs"`
	MasterName      string   `json:"master_name"`
	MasterPhone     string   `json:"master_phone"`
	NewRiskLevel    string   `json:"new_risk_level"`
	ConflictNote    string   `json:"conflict_note"`
}

func calculatePriority(riskLevel models.RiskLevel, isOverdue bool) int {
	base := 50
	switch riskLevel {
	case models.RiskHigh:
		base = 90
	case models.RiskMedium:
		base = 50
	case models.RiskLow:
		base = 20
	}
	if isOverdue {
		base += 30
	}
	return base
}

func calculateRequiredEvidences(riskLevel models.RiskLevel) int {
	switch riskLevel {
	case models.RiskHigh:
		return 4
	case models.RiskMedium:
		return 2
	case models.RiskLow:
		return 1
	default:
		return 2
	}
}

func validateRoleTransition(currentStage models.ProcessStage, userRole models.UserRole) bool {
	switch currentStage {
	case models.StageRegistration:
		return userRole == models.RoleRegistrar
	case models.StageDispatch:
		return userRole == models.RoleSupervisor
	case models.StageAcceptance:
		return userRole == models.RoleSupervisor
	case models.StageReview:
		return userRole == models.RoleReviewer
	default:
		return false
	}
}

func logOperation(orderID int, operatorID int, operatorName string, operatorRole string,
	action string, fromStatus string, toStatus string, opinion string,
	riskLevel string, versionBefore int, versionAfter int) error {
	_, err := database.DB.Exec(`
		INSERT INTO operation_logs (
			order_id, operator_id, operator_name, operator_role,
			action, from_status, to_status, opinion, risk_level,
			version_before, version_after
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, orderID, operatorID, operatorName, operatorRole,
		action, fromStatus, toStatus, opinion, riskLevel,
		versionBefore, versionAfter)
	return err
}

func CreateOrder(c *fiber.Ctx) error {
	userID := c.Locals("userID").(int)

	var user models.User
	err := database.DB.QueryRow(`
		SELECT id, name, role FROM users WHERE id = ?
	`, userID).Scan(&user.ID, &user.Name, &user.Role)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "获取用户信息失败"})
	}

	if user.Role != models.RoleRegistrar {
		return c.Status(403).JSON(fiber.Map{"error": "只有维修登记员可以创建订单"})
	}

	var req CreateOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "请求参数错误: " + err.Error()})
	}

	if req.Title == "" || req.Description == "" || req.ContactName == "" ||
		req.ContactPhone == "" || req.Address == "" {
		return c.Status(400).JSON(fiber.Map{"error": "请填写所有必填字段"})
	}

	if req.RiskLevel == "" {
		req.RiskLevel = models.RiskMedium
	}
	if req.DueDays <= 0 {
		req.DueDays = 7
	}

	dueDate := time.Now().AddDate(0, 0, req.DueDays)
	requiredEvidences := calculateRequiredEvidences(req.RiskLevel)
	priority := calculatePriority(req.RiskLevel, false)
	orderNo := "WX" + time.Now().Format("20060102") + uuid.New().String()[:6]

	var firstSupervisor models.User
	err = database.DB.QueryRow(`
		SELECT id, name FROM users WHERE role = ? ORDER BY id LIMIT 1
	`, models.RoleSupervisor).Scan(&firstSupervisor.ID, &firstSupervisor.Name)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "获取审核主管失败"})
	}

	tx, err := database.DB.Begin()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "开始事务失败"})
	}

	result, err := tx.Exec(`
		INSERT INTO repair_orders (
			order_no, title, description, contact_name, contact_phone, address,
			risk_level, status, current_stage, current_handler_id,
			registrar_id, due_date, priority, required_evidences, last_operator, last_operator_role
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, orderNo, req.Title, req.Description, req.ContactName, req.ContactPhone, req.Address,
		req.RiskLevel, models.StatusRegistered, models.StageDispatch, firstSupervisor.ID,
		userID, dueDate, priority, requiredEvidences, user.Name, string(user.Role))
	if err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "创建订单失败: " + err.Error()})
	}

	orderID, _ := result.LastInsertId()

	err = logOperation(int(orderID), userID, user.Name, string(user.Role),
		"创建订单", string(models.StatusPendingRegistration), string(models.StatusRegistered),
		"新建维修订单", string(req.RiskLevel), 1, 1)
	if err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "记录操作失败"})
	}

	tx.Commit()

	return c.JSON(fiber.Map{
		"id":       orderID,
		"order_no": orderNo,
		"message":  "订单创建成功，已流转至审核主管派单",
	})
}

func GetOrders(c *fiber.Ctx) error {
	userID := c.Locals("userID").(int)
	statusFilter := c.Query("status")
	riskFilter := c.Query("risk")
	stageFilter := c.Query("stage")

	var user models.User
	database.DB.QueryRow(`SELECT role FROM users WHERE id = ?`, userID).Scan(&user.Role)

	query := `
		SELECT 
			o.id, o.order_no, o.title, o.description, o.contact_name, o.contact_phone,
			o.address, o.risk_level, o.status, o.current_stage, o.current_handler_id,
			COALESCE(u.name, ''), o.registrar_id, o.supervisor_id, o.reviewer_id,
			COALESCE(o.master_name, ''), COALESCE(o.master_phone, ''),
			o.dispatch_time, o.complete_time, o.archive_time,
			o.due_date, o.priority, o.version, COALESCE(o.last_opinion, ''),
			COALESCE(o.last_operator, ''), COALESCE(o.last_operator_role, ''),
			o.evidence_count, o.required_evidences, o.is_overdue,
			COALESCE(o.conflict_note, ''), o.created_at, o.updated_at
		FROM repair_orders o
		LEFT JOIN users u ON o.current_handler_id = u.id
		WHERE 1=1
	`
	args := []interface{}{}
	argIdx := 1

	if statusFilter != "" {
		query += fmt.Sprintf(" AND o.status = $%d", argIdx)
		args = append(args, statusFilter)
		argIdx++
	}
	if riskFilter != "" {
		query += fmt.Sprintf(" AND o.risk_level = $%d", argIdx)
		args = append(args, riskFilter)
		argIdx++
	}
	if stageFilter != "" {
		query += fmt.Sprintf(" AND o.current_stage = $%d", argIdx)
		args = append(args, stageFilter)
		argIdx++
	}

	query += `
		AND (
			o.current_handler_id = ?
			OR (o.current_stage = 'registration' AND ? = 'registrar')
			OR ? = 'reviewer'
		)
	`
	args = append(args, userID, string(user.Role), string(user.Role))

	query += ` ORDER BY o.is_overdue DESC, o.priority DESC, o.created_at DESC`

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "查询失败: " + err.Error()})
	}
	defer rows.Close()

	orders := []models.RepairOrder{}
	for rows.Next() {
		var o models.RepairOrder
		err := rows.Scan(
			&o.ID, &o.OrderNo, &o.Title, &o.Description, &o.ContactName, &o.ContactPhone,
			&o.Address, &o.RiskLevel, &o.Status, &o.CurrentStage, &o.CurrentHandlerID,
			&o.CurrentHandler, &o.RegistrarID, &o.SupervisorID, &o.ReviewerID,
			&o.MasterName, &o.MasterPhone, &o.DispatchTime, &o.CompleteTime, &o.ArchiveTime,
			&o.DueDate, &o.Priority, &o.Version, &o.LastOpinion, &o.LastOperator,
			&o.LastOperatorRole, &o.EvidenceCount, &o.RequiredEvidences, &o.IsOverdue,
			&o.ConflictNote, &o.CreatedAt, &o.UpdatedAt,
		)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "扫描失败: " + err.Error()})
		}
		orders = append(orders, o)
	}

	return c.JSON(orders)
}

func GetOrderDetail(c *fiber.Ctx) error {
	orderID, _ := strconv.Atoi(c.Params("id"))
	userID := c.Locals("userID").(int)

	var order models.RepairOrder
	err := database.DB.QueryRow(`
		SELECT 
			o.id, o.order_no, o.title, o.description, o.contact_name, o.contact_phone,
			o.address, o.risk_level, o.status, o.current_stage, o.current_handler_id,
			COALESCE(u.name, ''), o.registrar_id, o.supervisor_id, o.reviewer_id,
			COALESCE(o.master_name, ''), COALESCE(o.master_phone, ''),
			o.dispatch_time, o.complete_time, o.archive_time,
			o.due_date, o.priority, o.version, COALESCE(o.last_opinion, ''),
			COALESCE(o.last_operator, ''), COALESCE(o.last_operator_role, ''),
			o.evidence_count, o.required_evidences, o.is_overdue,
			COALESCE(o.conflict_note, ''), o.created_at, o.updated_at
		FROM repair_orders o
		LEFT JOIN users u ON o.current_handler_id = u.id
		WHERE o.id = ?
	`, orderID).Scan(
		&order.ID, &order.OrderNo, &order.Title, &order.Description, &order.ContactName, &order.ContactPhone,
		&order.Address, &order.RiskLevel, &order.Status, &order.CurrentStage, &order.CurrentHandlerID,
		&order.CurrentHandler, &order.RegistrarID, &order.SupervisorID, &order.ReviewerID,
		&order.MasterName, &order.MasterPhone, &order.DispatchTime, &order.CompleteTime, &order.ArchiveTime,
		&order.DueDate, &order.Priority, &order.Version, &order.LastOpinion, &order.LastOperator,
		&order.LastOperatorRole, &order.EvidenceCount, &order.RequiredEvidences, &order.IsOverdue,
		&order.ConflictNote, &order.CreatedAt, &order.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(404).JSON(fiber.Map{"error": "订单不存在"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "查询失败: " + err.Error()})
	}

	evidenceRows, err := database.DB.Query(`
		SELECT id, order_id, type, description, uploaded_by, created_at
		FROM evidences WHERE order_id = ? ORDER BY created_at DESC
	`, orderID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "查询证据失败"})
	}
	defer evidenceRows.Close()

	var evidences []models.Evidence
	for evidenceRows.Next() {
		var e models.Evidence
		evidenceRows.Scan(&e.ID, &e.OrderID, &e.Type, &e.Description, &e.UploadedBy, &e.CreatedAt)
		evidences = append(evidences, e)
	}

	logRows, err := database.DB.Query(`
		SELECT id, order_id, operator_id, operator_name, operator_role,
			action, from_status, to_status, opinion, risk_level,
			version_before, version_after, created_at
		FROM operation_logs WHERE order_id = ? ORDER BY created_at DESC
	`, orderID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "查询操作记录失败"})
	}
	defer logRows.Close()

	var logs []models.OperationLog
	for logRows.Next() {
		var l models.OperationLog
		logRows.Scan(&l.ID, &l.OrderID, &l.OperatorID, &l.OperatorName, &l.OperatorRole,
			&l.Action, &l.FromStatus, &l.ToStatus, &l.Opinion, &l.RiskLevel,
			&l.VersionBefore, &l.VersionAfter, &l.CreatedAt)
		logs = append(logs, l)
	}

	prevHandler := ""
	prevOpinion := ""
	prevRole := ""
	if len(logs) > 1 {
		prevHandler = logs[1].OperatorName
		prevOpinion = logs[1].Opinion
		prevRole = logs[1].OperatorRole
	}

	return c.JSON(fiber.Map{
		"order":           order,
		"evidences":       evidences,
		"operation_logs":  logs,
		"prev_handler":    prevHandler,
		"prev_opinion":    prevOpinion,
		"prev_role":       prevRole,
		"can_process":     order.CurrentHandlerID == userID,
	})
}

func ProcessOrder(c *fiber.Ctx) error {
	orderID, _ := strconv.Atoi(c.Params("id"))
	userID := c.Locals("userID").(int)

	var user models.User
	err := database.DB.QueryRow(`
		SELECT id, name, role FROM users WHERE id = ?
	`, userID).Scan(&user.ID, &user.Name, &user.Role)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "获取用户信息失败"})
	}

	var req ProcessOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "请求参数错误: " + err.Error()})
	}

	tx, err := database.DB.Begin()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "开始事务失败"})
	}

	var order models.RepairOrder
	err = tx.QueryRow(`
		SELECT id, status, current_stage, current_handler_id, version, risk_level,
			evidence_count, required_evidences, is_overdue
		FROM repair_orders WHERE id = ?
	`, orderID).Scan(
		&order.ID, &order.Status, &order.CurrentStage, &order.CurrentHandlerID,
		&order.Version, &order.RiskLevel, &order.EvidenceCount, &order.RequiredEvidences,
		&order.IsOverdue,
	)
	if err != nil {
		tx.Rollback()
		if err == sql.ErrNoRows {
			return c.Status(404).JSON(fiber.Map{"error": "订单不存在"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "查询订单失败"})
	}

	if order.CurrentHandlerID != userID {
		tx.Rollback()
		_ = logOperation(orderID, userID, user.Name, string(user.Role),
			"越权尝试", string(order.Status), string(order.Status),
			"非当前处理人尝试操作", string(order.RiskLevel), order.Version, order.Version)
		return c.Status(403).JSON(fiber.Map{
			"error":       "您不是当前处理人，无法操作此订单",
			"old_status":  order.Status,
			"old_version": order.Version,
		})
	}

	if !validateRoleTransition(order.CurrentStage, user.Role) {
		tx.Rollback()
		_ = logOperation(orderID, userID, user.Name, string(user.Role),
			"角色不匹配", string(order.Status), string(order.Status),
			"当前角色无权处理此阶段订单", string(order.RiskLevel), order.Version, order.Version)
		return c.Status(403).JSON(fiber.Map{
			"error":       "当前角色无权处理此阶段订单",
			"old_status":  order.Status,
			"old_version": order.Version,
		})
	}

	if req.Version != order.Version {
		tx.Rollback()
		_ = logOperation(orderID, userID, user.Name, string(user.Role),
			"版本冲突", string(order.Status), string(order.Status),
			fmt.Sprintf("版本不匹配，期望:%d 实际:%d", order.Version, req.Version),
			string(order.RiskLevel), order.Version, order.Version)
		return c.Status(409).JSON(fiber.Map{
			"error":         "订单已被他人修改，请刷新后重试",
			"old_status":    order.Status,
			"old_version":   order.Version,
			"your_version":  req.Version,
		})
	}

	newRiskLevel := order.RiskLevel
	if req.NewRiskLevel != "" {
		newRiskLevel = models.RiskLevel(req.NewRiskLevel)
	}

	newVersion := order.Version + 1
	newStatus := order.Status
	newStage := order.CurrentStage
	newHandlerID := order.CurrentHandlerID
	masterName := order.MasterName
	masterPhone := order.MasterPhone

	switch req.Action {
	case "return_to_registrar":
		if user.Role != models.RoleSupervisor {
			tx.Rollback()
			return c.Status(400).JSON(fiber.Map{"error": "只有审核主管可以退回补正"})
		}
		newStatus = models.StatusReturnedForCorrection
		newStage = models.StageRegistration
		newStatus = models.StatusReturnedForCorrection
		var registrarID int
		tx.QueryRow("SELECT registrar_id FROM repair_orders WHERE id = ?", orderID).Scan(&registrarID)
		newHandlerID = registrarID

	case "dispatch":
		if user.Role != models.RoleSupervisor {
			tx.Rollback()
			return c.Status(400).JSON(fiber.Map{"error": "只有审核主管可以派单"})
		}
		if req.MasterName == "" || req.MasterPhone == "" {
			tx.Rollback()
			_ = logOperation(orderID, userID, user.Name, string(user.Role),
				"派单失败", string(order.Status), string(order.Status),
				"缺少师傅信息", string(order.RiskLevel), order.Version, order.Version)
			return c.Status(400).JSON(fiber.Map{
				"error":       "请填写师傅姓名和电话",
				"old_status":  order.Status,
				"old_version": order.Version,
			})
		}
		masterName = req.MasterName
		masterPhone = req.MasterPhone
		newStatus = models.StatusDispatched
		newStage = models.StageAcceptance

	case "complete":
		if user.Role != models.RoleSupervisor {
			tx.Rollback()
			return c.Status(400).JSON(fiber.Map{"error": "只有审核主管可以完工验收"})
		}
		if order.EvidenceCount < order.RequiredEvidences {
			tx.Rollback()
			_ = logOperation(orderID, userID, user.Name, string(user.Role),
				"验收失败", string(order.Status), string(order.Status),
				fmt.Sprintf("证据不足，需要%d份，现有%d份", order.RequiredEvidences, order.EvidenceCount),
				string(order.RiskLevel), order.Version, order.Version)
			return c.Status(400).JSON(fiber.Map{
				"error":               fmt.Sprintf("证据不足，需要%d份，现有%d份", order.RequiredEvidences, order.EvidenceCount),
				"old_status":          order.Status,
				"old_version":         order.Version,
				"missing_evidences":   order.RequiredEvidences - order.EvidenceCount,
			})
		}
		newStatus = models.StatusCompleted
		newStage = models.StageReview
		var firstReviewer models.User
		tx.QueryRow("SELECT id FROM users WHERE role = ? ORDER BY id LIMIT 1", models.RoleReviewer).Scan(&firstReviewer.ID)
		newHandlerID = firstReviewer.ID

	case "mark_missing_evidence":
		newStatus = models.StatusMissingEvidence
		_ = logOperation(orderID, userID, user.Name, string(user.Role),
			"标记缺证据", string(order.Status), string(newStatus),
			req.Opinion, string(newRiskLevel), order.Version, order.Version)
		tx.Exec(`
			UPDATE repair_orders SET 
				status = ?, last_opinion = ?, last_operator = ?, last_operator_role = ?,
				updated_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`, newStatus, req.Opinion, user.Name, string(user.Role), orderID)
		tx.Commit()
		return c.JSON(fiber.Map{
			"message":     "已标记为缺证据",
			"new_status":  newStatus,
			"new_version": order.Version,
		})

	case "mark_overdue":
		newStatus = models.StatusOverdue
		_ = logOperation(orderID, userID, user.Name, string(user.Role),
			"标记逾期", string(order.Status), string(newStatus),
			req.Opinion, string(newRiskLevel), order.Version, order.Version)
		tx.Exec(`
			UPDATE repair_orders SET 
				status = ?, is_overdue = 1, priority = priority + 30,
				last_opinion = ?, last_operator = ?, last_operator_role = ?,
				updated_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`, newStatus, req.Opinion, user.Name, string(user.Role), orderID)
		tx.Commit()
		return c.JSON(fiber.Map{
			"message":     "已标记为逾期",
			"new_status":  newStatus,
			"new_version": order.Version,
		})

	case "mark_conflict":
		newStatus = models.StatusConflict
		_ = logOperation(orderID, userID, user.Name, string(user.Role),
			"标记状态冲突", string(order.Status), string(newStatus),
			req.Opinion+" 冲突说明:"+req.ConflictNote, string(newRiskLevel), order.Version, order.Version)
		tx.Exec(`
			UPDATE repair_orders SET 
				status = ?, conflict_note = ?,
				last_opinion = ?, last_operator = ?, last_operator_role = ?,
				updated_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`, newStatus, req.ConflictNote, req.Opinion, user.Name, string(user.Role), orderID)
		tx.Commit()
		return c.JSON(fiber.Map{
			"message":     "已标记为状态冲突",
			"new_status":  newStatus,
			"new_version": order.Version,
		})

	case "re_submit":
		if user.Role != models.RoleRegistrar {
			tx.Rollback()
			return c.Status(400).JSON(fiber.Map{"error": "只有登记员可以补正后重提"})
		}
		if order.EvidenceCount < order.RequiredEvidences {
			tx.Rollback()
			return c.Status(400).JSON(fiber.Map{
				"error": fmt.Sprintf("证据不足，需要%d份，现有%d份",
					order.RequiredEvidences, order.EvidenceCount),
				"old_status":  order.Status,
				"old_version": order.Version,
			})
		}
		newStatus = models.StatusRegistered
		newStage = models.StageDispatch
		var firstSupervisor models.User
		tx.QueryRow("SELECT id FROM users WHERE role = ? ORDER BY id LIMIT 1", models.RoleSupervisor).Scan(&firstSupervisor.ID)
		newHandlerID = firstSupervisor.ID

	case "archive":
		if user.Role != models.RoleReviewer {
			tx.Rollback()
			return c.Status(400).JSON(fiber.Map{"error": "只有复核负责人可以归档"})
		}
		newStatus = models.StatusArchived
		newStage = models.StageReview
		newHandlerID = userID

	default:
		tx.Rollback()
		return c.Status(400).JSON(fiber.Map{"error": "未知操作类型"})
	}

	if len(req.EvidenceTypes) > 0 {
		for i, evType := range req.EvidenceTypes {
			evDesc := ""
			if i < len(req.EvidenceDescs) {
				evDesc = req.EvidenceDescs[i]
			}
			_, err = tx.Exec(`
				INSERT INTO evidences (order_id, type, description, uploaded_by)
				VALUES (?, ?, ?, ?)
			`, orderID, evType, evDesc, userID)
			if err != nil {
				tx.Rollback()
				return c.Status(500).JSON(fiber.Map{"error": "添加证据失败"})
			}
		}
	}

	priority := calculatePriority(newRiskLevel, order.IsOverdue)

	var updateSql string
	var updateArgs []interface{}

	if req.Action == "dispatch" {
		updateSql = `
			UPDATE repair_orders SET
				status = ?, current_stage = ?, current_handler_id = ?,
				master_name = ?, master_phone = ?, dispatch_time = CURRENT_TIMESTAMP,
				risk_level = ?, priority = ?, version = ?,
				last_opinion = ?, last_operator = ?, last_operator_role = ?,
				evidence_count = (SELECT COUNT(*) FROM evidences WHERE order_id = ?),
				updated_at = CURRENT_TIMESTAMP
			WHERE id = ? AND version = ?
		`
		updateArgs = []interface{}{
			newStatus, newStage, userID,
			masterName, masterPhone,
			newRiskLevel, priority, newVersion,
			req.Opinion, user.Name, string(user.Role),
			orderID, orderID, order.Version,
		}
	} else if req.Action == "complete" {
		updateSql = `
			UPDATE repair_orders SET
				status = ?, current_stage = ?, current_handler_id = ?,
				complete_time = CURRENT_TIMESTAMP,
				risk_level = ?, priority = ?, version = ?,
				last_opinion = ?, last_operator = ?, last_operator_role = ?,
				supervisor_id = ?,
				evidence_count = (SELECT COUNT(*) FROM evidences WHERE order_id = ?),
				updated_at = CURRENT_TIMESTAMP
			WHERE id = ? AND version = ?
		`
		updateArgs = []interface{}{
			newStatus, newStage, newHandlerID,
			newRiskLevel, priority, newVersion,
			req.Opinion, user.Name, string(user.Role),
			userID, orderID, orderID, order.Version,
		}
	} else if req.Action == "archive" {
		updateSql = `
			UPDATE repair_orders SET
				status = ?, current_stage = ?, current_handler_id = ?,
				archive_time = CURRENT_TIMESTAMP,
				risk_level = ?, priority = ?, version = ?,
				last_opinion = ?, last_operator = ?, last_operator_role = ?,
				reviewer_id = ?,
				evidence_count = (SELECT COUNT(*) FROM evidences WHERE order_id = ?),
				updated_at = CURRENT_TIMESTAMP
			WHERE id = ? AND version = ?
		`
		updateArgs = []interface{}{
			newStatus, newStage, userID,
			newRiskLevel, priority, newVersion,
			req.Opinion, user.Name, string(user.Role),
			userID, orderID, orderID, order.Version,
		}
	} else {
		updateSql = `
			UPDATE repair_orders SET
				status = ?, current_stage = ?, current_handler_id = ?,
				risk_level = ?, priority = ?, version = ?,
				last_opinion = ?, last_operator = ?, last_operator_role = ?,
				evidence_count = (SELECT COUNT(*) FROM evidences WHERE order_id = ?),
				updated_at = CURRENT_TIMESTAMP
			WHERE id = ? AND version = ?
		`
		updateArgs = []interface{}{
			newStatus, newStage, newHandlerID,
			newRiskLevel, priority, newVersion,
			req.Opinion, user.Name, string(user.Role),
			orderID, orderID, order.Version,
		}
	}

	result, err := tx.Exec(updateSql, updateArgs...)
	if err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "更新订单失败: " + err.Error()})
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		tx.Rollback()
		_ = logOperation(orderID, userID, user.Name, string(user.Role),
			"并发冲突", string(order.Status), string(order.Status),
			"更新时版本已变化", string(order.RiskLevel), order.Version, order.Version)
		return c.Status(409).JSON(fiber.Map{
			"error":       "订单已被修改，请刷新后重试",
			"old_status":  order.Status,
			"old_version": order.Version,
		})
	}

	err = logOperation(orderID, userID, user.Name, string(user.Role),
		req.Action, string(order.Status), string(newStatus),
		req.Opinion, string(newRiskLevel), order.Version, newVersion)
	if err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "记录操作失败"})
	}

	tx.Commit()

	return c.JSON(fiber.Map{
		"message":     "操作成功",
		"new_status":  newStatus,
		"new_version": newVersion,
		"new_stage":   newStage,
	})
}

func GetStatistics(c *fiber.Ctx) error {
	userID := c.Locals("userID").(int)

	var userRole string
	database.DB.QueryRow("SELECT role FROM users WHERE id = ?", userID).Scan(&userRole)

	var stats models.Statistics

	database.DB.QueryRow(`
		SELECT COUNT(*) FROM repair_orders WHERE 1=1
	`).Scan(&stats.Total)

	database.DB.QueryRow(`
		SELECT COUNT(*) FROM repair_orders WHERE status IN ('pending_registration', 'registered', 'returned_for_correction')
	`).Scan(&stats.Pending)

	database.DB.QueryRow(`
		SELECT COUNT(*) FROM repair_orders WHERE status IN ('dispatched', 'completed', 'missing_evidence', 'overdue', 'status_conflict')
	`).Scan(&stats.InProgress)

	database.DB.QueryRow(`
		SELECT COUNT(*) FROM repair_orders WHERE status = 'completed'
	`).Scan(&stats.Completed)

	database.DB.QueryRow(`
		SELECT COUNT(*) FROM repair_orders WHERE status = 'archived'
	`).Scan(&stats.Archived)

	database.DB.QueryRow(`SELECT COUNT(*) FROM repair_orders WHERE risk_level = 'high'`).Scan(&stats.HighRisk)
	database.DB.QueryRow(`SELECT COUNT(*) FROM repair_orders WHERE risk_level = 'medium'`).Scan(&stats.MediumRisk)
	database.DB.QueryRow(`SELECT COUNT(*) FROM repair_orders WHERE risk_level = 'low'`).Scan(&stats.LowRisk)
	database.DB.QueryRow(`SELECT COUNT(*) FROM repair_orders WHERE status = 'overdue' OR is_overdue = 1`).Scan(&stats.Overdue)
	database.DB.QueryRow(`SELECT COUNT(*) FROM repair_orders WHERE status = 'returned_for_correction'`).Scan(&stats.Returned)
	database.DB.QueryRow(`SELECT COUNT(*) FROM repair_orders WHERE status = 'missing_evidence'`).Scan(&stats.MissingEvidence)
	database.DB.QueryRow(`SELECT COUNT(*) FROM repair_orders WHERE status = 'status_conflict'`).Scan(&stats.Conflict)

	myQueue, _ := database.DB.Query(`
		SELECT status, COUNT(*) as cnt
		FROM repair_orders WHERE current_handler_id = ?
		GROUP BY status
	`, userID)
	defer myQueue.Close()

	myTasks := make(map[string]int64)
	for myQueue.Next() {
		var s string
		var cnt int64
		myQueue.Scan(&s, &cnt)
		myTasks[s] = cnt
	}

	return c.JSON(fiber.Map{
		"stats":    stats,
		"my_tasks": myTasks,
		"my_role":  userRole,
	})
}
