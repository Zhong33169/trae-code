package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"fire-hazard-tracker/db"
	"fire-hazard-tracker/middleware"
	"fire-hazard-tracker/models"

	"github.com/go-chi/chi/v5"
)

const (
	NodeDeadlineReport  = 24 * time.Hour
	NodeDeadlineAssign  = 24 * time.Hour
	NodeDeadlineRectify = 72 * time.Hour
	NodeDeadlineRecheck = 48 * time.Hour
	NodeDeadlineConfirm = 24 * time.Hour
)

type Action string

const (
	ActionCreate    Action = "create"
	ActionAssign    Action = "assign"
	ActionRectify   Action = "rectify"
	ActionRecheck   Action = "recheck"
	ActionConfirm   Action = "confirm"
	ActionTimeout   Action = "handle_timeout"
)

type TransitionRule struct {
	AllowRoles    map[models.Role]bool
	AllowStatuses map[models.HazardStatus]bool
	AllowNodes    map[models.NodeType]bool
	FailMsg       string
}

var actionRules = map[Action]TransitionRule{
	ActionCreate: {
		AllowRoles:    map[models.Role]bool{models.RoleClerk: true},
		AllowStatuses: nil,
		AllowNodes:    nil,
		FailMsg:       "仅消防文员可上报隐患单",
	},
	ActionAssign: {
		AllowRoles:    map[models.Role]bool{models.RoleSupervisor: true},
		AllowStatuses: map[models.HazardStatus]bool{models.StatusPending: true},
		AllowNodes:    map[models.NodeType]bool{models.NodeReport: true},
		FailMsg:       "仅「待分派」状态的隐患单可转办分派",
	},
	ActionRectify: {
		AllowRoles:    map[models.Role]bool{models.RoleSupervisor: true},
		AllowStatuses: map[models.HazardStatus]bool{models.StatusAssigned: true},
		AllowNodes:    map[models.NodeType]bool{models.NodeRectify: true},
		FailMsg:       "仅「已转办-整改通知」节点可提交整改记录",
	},
	ActionRecheck: {
		AllowRoles:    map[models.Role]bool{models.RoleStationChief: true},
		AllowStatuses: map[models.HazardStatus]bool{models.StatusAssigned: true},
		AllowNodes:    map[models.NodeType]bool{models.NodeRecheck: true},
		FailMsg:       "仅「已转办-复查销项」节点可提交复查",
	},
	ActionConfirm: {
		AllowRoles:    map[models.Role]bool{models.RoleStationChief: true},
		AllowStatuses: map[models.HazardStatus]bool{models.StatusRevisited: true},
		AllowNodes:    nil,
		FailMsg:       "仅「已回访」状态的隐患单可确认完成",
	},
	ActionTimeout: {
		AllowRoles:    map[models.Role]bool{models.RoleClerk: true, models.RoleSupervisor: true, models.RoleStationChief: true},
		AllowStatuses: nil,
		AllowNodes:    nil,
		FailMsg:       "仅超时状态的隐患单可处理超时",
	},
}

func getNodeDeadline(node models.NodeType) time.Time {
	var d time.Duration
	switch node {
	case models.NodeReport:
		d = NodeDeadlineReport
	case models.NodeAssign:
		d = NodeDeadlineAssign
	case models.NodeRectify:
		d = NodeDeadlineRectify
	case models.NodeRecheck:
		d = NodeDeadlineRecheck
	case models.NodeConfirm:
		d = NodeDeadlineConfirm
	default:
		d = 24 * time.Hour
	}
	return time.Now().Add(d)
}

func checkAndMarkTimeout() error {
	now := time.Now()
	_, err := db.DB.Exec(`
		UPDATE hazard_orders SET is_timeout = 1 
		WHERE is_timeout = 0 AND (
			(current_node = 'report' AND created_at < ?) OR
			(current_node = 'assign' AND updated_at < ?) OR
			(current_node = 'rectify' AND rectify_deadline IS NOT NULL AND rectify_deadline < ?) OR
			(current_node = 'recheck' AND recheck_deadline IS NOT NULL AND recheck_deadline < ?) OR
			(current_node = 'confirm' AND updated_at < ?)
		)
	`,
		now.Add(-NodeDeadlineReport),
		now.Add(-NodeDeadlineAssign),
		now,
		now,
		now.Add(-NodeDeadlineConfirm),
	)
	return err
}

func addOperationLog(tx *sql.Tx, orderID int64, user *models.User, action string,
	fromStatus, toStatus models.HazardStatus, fromNode, toNode models.NodeType, remark string) error {
	_, err := tx.Exec(`
		INSERT INTO operation_logs (order_id, user_id, user_name, action, from_status, to_status, from_node, to_node, remark)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, orderID, user.ID, user.Name, action, fromStatus, toStatus, fromNode, toNode, remark)
	return err
}

func generateOrderNo() string {
	now := time.Now()
	var count int
	_ = db.DB.QueryRow(
		"SELECT COUNT(*) FROM hazard_orders WHERE strftime('%Y%m', created_at) = ?",
		now.Format("200601"),
	).Scan(&count)
	return fmt.Sprintf("XFA%s%04d", now.Format("200601"), count+1)
}

func buildVisibilityFilter(user *models.User) (where []string, args []interface{}) {
	switch user.Role {
	case models.RoleClerk:
		where = append(where, "reporter_id = ?")
		args = append(args, user.ID)
	case models.RoleSupervisor:
		where = append(where, "(reporter_id = ? OR supervisor_id = ? OR status IN ('pending','assigned'))")
		args = append(args, user.ID, user.ID)
	case models.RoleStationChief:
		where = append(where, "status IN ('assigned','revisited')")
	}
	return
}

func applyVisibilityWhere(user *models.User, where []string, args []interface{}) ([]string, []interface{}) {
	extraWhere, extraArgs := buildVisibilityFilter(user)
	return append(where, extraWhere...), append(args, extraArgs...)
}

func canUserViewOrder(user *models.User, order *models.HazardOrder) bool {
	switch user.Role {
	case models.RoleClerk:
		return order.ReporterID == user.ID
	case models.RoleSupervisor:
		if order.ReporterID == user.ID {
			return true
		}
		if order.SupervisorID != nil && *order.SupervisorID == user.ID {
			return true
		}
		return order.Status == models.StatusPending || order.Status == models.StatusAssigned
	case models.RoleStationChief:
		return order.Status == models.StatusAssigned || order.Status == models.StatusRevisited
	}
	return false
}

func validateAction(action Action, user *models.User, orderStatus models.HazardStatus, orderNode models.NodeType, isTimeout bool) error {
	rule, ok := actionRules[action]
	if !ok {
		return fmt.Errorf("未知操作")
	}
	if !rule.AllowRoles[user.Role] {
		return fmt.Errorf("当前岗位「%s」无此操作权限", roleText(user.Role))
	}
	if rule.AllowStatuses != nil && !rule.AllowStatuses[orderStatus] {
		return fmt.Errorf("%s（当前状态：%s）", rule.FailMsg, statusText(orderStatus))
	}
	if rule.AllowNodes != nil && !rule.AllowNodes[orderNode] {
		return fmt.Errorf("%s（当前节点：%s）", rule.FailMsg, nodeText(orderNode))
	}
	if action == ActionTimeout && !isTimeout {
		return fmt.Errorf("该隐患单当前节点未超时，无需处理")
	}
	return nil
}

func roleText(r models.Role) string {
	switch r {
	case models.RoleClerk:
		return "消防文员"
	case models.RoleSupervisor:
		return "防火监督员"
	case models.RoleStationChief:
		return "站点负责人"
	default:
		return string(r)
	}
}

func scanOrder(rows interface {
	Scan(dest ...interface{}) error
}, o *models.HazardOrder) (supervisorID, stationChiefID sql.NullInt64, rectifyDeadline, recheckDeadline sql.NullTime, err error) {
	err = rows.Scan(&o.ID, &o.OrderNo, &o.Title, &o.Description, &o.Location, &o.HazardLevel,
		&o.Status, &o.CurrentNode, &o.ReporterID, &o.ReporterName,
		&supervisorID, &o.SupervisorName, &stationChiefID, &o.StationChiefName,
		&rectifyDeadline, &recheckDeadline, &o.IsTimeout, &o.CreatedAt, &o.UpdatedAt)
	return
}

func applyNullsToOrder(o *models.HazardOrder, supervisorID, stationChiefID sql.NullInt64, rectifyDeadline, recheckDeadline sql.NullTime) {
	if supervisorID.Valid {
		id := supervisorID.Int64
		o.SupervisorID = &id
	}
	if stationChiefID.Valid {
		id := stationChiefID.Int64
		o.StationChiefID = &id
	}
	if rectifyDeadline.Valid {
		t := rectifyDeadline.Time
		o.RectifyDeadline = &t
	}
	if recheckDeadline.Valid {
		t := recheckDeadline.Time
		o.RecheckDeadline = &t
	}
}

const orderSelectSQL = `
	SELECT id, order_no, title, description, location, hazard_level, status, current_node,
		reporter_id, reporter_name, supervisor_id, supervisor_name, station_chief_id, station_chief_name,
		rectify_deadline, recheck_deadline, is_timeout, created_at, updated_at
	FROM hazard_orders
`

func ListHazardOrders(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if err := checkAndMarkTimeout(); err != nil {
		writeError(w, http.StatusInternalServerError, "超时检查失败", "列表数据可能不完整")
		return
	}

	status := r.URL.Query().Get("status")
	keyword := r.URL.Query().Get("keyword")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	size, _ := strconv.Atoi(r.URL.Query().Get("size"))
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 10
	}

	var where []string
	var args []interface{}
	where, args = applyVisibilityWhere(user, where, args)

	if status != "" && status != "all" {
		switch models.HazardStatus(status) {
		case models.StatusPending, models.StatusAssigned, models.StatusRevisited:
			where = append(where, "status = ?")
			args = append(args, status)
		default:
			writeError(w, http.StatusBadRequest, "状态筛选值无效", fmt.Sprintf("合法值: pending/assigned/revisited，收到: %s", status))
			return
		}
	}

	if keyword != "" {
		if len(keyword) > 50 {
			writeError(w, http.StatusBadRequest, "搜索关键字过长", "最多50个字符")
			return
		}
		where = append(where, "(order_no LIKE ? OR title LIKE ? OR location LIKE ?)")
		kw := "%" + keyword + "%"
		args = append(args, kw, kw, kw)
	}

	whereSQL := ""
	if len(where) > 0 {
		whereSQL = "WHERE " + strings.Join(where, " AND ")
	}

	var total int64
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM hazard_orders %s", whereSQL)
	if err := db.DB.QueryRow(countSQL, args...).Scan(&total); err != nil {
		writeError(w, http.StatusInternalServerError, "统计隐患单数量失败")
		return
	}

	querySQL := fmt.Sprintf("%s %s ORDER BY is_timeout DESC, created_at DESC LIMIT ? OFFSET ?", orderSelectSQL, whereSQL)
	args = append(args, size, (page-1)*size)

	rows, err := db.DB.Query(querySQL, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询隐患单列表失败", err.Error())
		return
	}
	defer rows.Close()

	orders := make([]*models.HazardOrder, 0)
	for rows.Next() {
		o := &models.HazardOrder{}
		var sid, scid sql.NullInt64
		var rd, rcd sql.NullTime
		if _, _, _, _, err := scanOrder(rows, o); err != nil {
			continue
		}
		applyNullsToOrder(o, sid, scid, rd, rcd)
		orders = append(orders, o)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"list":  orders,
		"total": total,
		"page":  page,
		"size":  size,
	})
}

func GetHazardOrder(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "隐患单ID格式错误", fmt.Sprintf("期望整数，收到: %s", idStr))
		return
	}

	if err := checkAndMarkTimeout(); err != nil {
		writeError(w, http.StatusInternalServerError, "超时检查失败")
		return
	}

	o := &models.HazardOrder{}
	var supervisorID, stationChiefID sql.NullInt64
	var rectifyDeadline, recheckDeadline sql.NullTime

	err = db.DB.QueryRow(fmt.Sprintf("%s WHERE id = ?", orderSelectSQL), id).Scan(
		&o.ID, &o.OrderNo, &o.Title, &o.Description, &o.Location, &o.HazardLevel,
		&o.Status, &o.CurrentNode, &o.ReporterID, &o.ReporterName,
		&supervisorID, &o.SupervisorName, &stationChiefID, &o.StationChiefName,
		&rectifyDeadline, &recheckDeadline, &o.IsTimeout, &o.CreatedAt, &o.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "隐患单不存在", fmt.Sprintf("ID=%d", id))
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询隐患单详情失败", err.Error())
		return
	}
	applyNullsToOrder(o, supervisorID, stationChiefID, rectifyDeadline, recheckDeadline)

	if !canUserViewOrder(user, o) {
		writeError(w, http.StatusForbidden,
			fmt.Sprintf("当前岗位「%s」无权查看该隐患单（单号：%s，状态：%s）",
				roleText(user.Role), o.OrderNo, statusText(o.Status)))
		return
	}

	reports := make([]*models.HazardReport, 0)
	rows, _ := db.DB.Query(`
		SELECT id, order_id, reporter_id, content, images, node_deadline, created_at
		FROM hazard_reports WHERE order_id = ? ORDER BY id DESC
	`, id)
	if rows != nil {
		for rows.Next() {
			rp := &models.HazardReport{}
			rows.Scan(&rp.ID, &rp.OrderID, &rp.ReporterID, &rp.Content, &rp.Images, &rp.NodeDeadline, &rp.CreatedAt)
			reports = append(reports, rp)
		}
		rows.Close()
	}

	notices := make([]*models.RectificationNotice, 0)
	rows, _ = db.DB.Query(`
		SELECT id, order_id, issuer_id, content, deadline, node_deadline, created_at
		FROM rectification_notices WHERE order_id = ? ORDER BY id DESC
	`, id)
	if rows != nil {
		for rows.Next() {
			n := &models.RectificationNotice{}
			rows.Scan(&n.ID, &n.OrderID, &n.IssuerID, &n.Content, &n.Deadline, &n.NodeDeadline, &n.CreatedAt)
			notices = append(notices, n)
		}
		rows.Close()
	}

	rectRecords := make([]*models.RectificationRecord, 0)
	rows, _ = db.DB.Query(`
		SELECT id, order_id, submitter_id, content, images, submitted_at
		FROM rectification_records WHERE order_id = ? ORDER BY id DESC
	`, id)
	if rows != nil {
		for rows.Next() {
			rr := &models.RectificationRecord{}
			rows.Scan(&rr.ID, &rr.OrderID, &rr.SubmitterID, &rr.Content, &rr.Images, &rr.SubmittedAt)
			rectRecords = append(rectRecords, rr)
		}
		rows.Close()
	}

	rechecks := make([]*models.RecheckRecord, 0)
	rows, _ = db.DB.Query(`
		SELECT id, order_id, checker_id, content, result, images, node_deadline, checked_at
		FROM recheck_records WHERE order_id = ? ORDER BY id DESC
	`, id)
	if rows != nil {
		for rows.Next() {
			rc := &models.RecheckRecord{}
			rows.Scan(&rc.ID, &rc.OrderID, &rc.CheckerID, &rc.Content, &rc.Result, &rc.Images, &rc.NodeDeadline, &rc.CheckedAt)
			rechecks = append(rechecks, rc)
		}
		rows.Close()
	}

	timeouts := make([]*models.TimeoutRecord, 0)
	rows, _ = db.DB.Query(`
		SELECT id, order_id, node_type, timeout_reason, handle_action, handler_id, handler_name,
			original_deadline, new_deadline, created_at
		FROM timeout_records WHERE order_id = ? ORDER BY id DESC
	`, id)
	if rows != nil {
		for rows.Next() {
			t := &models.TimeoutRecord{}
			var newDeadline sql.NullTime
			rows.Scan(&t.ID, &t.OrderID, &t.NodeType, &t.TimeoutReason, &t.HandleAction,
				&t.HandlerID, &t.HandlerName, &t.OriginalDeadline, &newDeadline, &t.CreatedAt)
			if newDeadline.Valid {
				nd := newDeadline.Time
				t.NewDeadline = &nd
			}
			timeouts = append(timeouts, t)
		}
		rows.Close()
	}

	logs := make([]*models.OperationLog, 0)
	rows, _ = db.DB.Query(`
		SELECT id, order_id, user_id, user_name, action, from_status, to_status, from_node, to_node, remark, created_at
		FROM operation_logs WHERE order_id = ? ORDER BY id DESC
	`, id)
	if rows != nil {
		for rows.Next() {
			l := &models.OperationLog{}
			rows.Scan(&l.ID, &l.OrderID, &l.UserID, &l.UserName, &l.Action,
				&l.FromStatus, &l.ToStatus, &l.FromNode, &l.ToNode, &l.Remark, &l.CreatedAt)
			logs = append(logs, l)
		}
		rows.Close()
	}

	allowedActions := []string{}
	if err := validateAction(ActionAssign, user, o.Status, o.CurrentNode, o.IsTimeout); err == nil {
		allowedActions = append(allowedActions, "assign")
	}
	if err := validateAction(ActionRectify, user, o.Status, o.CurrentNode, o.IsTimeout); err == nil {
		allowedActions = append(allowedActions, "rectify")
	}
	if err := validateAction(ActionRecheck, user, o.Status, o.CurrentNode, o.IsTimeout); err == nil {
		allowedActions = append(allowedActions, "recheck")
	}
	if err := validateAction(ActionConfirm, user, o.Status, o.CurrentNode, o.IsTimeout); err == nil {
		allowedActions = append(allowedActions, "confirm")
	}
	if err := validateAction(ActionTimeout, user, o.Status, o.CurrentNode, o.IsTimeout); err == nil {
		allowedActions = append(allowedActions, "handle_timeout")
	}

	actionDenials := map[string]string{}
	for _, a := range []string{"assign", "rectify", "recheck", "confirm", "handle_timeout"} {
		act := Action(a)
		if er := validateAction(act, user, o.Status, o.CurrentNode, o.IsTimeout); er != nil {
			actionDenials[a] = er.Error()
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"order":                   o,
		"reports":                 reports,
		"rectification_notices":   notices,
		"rectification_records":   rectRecords,
		"recheck_records":         rechecks,
		"timeout_records":         timeouts,
		"operation_logs":          logs,
		"allowed_actions":         allowedActions,
		"action_denial_reasons":   actionDenials,
		"role":                    user.Role,
	})
}

func CreateHazardOrder(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Location    string `json:"location"`
		HazardLevel string `json:"hazard_level"`
		Content     string `json:"content"`
		Images      string `json:"images"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数格式错误", err.Error())
		return
	}

	if err := validateAction(ActionCreate, user, "", "", false); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	if strings.TrimSpace(req.Title) == "" {
		writeError(w, http.StatusBadRequest, "隐患标题不能为空", "请填写简要的隐患标题")
		return
	}
	if len(strings.TrimSpace(req.Title)) > 100 {
		writeError(w, http.StatusBadRequest, "隐患标题过长", "最多100个字符")
		return
	}
	if strings.TrimSpace(req.Location) == "" {
		writeError(w, http.StatusBadRequest, "隐患地点不能为空", "请填写隐患所在的具体地点")
		return
	}
	if strings.TrimSpace(req.Content) == "" {
		writeError(w, http.StatusBadRequest, "上报内容不能为空", "请详细描述隐患情况")
		return
	}
	switch req.HazardLevel {
	case "general", "high", "critical":
	default:
		req.HazardLevel = "general"
	}

	tx, err := db.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "启动事务失败", err.Error())
		return
	}
	defer tx.Rollback()

	orderNo := generateOrderNo()
	nodeDeadline := getNodeDeadline(models.NodeReport)

	result, err := tx.Exec(`
		INSERT INTO hazard_orders 
		(order_no, title, description, location, hazard_level, status, current_node,
		 reporter_id, reporter_name, is_timeout, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 'pending', 'report', ?, ?, 0, ?, ?)
	`, orderNo, req.Title, req.Description, req.Location, req.HazardLevel,
		user.ID, user.Name, time.Now(), time.Now())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建隐患单失败", err.Error())
		return
	}

	orderID, _ := result.LastInsertId()

	_, err = tx.Exec(`
		INSERT INTO hazard_reports (order_id, reporter_id, content, images, node_deadline, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, orderID, user.ID, req.Content, req.Images, nodeDeadline, time.Now())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存上报记录失败", err.Error())
		return
	}

	if err = addOperationLog(tx, orderID, user, "隐患上报", "", models.StatusPending, "", models.NodeReport, req.Title); err != nil {
		writeError(w, http.StatusInternalServerError, "记录操作日志失败", err.Error())
		return
	}

	if err = tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "提交事务失败", err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":       orderID,
		"order_no": orderNo,
		"status":   "pending",
		"message":  "隐患单创建成功，状态为待分派",
	})
}

func AssignHazardOrder(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "隐患单ID格式错误")
		return
	}

	var req struct {
		Remark  string `json:"remark"`
		Content string `json:"content"`
		Days    int    `json:"days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数格式错误", err.Error())
		return
	}
	if req.Days <= 0 {
		req.Days = 7
	}
	if req.Days > 90 {
		writeError(w, http.StatusBadRequest, "整改期限过长", "整改期限最长90天")
		return
	}
	if strings.TrimSpace(req.Content) == "" {
		writeError(w, http.StatusBadRequest, "整改通知内容不能为空", "请明确整改要求和期限")
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "启动事务失败")
		return
	}
	defer tx.Rollback()

	var curStatus models.HazardStatus
	var curNode models.NodeType
	var isTimeout bool
	var orderNo string
	err = tx.QueryRow("SELECT status, current_node, is_timeout, order_no FROM hazard_orders WHERE id = ?", id).Scan(&curStatus, &curNode, &isTimeout, &orderNo)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "隐患单不存在", fmt.Sprintf("ID=%d", id))
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询隐患单状态失败")
		return
	}

	if err := validateAction(ActionAssign, user, curStatus, curNode, isTimeout); err != nil {
		writeError(w, http.StatusBadRequest, err.Error(), fmt.Sprintf("单号：%s", orderNo))
		return
	}

	rectifyDeadline := time.Now().AddDate(0, 0, req.Days)
	nodeDeadline := getNodeDeadline(models.NodeRectify)

	_, err = tx.Exec(`
		UPDATE hazard_orders SET 
			status = 'assigned', current_node = 'rectify',
			supervisor_id = ?, supervisor_name = ?,
			rectify_deadline = ?, updated_at = ?
		WHERE id = ?
	`, user.ID, user.Name, rectifyDeadline, time.Now(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "更新隐患单状态失败", err.Error())
		return
	}

	_, err = tx.Exec(`
		INSERT INTO rectification_notices (order_id, issuer_id, content, deadline, node_deadline, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, user.ID, req.Content, rectifyDeadline, nodeDeadline, time.Now())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存整改通知失败", err.Error())
		return
	}

	if err = addOperationLog(tx, id, user, "转办分派", models.StatusPending, models.StatusAssigned,
		models.NodeReport, models.NodeRectify, req.Remark); err != nil {
		writeError(w, http.StatusInternalServerError, "记录操作日志失败", err.Error())
		return
	}

	if err = tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "提交事务失败", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":      id,
		"order_no": orderNo,
		"status":  "assigned",
		"node":    "rectify",
		"message": "转办成功，已下发整改通知，整改截止" + rectifyDeadline.Format("2006-01-02"),
	})
}

func SubmitRectification(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "隐患单ID格式错误")
		return
	}

	var req struct {
		Content string `json:"content"`
		Images  string `json:"images"`
		Remark  string `json:"remark"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数格式错误", err.Error())
		return
	}
	if strings.TrimSpace(req.Content) == "" {
		writeError(w, http.StatusBadRequest, "整改内容不能为空", "请描述整改措施和完成情况")
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "启动事务失败")
		return
	}
	defer tx.Rollback()

	var curStatus models.HazardStatus
	var curNode models.NodeType
	var isTimeout bool
	var orderNo string
	err = tx.QueryRow("SELECT status, current_node, is_timeout, order_no FROM hazard_orders WHERE id = ?", id).Scan(&curStatus, &curNode, &isTimeout, &orderNo)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "隐患单不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询隐患单状态失败")
		return
	}

	if err := validateAction(ActionRectify, user, curStatus, curNode, isTimeout); err != nil {
		writeError(w, http.StatusBadRequest, err.Error(), fmt.Sprintf("单号：%s", orderNo))
		return
	}

	recheckDeadline := time.Now().AddDate(0, 0, 5)

	_, err = tx.Exec(`
		UPDATE hazard_orders SET current_node = 'recheck', recheck_deadline = ?, updated_at = ? WHERE id = ?
	`, recheckDeadline, time.Now(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "更新节点失败", err.Error())
		return
	}

	_, err = tx.Exec(`
		INSERT INTO rectification_records (order_id, submitter_id, content, images, submitted_at)
		VALUES (?, ?, ?, ?, ?)
	`, id, user.ID, req.Content, req.Images, time.Now())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存整改记录失败", err.Error())
		return
	}

	if err = addOperationLog(tx, id, user, "提交整改", curStatus, curStatus,
		models.NodeRectify, models.NodeRecheck, req.Remark); err != nil {
		writeError(w, http.StatusInternalServerError, "记录操作日志失败", err.Error())
		return
	}

	if err = tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "提交事务失败", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":           id,
		"order_no":     orderNo,
		"status":       string(curStatus),
		"current_node": "recheck",
		"message":      "整改记录已提交，进入复查销项节点",
	})
}

func SubmitRecheck(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "隐患单ID格式错误")
		return
	}

	var req struct {
		Content string `json:"content"`
		Result  string `json:"result"`
		Images  string `json:"images"`
		Remark  string `json:"remark"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数格式错误", err.Error())
		return
	}
	if strings.TrimSpace(req.Content) == "" {
		writeError(w, http.StatusBadRequest, "复查内容不能为空", "请描述现场复查情况")
		return
	}
	if req.Result != "pass" && req.Result != "fail" {
		writeError(w, http.StatusBadRequest, "复查结果无效", fmt.Sprintf("合法值: pass/fail，收到: %s", req.Result))
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "启动事务失败")
		return
	}
	defer tx.Rollback()

	var curStatus models.HazardStatus
	var curNode models.NodeType
	var isTimeout bool
	var orderNo string
	err = tx.QueryRow("SELECT status, current_node, is_timeout, order_no FROM hazard_orders WHERE id = ?", id).Scan(&curStatus, &curNode, &isTimeout, &orderNo)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "隐患单不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询隐患单状态失败")
		return
	}

	if err := validateAction(ActionRecheck, user, curStatus, curNode, isTimeout); err != nil {
		writeError(w, http.StatusBadRequest, err.Error(), fmt.Sprintf("单号：%s", orderNo))
		return
	}

	nodeDeadline := getNodeDeadline(models.NodeConfirm)

	_, err = tx.Exec(`
		UPDATE hazard_orders SET 
			status = 'revisited', current_node = 'confirm',
			station_chief_id = ?, station_chief_name = ?, updated_at = ?
		WHERE id = ?
	`, user.ID, user.Name, time.Now(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "更新隐患单状态失败", err.Error())
		return
	}

	_, err = tx.Exec(`
		INSERT INTO recheck_records (order_id, checker_id, content, result, images, node_deadline, checked_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, id, user.ID, req.Content, req.Result, req.Images, nodeDeadline, time.Now())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存复查记录失败", err.Error())
		return
	}

	resultText := map[string]string{"pass": "复查通过", "fail": "复查不通过，需重新整改"}[req.Result]
	fullRemark := resultText
	if req.Remark != "" {
		fullRemark += "；" + req.Remark
	}
	if err = addOperationLog(tx, id, user, "复查回访", models.StatusAssigned, models.StatusRevisited,
		models.NodeRecheck, models.NodeConfirm, fullRemark); err != nil {
		writeError(w, http.StatusInternalServerError, "记录操作日志失败", err.Error())
		return
	}

	if err = tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "提交事务失败", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":         id,
		"order_no":   orderNo,
		"status":     "revisited",
		"node":       "confirm",
		"recheck_result": req.Result,
		"message":    fmt.Sprintf("回访完成，状态已更新为已回访（复查结果：%s）", resultText),
	})
}

func ConfirmComplete(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "隐患单ID格式错误")
		return
	}

	var req struct {
		Remark string `json:"remark"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Remark = ""
	}

	tx, err := db.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "启动事务失败")
		return
	}
	defer tx.Rollback()

	var curStatus models.HazardStatus
	var curNode models.NodeType
	var isTimeout bool
	var orderNo string
	err = tx.QueryRow("SELECT status, current_node, is_timeout, order_no FROM hazard_orders WHERE id = ?", id).Scan(&curStatus, &curNode, &isTimeout, &orderNo)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "隐患单不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询隐患单状态失败")
		return
	}

	if err := validateAction(ActionConfirm, user, curStatus, curNode, isTimeout); err != nil {
		writeError(w, http.StatusBadRequest, err.Error(), fmt.Sprintf("单号：%s", orderNo))
		return
	}

	_, err = tx.Exec(`
		UPDATE hazard_orders SET current_node = 'confirm', updated_at = ? WHERE id = ?
	`, time.Now(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "更新节点失败", err.Error())
		return
	}

	if err = addOperationLog(tx, id, user, "确认完成", curStatus, curStatus,
		curNode, models.NodeConfirm, req.Remark); err != nil {
		writeError(w, http.StatusInternalServerError, "记录操作日志失败", err.Error())
		return
	}

	if err = tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "提交事务失败", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":       id,
		"order_no": orderNo,
		"status":   string(curStatus),
		"node":     "confirm",
		"message":  "已确认完成，隐患单闭环",
	})
}

func HandleTimeout(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "隐患单ID格式错误")
		return
	}

	var req struct {
		TimeoutReason string `json:"timeout_reason"`
		HandleAction  string `json:"handle_action"`
		AddDays       int    `json:"add_days"`
		Remark        string `json:"remark"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数格式错误", err.Error())
		return
	}
	if strings.TrimSpace(req.TimeoutReason) == "" {
		writeError(w, http.StatusBadRequest, "超时原因不能为空", "请如实填写超时发生的原因")
		return
	}
	if strings.TrimSpace(req.HandleAction) == "" {
		writeError(w, http.StatusBadRequest, "处理措施不能为空", "请说明后续采取的处理措施")
		return
	}
	if req.AddDays < 0 || req.AddDays > 30 {
		writeError(w, http.StatusBadRequest, "顺延天数无效", "范围0-30天，0表示不顺延")
		return
	}

	if err := checkAndMarkTimeout(); err != nil {
		writeError(w, http.StatusInternalServerError, "超时标记检查失败")
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "启动事务失败")
		return
	}
	defer tx.Rollback()

	var curStatus models.HazardStatus
	var curNode models.NodeType
	var isTimeout bool
	var originalDeadline time.Time
	var orderNo string
	err = tx.QueryRow(`
		SELECT status, current_node, is_timeout, order_no,
			CASE 
				WHEN current_node = 'rectify' THEN COALESCE(rectify_deadline, updated_at)
				WHEN current_node = 'recheck' THEN COALESCE(recheck_deadline, updated_at)
				ELSE updated_at
			END
		FROM hazard_orders WHERE id = ?
	`, id).Scan(&curStatus, &curNode, &isTimeout, &orderNo, &originalDeadline)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "隐患单不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询隐患单失败")
		return
	}

	if err := validateAction(ActionTimeout, user, curStatus, curNode, isTimeout); err != nil {
		writeError(w, http.StatusBadRequest, err.Error(), fmt.Sprintf("单号：%s", orderNo))
		return
	}

	var newDeadline *time.Time
	if req.AddDays > 0 {
		nd := time.Now().AddDate(0, 0, req.AddDays)
		newDeadline = &nd

		switch curNode {
		case models.NodeRectify:
			_, err = tx.Exec("UPDATE hazard_orders SET rectify_deadline = ?, is_timeout = 0, updated_at = ? WHERE id = ?", nd, time.Now(), id)
		case models.NodeRecheck:
			_, err = tx.Exec("UPDATE hazard_orders SET recheck_deadline = ?, is_timeout = 0, updated_at = ? WHERE id = ?", nd, time.Now(), id)
		default:
			_, err = tx.Exec("UPDATE hazard_orders SET is_timeout = 0, updated_at = ? WHERE id = ?", time.Now(), id)
		}
	} else {
		_, err = tx.Exec("UPDATE hazard_orders SET is_timeout = 0, updated_at = ? WHERE id = ?", time.Now(), id)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "更新隐患单超时标记失败", err.Error())
		return
	}

	var newDeadlineVal interface{}
	if newDeadline != nil {
		newDeadlineVal = *newDeadline
	}

	_, err = tx.Exec(`
		INSERT INTO timeout_records 
		(order_id, node_type, timeout_reason, handle_action, handler_id, handler_name, original_deadline, new_deadline, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, curNode, req.TimeoutReason, req.HandleAction, user.ID, user.Name, originalDeadline, newDeadlineVal, time.Now())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存超时处理记录失败（原因、措施已写入事务）", err.Error())
		return
	}

	remark := fmt.Sprintf("原因:%s；措施:%s", req.TimeoutReason, req.HandleAction)
	if req.AddDays > 0 {
		remark += fmt.Sprintf("；顺延%d天", req.AddDays)
	}
	if req.Remark != "" {
		remark += "；" + req.Remark
	}
	if err = addOperationLog(tx, id, user, "超时处理", curStatus, curStatus,
		curNode, curNode, remark); err != nil {
		writeError(w, http.StatusInternalServerError, "记录操作日志失败", err.Error())
		return
	}

	if err = tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "提交事务失败", err.Error())
		return
	}

	msg := "超时处理记录已保存"
	if req.AddDays > 0 {
		msg += fmt.Sprintf("，节点时限已顺延%d天", req.AddDays)
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":          id,
		"order_no":    orderNo,
		"status":      string(curStatus),
		"node":        string(curNode),
		"is_timeout":  false,
		"message":     msg,
	})
}

func GetStatistics(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if err := checkAndMarkTimeout(); err != nil {
		writeError(w, http.StatusInternalServerError, "超时检查失败")
		return
	}

	var where []string
	var args []interface{}
	where, args = applyVisibilityWhere(user, where, args)

	whereSQL := ""
	if len(where) > 0 {
		whereSQL = "WHERE " + strings.Join(where, " AND ")
	}

	var total, pending, assigned, revisited, timeoutCount, thisMonth int64

	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM hazard_orders %s", whereSQL)
	if err := db.DB.QueryRow(countSQL, args...).Scan(&total); err != nil {
		writeError(w, http.StatusInternalServerError, "统计总数失败", err.Error())
		return
	}

	if total > 0 {
		mainArgs := append([]interface{}{}, args...)
		pendingSQL := fmt.Sprintf("SELECT COUNT(*) FROM hazard_orders %s AND status = 'pending'", addAndToWhere(whereSQL))
		_ = db.DB.QueryRow(pendingSQL, mainArgs...).Scan(&pending)

		mainArgs = append([]interface{}{}, args...)
		assignedSQL := fmt.Sprintf("SELECT COUNT(*) FROM hazard_orders %s AND status = 'assigned'", addAndToWhere(whereSQL))
		_ = db.DB.QueryRow(assignedSQL, mainArgs...).Scan(&assigned)

		mainArgs = append([]interface{}{}, args...)
		revisitedSQL := fmt.Sprintf("SELECT COUNT(*) FROM hazard_orders %s AND status = 'revisited'", addAndToWhere(whereSQL))
		_ = db.DB.QueryRow(revisitedSQL, mainArgs...).Scan(&revisited)

		mainArgs = append([]interface{}{}, args...)
		timeoutSQL := fmt.Sprintf("SELECT COUNT(*) FROM hazard_orders %s AND is_timeout = 1", addAndToWhere(whereSQL))
		_ = db.DB.QueryRow(timeoutSQL, mainArgs...).Scan(&timeoutCount)

		mainArgs = append([]interface{}{}, args...)
		mainArgs = append(mainArgs, time.Now().Format("2006-01"))
		monthSQL := fmt.Sprintf("SELECT COUNT(*) FROM hazard_orders %s AND strftime('%%Y-%%m', created_at) = ?", addAndToWhere(whereSQL))
		_ = db.DB.QueryRow(monthSQL, mainArgs...).Scan(&thisMonth)
	}

	stats := models.Statistics{
		Total:     total,
		Pending:   pending,
		Assigned:  assigned,
		Revisited: revisited,
		Timeout:   timeoutCount,
		ThisMonth: thisMonth,
	}

	var nodeStats []map[string]interface{}
	if len(where) > 0 {
		nodeWhere := "WHERE " + strings.Join(where, " AND ")
		nodeArgs := append([]interface{}{}, args...)
		nodeRows, _ := db.DB.Query(fmt.Sprintf(`
			SELECT 
				current_node as node,
				COUNT(*) as count,
				SUM(CASE WHEN is_timeout = 1 THEN 1 ELSE 0 END) as timeout_count
			FROM hazard_orders %s
			GROUP BY current_node
			ORDER BY current_node
		`, nodeWhere), nodeArgs...)
		if nodeRows != nil {
			for nodeRows.Next() {
				var node string
				var count, tc int64
				nodeRows.Scan(&node, &count, &tc)
				nodeStats = append(nodeStats, map[string]interface{}{
					"node":          node,
					"node_text":     nodeText(models.NodeType(node)),
					"count":         count,
					"timeout_count": tc,
				})
			}
			nodeRows.Close()
		}
	} else {
		rows, _ := db.DB.Query(`
			SELECT 
				current_node as node,
				COUNT(*) as count,
				SUM(CASE WHEN is_timeout = 1 THEN 1 ELSE 0 END) as timeout_count
			FROM hazard_orders
			GROUP BY current_node
			ORDER BY current_node
		`)
		if rows != nil {
			for rows.Next() {
				var node string
				var count, tc int64
				rows.Scan(&node, &count, &tc)
				nodeStats = append(nodeStats, map[string]interface{}{
					"node":          node,
					"node_text":     nodeText(models.NodeType(node)),
					"count":         count,
					"timeout_count": tc,
				})
			}
			rows.Close()
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"summary":    stats,
		"node_stats": nodeStats,
		"role":       user.Role,
	})
}

func BatchGetStatus(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())

	var req struct {
		IDs []int64 `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数格式错误", err.Error())
		return
	}
	if len(req.IDs) == 0 {
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": []interface{}{}})
		return
	}
	if len(req.IDs) > 200 {
		writeError(w, http.StatusBadRequest, "批量查询数量过多", "最多200条")
		return
	}

	if err := checkAndMarkTimeout(); err != nil {
		writeError(w, http.StatusInternalServerError, "超时检查失败")
		return
	}

	var filterWhere []string
	var filterArgs []interface{}
	filterWhere, filterArgs = applyVisibilityWhere(user, filterWhere, filterArgs)

	placeholders := strings.Repeat("?,", len(req.IDs))
	placeholders = placeholders[:len(placeholders)-1]

	args := make([]interface{}, len(req.IDs))
	for i, id := range req.IDs {
		args[i] = id
	}
	args = append(args, filterArgs...)

	filterWhere = append(filterWhere, fmt.Sprintf("id IN (%s)", placeholders))
	argsOrder := append(filterArgs, args[:len(req.IDs)]...)

	whereSQL := "WHERE " + strings.Join(filterWhere, " AND ")

	querySQL := fmt.Sprintf(`
		SELECT id, order_no, status, current_node, is_timeout, updated_at, reporter_id, supervisor_id, station_chief_id
		FROM hazard_orders %s
	`, whereSQL)

	rows, err := db.DB.Query(querySQL, argsOrder...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "批量查询失败", err.Error())
		return
	}
	defer rows.Close()

	items := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id int64
		var orderNo string
		var status models.HazardStatus
		var node models.NodeType
		var isTimeout bool
		var updatedAt time.Time
		var reporterID int64
		var supervisorID, stationChiefID sql.NullInt64
		rows.Scan(&id, &orderNo, &status, &node, &isTimeout, &updatedAt, &reporterID, &supervisorID, &stationChiefID)
		items = append(items, map[string]interface{}{
			"id":           id,
			"order_no":     orderNo,
			"status":       status,
			"status_text":  statusText(status),
			"current_node": node,
			"node_text":    nodeText(node),
			"is_timeout":   isTimeout,
			"updated_at":   updatedAt,
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"items": items, "role": user.Role})
}

func addAndToWhere(w string) string {
	if w == "" {
		return "WHERE"
	}
	return w + " AND"
}

func statusText(s models.HazardStatus) string {
	switch s {
	case models.StatusPending:
		return "待分派"
	case models.StatusAssigned:
		return "已转办"
	case models.StatusRevisited:
		return "已回访"
	default:
		return string(s)
	}
}

func nodeText(n models.NodeType) string {
	switch n {
	case models.NodeReport:
		return "隐患上报"
	case models.NodeAssign:
		return "分派转办"
	case models.NodeRectify:
		return "整改通知"
	case models.NodeRecheck:
		return "复查销项"
	case models.NodeConfirm:
		return "确认完成"
	default:
		return string(n)
	}
}
