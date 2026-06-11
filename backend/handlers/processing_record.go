package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"water-office/db"
	"water-office/middleware"
	"water-office/models"
	"water-office/utils"
)

type CreateProcessingRecordRequest struct {
	ApplicationID int64  `json:"applicationId"`
	HandoverID    *int64 `json:"handoverId,omitempty"`
	RecordType    string `json:"recordType"`
	Content       string `json:"content"`
	RejectReason  string `json:"rejectReason,omitempty"`
}

type UpdateProcessingRecordRequest struct {
	Status       string `json:"status"`
	Content      string `json:"content,omitempty"`
	RejectReason string `json:"rejectReason,omitempty"`
}

func CreateProcessingRecord(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(middleware.ContextUserKey).(*models.User)

	var req CreateProcessingRecordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "请求参数格式错误"))
		return
	}

	if req.ApplicationID <= 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "请选择关联的开户申请"))
		return
	}
	if req.Content == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "请填写处理内容"))
		return
	}

	recordType := models.ProcessingRecordType(req.RecordType)
	if recordType != models.RecordTypeTodo &&
		recordType != models.RecordTypeCorrection &&
		recordType != models.RecordTypeRemark {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "无效的记录类型"))
		return
	}

	var appStatus string
	var currentHandlerID int64
	var appNo string
	var applicantName string
	err := db.DB.QueryRow(
		"SELECT status, current_handler_id, application_no, applicant_name FROM applications WHERE id=?",
		req.ApplicationID,
	).Scan(&appStatus, &currentHandlerID, &appNo, &applicantName)
	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAppNotFound, "该开户申请不存在或已被删除"))
		return
	}

	if appStatus == string(models.StatusArchived) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeRecordStatusError,
			"申请已归档，不能添加处理记录"))
		return
	}

	if currentHandlerID != user.ID {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeRecordPermissionDeny,
			"您不是此申请的当前处理人，无权添加处理记录"))
		return
	}

	if recordType == models.RecordTypeCorrection && appStatus != string(models.StatusNeedCorrection) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeRecordStatusError,
			"当前申请状态为【"+models.ApplicationStatus(appStatus).DisplayName()+"】，不允许添加补正记录"))
		return
	}

	tx, _ := db.DB.Begin()
	defer tx.Rollback()

	now := time.Now()
	status := models.RecordStatusPending
	if recordType == models.RecordTypeRemark {
		status = models.RecordStatusCompleted
	}

	res, err := tx.Exec(`
		INSERT INTO processing_records(
			application_id, handover_id, handler_id, handler_name,
			handler_role, handler_shift, record_type, status,
			content, reject_reason, created_at, updated_at
		) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
		req.ApplicationID, req.HandoverID, user.ID, user.RealName,
		string(user.Role), user.Shift, recordType, status,
		req.Content, req.RejectReason, now, now,
	)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "创建处理记录失败: "+err.Error()))
		return
	}
	recordID, _ := res.LastInsertId()

	opDetail := "【添加" + recordType.DisplayName() + "记录】"
	opDetail += "内容：" + req.Content
	if req.RejectReason != "" {
		opDetail += "，拒绝/补正原因：" + req.RejectReason
	}
	opDetail += "，处理人：" + user.RealName + "（" + user.Role.DisplayName() + "/" + user.Shift + "）"
	writeOpLog(tx, req.ApplicationID, appNo, user,
		"添加"+recordType.DisplayName()+"记录", opDetail, appStatus, appStatus, r.RemoteAddr)

	tx.Commit()

	var extraMsg string
	if recordType == models.RecordTypeCorrection {
		extraMsg = "，请及时补正资料并更新处理状态"
	} else if recordType == models.RecordTypeTodo {
		extraMsg = "，请及时处理并更新状态"
	} else {
		extraMsg = "，该记录已自动标记为完成"
	}
	if appStatus == string(models.StatusNeedCorrection) && recordType != models.RecordTypeRemark {
		extraMsg += "。补正完成后可提交审核重新进入审核流程"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.SuccessMsg(
		recordType.DisplayName()+"记录添加成功【状态："+status.DisplayName()+"】"+extraMsg,
		map[string]interface{}{"recordId": recordID}))
}

func UpdateProcessingRecord(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(middleware.ContextUserKey).(*models.User)
	idStr := chi.URLParam(r, "id")
	id, _ := strconv.ParseInt(idStr, 10, 64)

	var req UpdateProcessingRecordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "请求参数格式错误"))
		return
	}

	newStatus := models.ProcessingRecordStatus(req.Status)
	if newStatus != models.RecordStatusPending &&
		newStatus != models.RecordStatusProcessing &&
		newStatus != models.RecordStatusCompleted {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "无效的状态值"))
		return
	}

	var appID int64
	var appNo string
	var appStatus string
	var handlerID int64
	var recordType string
	var oldStatus string
	var content string
	err := db.DB.QueryRow(`
		SELECT pr.application_id, pr.handler_id, pr.record_type, pr.status, pr.content,
		       a.application_no, a.status
		FROM processing_records pr
		JOIN applications a ON pr.application_id = a.id
		WHERE pr.id=?`, id).
		Scan(&appID, &handlerID, &recordType, &oldStatus, &content, &appNo, &appStatus)
	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeRecordNotFound, "处理记录不存在"))
		return
	}

	if handlerID != user.ID {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeRecordPermissionDeny,
			"您不是此记录的责任人，无权修改"))
		return
	}

	if oldStatus == string(models.RecordStatusCompleted) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeRecordStatusError,
			"记录已完成，不能修改"))
		return
	}

	tx, _ := db.DB.Begin()
	defer tx.Rollback()

	now := time.Now()
	var completedAt interface{} = nil
	if newStatus == models.RecordStatusCompleted {
		completedAt = now
	}

	updateContent := content
	if req.Content != "" {
		updateContent = req.Content
	}

	_, err = tx.Exec(`
		UPDATE processing_records SET status=?, content=?, reject_reason=?, updated_at=?, completed_at=?
		WHERE id=?`,
		newStatus, updateContent, req.RejectReason, now, completedAt, id)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "更新处理记录失败"))
		return
	}

	rt := models.ProcessingRecordType(recordType)
	opDetail := "【更新" + rt.DisplayName() + "记录】状态变更：" +
		models.ProcessingRecordStatus(oldStatus).DisplayName() + " → " + newStatus.DisplayName()
	if req.Content != "" {
		opDetail += "，内容更新为：" + req.Content
	}
	if req.RejectReason != "" {
		opDetail += "，拒绝/补正原因：" + req.RejectReason
	}
	opDetail += "，处理人：" + user.RealName + "（" + user.Role.DisplayName() + "/" + user.Shift + "）"
	writeOpLog(tx, appID, appNo, user,
		"更新"+rt.DisplayName()+"记录", opDetail, appStatus, appStatus, r.RemoteAddr)

	tx.Commit()

	var extraMsg string
	if newStatus == models.RecordStatusCompleted {
		var remainingPending int64
		var remainingProcessing int64
		db.DB.QueryRow(`
			SELECT 
				COUNT(CASE WHEN status='PENDING' THEN 1 END),
				COUNT(CASE WHEN status='PROCESSING' THEN 1 END)
			FROM processing_records WHERE application_id=?`, appID).
			Scan(&remainingPending, &remainingProcessing)

		if rt == models.RecordTypeCorrection && appStatus == string(models.StatusNeedCorrection) {
			if remainingPending == 0 && remainingProcessing == 0 {
				extraMsg = "。所有补正任务已完成，您可以点击【提交审核】将申请流转至待审核状态"
			} else {
				extraMsg = fmt.Sprintf("。该申请还剩 %d 项待处理、%d 项处理中的补正任务", remainingPending, remainingProcessing)
			}
		} else {
			if remainingPending == 0 && remainingProcessing == 0 {
				extraMsg = "。该申请关联的所有处理任务均已完成"
			} else {
				extraMsg = fmt.Sprintf("。该申请还剩 %d 项待处理、%d 项处理中的任务", remainingPending, remainingProcessing)
			}
		}
	} else if newStatus == models.RecordStatusProcessing {
		extraMsg = "，请及时跟进处理"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.SuccessMsg(
		rt.DisplayName()+"记录已更新为【"+newStatus.DisplayName()+"】"+extraMsg, nil))
}

func ListProcessingRecords(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(middleware.ContextUserKey).(*models.User)
	appIDStr := chi.URLParam(r, "appId")
	statusFilter := r.URL.Query().Get("status")
	typeFilter := r.URL.Query().Get("type")
	handlerFilter := r.URL.Query().Get("handler")

	where := []string{"1=1"}
	args := []interface{}{}
	idx := 1

	if appIDStr != "" {
		appID, _ := strconv.ParseInt(appIDStr, 10, 64)
		if appID > 0 {
			where = append(where, "pr.application_id = $"+strconv.Itoa(idx))
			args = append(args, appID)
			idx++
		}
	}
	if statusFilter != "" {
		where = append(where, "pr.status = $"+strconv.Itoa(idx))
		args = append(args, statusFilter)
		idx++
	}
	if typeFilter != "" {
		where = append(where, "pr.record_type = $"+strconv.Itoa(idx))
		args = append(args, typeFilter)
		idx++
	}
	if handlerFilter == "me" {
		where = append(where, "pr.handler_id = $"+strconv.Itoa(idx))
		args = append(args, user.ID)
		idx++
	}

	whereSQL := "WHERE " + joinStrings(where, " AND ")
	sql := `
	SELECT pr.id, pr.application_id, pr.handover_id, pr.handler_id, pr.handler_name,
	       pr.handler_role, pr.handler_shift, pr.record_type, pr.status, pr.content,
	       pr.reject_reason, pr.created_at, pr.updated_at, pr.completed_at,
	       a.application_no, a.applicant_name
	FROM processing_records pr
	LEFT JOIN applications a ON pr.application_id = a.id
	` + whereSQL + `
	ORDER BY pr.id DESC
	LIMIT 200
	`

	rows, err := db.DB.Query(sql, args...)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "查询处理记录失败: "+err.Error()))
		return
	}
	defer rows.Close()

	list := []models.ProcessingRecord{}
	for rows.Next() {
		var r models.ProcessingRecord
		var recordType, status, handlerRole string
		var completedAt *time.Time
		err := rows.Scan(
			&r.ID, &r.ApplicationID, &r.HandoverID, &r.HandlerID, &r.HandlerName,
			&handlerRole, &r.HandlerShift, &recordType, &status, &r.Content,
			&r.RejectReason, &r.CreatedAt, &r.UpdatedAt, &completedAt,
			&r.ApplicationNo, &r.ApplicantName,
		)
		if err != nil {
			continue
		}
		r.RecordType = models.ProcessingRecordType(recordType)
		r.RecordTypeDisplay = r.RecordType.DisplayName()
		r.Status = models.ProcessingRecordStatus(status)
		r.StatusDisplay = r.Status.DisplayName()
		r.HandlerRole = models.Role(handlerRole).DisplayName()
		if completedAt != nil {
			r.CompletedAt = completedAt
		}
		list = append(list, r)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.Success(list))
}

func GetTodoSummary(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(middleware.ContextUserKey).(*models.User)

	var summary models.TodoSummary
	err := db.DB.QueryRow(`
		SELECT 
			COUNT(CASE WHEN status='PENDING' THEN 1 END) as pending,
			COUNT(CASE WHEN status='PROCESSING' THEN 1 END) as processing,
			COUNT(CASE WHEN status='COMPLETED' THEN 1 END) as completed,
			COUNT(*) as total
		FROM processing_records 
		WHERE handler_id=? AND status IN ('PENDING','PROCESSING')`,
		user.ID).Scan(&summary.PendingCount, &summary.ProcessingCount, &summary.CompletedCount, &summary.TotalCount)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "查询待办统计失败"))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.Success(summary))
}
