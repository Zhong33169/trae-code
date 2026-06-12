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

func ListHazardOrders(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if err := checkAndMarkTimeout(); err != nil {
		writeError(w, http.StatusInternalServerError, "超时检查失败")
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

	if status != "" && status != "all" {
		where = append(where, "status = ?")
		args = append(args, status)
	}

	if keyword != "" {
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

	querySQL := fmt.Sprintf(`
		SELECT id, order_no, title, description, location, hazard_level, status, current_node,
			reporter_id, reporter_name, supervisor_id, supervisor_name, station_chief_id, station_chief_name,
			rectify_deadline, recheck_deadline, is_timeout, created_at, updated_at
		FROM hazard_orders %s
		ORDER BY is_timeout DESC, created_at DESC
		LIMIT ? OFFSET ?
	`, whereSQL)
	args = append(args, size, (page-1)*size)

	rows, err := db.DB.Query(querySQL, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询隐患单列表失败")
		return
	}
	defer rows.Close()

	orders := make([]*models.HazardOrder, 0)
	for rows.Next() {
		o := &models.HazardOrder{}
		var supervisorID, stationChiefID sql.NullInt64
		var rectifyDeadline, recheckDeadline sql.NullTime
		err := rows.Scan(&o.ID, &o.OrderNo, &o.Title, &o.Description, &o.Location, &o.HazardLevel,
			&o.Status, &o.CurrentNode, &o.ReporterID, &o.ReporterName,
			&supervisorID, &o.SupervisorName, &stationChiefID, &o.StationChiefName,
			&rectifyDeadline, &recheckDeadline, &o.IsTimeout, &o.CreatedAt, &o.UpdatedAt)
		if err != nil {
			continue
		}
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
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "隐患单ID格式错误")
		return
	}

	if err := checkAndMarkTimeout(); err != nil {
		writeError(w, http.StatusInternalServerError, "超时检查失败")
		return
	}

	o := &models.HazardOrder{}
	var supervisorID, stationChiefID sql.NullInt64
	var rectifyDeadline, recheckDeadline sql.NullTime

	err = db.DB.QueryRow(`
		SELECT id, order_no, title, description, location, hazard_level, status, current_node,
			reporter_id, reporter_name, supervisor_id, supervisor_name, station_chief_id, station_chief_name,
			rectify_deadline, recheck_deadline, is_timeout, created_at, updated_at
		FROM hazard_orders WHERE id = ?
	`, id).Scan(&o.ID, &o.OrderNo, &o.Title, &o.Description, &o.Location, &o.HazardLevel,
		&o.Status, &o.CurrentNode, &o.ReporterID, &o.ReporterName,
		&supervisorID, &o.SupervisorName, &stationChiefID, &o.StationChiefName,
		&rectifyDeadline, &recheckDeadline, &o.IsTimeout, &o.CreatedAt, &o.UpdatedAt)

	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "隐患单不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询隐患单详情失败")
		return
	}

	if supervisorID.Valid {
		sid := supervisorID.Int64
		o.SupervisorID = &sid
	}
	if stationChiefID.Valid {
		sid := stationChiefID.Int64
		o.StationChiefID = &sid
	}
	if rectifyDeadline.Valid {
		t := rectifyDeadline.Time
		o.RectifyDeadline = &t
	}
	if recheckDeadline.Valid {
		t := recheckDeadline.Time
		o.RecheckDeadline = &t
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

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"order":              o,
		"reports":            reports,
		"rectification_notices": notices,
		"rectification_records": rectRecords,
		"recheck_records":    rechecks,
		"timeout_records":    timeouts,
		"operation_logs":     logs,
	})
}

func CreateHazardOrder(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user.Role != models.RoleClerk {
		writeError(w, http.StatusForbidden, "仅消防文员可上报隐患单")
		return
	}

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Location    string `json:"location"`
		HazardLevel string `json:"hazard_level"`
		Content     string `json:"content"`
		Images      string `json:"images"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数格式错误")
		return
	}

	if strings.TrimSpace(req.Title) == "" {
		writeError(w, http.StatusBadRequest, "隐患标题不能为空")
		return
	}
	if strings.TrimSpace(req.Location) == "" {
		writeError(w, http.StatusBadRequest, "隐患地点不能为空")
		return
	}
	if strings.TrimSpace(req.Content) == "" {
		writeError(w, http.StatusBadRequest, "上报内容不能为空")
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "启动事务失败")
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
		writeError(w, http.StatusInternalServerError, "创建隐患单失败")
		return
	}

	orderID, _ := result.LastInsertId()

	_, err = tx.Exec(`
		INSERT INTO hazard_reports (order_id, reporter_id, content, images, node_deadline, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, orderID, user.ID, req.Content, req.Images, nodeDeadline, time.Now())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存上报记录失败")
		return
	}

	if err = addOperationLog(tx, orderID, user, "隐患上报", "", models.StatusPending, "", models.NodeReport, req.Title); err != nil {
		writeError(w, http.StatusInternalServerError, "记录操作日志失败")
		return
	}

	if err = tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":       orderID,
		"order_no": orderNo,
		"message":  "隐患单创建成功，状态为待分派",
	})
}

func AssignHazardOrder(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user.Role != models.RoleSupervisor {
		writeError(w, http.StatusForbidden, "仅防火监督员可分派转办")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "隐患单ID格式错误")
		return
	}

	var req struct {
		Remark   string `json:"remark"`
		Content  string `json:"content"`
		Days     int    `json:"days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数格式错误")
		return
	}
	if req.Days <= 0 {
		req.Days = 7
	}
	if strings.TrimSpace(req.Content) == "" {
		writeError(w, http.StatusBadRequest, "整改通知内容不能为空")
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
	err = tx.QueryRow("SELECT status, current_node FROM hazard_orders WHERE id = ?", id).Scan(&curStatus, &curNode)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "隐患单不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询隐患单状态失败")
		return
	}
	if curStatus != models.StatusPending {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("当前状态为「%s」，仅「待分派」状态可转办", statusText(curStatus)))
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
		writeError(w, http.StatusInternalServerError, "更新隐患单状态失败")
		return
	}

	_, err = tx.Exec(`
		INSERT INTO rectification_notices (order_id, issuer_id, content, deadline, node_deadline, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, user.ID, req.Content, rectifyDeadline, nodeDeadline, time.Now())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存整改通知失败")
		return
	}

	if err = addOperationLog(tx, id, user, "转办分派", models.StatusPending, models.StatusAssigned,
		models.NodeReport, models.NodeRectify, req.Remark); err != nil {
		writeError(w, http.StatusInternalServerError, "记录操作日志失败")
		return
	}

	if err = tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":      id,
		"status":  "assigned",
		"message": "转办成功，已下发整改通知",
	})
}

func SubmitRectification(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user.Role != models.RoleSupervisor {
		writeError(w, http.StatusForbidden, "仅防火监督员可提交整改记录")
		return
	}

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
		writeError(w, http.StatusBadRequest, "请求参数格式错误")
		return
	}
	if strings.TrimSpace(req.Content) == "" {
		writeError(w, http.StatusBadRequest, "整改内容不能为空")
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
	err = tx.QueryRow("SELECT status, current_node FROM hazard_orders WHERE id = ?", id).Scan(&curStatus, &curNode)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "隐患单不存在")
		return
	}
	if curStatus != models.StatusAssigned || curNode != models.NodeRectify {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("当前节点为「%s」，仅整改节点可提交整改记录", nodeText(curNode)))
		return
	}

	recheckDeadline := time.Now().AddDate(0, 0, 5)

	_, err = tx.Exec(`
		UPDATE hazard_orders SET current_node = 'recheck', recheck_deadline = ?, updated_at = ? WHERE id = ?
	`, recheckDeadline, time.Now(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "更新节点失败")
		return
	}

	_, err = tx.Exec(`
		INSERT INTO rectification_records (order_id, submitter_id, content, images, submitted_at)
		VALUES (?, ?, ?, ?, ?)
	`, id, user.ID, req.Content, req.Images, time.Now())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存整改记录失败")
		return
	}

	if err = addOperationLog(tx, id, user, "提交整改", curStatus, curStatus,
		models.NodeRectify, models.NodeRecheck, req.Remark); err != nil {
		writeError(w, http.StatusInternalServerError, "记录操作日志失败")
		return
	}

	if err = tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":          id,
		"current_node": "recheck",
		"message":     "整改记录已提交，进入复查节点",
	})
}

func SubmitRecheck(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user.Role != models.RoleStationChief {
		writeError(w, http.StatusForbidden, "仅站点负责人可提交复查")
		return
	}

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
		writeError(w, http.StatusBadRequest, "请求参数格式错误")
		return
	}
	if strings.TrimSpace(req.Content) == "" {
		writeError(w, http.StatusBadRequest, "复查内容不能为空")
		return
	}
	if req.Result != "pass" && req.Result != "fail" {
		writeError(w, http.StatusBadRequest, "复查结果无效，请选择通过或不通过")
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
	err = tx.QueryRow("SELECT status, current_node FROM hazard_orders WHERE id = ?", id).Scan(&curStatus, &curNode)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "隐患单不存在")
		return
	}
	if curStatus != models.StatusAssigned || curNode != models.NodeRecheck {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("当前节点为「%s」，仅复查节点可提交复查", nodeText(curNode)))
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
		writeError(w, http.StatusInternalServerError, "更新隐患单状态失败")
		return
	}

	_, err = tx.Exec(`
		INSERT INTO recheck_records (order_id, checker_id, content, result, images, node_deadline, checked_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, id, user.ID, req.Content, req.Result, req.Images, nodeDeadline, time.Now())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存复查记录失败")
		return
	}

	resultText := map[string]string{"pass": "复查通过", "fail": "复查不通过，需重新整改"}[req.Result]
	if err = addOperationLog(tx, id, user, "复查回访", models.StatusAssigned, models.StatusRevisited,
		models.NodeRecheck, models.NodeConfirm, resultText+"；"+req.Remark); err != nil {
		writeError(w, http.StatusInternalServerError, "记录操作日志失败")
		return
	}

	if err = tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":      id,
		"status":  "revisited",
		"message": "回访完成，状态已更新为已回访",
	})
}

func ConfirmComplete(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user.Role != models.RoleStationChief {
		writeError(w, http.StatusForbidden, "仅站点负责人可最终确认")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "隐患单ID格式错误")
		return
	}

	var req struct {
		Remark string `json:"remark"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	tx, err := db.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "启动事务失败")
		return
	}
	defer tx.Rollback()

	var curStatus models.HazardStatus
	var curNode models.NodeType
	err = tx.QueryRow("SELECT status, current_node FROM hazard_orders WHERE id = ?", id).Scan(&curStatus, &curNode)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "隐患单不存在")
		return
	}
	if curStatus != models.StatusRevisited {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("当前状态为「%s」，仅「已回访」状态可确认完成", statusText(curStatus)))
		return
	}

	_, err = tx.Exec(`
		UPDATE hazard_orders SET current_node = 'confirm', updated_at = ? WHERE id = ?
	`, time.Now(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "更新节点失败")
		return
	}

	if err = addOperationLog(tx, id, user, "确认完成", curStatus, curStatus,
		curNode, models.NodeConfirm, req.Remark); err != nil {
		writeError(w, http.StatusInternalServerError, "记录操作日志失败")
		return
	}

	if err = tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":      id,
		"message": "已确认完成，隐患单闭环",
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
		writeError(w, http.StatusBadRequest, "请求参数格式错误")
		return
	}
	if strings.TrimSpace(req.TimeoutReason) == "" {
		writeError(w, http.StatusBadRequest, "超时原因不能为空")
		return
	}
	if strings.TrimSpace(req.HandleAction) == "" {
		writeError(w, http.StatusBadRequest, "处理措施不能为空")
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "启动事务失败")
		return
	}
	defer tx.Rollback()

	var curNode models.NodeType
	var originalDeadline time.Time
	var isTimeout bool
	err = tx.QueryRow(`
		SELECT current_node,
			CASE 
				WHEN current_node = 'rectify' THEN COALESCE(rectify_deadline, updated_at)
				WHEN current_node = 'recheck' THEN COALESCE(recheck_deadline, updated_at)
				ELSE updated_at
			END,
			is_timeout
		FROM hazard_orders WHERE id = ?
	`, id).Scan(&curNode, &originalDeadline, &isTimeout)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "隐患单不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询隐患单失败")
		return
	}

	if !isTimeout {
		if err := checkAndMarkTimeout(); err != nil {
			_ = err
		}
		_ = tx.QueryRow("SELECT is_timeout FROM hazard_orders WHERE id = ?", id).Scan(&isTimeout)
	}

	var newDeadline *time.Time
	if req.AddDays > 0 {
		nd := time.Now().AddDate(0, 0, req.AddDays)
		newDeadline = &nd

		switch curNode {
		case models.NodeRectify:
			_, _ = tx.Exec("UPDATE hazard_orders SET rectify_deadline = ?, is_timeout = 0, updated_at = ? WHERE id = ?", nd, time.Now(), id)
		case models.NodeRecheck:
			_, _ = tx.Exec("UPDATE hazard_orders SET recheck_deadline = ?, is_timeout = 0, updated_at = ? WHERE id = ?", nd, time.Now(), id)
		default:
			_, _ = tx.Exec("UPDATE hazard_orders SET is_timeout = 0, updated_at = ? WHERE id = ?", time.Now(), id)
		}
	} else {
		_, _ = tx.Exec("UPDATE hazard_orders SET is_timeout = 0, updated_at = ? WHERE id = ?", time.Now(), id)
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
		writeError(w, http.StatusInternalServerError, "保存超时处理记录失败")
		return
	}

	var curStatus models.HazardStatus
	_ = tx.QueryRow("SELECT status FROM hazard_orders WHERE id = ?", id).Scan(&curStatus)

	if err = addOperationLog(tx, id, user, "超时处理", curStatus, curStatus,
		curNode, curNode, "原因:"+req.TimeoutReason+"；措施:"+req.HandleAction+";"+req.Remark); err != nil {
		writeError(w, http.StatusInternalServerError, "记录操作日志失败")
		return
	}

	if err = tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":      id,
		"message": "超时处理记录已保存",
	})
}

func GetStatistics(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if err := checkAndMarkTimeout(); err != nil {
		writeError(w, http.StatusInternalServerError, "超时检查失败")
		return
	}

	var where string
	var args []interface{}
	switch user.Role {
	case models.RoleClerk:
		where = "WHERE reporter_id = ?"
		args = append(args, user.ID)
	case models.RoleSupervisor:
		where = "WHERE reporter_id = ? OR supervisor_id = ? OR status IN ('pending','assigned')"
		args = append(args, user.ID, user.ID)
	default:
		where = ""
	}

	var total, pending, assigned, revisited, timeoutCount, thisMonth int64

	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM hazard_orders %s", where)
	_ = db.DB.QueryRow(countSQL, args...).Scan(&total)

	pendingSQL := fmt.Sprintf("SELECT COUNT(*) FROM hazard_orders %s AND status = 'pending'", addAndToWhere(where))
	_ = db.DB.QueryRow(pendingSQL, args...).Scan(&pending)

	assignedSQL := fmt.Sprintf("SELECT COUNT(*) FROM hazard_orders %s AND status = 'assigned'", addAndToWhere(where))
	_ = db.DB.QueryRow(assignedSQL, args...).Scan(&assigned)

	revisitedSQL := fmt.Sprintf("SELECT COUNT(*) FROM hazard_orders %s AND status = 'revisited'", addAndToWhere(where))
	_ = db.DB.QueryRow(revisitedSQL, args...).Scan(&revisited)

	timeoutSQL := fmt.Sprintf("SELECT COUNT(*) FROM hazard_orders %s AND is_timeout = 1", addAndToWhere(where))
	_ = db.DB.QueryRow(timeoutSQL, args...).Scan(&timeoutCount)

	monthSQL := fmt.Sprintf("SELECT COUNT(*) FROM hazard_orders %s AND strftime('%%Y-%%m', created_at) = ?", addAndToWhere(where))
	args = append(args, time.Now().Format("2006-01"))
	_ = db.DB.QueryRow(monthSQL, args...).Scan(&thisMonth)

	stats := models.Statistics{
		Total:     total,
		Pending:   pending,
		Assigned:  assigned,
		Revisited: revisited,
		Timeout:   timeoutCount,
		ThisMonth: thisMonth,
	}

	var nodeStats []map[string]interface{}
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

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"summary":   stats,
		"node_stats": nodeStats,
	})
}

func BatchGetStatus(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs []int64 `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数格式错误")
		return
	}
	if len(req.IDs) == 0 {
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": []interface{}{}})
		return
	}

	if err := checkAndMarkTimeout(); err != nil {
		writeError(w, http.StatusInternalServerError, "超时检查失败")
		return
	}

	placeholders := strings.Repeat("?,", len(req.IDs))
	placeholders = placeholders[:len(placeholders)-1]

	args := make([]interface{}, len(req.IDs))
	for i, id := range req.IDs {
		args[i] = id
	}

	querySQL := fmt.Sprintf(`
		SELECT id, status, current_node, is_timeout, updated_at
		FROM hazard_orders WHERE id IN (%s)
	`, placeholders)

	rows, err := db.DB.Query(querySQL, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "批量查询失败")
		return
	}
	defer rows.Close()

	items := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id int64
		var status models.HazardStatus
		var node models.NodeType
		var isTimeout bool
		var updatedAt time.Time
		rows.Scan(&id, &status, &node, &isTimeout, &updatedAt)
		items = append(items, map[string]interface{}{
			"id":           id,
			"status":       status,
			"status_text":  statusText(status),
			"current_node": node,
			"node_text":    nodeText(node),
			"is_timeout":   isTimeout,
			"updated_at":   updatedAt,
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"items": items})
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
