package handlers

import (
	"coldchain/database"
	"coldchain/models"
	"database/sql"
	"fmt"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
)

func GetUsers(c *gin.Context) {
	rows, err := database.DB.Query("SELECT id, username, display_name, role FROM users ORDER BY id")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.Role); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		u.RoleLabel = models.RoleLabels[u.Role]
		users = append(users, u)
	}
	c.JSON(http.StatusOK, gin.H{"data": users})
}

func CreateOrder(c *gin.Context) {
	var req models.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效: " + err.Error()})
		return
	}

	if req.RiskLevel != "high" && req.RiskLevel != "medium" && req.RiskLevel != "low" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "风险等级必须为 high/medium/low"})
		return
	}

	var user models.User
	err := database.DB.QueryRow("SELECT id, username, display_name, role FROM users WHERE id = ?", req.CreatedBy).Scan(&user.ID, &user.Username, &user.DisplayName, &user.Role)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "用户不存在"})
		return
	}

	if user.Role != "warehouse_keeper" {
		c.JSON(http.StatusForbidden, gin.H{"error": "仅仓管员可创建入库单"})
		return
	}

	now := time.Now()
	orderNo := fmt.Sprintf("CC%s%04d", now.Format("20060102150405"), time.Now().Nanosecond()/100000)

	result, err := database.DB.Exec(
		`INSERT INTO orders (order_no, product_name, supplier, temperature_range, storage_location, risk_level, status, current_handler_id, version, created_by, notes)
		 VALUES (?, ?, ?, ?, ?, ?, 'registered', ?, 1, ?, ?)`,
		orderNo, req.ProductName, req.Supplier, req.TemperatureRange, req.StorageLocation, req.RiskLevel, req.CreatedBy, req.CreatedBy, req.Notes,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建入库单失败: " + err.Error()})
		return
	}

	orderID, _ := result.LastInsertId()

	database.DB.Exec(
		`INSERT INTO operation_records (order_id, handler_id, handler_name, handler_role, action, opinion, result)
		 VALUES (?, ?, ?, ?, 'submit', ?, 'passed')`,
		orderID, user.ID, user.DisplayName, user.Role, "提交冷链入库单登记",
	)

	order := getOrderByID(int(orderID))
	c.JSON(http.StatusCreated, gin.H{"data": order})
}

func GetOrders(c *gin.Context) {
	status := c.Query("status")
	riskLevel := c.Query("risk_level")
	handlerID := c.Query("handler_id")

	query := `SELECT o.id, o.order_no, o.product_name, o.supplier, o.temperature_range, o.storage_location,
	          o.risk_level, o.status, o.current_handler_id, o.version, o.created_by,
	          o.evidence_temperature, o.evidence_quality, o.evidence_quantity, o.notes,
	          o.created_at, o.updated_at,
	          u.display_name as handler_name, u.role as handler_role,
	          c.display_name as creator_name
	          FROM orders o
	          LEFT JOIN users u ON o.current_handler_id = u.id
	          LEFT JOIN users c ON o.created_by = c.id
	          WHERE 1=1`
	args := []interface{}{}

	if status != "" {
		query += " AND o.status = ?"
		args = append(args, status)
	}
	if riskLevel != "" {
		query += " AND o.risk_level = ?"
		args = append(args, riskLevel)
	}
	if handlerID != "" {
		query += " AND o.current_handler_id = ?"
		args = append(args, handlerID)
	}

	query += " ORDER BY o.updated_at DESC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	orders := []models.Order{}
	for rows.Next() {
		var o models.Order
		var handlerName, handlerRole, creatorName sql.NullString
		var notes sql.NullString
		var evTemp, evQual, evQty int

		err := rows.Scan(&o.ID, &o.OrderNo, &o.ProductName, &o.Supplier, &o.TemperatureRange, &o.StorageLocation,
			&o.RiskLevel, &o.Status, &o.CurrentHandlerID, &o.Version, &o.CreatedBy,
			&evTemp, &evQual, &evQty, &notes,
			&o.CreatedAt, &o.UpdatedAt,
			&handlerName, &handlerRole, &creatorName)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		o.EvidenceTemperature = evTemp == 1
		o.EvidenceQuality = evQual == 1
		o.EvidenceQuantity = evQty == 1
		o.CurrentHandlerName = handlerName.String
		o.CurrentHandlerRole = handlerRole.String
		o.CreatedByName = creatorName.String
		o.Notes = notes.String
		o.RiskLevelLabel = models.RiskLevelLabels[o.RiskLevel]
		o.StatusLabel = models.StatusLabels[o.Status]
		orders = append(orders, o)
	}

	sort.Slice(orders, func(i, j int) bool {
		pri := models.RiskPriority[orders[i].RiskLevel]
		prj := models.RiskPriority[orders[j].RiskLevel]
		if pri != prj {
			return pri < prj
		}
		return orders[i].UpdatedAt.After(orders[j].UpdatedAt)
	})

	c.JSON(http.StatusOK, gin.H{"data": orders})
}

func GetOrder(c *gin.Context) {
	id := c.Param("id")
	order := getOrderDetailByID(id)
	if order == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "入库单不存在"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": order})
}

type OrderDetail struct {
	Order            models.Order             `json:"order"`
	OperationRecords []models.OperationRecord `json:"operation_records"`
}

func getOrderDetailByID(id string) *OrderDetail {
	var i int
	fmt.Sscanf(id, "%d", &i)
	order := getOrderByID(i)
	if order == nil {
		return nil
	}

	rows, err := database.DB.Query(
		`SELECT id, order_id, handler_id, handler_name, handler_role, action, opinion, result, created_at
		 FROM operation_records WHERE order_id = ? ORDER BY created_at ASC`, order.ID)
	if err != nil {
		return &OrderDetail{Order: *order, OperationRecords: []models.OperationRecord{}}
	}
	defer rows.Close()

	records := []models.OperationRecord{}
	for rows.Next() {
		var r models.OperationRecord
		var opinion sql.NullString
		err := rows.Scan(&r.ID, &r.OrderID, &r.HandlerID, &r.HandlerName, &r.HandlerRole, &r.Action, &opinion, &r.Result, &r.CreatedAt)
		if err != nil {
			continue
		}
		r.Opinion = opinion.String
		r.RoleLabel = models.RoleLabels[r.HandlerRole]
		r.ActionLabel = models.ActionLabels[r.Action]
		r.ResultLabel = models.ResultLabels[r.Result]
		records = append(records, r)
	}

	return &OrderDetail{Order: *order, OperationRecords: records}
}

func getOrderByID(id int) *models.Order {
	var o models.Order
	var handlerName, handlerRole, creatorName sql.NullString
	var notes sql.NullString
	var evTemp, evQual, evQty int

	err := database.DB.QueryRow(
		`SELECT o.id, o.order_no, o.product_name, o.supplier, o.temperature_range, o.storage_location,
		        o.risk_level, o.status, o.current_handler_id, o.version, o.created_by,
		        o.evidence_temperature, o.evidence_quality, o.evidence_quantity, o.notes,
		        o.created_at, o.updated_at,
		        u.display_name as handler_name, u.role as handler_role,
		        c.display_name as creator_name
		        FROM orders o
		        LEFT JOIN users u ON o.current_handler_id = u.id
		        LEFT JOIN users c ON o.created_by = c.id
		        WHERE o.id = ?`, id).Scan(
		&o.ID, &o.OrderNo, &o.ProductName, &o.Supplier, &o.TemperatureRange, &o.StorageLocation,
		&o.RiskLevel, &o.Status, &o.CurrentHandlerID, &o.Version, &o.CreatedBy,
		&evTemp, &evQual, &evQty, &notes,
		&o.CreatedAt, &o.UpdatedAt,
		&handlerName, &handlerRole, &creatorName)
	if err != nil {
		return nil
	}

	o.EvidenceTemperature = evTemp == 1
	o.EvidenceQuality = evQual == 1
	o.EvidenceQuantity = evQty == 1
	o.CurrentHandlerName = handlerName.String
	o.CurrentHandlerRole = handlerRole.String
	o.CreatedByName = creatorName.String
	o.Notes = notes.String
	o.RiskLevelLabel = models.RiskLevelLabels[o.RiskLevel]
	o.StatusLabel = models.StatusLabels[o.Status]
	return &o
}

func findUserIDByRole(role string, excludeIDs ...int) int {
	var id int
	if len(excludeIDs) > 0 {
		database.DB.QueryRow(`SELECT id FROM users WHERE role = ? AND id NOT IN (?) LIMIT 1`,
			role, excludeIDs[0]).Scan(&id)
	}
	if id == 0 {
		database.DB.QueryRow("SELECT id FROM users WHERE role = ? LIMIT 1", role).Scan(&id)
	}
	return id
}

func ProcessOrder(c *gin.Context) {
	id := c.Param("id")
	var req models.ProcessOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效: " + err.Error()})
		return
	}

	var currentOrder models.Order
	var handlerName, handlerRole, creatorName sql.NullString
	var notes sql.NullString
	var evTemp, evQual, evQty int

	err := database.DB.QueryRow(
		`SELECT o.id, o.order_no, o.product_name, o.supplier, o.temperature_range, o.storage_location,
		        o.risk_level, o.status, o.current_handler_id, o.version, o.created_by,
		        o.evidence_temperature, o.evidence_quality, o.evidence_quantity, o.notes,
		        o.created_at, o.updated_at,
		        u.display_name as handler_name, u.role as handler_role,
		        c.display_name as creator_name
		        FROM orders o
		        LEFT JOIN users u ON o.current_handler_id = u.id
		        LEFT JOIN users c ON o.created_by = c.id
		        WHERE o.id = ?`, id).Scan(
		&currentOrder.ID, &currentOrder.OrderNo, &currentOrder.ProductName, &currentOrder.Supplier, &currentOrder.TemperatureRange, &currentOrder.StorageLocation,
		&currentOrder.RiskLevel, &currentOrder.Status, &currentOrder.CurrentHandlerID, &currentOrder.Version, &currentOrder.CreatedBy,
		&evTemp, &evQual, &evQty, &notes,
		&currentOrder.CreatedAt, &currentOrder.UpdatedAt,
		&handlerName, &handlerRole, &creatorName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "入库单不存在"})
		return
	}

	currentOrder.EvidenceTemperature = evTemp == 1
	currentOrder.EvidenceQuality = evQual == 1
	currentOrder.EvidenceQuantity = evQty == 1

	var user models.User
	err = database.DB.QueryRow("SELECT id, username, display_name, role FROM users WHERE id = ?", req.HandlerID).Scan(&user.ID, &user.Username, &user.DisplayName, &user.Role)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "处理人不存在"})
		return
	}

	auditConflict := func(action string, detail string) {
		actualAction := action
		if actualAction == "" {
			actualAction = req.Action
		}
		database.DB.Exec(
			`INSERT INTO operation_records (order_id, handler_id, handler_name, handler_role, action, opinion, result)
			 VALUES (?, ?, ?, ?, ?, ?, 'conflict')`,
			currentOrder.ID, user.ID, user.DisplayName, user.Role, actualAction, detail)
	}

	if req.Version != currentOrder.Version {
		auditConflict("", fmt.Sprintf("版本冲突：提交版本 v%d ≠ 当前版本 v%d", req.Version, currentOrder.Version))
		c.JSON(http.StatusConflict, gin.H{"error": "版本冲突，请刷新后重试", "current_version": currentOrder.Version})
		return
	}

	if currentOrder.CurrentHandlerID != req.HandlerID {
		auditConflict("", fmt.Sprintf("当前处理人不匹配，应为用户 %d (%s)", currentOrder.CurrentHandlerID, currentOrder.CurrentHandlerName))
		c.JSON(http.StatusForbidden, gin.H{"error": "您不是当前处理人"})
		return
	}

	expectedRole := models.ExpectedRoleForStatus[currentOrder.Status]
	if expectedRole != "" && user.Role != expectedRole {
		auditConflict("", fmt.Sprintf("角色不匹配：当前状态「%s」需要角色「%s」，操作者为「%s」",
			currentOrder.Status, expectedRole, user.Role))
		c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("当前状态「%s」需要角色「%s」处理", models.StatusLabels[currentOrder.Status], models.RoleLabels[expectedRole])})
		return
	}

	allowedActions, ok := models.StatusFlow[currentOrder.Status]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "当前状态无法执行任何操作"})
		return
	}

	newStatus, actionOk := allowedActions[req.Action]
	if !actionOk {
		auditConflict("", fmt.Sprintf("操作不支持：当前状态「%s」没有操作「%s」", currentOrder.Status, req.Action))
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("当前状态「%s」不支持操作「%s」", models.StatusLabels[currentOrder.Status], models.ActionLabels[req.Action])})
		return
	}

	resultLabel := req.Result
	if resultLabel == "" {
		switch req.Action {
		case "advance":
			resultLabel = "passed"
		case "return":
			resultLabel = "returned"
		case "approve":
			resultLabel = "passed"
		case "reject":
			resultLabel = "rejected"
		case "correct":
			resultLabel = "corrected"
		case "force_fix":
			resultLabel = "force_fixed"
		}
	}

	writeFailedRecord := func(r string, reason string) {
		database.DB.Exec(
			`INSERT INTO operation_records (order_id, handler_id, handler_name, handler_role, action, opinion, result)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			currentOrder.ID, user.ID, user.DisplayName, user.Role, req.Action, reason, r)
	}

	evidenceTriggerActions := map[string]bool{
		"advance": true,
		"approve": true,
		"correct": true,
	}
	mustHaveEvidence := []string{}
	if evidenceTriggerActions[req.Action] {
		mustHaveEvidence = append(mustHaveEvidence, models.RiskEvidenceRequirement[currentOrder.RiskLevel]...)
	}

	hasEvidence := map[string]bool{
		"temperature": currentOrder.EvidenceTemperature,
		"quality":     currentOrder.EvidenceQuality,
		"quantity":    currentOrder.EvidenceQuantity,
	}
	if req.EvidenceTemperature != nil {
		hasEvidence["temperature"] = *req.EvidenceTemperature
	}
	if req.EvidenceQuality != nil {
		hasEvidence["quality"] = *req.EvidenceQuality
	}
	if req.EvidenceQuantity != nil {
		hasEvidence["quantity"] = *req.EvidenceQuantity
	}

	evidenceName := map[string]string{
		"temperature": "温度记录",
		"quality":     "质量检测报告",
		"quantity":    "数量核实凭证",
	}

	for _, e := range mustHaveEvidence {
		if !hasEvidence[e] {
			reason := fmt.Sprintf("缺少%s，当前风险等级（%s）执行「%s」必须提供%s",
				evidenceName[e], models.RiskLevelLabels[currentOrder.RiskLevel], models.ActionLabels[req.Action], evidenceName[e])
			writeFailedRecord("conflict", reason)
			c.JSON(http.StatusBadRequest, gin.H{"error": reason})
			return
		}
	}

	if req.Action == "return" || req.Action == "reject" {
		newStatus = map[string]string{
			"return": "returned",
			"reject": "rejected",
		}[req.Action]
	}

	var nextHandlerID int
	switch newStatus {
	case "verifying":
		nextHandlerID = findUserIDByRole("temp_supervisor")
	case "reviewing":
		nextHandlerID = findUserIDByRole("warehouse_manager")
	case "archived":
		nextHandlerID = findUserIDByRole("warehouse_manager")
	case "rejected":
		nextHandlerID = findUserIDByRole("warehouse_manager")
	case "registered":
		nextHandlerID = findUserIDByRole("warehouse_keeper", currentOrder.CurrentHandlerID)
		if nextHandlerID == 0 {
			nextHandlerID = findUserIDByRole("warehouse_keeper")
		}
	case "returned":
		nextHandlerID = currentOrder.CreatedBy
	case "conflict":
		nextHandlerID = findUserIDByRole("warehouse_manager")
	default:
		nextHandlerID = currentOrder.CurrentHandlerID
	}

	res, err := database.DB.Exec(
		`UPDATE orders SET status = ?, current_handler_id = ?, version = version + 1, updated_at = datetime('now','localtime') WHERE id = ? AND version = ?`,
		newStatus, nextHandlerID, currentOrder.ID, currentOrder.Version)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新入库单状态失败: " + err.Error()})
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		auditConflict("", "并发更新冲突：版本校验失败，状态已被他人修改")
		c.JSON(http.StatusConflict, gin.H{"error": "并发冲突，请刷新后重试"})
		return
	}

	if req.EvidenceTemperature != nil {
		database.DB.Exec("UPDATE orders SET evidence_temperature = ? WHERE id = ?", boolToInt(*req.EvidenceTemperature), currentOrder.ID)
	}
	if req.EvidenceQuality != nil {
		database.DB.Exec("UPDATE orders SET evidence_quality = ? WHERE id = ?", boolToInt(*req.EvidenceQuality), currentOrder.ID)
	}
	if req.EvidenceQuantity != nil {
		database.DB.Exec("UPDATE orders SET evidence_quantity = ? WHERE id = ?", boolToInt(*req.EvidenceQuantity), currentOrder.ID)
	}

	database.DB.Exec(
		`INSERT INTO operation_records (order_id, handler_id, handler_name, handler_role, action, opinion, result)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		currentOrder.ID, user.ID, user.DisplayName, user.Role, req.Action, req.Opinion, resultLabel)

	detail := getOrderDetailByID(id)
	c.JSON(http.StatusOK, gin.H{"data": detail})
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func MarkOverdue(c *gin.Context) {
	result, err := database.DB.Exec(
		`UPDATE orders SET status = 'overdue', updated_at = datetime('now','localtime')
		 WHERE status IN ('registered', 'verifying', 'reviewing')
		 AND datetime(updated_at, '+7 days') < datetime('now','localtime')`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	affected, _ := result.RowsAffected()
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("已标记 %d 条逾期入库单", affected)})
}

func GetStats(c *gin.Context) {
	stats := models.Stats{
		ByStatus:    make(map[string]int),
		ByRiskLevel: make(map[string]int),
	}

	database.DB.QueryRow("SELECT COUNT(*) FROM orders").Scan(&stats.Total)

	statuses := []string{"registered", "verifying", "reviewing", "archived", "rejected", "returned", "overdue", "conflict"}
	for _, s := range statuses {
		var count int
		database.DB.QueryRow("SELECT COUNT(*) FROM orders WHERE status = ?", s).Scan(&count)
		stats.ByStatus[s] = count
	}

	riskLevels := []string{"high", "medium", "low"}
	for _, r := range riskLevels {
		var count int
		database.DB.QueryRow("SELECT COUNT(*) FROM orders WHERE risk_level = ?", r).Scan(&count)
		stats.ByRiskLevel[r] = count
	}

	database.DB.QueryRow("SELECT COUNT(*) FROM orders WHERE risk_level = 'high' AND status NOT IN ('archived')").Scan(&stats.HighRiskPend)
	database.DB.QueryRow("SELECT COUNT(*) FROM orders WHERE status = 'overdue'").Scan(&stats.Overdue)
	database.DB.QueryRow("SELECT COUNT(*) FROM orders WHERE status = 'reviewing'").Scan(&stats.ReviewingCount)
	database.DB.QueryRow("SELECT COUNT(*) FROM orders WHERE status = 'rejected'").Scan(&stats.RejectedCount)

	c.JSON(http.StatusOK, gin.H{"data": stats})
}
