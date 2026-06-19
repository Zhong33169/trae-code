package handlers

import (
	"database/sql"
	"fmt"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"transfer-system/db"
	"transfer-system/middleware"
	"transfer-system/models"
	"transfer-system/utils"
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

func addOperationLog(userID int64, action, targetType string, targetID int64, detail string) {
	_, _ = db.DB.Exec(
		"INSERT INTO operation_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)",
		userID, action, targetType, targetID, detail,
	)
}

func addProcessingTrail(appID int64, node string, handlerID *int64, action, remark, status string, isTimeout bool) error {
	_, err := db.DB.Exec(
		"INSERT INTO processing_trails (application_id, node, handler_id, action, remark, status, is_timeout) VALUES (?, ?, ?, ?, ?, ?, ?)",
		appID, node, handlerID, action, remark, status, isTimeout,
	)
	return err
}

func scanApplication(row interface {
	Scan(dest ...interface{}) error
}) (*models.TransferApplication, error) {
	var app models.TransferApplication
	var budgetV, salaryP, registered, isTimeout int
	var deadline sql.NullTime

	err := row.Scan(
		&app.ID, &app.ApplicationNo, &app.EmployeeID, &app.Type,
		&app.FromDepartment, &app.ToDepartment, &app.FromPosition, &app.ToPosition,
		&app.FromSalary, &app.ToSalary, &app.Reason, &app.Status, &app.CurrentNode,
		&budgetV, &salaryP, &registered, &app.CreatedBy,
		&app.CreatedAt, &app.UpdatedAt, &deadline, &isTimeout, &app.TimeoutReason,
	)
	if err != nil {
		return nil, err
	}

	app.BudgetVerified = budgetV == 1
	app.SalaryProcessed = salaryP == 1
	app.Registered = registered == 1
	app.IsTimeout = isTimeout == 1
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
		"SELECT id, application_id, node, handler_id, action, remark, status, is_timeout, created_at FROM processing_trails WHERE application_id = ? ORDER BY id",
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
		var isTimeout int
		if err := rows.Scan(&t.ID, &t.ApplicationID, &t.Node, &handlerID, &t.Action, &t.Remark, &t.Status, &isTimeout, &t.CreatedAt); err != nil {
			continue
		}
		t.IsTimeout = isTimeout == 1
		if handlerID.Valid {
			hid := handlerID.Int64
			t.HandlerID = &hid
			var handler models.User
			if err := db.DB.QueryRow("SELECT id, real_name, role FROM users WHERE id = ?", hid).Scan(&handler.ID, &handler.RealName, &handler.Role); err == nil {
				t.Handler = &handler
			}
		}
		trails = append(trails, t)
	}
	app.Trails = trails
}

func recalcApplicationStatus(appID int64) error {
	var app models.TransferApplication
	var budgetV, salaryP, registered int
	err := db.DB.QueryRow(
		"SELECT status, current_node, budget_verified, salary_processed, registered FROM transfer_applications WHERE id = ?",
		appID,
	).Scan(&app.Status, &app.CurrentNode, &budgetV, &salaryP, &registered)
	if err != nil {
		return err
	}

	app.BudgetVerified = budgetV == 1
	app.SalaryProcessed = salaryP == 1
	app.Registered = registered == 1

	if app.Status == models.StatusRejected || app.Status == models.StatusSynced {
		return nil
	}

	if app.Registered && app.SalaryProcessed && app.BudgetVerified && app.Status == models.StatusApproved {
		_, err = db.DB.Exec(
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

	result, err := db.DB.Exec(`
		INSERT INTO transfer_applications 
		(application_no, employee_id, type, from_department, to_department, from_position, to_position, from_salary, to_salary, reason, status, current_node, created_by, node_deadline)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		appNo, req.EmployeeID, req.Type, req.FromDepartment, req.ToDepartment,
		req.FromPosition, req.ToPosition, req.FromSalary, req.ToSalary, req.Reason,
		models.StatusPendingReview, "hr_specialist", uc.UserID, deadline,
	)
	if err != nil {
		return utils.Fail(c, 500, "创建异动申请失败："+err.Error())
	}

	appID, _ := result.LastInsertId()

	addProcessingTrail(appID, "hr_specialist", &uc.UserID, "发起申请", req.Reason, "待审核", false)
	addOperationLog(uc.UserID, "create_application", "transfer_application", appID, "创建异动申请: "+appNo)

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
	          created_by, created_at, updated_at, node_deadline, is_timeout, timeout_reason
	          FROM transfer_applications WHERE 1=1`
	args := make([]interface{}, 0)

	switch uc.Role {
	case string(models.RoleHRSpecialist):
		query += " AND created_by = ?"
		args = append(args, uc.UserID)
	case string(models.RoleSalarySupervisor):
		query += " AND current_node IN ('salary_supervisor', 'hrbp_leader', 'completed')"
	case string(models.RoleHRBPLeader):
		query += " AND current_node IN ('hrbp_leader', 'completed') OR status IN ('approved', 'synced')"
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
		apps = append(apps, app)
	}

	return utils.Success(c, apps)
}

func GetApplication(c echo.Context) error {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return utils.ErrorMsg(c, "无效的申请ID")
	}

	row := db.DB.QueryRow(`SELECT id, application_no, employee_id, type, from_department, to_department, from_position, to_position,
		from_salary, to_salary, reason, status, current_node, budget_verified, salary_processed, registered,
		created_by, created_at, updated_at, node_deadline, is_timeout, timeout_reason
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
	err = tx.QueryRow(
		"SELECT id, status, current_node, node_deadline, is_timeout FROM transfer_applications WHERE id = ?",
		id,
	).Scan(&app.ID, &app.Status, &app.CurrentNode, &deadline, &isTimeout)
	if err == sql.ErrNoRows {
		return utils.ErrorMsg(c, "异动申请不存在")
	}
	if err != nil {
		return utils.Fail(c, 500, "查询申请失败")
	}
	app.IsTimeout = isTimeout == 1
	if deadline.Valid {
		t := deadline.Time
		app.NodeDeadline = &t
		if !app.IsTimeout && checkTimeout(app.NodeDeadline) {
			app.IsTimeout = true
		}
	}

	if app.Status == models.StatusRejected || app.Status == models.StatusSynced {
		return utils.ErrorMsg(c, "该申请已" + getStatusName(string(app.Status)) + "，无法继续处理")
	}

	canProcess := false
	switch uc.Role {
	case string(models.RoleHRSpecialist):
		canProcess = app.CurrentNode == "hr_specialist"
	case string(models.RoleSalarySupervisor):
		canProcess = app.CurrentNode == "salary_supervisor"
	case string(models.RoleHRBPLeader):
		canProcess = app.CurrentNode == "hrbp_leader"
	}

	if !canProcess {
		return utils.ErrorMsg(c, "当前节点需由" + getNodeName(app.CurrentNode) + "处理，您无操作权限")
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
		if uc.Role != string(models.RoleSalarySupervisor) {
			return utils.ErrorMsg(c, "仅薪酬主管可进行预算校验")
		}
		if app.CurrentNode != "salary_supervisor" {
			return utils.ErrorMsg(c, "当前节点不可进行预算校验")
		}
		_, err = tx.Exec("UPDATE transfer_applications SET budget_verified = 1, updated_at = ? WHERE id = ?", time.Now(), id)
		if err != nil {
			return utils.Fail(c, 500, "预算校验失败")
		}
		addProcessingTrail(id, "salary_supervisor", &uc.UserID, "预算校验", req.Remark, "预算已校验", app.IsTimeout)
		addOperationLog(uc.UserID, "verify_budget", "transfer_application", id, "异动申请预算校验: "+strconv.FormatInt(id, 10))
		tx.Commit()
		recalcApplicationStatus(id)
		return utils.Success(c, map[string]string{"message": "预算校验成功"})

	case "process_salary":
		if uc.Role != string(models.RoleSalarySupervisor) {
			return utils.ErrorMsg(c, "仅薪酬主管可处理调薪")
		}
		_, err = tx.Exec("UPDATE transfer_applications SET salary_processed = 1, updated_at = ? WHERE id = ?", time.Now(), id)
		if err != nil {
			return utils.Fail(c, 500, "调薪处理失败")
		}
		addProcessingTrail(id, "salary_supervisor", &uc.UserID, "调薪处理", req.Remark, "调薪已处理", app.IsTimeout)
		addOperationLog(uc.UserID, "process_salary", "transfer_application", id, "异动申请调薪处理: "+strconv.FormatInt(id, 10))
		tx.Commit()
		recalcApplicationStatus(id)
		return utils.Success(c, map[string]string{"message": "调薪处理成功"})

	case "register":
		if uc.Role != string(models.RoleHRSpecialist) {
			return utils.ErrorMsg(c, "仅人事专员可进行异动登记")
		}
		_, err = tx.Exec("UPDATE transfer_applications SET registered = 1, updated_at = ? WHERE id = ?", time.Now(), id)
		if err != nil {
			return utils.Fail(c, 500, "异动登记失败")
		}
		addProcessingTrail(id, "hr_specialist", &uc.UserID, "异动登记", req.Remark, "已登记", app.IsTimeout)
		addOperationLog(uc.UserID, "register_transfer", "transfer_application", id, "异动登记完成: "+strconv.FormatInt(id, 10))
		tx.Commit()
		recalcApplicationStatus(id)
		return utils.Success(c, map[string]string{"message": "异动登记成功"})

	default:
		return utils.ErrorMsg(c, "不支持的处理动作: " + req.Action)
	}

	updateSQL := "UPDATE transfer_applications SET status = ?, current_node = ?, updated_at = ?"
	updateArgs := []interface{}{nextStatus, nextNode, time.Now()}

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

	if err = addProcessingTrail(id, app.CurrentNode, &uc.UserID, actionName, req.Remark, trailStatus, app.IsTimeout); err != nil {
		return utils.Fail(c, 500, "记录处理轨迹失败")
	}

	addOperationLog(uc.UserID, "process_application", "transfer_application", id,
		actionName+": "+getStatusName(string(nextStatus)))

	if err = tx.Commit(); err != nil {
		return utils.Fail(c, 500, "提交事务失败")
	}

	recalcApplicationStatus(id)

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
		var currentNode string
		err := db.DB.QueryRow("SELECT current_node FROM transfer_applications WHERE id = ?", id).Scan(&currentNode)
		if err != nil {
			failCount++
			results[id] = "申请不存在"
			continue
		}

		canProcess := false
		switch uc.Role {
		case string(models.RoleHRSpecialist):
			canProcess = currentNode == "hr_specialist"
		case string(models.RoleSalarySupervisor):
			canProcess = currentNode == "salary_supervisor" && (req.Action == "submit" || req.Action == "verify_budget" || req.Action == "process_salary")
		case string(models.RoleHRBPLeader):
			canProcess = currentNode == "hrbp_leader"
		}

		if !canProcess {
			failCount++
			results[id] = "无权限处理"
			continue
		}

		if req.Action == "submit" || req.Action == "reject" {
			var status string
			var node string
			if req.Action == "submit" {
				switch currentNode {
				case "hr_specialist":
					node = "salary_supervisor"
					status = string(models.StatusBudgetChecking)
				case "salary_supervisor":
					node = "hrbp_leader"
					status = string(models.StatusPendingConfirm)
				case "hrbp_leader":
					node = "completed"
					status = string(models.StatusApproved)
				}
			} else {
				status = string(models.StatusRejected)
				node = currentNode
			}
			_, err = db.DB.Exec(
				"UPDATE transfer_applications SET status = ?, current_node = ?, updated_at = ? WHERE id = ?",
				status, node, time.Now(), id,
			)
			if err != nil {
				failCount++
				results[id] = "处理失败: " + err.Error()
				continue
			}
			addProcessingTrail(id, currentNode, &uc.UserID, map[string]string{"submit": "批量提交", "reject": "批量驳回"}[req.Action], req.Remark, getStatusName(status), false)
		} else if req.Action == "verify_budget" {
			_, err = db.DB.Exec("UPDATE transfer_applications SET budget_verified = 1, updated_at = ? WHERE id = ?", time.Now(), id)
			addProcessingTrail(id, "salary_supervisor", &uc.UserID, "批量预算校验", req.Remark, "预算已校验", false)
		} else if req.Action == "process_salary" {
			_, err = db.DB.Exec("UPDATE transfer_applications SET salary_processed = 1, updated_at = ? WHERE id = ?", time.Now(), id)
			addProcessingTrail(id, "salary_supervisor", &uc.UserID, "批量调薪处理", req.Remark, "调薪已处理", false)
		} else {
			failCount++
			results[id] = "不支持的动作"
			continue
		}

		successCount++
		results[id] = "处理成功"
		recalcApplicationStatus(id)
	}

	addOperationLog(uc.UserID, "batch_process", "transfer_application", 0,
		fmt.Sprintf("批量操作: %s, 成功%d, 失败%d", req.Action, successCount, failCount))

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
		baseQuery += " AND current_node IN ('salary_supervisor', 'hrbp_leader', 'completed')"
	case string(models.RoleHRBPLeader):
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
		}
		db.DB.QueryRow(q, a...).Scan(item.ptr)
	}

	q := "SELECT COUNT(*) FROM transfer_applications WHERE is_timeout = 1"
	a := make([]interface{}, 0)
	if uc.Role == string(models.RoleHRSpecialist) {
		q += " AND created_by = ?"
		a = append(a, uc.UserID)
	}
	db.DB.QueryRow(q, a...).Scan(&stats.TimeoutCount)

	return utils.Success(c, stats)
}

func ListOperationLogs(c echo.Context) error {
	limit := 50
	rows, err := db.DB.Query(`
		SELECT l.id, l.user_id, l.action, l.target_type, l.target_id, l.detail, l.created_at,
		       u.real_name, u.role
		FROM operation_logs l
		LEFT JOIN users u ON l.user_id = u.id
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
		if err := rows.Scan(&log.ID, &log.UserID, &log.Action, &targetType, &targetID, &detail, &log.CreatedAt, &userName, &userRole); err != nil {
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
			log.User = &models.User{ID: log.UserID, RealName: userName.String}
			if userRole.Valid {
				log.User.Role = models.Role(userRole.String)
			}
		}
		logs = append(logs, log)
	}

	return utils.Success(c, logs)
}
