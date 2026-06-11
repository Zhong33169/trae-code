package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"checkin-system/database"
	"checkin-system/middleware"
	"checkin-system/models"
)

const (
	ActionInitiate = "initiate"
	ActionHandle   = "handle"
	ActionVerify   = "verify"
	ActionReview   = "review"
	ActionArchive  = "archive"
	ActionReturn   = "return"
	ActionReject   = "reject"
	ActionUpdate   = "update"
)

var StatusTransitions = map[string][]string{
	"pending":    {"processing"},
	"processing": {"verified", "returned", "rejected"},
	"verified":   {"archived", "returned"},
	"returned":   {"processing"},
	"rejected":   {"processing"},
	"archived":   {},
}

var RoleAllowedActions = map[string][]string{
	"initiator": {ActionInitiate, ActionUpdate},
	"handler":   {ActionHandle, ActionVerify, ActionReturn},
	"reviewer":  {ActionReview, ActionArchive, ActionReturn},
	"admin":     {ActionInitiate, ActionHandle, ActionVerify, ActionReview, ActionArchive, ActionReturn, ActionReject, ActionUpdate},
}

type CheckinHandler struct{}

func NewCheckinHandler() *CheckinHandler {
	return &CheckinHandler{}
}

func canTransition(from, to string) bool {
	allowed, ok := StatusTransitions[from]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

func roleCanAction(role, action string) bool {
	allowed, ok := RoleAllowedActions[role]
	if !ok {
		return false
	}
	for _, a := range allowed {
		if a == action {
			return true
		}
	}
	return false
}

func actionToStatus(action string) (string, error) {
	switch action {
	case ActionInitiate, ActionUpdate:
		return "processing", nil
	case ActionHandle, ActionVerify:
		return "verified", nil
	case ActionReview, ActionArchive:
		return "archived", nil
	case ActionReturn:
		return "returned", nil
	case ActionReject:
		return "rejected", nil
	default:
		return "", fmt.Errorf("unknown action: %s", action)
	}
}

func writeAuditLog(recordID, userID int, action, oldStatus, newStatus, detail, failureReason string) error {
	var recID interface{}
	if recordID > 0 {
		recID = recordID
	}
	_, err := database.DB.Exec(
		`INSERT INTO audit_logs (checkin_record_id, user_id, action, old_status, new_status, detail, failure_reason)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		recID, userID, action, oldStatus, newStatus, detail, failureReason,
	)
	return err
}

func detectDuplicates(batchNo, idCardNo string, excludeID int) ([]models.ConsistencyIssue, error) {
	var issues []models.ConsistencyIssue
	var count int
	err := database.DB.QueryRow(
		`SELECT COUNT(*) FROM checkin_records WHERE batch_no = ? AND id_card_no = ? AND id != ?`,
		batchNo, idCardNo, excludeID,
	).Scan(&count)
	if err != nil {
		return nil, err
	}
	if count > 0 {
		issues = append(issues, models.ConsistencyIssue{
			Type:    "duplicate_batch",
			Message: fmt.Sprintf("批次 %s 内已存在身份证号 %s 的记录（共 %d 条重复），请核实是否为重复录入", batchNo, idCardNo, count),
		})
	}
	return issues, nil
}

func detectStatusInconsistency(batchNo, idCardNo, source, status string, excludeID int) ([]models.ConsistencyIssue, error) {
	var issues []models.ConsistencyIssue
	var otherSource string
	if source == "offline" {
		otherSource = "online"
	} else {
		otherSource = "offline"
	}

	var otherStatus string
	var otherID int
	err := database.DB.QueryRow(
		`SELECT id, status FROM checkin_records WHERE batch_no = ? AND id_card_no = ? AND source = ? AND id != ? LIMIT 1`,
		batchNo, idCardNo, otherSource, excludeID,
	).Scan(&otherID, &otherStatus)
	if err == sql.ErrNoRows {
		return issues, nil
	}
	if err != nil {
		return nil, err
	}

	if otherStatus != status {
		issues = append(issues, models.ConsistencyIssue{
			Type: "status_inconsistency",
			Message: fmt.Sprintf(
				"线上线下状态不一致：当前记录（%s）状态为 %s，对应%s记录（ID:%d）状态为 %s，请核实",
				source, status, otherSource, otherID, otherStatus,
			),
		})
	}
	return issues, nil
}

func (h *CheckinHandler) List(c echo.Context) error {
	status := c.QueryParam("status")
	isAbnormal := c.QueryParam("is_abnormal")
	flightNo := c.QueryParam("flight_no")
	batchNo := c.QueryParam("batch_no")
	search := c.QueryParam("search")
	role, _ := middleware.GetRole(c)

	var where []string
	var args []interface{}

	if status != "" {
		where = append(where, "r.status = ?")
		args = append(args, status)
	}
	if isAbnormal == "1" {
		where = append(where, "r.is_abnormal = 1")
	}
	if isAbnormal == "0" {
		where = append(where, "r.is_abnormal = 0")
	}
	if flightNo != "" {
		where = append(where, "r.flight_no LIKE ?")
		args = append(args, "%"+flightNo+"%")
	}
	if batchNo != "" {
		where = append(where, "r.batch_no LIKE ?")
		args = append(args, "%"+batchNo+"%")
	}
	if search != "" {
		where = append(where, "(r.passenger_name LIKE ? OR r.id_card_no LIKE ?)")
		args = append(args, "%"+search+"%", "%"+search+"%")
	}

	whereSQL := ""
	if len(where) > 0 {
		whereSQL = "WHERE " + strings.Join(where, " AND ")
	}

	rows, err := database.DB.Query(`
		SELECT r.id, r.batch_no, r.flight_no, r.flight_date, r.passenger_name, r.id_card_no,
		       r.seat_no, r.boarding_gate, r.checkin_time, r.source, r.status,
		       r.material_complete, r.is_overtime, r.is_abnormal, r.abnormal_reason,
		       r.initiated_at, r.handled_at, r.reviewed_at,
		       ui.real_name, uh.real_name, ur.real_name
		FROM checkin_records r
		LEFT JOIN users ui ON r.initiator_id = ui.id
		LEFT JOIN users uh ON r.handler_id = uh.id
		LEFT JOIN users ur ON r.reviewer_id = ur.id
		`+whereSQL+`
		ORDER BY r.created_at DESC
	`, args...)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer rows.Close()

	records := []models.CheckinRecord{}
	for rows.Next() {
		var r models.CheckinRecord
		var initiatorName, handlerName, reviewerName sql.NullString
		var seatNo, boardingGate, abnormalReason sql.NullString
		err := rows.Scan(
			&r.ID, &r.BatchNo, &r.FlightNo, &r.FlightDate, &r.PassengerName, &r.IDCardNo,
			&seatNo, &boardingGate, &r.CheckinTime, &r.Source, &r.Status,
			&r.MaterialComplete, &r.IsOvertime, &r.IsAbnormal, &abnormalReason,
			&r.InitiatedAt, &r.HandledAt, &r.ReviewedAt,
			&initiatorName, &handlerName, &reviewerName,
		)
		r.SeatNo = seatNo.String
		r.BoardingGate = boardingGate.String
		r.AbnormalReason = abnormalReason.String
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		r.InitiatorName = initiatorName.String
		r.HandlerName = handlerName.String
		r.ReviewerName = reviewerName.String
		records = append(records, r)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"records": records,
		"role":    role,
		"allowed_actions": RoleAllowedActions[role],
	})
}

func (h *CheckinHandler) Get(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id"})
	}

	var r models.CheckinRecord
	var initiatorName, handlerName, reviewerName sql.NullString
	var initiatorID, handlerID, reviewerID sql.NullInt64
	var seatNo, boardingGate, abnormalReason, result, returnReason, auditRemark sql.NullString
	err = database.DB.QueryRow(`
		SELECT r.id, r.batch_no, r.flight_no, r.flight_date, r.passenger_name, r.id_card_no,
		       r.seat_no, r.boarding_gate, r.checkin_time, r.source, r.status,
		       r.material_complete, r.is_overtime, r.is_abnormal, r.abnormal_reason,
		       r.result, r.return_reason, r.audit_remark,
		       r.initiator_id, r.handler_id, r.reviewer_id,
		       r.initiated_at, r.handled_at, r.reviewed_at, r.created_at, r.updated_at,
		       ui.real_name, uh.real_name, ur.real_name
		FROM checkin_records r
		LEFT JOIN users ui ON r.initiator_id = ui.id
		LEFT JOIN users uh ON r.handler_id = uh.id
		LEFT JOIN users ur ON r.reviewer_id = ur.id
		WHERE r.id = ?
	`, id).Scan(
		&r.ID, &r.BatchNo, &r.FlightNo, &r.FlightDate, &r.PassengerName, &r.IDCardNo,
		&seatNo, &boardingGate, &r.CheckinTime, &r.Source, &r.Status,
		&r.MaterialComplete, &r.IsOvertime, &r.IsAbnormal, &abnormalReason,
		&result, &returnReason, &auditRemark,
		&initiatorID, &handlerID, &reviewerID,
		&r.InitiatedAt, &r.HandledAt, &r.ReviewedAt, &r.CreatedAt, &r.UpdatedAt,
		&initiatorName, &handlerName, &reviewerName,
	)
	r.SeatNo = seatNo.String
	r.BoardingGate = boardingGate.String
	r.AbnormalReason = abnormalReason.String
	r.Result = result.String
	r.ReturnReason = returnReason.String
	r.AuditRemark = auditRemark.String
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "record not found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if initiatorID.Valid {
		v := int(initiatorID.Int64)
		r.InitiatorID = &v
	}
	if handlerID.Valid {
		v := int(handlerID.Int64)
		r.HandlerID = &v
	}
	if reviewerID.Valid {
		v := int(reviewerID.Int64)
		r.ReviewerID = &v
	}
	r.InitiatorName = initiatorName.String
	r.HandlerName = handlerName.String
	r.ReviewerName = reviewerName.String

	attachRows, err := database.DB.Query(`
		SELECT a.id, a.checkin_record_id, a.file_name, a.file_path, a.file_type, a.file_size,
		       a.uploaded_by, a.uploaded_at, u.real_name
		FROM attachments a LEFT JOIN users u ON a.uploaded_by = u.id
		WHERE a.checkin_record_id = ? ORDER BY a.uploaded_at DESC
	`, id)
	if err == nil {
		defer attachRows.Close()
		for attachRows.Next() {
			var a models.Attachment
			var uploaderName, fileType sql.NullString
			attachRows.Scan(&a.ID, &a.RecordID, &a.FileName, &a.FilePath, &fileType, &a.FileSize,
				&a.UploadedBy, &a.UploadedAt, &uploaderName)
			a.FileType = fileType.String
			a.UploaderName = uploaderName.String
			r.Attachments = append(r.Attachments, a)
		}
	}

	logRows, err := database.DB.Query(`
		SELECT l.id, l.checkin_record_id, l.user_id, u.real_name, l.action, l.old_status,
		       l.new_status, l.detail, l.failure_reason, l.created_at
		FROM audit_logs l LEFT JOIN users u ON l.user_id = u.id
		WHERE l.checkin_record_id = ? ORDER BY l.created_at DESC
	`, id)
	if err == nil {
		defer logRows.Close()
		for logRows.Next() {
			var l models.AuditLog
			var userName, oldStatus, newStatus, detail, failureReason sql.NullString
			logRows.Scan(&l.ID, &l.RecordID, &l.UserID, &userName, &l.Action, &oldStatus,
				&newStatus, &detail, &failureReason, &l.CreatedAt)
			l.UserName = userName.String
			l.OldStatus = oldStatus.String
			l.NewStatus = newStatus.String
			l.Detail = detail.String
			l.FailureReason = failureReason.String
			r.AuditLogs = append(r.AuditLogs, l)
		}
	}

	issues := []models.ConsistencyIssue{}
	dupIssues, _ := detectDuplicates(r.BatchNo, r.IDCardNo, r.ID)
	issues = append(issues, dupIssues...)
	incIssues, _ := detectStatusInconsistency(r.BatchNo, r.IDCardNo, r.Source, r.Status, r.ID)
	issues = append(issues, incIssues...)

	role, _ := middleware.GetRole(c)
	return c.JSON(http.StatusOK, map[string]interface{}{
		"record":           r,
		"consistency_issues": issues,
		"role":             role,
		"allowed_actions":  RoleAllowedActions[role],
		"valid_transitions": StatusTransitions[r.Status],
	})
}

func (h *CheckinHandler) Create(c echo.Context) error {
	role, _ := middleware.GetRole(c)
	userID, _ := middleware.GetUserID(c)
	if !roleCanAction(role, ActionInitiate) {
		allowedStr := strings.Join(RoleAllowedActions[role], ",")
		writeAuditLog(0, userID, ActionInitiate, "", "", "",
			fmt.Sprintf("创建权限拒绝：角色 %s 不允许创建记录，允许操作为 [%s]", role, allowedStr))
		return c.JSON(http.StatusForbidden, map[string]string{"error": "角色无权创建记录"})
	}

	var r models.CheckinRecord
	if err := c.Bind(&r); err != nil {
		writeAuditLog(0, userID, ActionInitiate, "", "", "", "请求体解析失败: "+err.Error())
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	validationErrs := []models.ValidationError{}
	if r.BatchNo == "" {
		validationErrs = append(validationErrs, models.ValidationError{Field: "batch_no", Message: "批次号必填"})
	}
	if r.FlightNo == "" {
		validationErrs = append(validationErrs, models.ValidationError{Field: "flight_no", Message: "航班号必填"})
	}
	if r.FlightDate == "" {
		validationErrs = append(validationErrs, models.ValidationError{Field: "flight_date", Message: "航班日期必填"})
	}
	if r.PassengerName == "" {
		validationErrs = append(validationErrs, models.ValidationError{Field: "passenger_name", Message: "旅客姓名必填"})
	}
	if r.IDCardNo == "" {
		validationErrs = append(validationErrs, models.ValidationError{Field: "id_card_no", Message: "身份证号必填"})
	}
	if len(validationErrs) > 0 {
		msgs := make([]string, 0, len(validationErrs))
		for _, ve := range validationErrs {
			msgs = append(msgs, ve.Field+": "+ve.Message)
		}
		writeAuditLog(0, userID, ActionInitiate, "", "", "",
			"创建记录字段校验失败："+strings.Join(msgs, "; "))
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"error": "validation failed", "details": validationErrs})
	}

	issues := []models.ConsistencyIssue{}
	dupIssues, err := detectDuplicates(r.BatchNo, r.IDCardNo, 0)
	if err != nil {
		writeAuditLog(0, userID, ActionInitiate, "", "", "", "重复批次检测失败: "+err.Error())
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	issues = append(issues, dupIssues...)

	now := time.Now().Format("2006-01-02 15:04:05")

	result, err := database.DB.Exec(`
		INSERT INTO checkin_records
		(batch_no, flight_no, flight_date, passenger_name, id_card_no, seat_no, boarding_gate,
		 checkin_time, source, status, material_complete, is_overtime, is_abnormal, abnormal_reason,
		 initiator_id, initiated_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, r.BatchNo, r.FlightNo, r.FlightDate, r.PassengerName, r.IDCardNo,
		r.SeatNo, r.BoardingGate, r.CheckinTime, "offline", "processing",
		r.MaterialComplete, r.IsOvertime, len(issues) > 0, r.AbnormalReason,
		userID, now, now, now)
	if err != nil {
		writeAuditLog(0, userID, ActionInitiate, "", "processing", "", "数据库插入失败: "+err.Error())
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	newID, _ := result.LastInsertId()
	writeAuditLog(int(newID), userID, ActionInitiate, "", "processing", "创建并发起值机记录回填", "")

	if len(issues) > 0 {
		return c.JSON(http.StatusCreated, map[string]interface{}{
			"id":                 newID,
			"status":             "processing",
			"consistency_issues": issues,
			"warning":            "记录已创建，但检测到数据一致性问题，请处理",
		})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"id":     newID,
		"status": "processing",
	})
}

func (h *CheckinHandler) HandleAction(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id"})
	}

	action := c.Param("action")
	role, _ := middleware.GetRole(c)
	userID, _ := middleware.GetUserID(c)

	if !roleCanAction(role, action) {
		allowedStr := strings.Join(RoleAllowedActions[role], ",")
		writeAuditLog(id, userID, action, "", "",
			"", fmt.Sprintf("权限拒绝：角色 %s 不允许执行 %s 操作，允许操作为 [%s]", role, action, allowedStr))
		return c.JSON(http.StatusForbidden, map[string]interface{}{
			"error":          "角色无权执行该操作",
			"current_role":   role,
			"action":         action,
			"allowed_actions": RoleAllowedActions[role],
		})
	}

	var body struct {
		Result       string `json:"result"`
		ReturnReason string `json:"return_reason"`
		AuditRemark  string `json:"audit_remark"`
		Remark       string `json:"remark"`
	}
	c.Bind(&body)

	var oldStatus string
	var batchNo, idCardNo, source string
	err = database.DB.QueryRow(
		"SELECT status, batch_no, id_card_no, source FROM checkin_records WHERE id = ?", id,
	).Scan(&oldStatus, &batchNo, &idCardNo, &source)
	if err == sql.ErrNoRows {
		writeAuditLog(id, userID, action, "", "", "", fmt.Sprintf("记录 #%d 不存在", id))
		return c.JSON(http.StatusNotFound, map[string]string{"error": "record not found"})
	}
	if err != nil {
		writeAuditLog(id, userID, action, "", "", "", "查询记录失败: "+err.Error())
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	newStatus, err := actionToStatus(action)
	if err != nil {
		writeAuditLog(id, userID, action, oldStatus, "", "", "未知动作: "+action)
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	if oldStatus != newStatus && !canTransition(oldStatus, newStatus) {
		allowedStr := strings.Join(StatusTransitions[oldStatus], ",")
		writeAuditLog(id, userID, action, oldStatus, newStatus, "",
			fmt.Sprintf("状态流转拒绝：不能从 %s 转为 %s，允许流转为 [%s]", oldStatus, newStatus, allowedStr))
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error":         "invalid status transition",
			"current_status": oldStatus,
			"target_status":  newStatus,
			"allowed_from":  StatusTransitions[oldStatus],
		})
	}

	issues := []models.ConsistencyIssue{}
	if action == ActionInitiate || action == ActionHandle || action == ActionReview || action == ActionArchive {
		dupIssues, _ := detectDuplicates(batchNo, idCardNo, id)
		issues = append(issues, dupIssues...)
		incIssues, _ := detectStatusInconsistency(batchNo, idCardNo, source, newStatus, id)
		issues = append(issues, incIssues...)
		if len(issues) > 0 && (action == ActionReview || action == ActionArchive) {
			msgs := make([]string, 0, len(issues))
			for _, iss := range issues {
				msgs = append(msgs, iss.Message)
			}
			detail := strings.Join(msgs, "；")
			writeAuditLog(id, userID, action, oldStatus, newStatus, detail,
				fmt.Sprintf("归档/复核拦截：存在 %d 个数据一致性问题：%s", len(issues), detail))
			return c.JSON(http.StatusBadRequest, map[string]interface{}{
				"error":              "存在数据一致性问题，无法继续操作",
				"consistency_issues": issues,
				"details":            strings.Join(msgs, "；"),
			})
		}
	}

	now := time.Now().Format("2006-01-02 15:04:05")

	var updateSQL string
	var args []interface{}
	isAbnormal := len(issues) > 0

	switch action {
	case ActionInitiate:
		updateSQL = "UPDATE checkin_records SET status = ?, initiator_id = ?, initiated_at = ?, is_abnormal = ?, updated_at = ? WHERE id = ?"
		args = []interface{}{newStatus, userID, now, isAbnormal, now, id}
	case ActionHandle, ActionVerify:
		updateSQL = "UPDATE checkin_records SET status = ?, handler_id = ?, handled_at = ?, result = ?, is_abnormal = ?, updated_at = ? WHERE id = ?"
		args = []interface{}{newStatus, userID, now, body.Result, isAbnormal, now, id}
	case ActionReview, ActionArchive:
		updateSQL = "UPDATE checkin_records SET status = ?, reviewer_id = ?, reviewed_at = ?, audit_remark = ?, is_abnormal = ?, updated_at = ? WHERE id = ?"
		args = []interface{}{newStatus, userID, now, body.AuditRemark, isAbnormal, now, id}
	case ActionReturn:
		if body.ReturnReason == "" {
			writeAuditLog(id, userID, action, oldStatus, newStatus, "", "退回原因缺失：执行退回操作但未填写退回原因")
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "退回原因必填"})
		}
		if role == "reviewer" {
			updateSQL = "UPDATE checkin_records SET status = ?, reviewer_id = ?, reviewed_at = ?, return_reason = ?, is_abnormal = 1, updated_at = ? WHERE id = ?"
			args = []interface{}{newStatus, userID, now, body.ReturnReason, now, id}
		} else {
			updateSQL = "UPDATE checkin_records SET status = ?, handler_id = ?, handled_at = ?, return_reason = ?, is_abnormal = 1, updated_at = ? WHERE id = ?"
			args = []interface{}{newStatus, userID, now, body.ReturnReason, now, id}
		}
	case ActionUpdate:
		updateSQL = "UPDATE checkin_records SET is_abnormal = ?, updated_at = ? WHERE id = ?"
		args = []interface{}{isAbnormal, now, id}
	}

	if _, err := database.DB.Exec(updateSQL, args...); err != nil {
		writeAuditLog(id, userID, action, oldStatus, newStatus, body.Remark, "数据库更新失败: "+err.Error())
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	failureReason := ""
	if len(issues) > 0 {
		for _, iss := range issues {
			failureReason += iss.Message + "; "
		}
	}
	writeAuditLog(id, userID, action, oldStatus, newStatus, body.Remark, failureReason)

	resp := map[string]interface{}{
		"id":      id,
		"status":  newStatus,
		"action":  action,
		"message": "操作成功",
	}
	if len(issues) > 0 {
		resp["consistency_issues"] = issues
		resp["warning"] = "操作成功，但检测到数据一致性问题"
	}
	return c.JSON(http.StatusOK, resp)
}

func (h *CheckinHandler) BatchHandle(c echo.Context) error {
	var req models.BatchHandleRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if len(req.IDs) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请选择至少一条记录"})
	}

	role, _ := middleware.GetRole(c)
	userID, _ := middleware.GetUserID(c)
	if !roleCanAction(role, req.Action) {
		allowedStr := strings.Join(RoleAllowedActions[role], ",")
		reason := fmt.Sprintf("批量权限拒绝：角色 %s 不允许执行 %s 操作，允许操作为 [%s]", role, req.Action, allowedStr)
		for _, id := range req.IDs {
			writeAuditLog(id, userID, req.Action, "", "", req.Remark, reason)
		}
		return c.JSON(http.StatusForbidden, map[string]interface{}{
			"error":          "角色无权执行该操作",
			"current_role":   role,
			"action":         req.Action,
			"allowed_actions": RoleAllowedActions[role],
		})
	}

	userID, _ = middleware.GetUserID(c)
	results := []models.BatchResultItem{}
	successCount := 0
	failCount := 0
	now := time.Now().Format("2006-01-02 15:04:05")

	targetStatus, _ := actionToStatus(req.Action)

	for _, id := range req.IDs {
		item := models.BatchResultItem{ID: id}

		var oldStatus string
		var batchNo, idCardNo, source string
		err := database.DB.QueryRow(
			"SELECT status, batch_no, id_card_no, source FROM checkin_records WHERE id = ?", id,
		).Scan(&oldStatus, &batchNo, &idCardNo, &source)

		if err == sql.ErrNoRows {
			item.Success = false
			item.Message = "记录不存在"
			failCount++
			results = append(results, item)
			continue
		}
		if err != nil {
			item.Success = false
			item.Message = "数据库错误: " + err.Error()
			failCount++
			writeAuditLog(id, userID, req.Action, oldStatus, targetStatus, req.Remark, err.Error())
			results = append(results, item)
			continue
		}

		if oldStatus != targetStatus && !canTransition(oldStatus, targetStatus) {
			item.Success = false
			item.Message = fmt.Sprintf("状态不允许从 %s 转为 %s", oldStatus, targetStatus)
			failCount++
			writeAuditLog(id, userID, req.Action, oldStatus, targetStatus, req.Remark, item.Message)
			results = append(results, item)
			continue
		}

		issues := []models.ConsistencyIssue{}
		if req.Action == ActionReview || req.Action == ActionArchive {
			dupIssues, _ := detectDuplicates(batchNo, idCardNo, id)
			issues = append(issues, dupIssues...)
			incIssues, _ := detectStatusInconsistency(batchNo, idCardNo, source, targetStatus, id)
			issues = append(issues, incIssues...)
			if len(issues) > 0 {
				item.Success = false
				msgs := make([]string, 0, len(issues))
				for _, iss := range issues {
					msgs = append(msgs, iss.Message)
				}
				item.Message = strings.Join(msgs, "；")
				failCount++
				writeAuditLog(id, userID, req.Action, oldStatus, targetStatus, req.Remark, item.Message)
				results = append(results, item)
				continue
			}
		}

		if req.Action == ActionReturn && req.ReturnReason == "" {
			item.Success = false
			item.Message = "退回原因必填"
			failCount++
			writeAuditLog(id, userID, req.Action, oldStatus, targetStatus, req.Remark, item.Message)
			results = append(results, item)
			continue
		}

		var updateSQL string
		var args []interface{}

		switch req.Action {
		case ActionHandle, ActionVerify:
			updateSQL = "UPDATE checkin_records SET status = ?, handler_id = ?, handled_at = ?, result = ?, updated_at = ? WHERE id = ?"
			args = []interface{}{targetStatus, userID, now, req.Result, now, id}
		case ActionReview, ActionArchive:
			updateSQL = "UPDATE checkin_records SET status = ?, reviewer_id = ?, reviewed_at = ?, audit_remark = ?, updated_at = ? WHERE id = ?"
			args = []interface{}{targetStatus, userID, now, req.Remark, now, id}
		case ActionReturn:
			updateSQL = "UPDATE checkin_records SET status = ?, return_reason = ?, is_abnormal = 1, updated_at = ? WHERE id = ?"
			args = []interface{}{targetStatus, req.ReturnReason, now, id}
		case ActionInitiate:
			updateSQL = "UPDATE checkin_records SET status = ?, initiator_id = ?, initiated_at = ?, updated_at = ? WHERE id = ?"
			args = []interface{}{targetStatus, userID, now, now, id}
		}

		if _, err := database.DB.Exec(updateSQL, args...); err != nil {
			item.Success = false
			item.Message = "更新失败: " + err.Error()
			failCount++
			writeAuditLog(id, userID, req.Action, oldStatus, targetStatus, req.Remark, err.Error())
		} else {
			item.Success = true
			item.Message = "处理成功"
			successCount++
			writeAuditLog(id, userID, req.Action, oldStatus, targetStatus, req.Remark, "")
		}
		results = append(results, item)
	}

	return c.JSON(http.StatusOK, models.BatchHandleResponse{
		Results: results,
		Total:   len(req.IDs),
		Success: successCount,
		Failed:  failCount,
	})
}
