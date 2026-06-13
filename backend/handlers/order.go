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
	Action        string   `json:"action"`
	Opinion       string   `json:"opinion"`
	Version       int      `json:"version"`
	EvidenceTypes []string `json:"evidence_types"`
	EvidenceDescs []string `json:"evidence_descs"`
	MasterName    string   `json:"master_name"`
	MasterPhone   string   `json:"master_phone"`
	NewRiskLevel  string   `json:"new_risk_level"`
	ConflictNote  string   `json:"conflict_note"`
}

var actionStatusWhitelist = map[string][]models.OrderStatus{
	"dispatch":              {models.StatusRegistered, models.StatusOverdue},
	"return_to_registrar":   {models.StatusRegistered, models.StatusOverdue},
	"re_submit":             {models.StatusReturnedForCorrection},
	"complete":              {models.StatusDispatched, models.StatusMissingEvidence, models.StatusConflict},
	"archive":               {models.StatusCompleted},
	"mark_missing_evidence": {models.StatusDispatched},
	"mark_overdue":          {models.StatusRegistered},
	"mark_conflict":         {models.StatusDispatched, models.StatusMissingEvidence},
}

var actionRoleWhitelist = map[string]models.UserRole{
	"dispatch":              models.RoleSupervisor,
	"return_to_registrar":   models.RoleSupervisor,
	"complete":              models.RoleSupervisor,
	"mark_missing_evidence": models.RoleSupervisor,
	"mark_overdue":          models.RoleSupervisor,
	"mark_conflict":         models.RoleSupervisor,
	"re_submit":             models.RoleRegistrar,
	"archive":               models.RoleReviewer,
}

var actionLabelMap = map[string]string{
	"dispatch":              "师傅派单",
	"return_to_registrar":   "退回补正",
	"re_submit":             "补正重提",
	"complete":              "完工验收",
	"archive":               "复核归档",
	"mark_missing_evidence": "标记缺证据",
	"mark_overdue":          "标记逾期",
	"mark_conflict":         "标记状态冲突",
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

func logInTx(tx *sql.Tx, orderID int, operatorID int, operatorName string, operatorRole string,
	action string, fromStatus string, toStatus string, opinion string,
	riskLevel string, versionBefore int, versionAfter int) error {
	_, err := tx.Exec(`
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

func persistFailLog(orderID int, operatorID int, operatorName string, operatorRole string,
	action string, fromStatus string, opinion string,
	riskLevel string, version int) {
	failTx, err := database.DB.Begin()
	if err != nil {
		return
	}
	_ = logInTx(failTx, orderID, operatorID, operatorName, operatorRole,
		action, fromStatus, fromStatus, opinion, riskLevel, version, version)
	failTx.Commit()
}

func insertEvidencesInTx(tx *sql.Tx, orderID int, operatorID int, evidenceTypes []string, evidenceDescs []string) error {
	for i, evType := range evidenceTypes {
		if evType == "" {
			continue
		}
		evDesc := ""
		if i < len(evidenceDescs) {
			evDesc = evidenceDescs[i]
		}
		_, err := tx.Exec(`
			INSERT INTO evidences (order_id, type, description, uploaded_by)
			VALUES (?, ?, ?, ?)
		`, orderID, evType, evDesc, operatorID)
		if err != nil {
			return fmt.Errorf("添加证据失败: %w", err)
		}
	}
	return nil
}

func countEvidencesInTx(tx *sql.Tx, orderID int) int {
	var count int
	tx.QueryRow("SELECT COUNT(*) FROM evidences WHERE order_id = ?", orderID).Scan(&count)
	return count
}

func failWithLog(c *fiber.Ctx, tx *sql.Tx, orderID int, user models.User,
	action string, order models.RepairOrder, errorMsg string, failReason string, httpStatus int) error {
	tx.Rollback()
	persistFailLog(orderID, user.ID, user.Name, string(user.Role),
		action, string(order.Status), failReason, string(order.RiskLevel), order.Version)
	return c.Status(httpStatus).JSON(fiber.Map{
		"error":       errorMsg,
		"old_status":  order.Status,
		"old_version": order.Version,
	})
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
			registrar_id, due_date, priority, required_evidences,
			last_opinion, last_operator, last_operator_role,
			version, evidence_count
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
	`, orderNo, req.Title, req.Description, req.ContactName, req.ContactPhone, req.Address,
		req.RiskLevel, models.StatusRegistered, models.StageDispatch, firstSupervisor.ID,
		userID, dueDate, priority, requiredEvidences,
		"新建维修订单", user.Name, string(user.Role))
	if err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "创建订单失败: " + err.Error()})
	}

	orderID, _ := result.LastInsertId()

	if err := logInTx(tx, int(orderID), userID, user.Name, string(user.Role),
		"创建订单", string(models.StatusPendingRegistration), string(models.StatusRegistered),
		"新建维修订单", string(req.RiskLevel), 1, 1); err != nil {
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

func computeAvailableActions(order models.RepairOrder, user models.User, isCurrentHandler bool) []map[string]interface{} {
	actions := []map[string]interface{}{}
	if !isCurrentHandler {
		return actions
	}
	if order.Status == models.StatusArchived {
		return actions
	}

	for action, roleReq := range actionRoleWhitelist {
		if user.Role != roleReq {
			continue
		}
		whitelist, ok := actionStatusWhitelist[action]
		if !ok {
			continue
		}
		allowed := false
		for _, s := range whitelist {
			if order.Status == s {
				allowed = true
				break
			}
		}
		if !allowed {
			continue
		}

		a := map[string]interface{}{
			"value": action,
			"label": actionLabelMap[action],
		}
		switch action {
		case "dispatch":
			a["label"] = "📤 师傅派单"
			a["class"] = "btn-primary"
			a["requiresMaster"] = true
		case "return_to_registrar":
			a["label"] = "↩️ 退回补正"
			a["class"] = "btn-warning"
		case "complete":
			a["label"] = "✅ 完工验收"
			a["class"] = "btn-success"
		case "archive":
			a["label"] = "📦 复核归档"
			a["class"] = "btn-success"
		case "re_submit":
			a["label"] = "🔄 补正重提"
			a["class"] = "btn-primary"
		case "mark_missing_evidence":
			a["label"] = "📎 标记缺证据"
			a["class"] = "btn-warning"
		case "mark_overdue":
			a["label"] = "⏰ 标记逾期"
			a["class"] = "btn-danger"
		case "mark_conflict":
			a["label"] = "⚠️ 标记状态冲突"
			a["class"] = "btn-danger"
			a["requiresConflict"] = true
		}
		actions = append(actions, a)
	}
	return actions
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

	var user models.User
	database.DB.QueryRow(`SELECT id, name, role FROM users WHERE id = ?`, userID).Scan(
		&user.ID, &user.Name, &user.Role)

	canProcess := order.CurrentHandlerID == userID
	availableActions := computeAvailableActions(order, user, canProcess)

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
		if err := evidenceRows.Scan(&e.ID, &e.OrderID, &e.Type, &e.Description, &e.UploadedBy, &e.CreatedAt); err == nil {
			evidences = append(evidences, e)
		}
	}

	logRows, err := database.DB.Query(`
		SELECT id, order_id, operator_id, operator_name, operator_role,
			action, from_status, to_status, opinion, risk_level,
			version_before, version_after, created_at
		FROM operation_logs WHERE order_id = ? ORDER BY created_at DESC, id DESC
	`, orderID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "查询操作记录失败"})
	}
	defer logRows.Close()

	var logs []models.OperationLog
	for logRows.Next() {
		var l models.OperationLog
		if err := logRows.Scan(&l.ID, &l.OrderID, &l.OperatorID, &l.OperatorName, &l.OperatorRole,
			&l.Action, &l.FromStatus, &l.ToStatus, &l.Opinion, &l.RiskLevel,
			&l.VersionBefore, &l.VersionAfter, &l.CreatedAt); err == nil {
			logs = append(logs, l)
		}
	}

	prevHandler := ""
	prevOpinion := ""
	prevRole := ""
	if len(logs) > 1 {
		for _, log := range logs[1:] {
			if log.ToStatus != log.FromStatus ||
				log.Action == "创建订单" ||
				log.Action == "师傅派单" || log.Action == "dispatch" ||
				log.Action == "完工验收" || log.Action == "complete" ||
				log.Action == "复核归档" || log.Action == "archive" ||
				log.Action == "退回补正" || log.Action == "return_to_registrar" ||
				log.Action == "补正重提" || log.Action == "re_submit" ||
				log.Action == "标记缺证据" || log.Action == "标记逾期" || log.Action == "标记状态冲突" {
				prevHandler = log.OperatorName
				prevOpinion = log.Opinion
				prevRole = log.OperatorRole
				break
			}
		}
	}

	return c.JSON(fiber.Map{
		"order":             order,
		"evidences":         evidences,
		"operation_logs":    logs,
		"prev_handler":      prevHandler,
		"prev_opinion":      prevOpinion,
		"prev_role":         prevRole,
		"can_process":       canProcess,
		"available_actions": availableActions,
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

	if req.Action == "" {
		return c.Status(400).JSON(fiber.Map{"error": "请指定操作类型"})
	}

	tx, err := database.DB.Begin()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "开始事务失败"})
	}

	var order models.RepairOrder
	err = tx.QueryRow(`
		SELECT id, status, current_stage, current_handler_id, version, risk_level,
			evidence_count, required_evidences, is_overdue, registrar_id
		FROM repair_orders WHERE id = ?
	`, orderID).Scan(
		&order.ID, &order.Status, &order.CurrentStage, &order.CurrentHandlerID,
		&order.Version, &order.RiskLevel, &order.EvidenceCount, &order.RequiredEvidences,
		&order.IsOverdue, &order.RegistrarID,
	)
	if err != nil {
		tx.Rollback()
		if err == sql.ErrNoRows {
			return c.Status(404).JSON(fiber.Map{"error": "订单不存在"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "查询订单失败"})
	}

	actionLabel, hasLabel := actionLabelMap[req.Action]
	if !hasLabel {
		return failWithLog(c, tx, orderID, user, req.Action, order,
			"未知操作类型: "+req.Action, "未知操作", 400)
	}

	if order.CurrentHandlerID != userID {
		return failWithLog(c, tx, orderID, user, actionLabel+"失败", order,
			"您不是当前处理人，无法操作此订单", "非当前处理人尝试操作", 403)
	}

	reqRole, roleOk := actionRoleWhitelist[req.Action]
	if !roleOk || user.Role != reqRole {
		return failWithLog(c, tx, orderID, user, actionLabel+"失败", order,
			"当前角色无权执行"+actionLabel,
			"角色不匹配: "+string(user.Role)+"无权执行"+req.Action, 403)
	}

	whitelist, hasWhitelist := actionStatusWhitelist[req.Action]
	if hasWhitelist {
		allowed := false
		for _, s := range whitelist {
			if order.Status == s {
				allowed = true
				break
			}
		}
		if !allowed {
			allowedList := ""
			for i, s := range whitelist {
				if i > 0 {
					allowedList += "、"
				}
				allowedList += string(s)
			}
			return failWithLog(c, tx, orderID, user, actionLabel+"失败", order,
				fmt.Sprintf("当前订单状态[%s]不允许执行%s，仅允许状态: %s",
					order.Status, actionLabel, allowedList),
				fmt.Sprintf("状态不匹配: 当前%s 白名单[%s]", order.Status, allowedList), 400)
		}
	}

	if req.Version != order.Version {
		return failWithLog(c, tx, orderID, user, actionLabel+"失败", order,
			"订单已被他人修改，请刷新后重试",
			fmt.Sprintf("版本不匹配，期望:%d 实际:%d", order.Version, req.Version), 409)
	}

	newRiskLevel := order.RiskLevel
	if req.NewRiskLevel != "" {
		newRiskLevel = models.RiskLevel(req.NewRiskLevel)
	}
	newVersion := order.Version + 1
	newStatus := order.Status
	newStage := order.CurrentStage
	newHandlerID := order.CurrentHandlerID

	switch req.Action {
	case "dispatch":
		if req.MasterName == "" || req.MasterPhone == "" {
			return failWithLog(c, tx, orderID, user, actionLabel+"失败", order,
				"请填写师傅姓名和电话", "缺少师傅信息", 400)
		}
		if err := insertEvidencesInTx(tx, orderID, userID, req.EvidenceTypes, req.EvidenceDescs); err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		newStatus = models.StatusDispatched
		newStage = models.StageAcceptance

	case "return_to_registrar":
		newStatus = models.StatusReturnedForCorrection
		newStage = models.StageRegistration
		newHandlerID = order.RegistrarID

	case "re_submit":
		if err := insertEvidencesInTx(tx, orderID, userID, req.EvidenceTypes, req.EvidenceDescs); err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		totalEvidences := countEvidencesInTx(tx, orderID)
		if totalEvidences < order.RequiredEvidences {
			failReason := fmt.Sprintf("证据不足，需要%d份，现有%d份（含本次补充%d份）",
				order.RequiredEvidences, totalEvidences, len(req.EvidenceTypes))
			return failWithLog(c, tx, orderID, user, actionLabel+"失败", order,
				failReason, failReason, 400)
		}
		newStatus = models.StatusRegistered
		newStage = models.StageDispatch
		var firstSupervisor models.User
		if err := tx.QueryRow("SELECT id FROM users WHERE role = ? ORDER BY id LIMIT 1",
			models.RoleSupervisor).Scan(&firstSupervisor.ID); err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "获取审核主管失败"})
		}
		newHandlerID = firstSupervisor.ID

	case "complete":
		if err := insertEvidencesInTx(tx, orderID, userID, req.EvidenceTypes, req.EvidenceDescs); err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		totalEvidences := countEvidencesInTx(tx, orderID)
		if totalEvidences < order.RequiredEvidences {
			failReason := fmt.Sprintf("证据不足，需要%d份，现有%d份（含本次补充%d份）",
				order.RequiredEvidences, totalEvidences, len(req.EvidenceTypes))
			return failWithLog(c, tx, orderID, user, actionLabel+"失败", order,
				failReason, failReason, 400)
		}
		newStatus = models.StatusCompleted
		newStage = models.StageReview
		var firstReviewer models.User
		if err := tx.QueryRow("SELECT id FROM users WHERE role = ? ORDER BY id LIMIT 1",
			models.RoleReviewer).Scan(&firstReviewer.ID); err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "获取复核负责人失败"})
		}
		newHandlerID = firstReviewer.ID

	case "mark_missing_evidence":
		newStatus = models.StatusMissingEvidence

	case "mark_overdue":
		newStatus = models.StatusOverdue

	case "mark_conflict":
		newStatus = models.StatusConflict

	case "archive":
		newStatus = models.StatusArchived
		newStage = models.StageReview
		newHandlerID = userID
	}

	priority := calculatePriority(newRiskLevel, order.IsOverdue || newStatus == models.StatusOverdue)

	opinion := req.Opinion
	if req.Action == "mark_conflict" && req.ConflictNote != "" {
		opinion = req.Opinion + " 冲突说明:" + req.ConflictNote
	}

	var updateSql string
	var updateArgs []interface{}

	switch req.Action {
	case "dispatch":
		updateSql = `
			UPDATE repair_orders SET
				status = ?, current_stage = ?, current_handler_id = ?,
				master_name = ?, master_phone = ?, dispatch_time = CURRENT_TIMESTAMP,
				risk_level = ?, priority = ?, version = ?,
				last_opinion = ?, last_operator = ?, last_operator_role = ?,
				supervisor_id = ?,
				evidence_count = (SELECT COUNT(*) FROM evidences WHERE order_id = ?),
				updated_at = CURRENT_TIMESTAMP
			WHERE id = ? AND version = ?
		`
		updateArgs = []interface{}{
			newStatus, newStage, userID,
			req.MasterName, req.MasterPhone,
			newRiskLevel, priority, newVersion,
			opinion, user.Name, string(user.Role),
			userID, orderID, orderID, order.Version,
		}

	case "complete":
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
			opinion, user.Name, string(user.Role),
			userID, orderID, orderID, order.Version,
		}

	case "archive":
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
			opinion, user.Name, string(user.Role),
			userID, orderID, orderID, order.Version,
		}

	case "mark_overdue":
		updateSql = `
			UPDATE repair_orders SET
				status = ?, is_overdue = 1, risk_level = ?, priority = ?, version = ?,
				last_opinion = ?, last_operator = ?, last_operator_role = ?,
				evidence_count = (SELECT COUNT(*) FROM evidences WHERE order_id = ?),
				updated_at = CURRENT_TIMESTAMP
			WHERE id = ? AND version = ?
		`
		updateArgs = []interface{}{
			newStatus, newRiskLevel, priority, newVersion,
			opinion, user.Name, string(user.Role),
			orderID, orderID, order.Version,
		}

	case "mark_conflict":
		updateSql = `
			UPDATE repair_orders SET
				status = ?, conflict_note = ?, risk_level = ?, priority = ?, version = ?,
				last_opinion = ?, last_operator = ?, last_operator_role = ?,
				evidence_count = (SELECT COUNT(*) FROM evidences WHERE order_id = ?),
				updated_at = CURRENT_TIMESTAMP
			WHERE id = ? AND version = ?
		`
		updateArgs = []interface{}{
			newStatus, req.ConflictNote, newRiskLevel, priority, newVersion,
			opinion, user.Name, string(user.Role),
			orderID, orderID, order.Version,
		}

	default:
		updateSql = `
			UPDATE repair_orders SET
				status = ?, current_stage = ?, current_handler_id = ?,
				risk_level = ?, priority = ?, version = ?,
				last_opinion = ?, last_operator = ?, last_operator_role = ?,
				evidence_count = (SELECT COUNT(*) FROM evidences WHERE order_id = ?),
				conflict_note = NULL,
				updated_at = CURRENT_TIMESTAMP
			WHERE id = ? AND version = ?
		`
		updateArgs = []interface{}{
			newStatus, newStage, newHandlerID,
			newRiskLevel, priority, newVersion,
			opinion, user.Name, string(user.Role),
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
		return failWithLog(c, tx, orderID, user, actionLabel+"失败", order,
			"订单已被修改，请刷新后重试", "更新时版本已变化", 409)
	}

	if err := logInTx(tx, orderID, userID, user.Name, string(user.Role),
		actionLabel, string(order.Status), string(newStatus),
		opinion, string(newRiskLevel), order.Version, newVersion); err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "记录操作失败"})
	}

	tx.Commit()

	return c.JSON(fiber.Map{
		"message":      actionLabel + "成功",
		"action_label": actionLabel,
		"new_status":   newStatus,
		"new_version":  newVersion,
		"new_stage":    newStage,
		"new_handler":  newHandlerID,
	})
}

func GetStatistics(c *fiber.Ctx) error {
	userID := c.Locals("userID").(int)

	var userRole string
	database.DB.QueryRow("SELECT role FROM users WHERE id = ?", userID).Scan(&userRole)

	var stats models.Statistics

	database.DB.QueryRow(`SELECT COUNT(*) FROM repair_orders`).Scan(&stats.Total)
	database.DB.QueryRow(`
		SELECT COUNT(*) FROM repair_orders
		WHERE status IN ('pending_registration', 'registered', 'returned_for_correction')
	`).Scan(&stats.Pending)
	database.DB.QueryRow(`
		SELECT COUNT(*) FROM repair_orders
		WHERE status IN ('dispatched', 'missing_evidence', 'overdue', 'status_conflict')
	`).Scan(&stats.InProgress)
	database.DB.QueryRow(`SELECT COUNT(*) FROM repair_orders WHERE status = 'completed'`).Scan(&stats.Completed)
	database.DB.QueryRow(`SELECT COUNT(*) FROM repair_orders WHERE status = 'archived'`).Scan(&stats.Archived)
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
