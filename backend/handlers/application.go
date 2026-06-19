package handlers

import (
	"database/sql"
	"fmt"
	"strconv"
	"time"

	"transfer-system/db"
	"transfer-system/middleware"
	"transfer-system/models"
	"transfer-system/utils"

	"github.com/labstack/echo/v4"
)

const nodeTimeoutHours = 24

func generateApplicationNo() string {
	return fmt.Sprintf("TR%s", time.Now().Format("20060102150405"))
}

func getNodeDeadline() time.Time {
	return time.Now().Add(time.Duration(nodeTimeoutHours) * time.Hour)
}

func checkTimeout(deadline *time.Time) bool {
	if deadline == nil {
		return false
	}
	return time.Now().After(*deadline)
}

func getNodeName(node string) string {
	switch node {
	case "hr_specialist":
		return "人事专员"
	case "salary_supervisor":
		return "薪酬主管"
	case "hrbp_leader":
		return "HRBP负责人"
	case "completed":
		return "已完成"
	default:
		return node
	}
}

func getStatusName(status string) string {
	switch status {
	case string(models.StatusPendingReview):
		return "待审核"
	case string(models.StatusBudgetChecking):
		return "预算校验中"
	case string(models.StatusPendingConfirm):
		return "待确认"
	case string(models.StatusApproved):
		return "审核通过"
	case string(models.StatusSynced):
		return "已同步"
	case string(models.StatusRejected):
		return "已驳回"
	default:
		return status
	}
}

func prerequisitesForType(appType string) (needBudget bool, needSalary bool) {
	switch models.ApplicationType(appType) {
	case models.TypeTransfer:
		return true, false
	case models.TypeSalaryAdjustment:
		return true, true
	case models.TypeBoth:
		return true, true
	default:
		return true, true
	}
}

type actionPermission struct {
	action   string
	role     string
	node     string
	status   string
	forTypes []string // 空表示所有类型
}

var actionWhitelist = []actionPermission{
	{"submit", string(models.RoleHRSpecialist), "hr_specialist", string(models.StatusPendingReview), nil},
	{"submit", string(models.RoleSalarySupervisor), "salary_supervisor", string(models.StatusBudgetChecking), nil},
	{"submit", string(models.RoleHRBPLeader), "hrbp_leader", string(models.StatusPendingConfirm), nil},

	{"reject", string(models.RoleHRSpecialist), "hr_specialist", string(models.StatusPendingReview), nil},
	{"reject", string(models.RoleSalarySupervisor), "salary_supervisor", string(models.StatusBudgetChecking), nil},
	{"reject", string(models.RoleHRBPLeader), "hrbp_leader", string(models.StatusPendingConfirm), nil},

	{"verify_budget", string(models.RoleSalarySupervisor), "salary_supervisor", string(models.StatusBudgetChecking),
		[]string{string(models.TypeTransfer), string(models.TypeSalaryAdjustment), string(models.TypeBoth)}},
	{"process_salary", string(models.RoleSalarySupervisor), "salary_supervisor", string(models.StatusBudgetChecking),
		[]string{string(models.TypeSalaryAdjustment), string(models.TypeBoth)}},

	{"register", string(models.RoleHRSpecialist), "completed", string(models.StatusApproved), nil},
}

func typeInList(appType string, allowed []string) bool {
	if len(allowed) == 0 {
		return true
	}
	for _, t := range allowed {
		if t == appType {
			return true
		}
	}
	return false
}

func canPerformAction(appType, appStatus, appNode, userRole, action string) bool {
	for _, rule := range actionWhitelist {
		if rule.action == action &&
			rule.role == userRole &&
			rule.node == appNode &&
			rule.status == appStatus &&
			typeInList(appType, rule.forTypes) {
			return true
		}
	}
	return false
}

func actionPermissionError(appType, action, userRole, appNode, appStatus string) string {
	switch action {
	case "verify_budget":
		if userRole != string(models.RoleSalarySupervisor) {
			return "仅薪酬主管可执行预算校验"
		}
		return "当前节点/状态不支持预算校验"
	case "process_salary":
		if userRole != string(models.RoleSalarySupervisor) {
			return "仅薪酬主管可执行调薪处理"
		}
		_, needSalary := prerequisitesForType(appType)
		if !needSalary {
			return "此异动类型（调岗）不涉及调薪，无需执行调薪处理"
		}
		return "当前节点/状态不支持调薪处理"
	case "register":
		return "仅人事专员可在审核通过后进行异动登记"
	case "submit", "reject":
		return "当前节点需由" + getNodeName(appNode) + "处理，您无操作权限"
	default:
		return "不支持的操作类型"
	}
}

func validatePrerequisites(appType, action string, app *models.TransferApplication) string {
	needBudget, needSalary := prerequisitesForType(appType)

	switch action {
	case "submit":
		if app.CurrentNode == "salary_supervisor" || app.CurrentNode == "hrbp_leader" {
			if needBudget && !app.BudgetVerified {
				return "此异动类型需要先完成【预算校验】，方可提交确认"
			}
			if needSalary && !app.SalaryProcessed {
				return "此异动类型需要先完成【调薪处理】，方可提交确认"
			}
		}
	case "register":
		if needBudget && !app.BudgetVerified {
			return "异动类型要求【预算校验】未完成，暂不可进行异动登记"
		}
		if needSalary && !app.SalaryProcessed {
			return "异动类型要求【调薪处理】未完成，暂不可进行异动登记"
		}
	}
	return ""
}

func txAddOperationLog(tx *sql.Tx, userID int64, userName, userRole, action, targetType string, targetID int64, detail string) error {
	_, err := tx.Exec(
		"INSERT INTO operation_logs (user_id, user_name, user_role, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?, ?)",
		userID, userName, userRole, action, targetType, targetID, detail,
	)
	return err
}

func txAddProcessingTrail(tx *sql.Tx, appID int64, node string, handlerID *int64, handlerName, action, remark, status string, isTimeout bool, timeoutReason string) error {
	_, err := tx.Exec(
		"INSERT INTO processing_trails (application_id, node, handler_id, handler_name, action, remark, status, is_timeout, timeout_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		appID, node, handlerID, handlerName, action, remark, status, isTimeout, timeoutReason,
	)
	return err
}

func scanApplication(row interface {
	Scan(dest ...interface{}) error
}) (*models.TransferApplication, error) {
	var app models.TransferApplication
	var budgetV, salaryP, registered, isTimeout int
	var deadline sql.NullTime
	var updatedBy sql.NullInt64
	var timeoutReason sql.NullString

	err := row.Scan(
		&app.ID, &app.ApplicationNo, &app.EmployeeID, &app.Type,
		&app.FromDepartment, &app.ToDepartment, &app.FromPosition, &app.ToPosition,
		&app.FromSalary, &app.ToSalary, &app.Reason, &app.Status, &app.CurrentNode,
		&budgetV, &salaryP, &registered, &app.CreatedBy, &updatedBy,
		&app.CreatedAt, &app.UpdatedAt, &deadline, &isTimeout, &timeoutReason,
	)
	if err != nil {
		return nil, err
	}

	app.BudgetVerified = budgetV == 1
	app.SalaryProcessed = salaryP == 1
	app.Registered = registered == 1
	app.IsTimeout = isTimeout == 1
	if timeoutReason.Valid {
		app.TimeoutReason = timeoutReason.String
	}
	if updatedBy.Valid {
		v := updatedBy.Int64
		app.UpdatedBy = &v
	}
	if deadline.Valid {
		t := deadline.Time
		app.NodeDeadline = &t
		if !app.IsTimeout && checkTimeout(app.NodeDeadline) {
			app.IsTimeout = true
		}
	}

	return &app, nil
}

func enrichApplication(app *models.TransferApplication) {
	var emp models.Employee
	err := db.DB.QueryRow(
		"SELECT id, employee_no, name, department, position, current_salary FROM employees WHERE id = ?",
		app.EmployeeID,
	).Scan(&emp.ID, &emp.EmployeeNo, &emp.Name, &emp.Department, &emp.Position, &emp.CurrentSalary)
	if err == nil {
		app.Employee = &emp
	}

	var creator models.User
	err = db.DB.QueryRow(
		"SELECT id, username, real_name, role FROM users WHERE id = ?",
		app.CreatedBy,
	).Scan(&creator.ID, &creator.Username, &creator.RealName, &creator.Role)
	if err == nil {
		app.Creator = &creator
	}
}

func enrichTrails(app *models.TransferApplication) {
	rows, err := db.DB.Query(
		"SELECT id, application_id, node, handler_id, handler_name, action, remark, status, is_timeout, timeout_reason, created_at FROM processing_trails WHERE application_id = ? ORDER BY id",
		app.ID,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	trails := make([]models.ProcessingTrail, 0)
	for rows.Next() {
		var t models.ProcessingTrail
		var handlerID sql.NullInt64
		var handlerName sql.NullString
		var isTimeout int
		var timeoutReason sql.NullString
		if err := rows.Scan(&t.ID, &t.ApplicationID, &t.Node, &handlerID, &handlerName, &t.Action, &t.Remark, &t.Status, &isTimeout, &timeoutReason, &t.CreatedAt); err != nil {
			continue
		}
		t.IsTimeout = isTimeout == 1
		if timeoutReason.Valid {
			t.TimeoutReason = timeoutReason.String
		}
		if handlerID.Valid {
			hid := handlerID.Int64
			t.HandlerID = &hid
		}
		if handlerName.Valid {
			t.HandlerName = handlerName.String
		}
		if t.HandlerID != nil && t.HandlerName == "" {
			var handler models.User
			if err := db.DB.QueryRow("SELECT id, real_name, role FROM users WHERE id = ?", *t.HandlerID).Scan(&handler.ID, &handler.RealName, &handler.Role); err == nil {
				t.Handler = &handler
				t.HandlerName = handler.RealName
			}
		}
		trails = append(trails, t)
	}
	app.Trails = trails
}

func getAllowedActions(app *models.TransferApplication, userRole string) []models.AllowedAction {
	appType := string(app.Type)
	appStatus := string(app.Status)
	appNode := app.CurrentNode

	actions := []struct {
		action     string
		label      string
		buttonType string
	}{
		{"submit", getSubmitLabel(appNode), "primary"},
		{"reject", "驳回", "danger"},
		{"verify_budget", "预算校验", "default"},
		{"process_salary", "调薪处理", "default"},
		{"register", "异动登记", "success"},
	}

	result := make([]models.AllowedAction, 0)
	for _, a := range actions {
		allowed := canPerformAction(appType, appStatus, appNode, userRole, a.action)
		reason := ""
		if !allowed {
			reason = actionPermissionError(appType, a.action, userRole, appNode, appStatus)
		}
		if allowed && a.action == "register" && app.Registered {
			allowed = false
			reason = "已完成异动登记"
		}
		if allowed && a.action == "verify_budget" && app.BudgetVerified {
			allowed = false
			reason = "预算已校验"
		}
		if allowed && a.action == "process_salary" && app.SalaryProcessed {
			allowed = false
			reason = "调薪已处理"
		}
		if allowed && (a.action == "submit") && (appNode == "salary_supervisor" || appNode == "hrbp_leader") {
			if msg := validatePrerequisites(appType, a.action, app); msg != "" {
				allowed = false
				reason = msg
			}
		}
		if allowed && a.action == "register" {
			if msg := validatePrerequisites(appType, a.action, app); msg != "" {
				allowed = false
				reason = msg
			}
		}
		result = append(result, models.AllowedAction{
			Action:     a.action,
			Allowed:    allowed,
			Reason:     reason,
			Label:      a.label,
			ButtonType: a.buttonType,
		})
	}
	return result
}

func getSubmitLabel(node string) string {
	switch node {
	case "hr_specialist":
		return "提交审核"
	case "salary_supervisor":
		return "提交确认"
	case "hrbp_leader":
		return "审核通过"
	default:
		return "提交"
	}
}

func txRecalcApplicationStatus(tx *sql.Tx, appID int64) error {
	var appType string
	var status string
	var currentNode string
	var budgetV, salaryP, registered int
	err := tx.QueryRow(
		"SELECT type, status, current_node, budget_verified, salary_processed, registered FROM transfer_applications WHERE id = ?",
		appID,
	).Scan(&appType, &status, &currentNode, &budgetV, &salaryP, &registered)
	if err != nil {
		return err
	}

	if status == string(models.StatusRejected) || status == string(models.StatusSynced) {
		return nil
	}

	needBudget, needSalary := prerequisitesForType(appType)
	moduleOK := registered == 1 &&
		(!needBudget || budgetV == 1) &&
		(!needSalary || salaryP == 1)

	if moduleOK && status == string(models.StatusApproved) {
		_, err = tx.Exec(
			"UPDATE transfer_applications SET status = ?, current_node = ?, updated_at = ? WHERE id = ?",
			models.StatusSynced, "completed", time.Now(), appID,
		)
		return err
	}

	return nil
}

func CreateApplication(c echo.Context) error {
	uc := middleware.GetUserContext(c)
	if uc == nil {
		return utils.ErrorMsg(c, "用户未登录")
	}
	if uc.Role != string(models.RoleHRSpecialist) {
		return utils.ErrorMsg(c, "仅人事专员可发起异动申请")
	}

	var req models.CreateApplicationRequest
	if err := c.Bind(&req); err != nil {
		return utils.ErrorMsg(c, "请求参数错误")
	}
	if req.EmployeeID == 0 {
		return utils.ErrorMsg(c, "请选择员工")
	}
	if req.Type == "" {
		return utils.ErrorMsg(c, "请选择异动类型")
	}

	var empExists int
	db.DB.QueryRow("SELECT COUNT(*) FROM employees WHERE id = ?", req.EmployeeID).Scan(&empExists)
	if empExists == 0 {
		return utils.ErrorMsg(c, "员工不存在")
	}

	appNo := generateApplicationNo()
	deadline := getNodeDeadline()

	tx, err := db.DB.Begin()
	if err != nil {
		return utils.Fail(c, 500, "开启事务失败")
	}
	defer tx.Rollback()

	result, err := tx.Exec(`
		INSERT INTO transfer_applications 
		(application_no, employee_id, type, from_department, to_department, from_position, to_position, from_salary, to_salary, reason, status, current_node, created_by, updated_by, node_deadline)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		appNo, req.EmployeeID, req.Type, req.FromDepartment, req.ToDepartment,
		req.FromPosition, req.ToPosition, req.FromSalary, req.ToSalary, req.Reason,
		models.StatusPendingReview, "hr_specialist", uc.UserID, uc.UserID, deadline,
	)
	if err != nil {
		return utils.Fail(c, 500, "创建异动申请失败："+err.Error())
	}

	appID, _ := result.LastInsertId()

	if err = txAddProcessingTrail(tx, appID, "hr_specialist", &uc.UserID, uc.Username, "发起申请", req.Reason, "待审核", false, ""); err != nil {
		return utils.Fail(c, 500, "记录轨迹失败")
	}
	if err = txAddOperationLog(tx, uc.UserID, uc.RealName, uc.Role, "create_application", "transfer_application", appID, "创建异动申请: "+appNo); err != nil {
		return utils.Fail(c, 500, "记录日志失败")
	}

	if err = tx.Commit(); err != nil {
		return utils.Fail(c, 500, "提交事务失败")
	}

	return utils.Success(c, map[string]interface{}{
		"id":             appID,
		"application_no": appNo,
	})
}

func ListApplications(c echo.Context) error {
	uc := middleware.GetUserContext(c)
	status := c.QueryParam("status")
	search := c.QueryParam("search")

	query := `SELECT id, application_no, employee_id, type, from_department, to_department, from_position, to_position,
	          from_salary, to_salary, reason, status, current_node, budget_verified, salary_processed, registered,
	          created_by, updated_by, created_at, updated_at, node_deadline, is_timeout, timeout_reason
	          FROM transfer_applications WHERE 1=1`
	args := make([]interface{}, 0)

	switch uc.Role {
	case string(models.RoleHRSpecialist):
		query += " AND created_by = ?"
		args = append(args, uc.UserID)
	case string(models.RoleSalarySupervisor):
		query += " AND (current_node IN ('salary_supervisor', 'hrbp_leader', 'completed') OR status IN ('approved', 'synced'))"
	case string(models.RoleHRBPLeader):
		query += " AND (current_node IN ('hrbp_leader', 'completed') OR status IN ('approved', 'synced'))"
	}

	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}
	if search != "" {
		query += " AND (application_no LIKE ? OR reason LIKE ?)"
		args = append(args, "%"+search+"%", "%"+search+"%")
	}

	query += " ORDER BY created_at DESC"

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		return utils.Fail(c, 500, "查询异动申请列表失败: "+err.Error())
	}
	defer rows.Close()

	apps := make([]*models.TransferApplication, 0)
	for rows.Next() {
		app, err := scanApplication(rows)
		if err != nil {
			continue
		}
		enrichApplication(app)
		app.AllowedActions = getAllowedActions(app, uc.Role)
		apps = append(apps, app)
	}

	return utils.Success(c, apps)
}

func GetApplication(c echo.Context) error {
	uc := middleware.GetUserContext(c)
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return utils.ErrorMsg(c, "无效的申请ID")
	}

	row := db.DB.QueryRow(`SELECT id, application_no, employee_id, type, from_department, to_department, from_position, to_position,
		from_salary, to_salary, reason, status, current_node, budget_verified, salary_processed, registered,
		created_by, updated_by, created_at, updated_at, node_deadline, is_timeout, timeout_reason
		FROM transfer_applications WHERE id = ?`, id)

	app, err := scanApplication(row)
	if err == sql.ErrNoRows {
		return utils.ErrorMsg(c, "异动申请不存在")
	}
	if err != nil {
		return utils.Fail(c, 500, "查询申请失败")
	}

	enrichApplication(app)
	enrichTrails(app)
	app.AllowedActions = getAllowedActions(app, uc.Role)

	return utils.Success(c, app)
}

func ProcessApplication(c echo.Context) error {
	uc := middleware.GetUserContext(c)
	if uc == nil {
		return utils.ErrorMsg(c, "用户未登录")
	}

	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return utils.ErrorMsg(c, "无效的申请ID")
	}

	var req models.ProcessApplicationRequest
	if err := c.Bind(&req); err != nil {
		return utils.ErrorMsg(c, "请求参数错误")
	}
	if req.Action == "" {
		return utils.ErrorMsg(c, "请指定处理动作")
	}

	tx, err := db.DB.Begin()
	if err != nil {
		return utils.Fail(c, 500, "开启事务失败")
	}
	defer tx.Rollback()

	var app models.TransferApplication
	var deadline sql.NullTime
	var isTimeout int
	var budgetV, salaryP, registered int
	err = tx.QueryRow(
		"SELECT id, type, status, current_node, node_deadline, is_timeout, budget_verified, salary_processed, registered FROM transfer_applications WHERE id = ?",
		id,
	).Scan(&app.ID, &app.Type, &app.Status, &app.CurrentNode, &deadline, &isTimeout, &budgetV, &salaryP, &registered)
	if err == sql.ErrNoRows {
		return utils.ErrorMsg(c, "异动申请不存在")
	}
	if err != nil {
		return utils.Fail(c, 500, "查询申请失败")
	}
	app.IsTimeout = isTimeout == 1
	app.BudgetVerified = budgetV == 1
	app.SalaryProcessed = salaryP == 1
	app.Registered = registered == 1
	if deadline.Valid {
		t := deadline.Time
		app.NodeDeadline = &t
		if !app.IsTimeout && checkTimeout(app.NodeDeadline) {
			app.IsTimeout = true
		}
	}

	if app.Status == models.StatusSynced {
		return utils.ErrorMsg(c, "该申请已同步，无法继续处理")
	}
	if app.Status == models.StatusRejected {
		return utils.ErrorMsg(c, "该申请已驳回，无法继续处理")
	}

	canProcess := canPerformAction(string(app.Type), string(app.Status), app.CurrentNode, uc.Role, req.Action)
	if req.Action == "register" {
		canProcess = canProcess && !app.Registered
	}

	if !canProcess {
		return utils.ErrorMsg(c, actionPermissionError(string(app.Type), req.Action, uc.Role, app.CurrentNode, string(app.Status)))
	}

	if req.Action == "submit" || req.Action == "register" {
		if msg := validatePrerequisites(string(app.Type), req.Action, &app); msg != "" {
			return utils.ErrorMsg(c, msg)
		}
	}

	nextNode := app.CurrentNode
	nextStatus := app.Status
	newDeadline := getNodeDeadline()
	updateDeadline := true
	trailStatus := ""

	switch req.Action {
	case "submit":
		switch app.CurrentNode {
		case "hr_specialist":
			nextNode = "salary_supervisor"
			nextStatus = models.StatusBudgetChecking
			trailStatus = "已提交"
		case "salary_supervisor":
			nextNode = "hrbp_leader"
			nextStatus = models.StatusPendingConfirm
			trailStatus = "预算校验通过"
		case "hrbp_leader":
			nextNode = "completed"
			nextStatus = models.StatusApproved
			trailStatus = "审核通过"
			updateDeadline = false
		}

	case "reject":
		nextNode = app.CurrentNode
		nextStatus = models.StatusRejected
		trailStatus = "已驳回"
		updateDeadline = false

	case "verify_budget":
		if app.BudgetVerified {
			return utils.ErrorMsg(c, "预算已校验，请勿重复操作")
		}
		_, err = tx.Exec("UPDATE transfer_applications SET budget_verified = 1, updated_at = ?, updated_by = ? WHERE id = ?", time.Now(), uc.UserID, id)
		if err != nil {
			return utils.Fail(c, 500, "预算校验失败")
		}
		if err = txAddProcessingTrail(tx, id, "salary_supervisor", &uc.UserID, uc.RealName, "预算校验", req.Remark, "预算已校验", app.IsTimeout, req.TimeoutReason); err != nil {
			return utils.Fail(c, 500, "记录轨迹失败")
		}
		if err = txAddOperationLog(tx, uc.UserID, uc.RealName, uc.Role, "verify_budget", "transfer_application", id, "异动申请预算校验: "+strconv.FormatInt(id, 10)); err != nil {
			return utils.Fail(c, 500, "记录日志失败")
		}
		if err = txRecalcApplicationStatus(tx, id); err != nil {
			return utils.Fail(c, 500, "状态重算失败")
		}
		if err = tx.Commit(); err != nil {
			return utils.Fail(c, 500, "提交事务失败")
		}
		return utils.Success(c, map[string]string{"message": "预算校验成功"})

	case "process_salary":
		if app.SalaryProcessed {
			return utils.ErrorMsg(c, "调薪已处理，请勿重复操作")
		}
		_, err = tx.Exec("UPDATE transfer_applications SET salary_processed = 1, updated_at = ?, updated_by = ? WHERE id = ?", time.Now(), uc.UserID, id)
		if err != nil {
			return utils.Fail(c, 500, "调薪处理失败")
		}
		if err = txAddProcessingTrail(tx, id, "salary_supervisor", &uc.UserID, uc.RealName, "调薪处理", req.Remark, "调薪已处理", app.IsTimeout, req.TimeoutReason); err != nil {
			return utils.Fail(c, 500, "记录轨迹失败")
		}
		if err = txAddOperationLog(tx, uc.UserID, uc.RealName, uc.Role, "process_salary", "transfer_application", id, "异动申请调薪处理: "+strconv.FormatInt(id, 10)); err != nil {
			return utils.Fail(c, 500, "记录日志失败")
		}
		if err = txRecalcApplicationStatus(tx, id); err != nil {
			return utils.Fail(c, 500, "状态重算失败")
		}
		if err = tx.Commit(); err != nil {
			return utils.Fail(c, 500, "提交事务失败")
		}
		return utils.Success(c, map[string]string{"message": "调薪处理成功"})

	case "register":
		if app.Registered {
			return utils.ErrorMsg(c, "异动已登记，请勿重复操作")
		}
		_, err = tx.Exec("UPDATE transfer_applications SET registered = 1, updated_at = ?, updated_by = ? WHERE id = ?", time.Now(), uc.UserID, id)
		if err != nil {
			return utils.Fail(c, 500, "异动登记失败")
		}
		if err = txAddProcessingTrail(tx, id, "hr_specialist", &uc.UserID, uc.RealName, "异动登记", req.Remark, "已登记", app.IsTimeout, req.TimeoutReason); err != nil {
			return utils.Fail(c, 500, "记录轨迹失败")
		}
		if err = txAddOperationLog(tx, uc.UserID, uc.RealName, uc.Role, "register_transfer", "transfer_application", id, "异动登记完成: "+strconv.FormatInt(id, 10)); err != nil {
			return utils.Fail(c, 500, "记录日志失败")
		}
		if err = txRecalcApplicationStatus(tx, id); err != nil {
			return utils.Fail(c, 500, "状态重算失败")
		}
		if err = tx.Commit(); err != nil {
			return utils.Fail(c, 500, "提交事务失败")
		}
		return utils.Success(c, map[string]string{"message": "异动登记成功"})

	default:
		return utils.ErrorMsg(c, "不支持的处理动作: "+req.Action)
	}

	updateSQL := "UPDATE transfer_applications SET status = ?, current_node = ?, updated_at = ?, updated_by = ?"
	updateArgs := []interface{}{nextStatus, nextNode, time.Now(), uc.UserID}

	if req.TimeoutReason != "" || app.IsTimeout {
		updateSQL += ", is_timeout = 1, timeout_reason = ?"
		reason := req.TimeoutReason
		if reason == "" {
			reason = "处理超时"
		}
		updateArgs = append(updateArgs, reason)
	}
	if updateDeadline {
		updateSQL += ", node_deadline = ?"
		updateArgs = append(updateArgs, newDeadline)
	}
	updateSQL += " WHERE id = ?"
	updateArgs = append(updateArgs, id)

	if _, err = tx.Exec(updateSQL, updateArgs...); err != nil {
		return utils.Fail(c, 500, "更新申请状态失败: "+err.Error())
	}

	actionName := map[string]string{
		"submit": "提交审核",
		"reject": "驳回申请",
	}[req.Action]

	if err = txAddProcessingTrail(tx, id, app.CurrentNode, &uc.UserID, uc.RealName, actionName, req.Remark, trailStatus, app.IsTimeout, req.TimeoutReason); err != nil {
		return utils.Fail(c, 500, "记录处理轨迹失败")
	}

	if err = txAddOperationLog(tx, uc.UserID, uc.RealName, uc.Role, "process_application", "transfer_application", id,
		actionName+": "+getStatusName(string(nextStatus))); err != nil {
		return utils.Fail(c, 500, "记录日志失败")
	}

	if err = txRecalcApplicationStatus(tx, id); err != nil {
		return utils.Fail(c, 500, "状态重算失败")
	}

	if err = tx.Commit(); err != nil {
		return utils.Fail(c, 500, "提交事务失败")
	}

	return utils.Success(c, map[string]interface{}{
		"id":           id,
		"status":       nextStatus,
		"current_node": nextNode,
		"message":      actionName + "成功",
	})
}

func BatchProcess(c echo.Context) error {
	uc := middleware.GetUserContext(c)
	if uc == nil {
		return utils.ErrorMsg(c, "用户未登录")
	}

	var req models.BatchOperationRequest
	if err := c.Bind(&req); err != nil {
		return utils.ErrorMsg(c, "请求参数错误")
	}
	if len(req.IDs) == 0 {
		return utils.ErrorMsg(c, "请选择要操作的申请")
	}
	if req.Action == "" {
		return utils.ErrorMsg(c, "请指定操作动作")
	}

	successCount := 0
	failCount := 0
	results := make(map[int64]string)

	for _, id := range req.IDs {
		var appType, currentNode, status string
		var budgetV, salaryP, registered, isTimeout int
		err := db.DB.QueryRow("SELECT type, current_node, status, budget_verified, salary_processed, registered, is_timeout FROM transfer_applications WHERE id = ?", id).Scan(&appType, &currentNode, &status, &budgetV, &salaryP, &registered, &isTimeout)
		if err != nil {
			failCount++
			results[id] = "申请不存在"
			continue
		}

		tempApp := &models.TransferApplication{
			CurrentNode:     currentNode,
			Status:          models.ApplicationStatus(status),
			BudgetVerified:  budgetV == 1,
			SalaryProcessed: salaryP == 1,
			Registered:      registered == 1,
		}

		canProcess := canPerformAction(appType, status, currentNode, uc.Role, req.Action)
		if req.Action == "register" {
			canProcess = canProcess && registered == 0
		}

		if !canProcess {
			failCount++
			results[id] = actionPermissionError(appType, req.Action, uc.Role, currentNode, status)
			continue
		}

		if req.Action == "submit" || req.Action == "register" {
			if msg := validatePrerequisites(appType, req.Action, tempApp); msg != "" {
				failCount++
				results[id] = msg
				continue
			}
		}

		timeoutFlag := isTimeout == 1 || req.TimeoutReason != ""
		timeoutReason := req.TimeoutReason
		if timeoutFlag && timeoutReason == "" {
			timeoutReason = "批量处理时存在超时节点"
		}

		tx, txErr := db.DB.Begin()
		if txErr != nil {
			failCount++
			results[id] = "事务开启失败"
			continue
		}

		if req.Action == "submit" || req.Action == "reject" {
			var nextStatus, nextNode string
			if req.Action == "submit" {
				switch currentNode {
				case "hr_specialist":
					nextNode = "salary_supervisor"
					nextStatus = string(models.StatusBudgetChecking)
				case "salary_supervisor":
					nextNode = "hrbp_leader"
					nextStatus = string(models.StatusPendingConfirm)
				case "hrbp_leader":
					nextNode = "completed"
					nextStatus = string(models.StatusApproved)
				}
			} else {
				nextStatus = string(models.StatusRejected)
				nextNode = currentNode
			}
			_, err = tx.Exec(
				"UPDATE transfer_applications SET status = ?, current_node = ?, updated_at = ?, updated_by = ? WHERE id = ?",
				nextStatus, nextNode, time.Now(), uc.UserID, id,
			)
			if err != nil {
				tx.Rollback()
				failCount++
				results[id] = "处理失败: " + err.Error()
				continue
			}
			trailAction := map[string]string{"submit": "批量提交", "reject": "批量驳回"}[req.Action]
			if err = txAddProcessingTrail(tx, id, currentNode, &uc.UserID, uc.RealName, trailAction, req.Remark, getStatusName(nextStatus), timeoutFlag, timeoutReason); err != nil {
				tx.Rollback()
				failCount++
				results[id] = "记录轨迹失败"
				continue
			}
			if err = txRecalcApplicationStatus(tx, id); err != nil {
				tx.Rollback()
				failCount++
				results[id] = "状态重算失败"
				continue
			}
		} else if req.Action == "verify_budget" {
			if budgetV == 1 {
				tx.Rollback()
				failCount++
				results[id] = "预算已校验，请勿重复操作"
				continue
			}
			_, err = tx.Exec("UPDATE transfer_applications SET budget_verified = 1, updated_at = ?, updated_by = ? WHERE id = ?", time.Now(), uc.UserID, id)
			if err != nil {
				tx.Rollback()
				failCount++
				results[id] = "预算校验失败"
				continue
			}
			if err = txAddProcessingTrail(tx, id, "salary_supervisor", &uc.UserID, uc.RealName, "批量预算校验", req.Remark, "预算已校验", timeoutFlag, timeoutReason); err != nil {
				tx.Rollback()
				failCount++
				results[id] = "记录轨迹失败"
				continue
			}
			if err = txRecalcApplicationStatus(tx, id); err != nil {
				tx.Rollback()
				failCount++
				results[id] = "状态重算失败"
				continue
			}
		} else if req.Action == "process_salary" {
			if salaryP == 1 {
				tx.Rollback()
				failCount++
				results[id] = "调薪已处理，请勿重复操作"
				continue
			}
			_, err = tx.Exec("UPDATE transfer_applications SET salary_processed = 1, updated_at = ?, updated_by = ? WHERE id = ?", time.Now(), uc.UserID, id)
			if err != nil {
				tx.Rollback()
				failCount++
				results[id] = "调薪处理失败"
				continue
			}
			if err = txAddProcessingTrail(tx, id, "salary_supervisor", &uc.UserID, uc.RealName, "批量调薪处理", req.Remark, "调薪已处理", timeoutFlag, timeoutReason); err != nil {
				tx.Rollback()
				failCount++
				results[id] = "记录轨迹失败"
				continue
			}
			if err = txRecalcApplicationStatus(tx, id); err != nil {
				tx.Rollback()
				failCount++
				results[id] = "状态重算失败"
				continue
			}
		} else if req.Action == "register" {
			if registered == 1 {
				tx.Rollback()
				failCount++
				results[id] = "异动已登记，请勿重复操作"
				continue
			}
			_, err = tx.Exec("UPDATE transfer_applications SET registered = 1, updated_at = ?, updated_by = ? WHERE id = ?", time.Now(), uc.UserID, id)
			if err != nil {
				tx.Rollback()
				failCount++
				results[id] = "异动登记失败"
				continue
			}
			if err = txAddProcessingTrail(tx, id, "hr_specialist", &uc.UserID, uc.RealName, "批量异动登记", req.Remark, "已登记", timeoutFlag, timeoutReason); err != nil {
				tx.Rollback()
				failCount++
				results[id] = "记录轨迹失败"
				continue
			}
			if err = txRecalcApplicationStatus(tx, id); err != nil {
				tx.Rollback()
				failCount++
				results[id] = "状态重算失败"
				continue
			}
		} else {
			tx.Rollback()
			failCount++
			results[id] = "不支持的动作"
			continue
		}

		if err = txAddOperationLog(tx, uc.UserID, uc.RealName, uc.Role, "batch_"+req.Action, "transfer_application", id, "批量操作: "+req.Action+" | "+req.Remark); err != nil {
			tx.Rollback()
			failCount++
			results[id] = "记录日志失败"
			continue
		}

		if err = tx.Commit(); err != nil {
			failCount++
			results[id] = "提交事务失败"
			continue
		}

		successCount++
		results[id] = "处理成功"
	}

	_, _ = db.DB.Exec(
		"INSERT INTO operation_logs (user_id, user_name, user_role, action, target_type, detail) VALUES (?, ?, ?, ?, ?, ?)",
		uc.UserID, uc.RealName, uc.Role, "batch_process", "transfer_application",
		fmt.Sprintf("批量操作: %s, 成功%d, 失败%d", req.Action, successCount, failCount),
	)

	return utils.Success(c, map[string]interface{}{
		"success_count": successCount,
		"fail_count":    failCount,
		"results":       results,
	})
}

func GetStatistics(c echo.Context) error {
	uc := middleware.GetUserContext(c)
	var stats models.Statistics

	baseQuery := "SELECT COUNT(*) FROM transfer_applications WHERE 1=1"
	args := make([]interface{}, 0)

	switch uc.Role {
	case string(models.RoleHRSpecialist):
		baseQuery += " AND created_by = ?"
		args = append(args, uc.UserID)
	case string(models.RoleSalarySupervisor):
		baseQuery += " AND (current_node IN ('salary_supervisor', 'hrbp_leader', 'completed') OR status IN ('approved', 'synced'))"
	case string(models.RoleHRBPLeader):
		baseQuery += " AND (current_node IN ('hrbp_leader', 'completed') OR status IN ('approved', 'synced'))"
	}

	db.DB.QueryRow(baseQuery, args...).Scan(&stats.Total)

	statusItems := []struct {
		ptr    *int64
		status string
	}{
		{&stats.PendingReview, string(models.StatusPendingReview)},
		{&stats.BudgetChecking, string(models.StatusBudgetChecking)},
		{&stats.PendingConfirm, string(models.StatusPendingConfirm)},
		{&stats.Approved, string(models.StatusApproved)},
		{&stats.Synced, string(models.StatusSynced)},
		{&stats.Rejected, string(models.StatusRejected)},
	}

	for _, item := range statusItems {
		q := "SELECT COUNT(*) FROM transfer_applications WHERE status = ?"
		a := []interface{}{item.status}
		if uc.Role == string(models.RoleHRSpecialist) {
			q += " AND created_by = ?"
			a = append(a, uc.UserID)
		} else if uc.Role == string(models.RoleSalarySupervisor) {
			q += " AND (current_node IN ('salary_supervisor', 'hrbp_leader', 'completed') OR status IN ('approved', 'synced'))"
		} else if uc.Role == string(models.RoleHRBPLeader) {
			q += " AND (current_node IN ('hrbp_leader', 'completed') OR status IN ('approved', 'synced'))"
		}
		db.DB.QueryRow(q, a...).Scan(item.ptr)
	}

	q := "SELECT COUNT(*) FROM transfer_applications WHERE is_timeout = 1"
	a := make([]interface{}, 0)
	if uc.Role == string(models.RoleHRSpecialist) {
		q += " AND created_by = ?"
		a = append(a, uc.UserID)
	} else if uc.Role == string(models.RoleSalarySupervisor) {
		q += " AND (current_node IN ('salary_supervisor', 'hrbp_leader', 'completed') OR status IN ('approved', 'synced'))"
	} else if uc.Role == string(models.RoleHRBPLeader) {
		q += " AND (current_node IN ('hrbp_leader', 'completed') OR status IN ('approved', 'synced'))"
	}
	db.DB.QueryRow(q, a...).Scan(&stats.TimeoutCount)

	return utils.Success(c, stats)
}

func ListOperationLogs(c echo.Context) error {
	limit := 100
	rows, err := db.DB.Query(`
		SELECT l.id, l.user_id, l.user_name, l.user_role, l.action, l.target_type, l.target_id, l.detail, l.created_at
		FROM operation_logs l
		ORDER BY l.id DESC LIMIT ?`, limit)
	if err != nil {
		return utils.Fail(c, 500, "查询操作日志失败")
	}
	defer rows.Close()

	logs := make([]models.OperationLog, 0)
	for rows.Next() {
		var log models.OperationLog
		var userName, userRole sql.NullString
		var targetType, detail sql.NullString
		var targetID sql.NullInt64
		if err := rows.Scan(&log.ID, &log.UserID, &userName, &userRole, &log.Action, &targetType, &targetID, &detail, &log.CreatedAt); err != nil {
			continue
		}
		if targetType.Valid {
			log.TargetType = targetType.String
		}
		if targetID.Valid {
			log.TargetID = targetID.Int64
		}
		if detail.Valid {
			log.Detail = detail.String
		}
		if userName.Valid {
			log.UserName = userName.String
		}
		if userRole.Valid {
			log.UserRole = userRole.String
		}
		if log.UserName == "" {
			var u models.User
			if err := db.DB.QueryRow("SELECT id, real_name, role FROM users WHERE id = ?", log.UserID).Scan(&u.ID, &u.RealName, &u.Role); err == nil {
				log.User = &u
				log.UserName = u.RealName
				log.UserRole = string(u.Role)
			}
		}
		logs = append(logs, log)
	}

	return utils.Success(c, logs)
}
