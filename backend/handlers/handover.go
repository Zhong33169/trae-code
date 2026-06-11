package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"water-office/db"
	"water-office/middleware"
	"water-office/models"
	"water-office/utils"
)

type CreateHandoverRequest struct {
	ApplicationID int64  `json:"applicationId"`
	ToUserID      int64  `json:"toUserId"`
	ToShift       string `json:"toShift"`
	Remark        string `json:"remark"`
}

func CreateHandover(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(middleware.ContextUserKey).(*models.User)

	var req CreateHandoverRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "请求参数格式错误"))
		return
	}

	if req.ApplicationID <= 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "请选择要交接的开户申请"))
		return
	}
	if req.ToUserID <= 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "请选择接收人"))
		return
	}
	if req.ToUserID == user.ID {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeHandoverSelfForbidden, "不能将申请交接给自己，请选择其他同事"))
		return
	}
	if req.Remark == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "请填写交接说明，说明当前申请的处理进度和注意事项"))
		return
	}

	var appStatus string
	var currentHandlerID int64
	var appNo string
	var applicantName string
	var registerID int64
	err := db.DB.QueryRow(
		"SELECT status, current_handler_id, application_no, applicant_name, register_id FROM applications WHERE id=?",
		req.ApplicationID,
	).Scan(&appStatus, &currentHandlerID, &appNo, &applicantName, &registerID)
	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAppNotFound, "该开户申请不存在或已被删除"))
		return
	}

	if appStatus == string(models.StatusArchived) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeHandoverStatusError,
			"申请已归档，状态不允许进行交接操作"))
		return
	}

	var isRelated bool
	switch user.Role {
	case models.RoleRegister:
		isRelated = currentHandlerID == user.ID || registerID == user.ID
	case models.RoleAuditor, models.RoleReviewer:
		isRelated = currentHandlerID == user.ID
	}
	if !isRelated {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAuthForbidden, "您不是此申请的当前处理人，无权发起交接"))
		return
	}

	var toUserName string
	var toUserRole models.Role
	err = db.DB.QueryRow("SELECT real_name, role FROM users WHERE id=?", req.ToUserID).
		Scan(&toUserName, &toUserRole)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "接收人不存在"))
		return
	}

	switch appStatus {
	case string(models.StatusDraft), string(models.StatusNeedCorrection):
		if toUserRole != models.RoleRegister {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(utils.Fail(utils.CodeHandoverRoleMismatch,
				"当前申请为【"+models.ApplicationStatus(appStatus).DisplayName()+"】状态，接收人岗位必须是开户登记员（目标为["+toUserRole.DisplayName()+"]）"))
			return
		}
	case string(models.StatusPendingAudit):
		if toUserRole != models.RoleAuditor {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(utils.Fail(utils.CodeHandoverRoleMismatch,
				"当前申请为【待审核】状态，接收人岗位必须是开户审核主管（目标为["+toUserRole.DisplayName()+"]）"))
			return
		}
	case string(models.StatusPendingReview):
		if toUserRole != models.RoleReviewer {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(utils.Fail(utils.CodeHandoverRoleMismatch,
				"当前申请为【待复核】状态，接收人岗位必须是复核负责人（目标为["+toUserRole.DisplayName()+"]）"))
			return
		}
	}

	tx, _ := db.DB.Begin()
	defer tx.Rollback()

	now := time.Now()
	res, err := tx.Exec(`
		INSERT INTO handovers(
			application_id, from_user_id, from_shift, to_user_id, to_shift,
			status, handover_remark, created_at
		) VALUES(?,?,?,?,?,?,?,?)`,
		req.ApplicationID, user.ID, user.Shift, req.ToUserID, req.ToShift,
		models.HandoverPending, req.Remark, now,
	)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "创建交接记录失败: "+err.Error()))
		return
	}
	handoverID, _ := res.LastInsertId()

	opDetail := "【发起交接】交出人：" + user.RealName + "（" + user.Role.DisplayName() + "/" + user.Shift + "）→ 接收人：" + toUserName + "（" + toUserRole.DisplayName() + "/" + req.ToShift + "）"
	opDetail += "，交接说明：" + req.Remark
	opDetail += "，申请当前状态：【" + models.ApplicationStatus(appStatus).DisplayName() + "】"
	writeOpLog(tx, req.ApplicationID, appNo, user,
		"发起交接", opDetail, appStatus, appStatus, r.RemoteAddr)

	tx.Commit()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.SuccessMsg(
		"交接发起成功，等待【"+toUserName+"】接收确认。交接单ID："+strconv.FormatInt(handoverID, 10),
		map[string]interface{}{"handoverId": handoverID}))
}

type ConfirmHandoverRequest struct {
	Accepted bool   `json:"accepted"`
	Remark   string `json:"remark"`
}

func ConfirmHandover(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(middleware.ContextUserKey).(*models.User)
	idStr := chi.URLParam(r, "id")
	id, _ := strconv.ParseInt(idStr, 10, 64)

	var req ConfirmHandoverRequest
	json.NewDecoder(r.Body).Decode(&req)

	var appID int64
	var appNo string
	var applicantName string
	var toUserID int64
	var fromUserID int64
	var fromShift string
	var toShift string
	var handoverStatus string
	var appStatus string
	var handoverRemark string
	var fromUserName, toUserName string
	err := db.DB.QueryRow(`
		SELECT h.application_id, h.to_user_id, h.from_user_id, h.from_shift, h.to_shift,
			h.status, h.handover_remark,
			a.application_no, a.applicant_name, a.status,
			fu.real_name, tu.real_name
		FROM handovers h 
		JOIN applications a ON h.application_id = a.id
		JOIN users fu ON h.from_user_id = fu.id
		JOIN users tu ON h.to_user_id = tu.id
		WHERE h.id=?`, id).
		Scan(&appID, &toUserID, &fromUserID, &fromShift, &toShift,
			&handoverStatus, &handoverRemark, &appNo, &applicantName, &appStatus,
			&fromUserName, &toUserName)
	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(utils.Fail(404, "交接单不存在"))
		return
	}
	if handoverStatus != string(models.HandoverPending) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeHandoverStatusError,
			"当前交接状态为【"+models.HandoverStatus(handoverStatus).DisplayName()+"】，不能重复确认"))
		return
	}
	if appStatus == string(models.StatusArchived) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeHandoverStatusError,
			"关联的开户申请已归档（状态：【"+models.ApplicationStatus(appStatus).DisplayName()+"】），无法确认交接"))
		return
	}
	if toUserID != user.ID {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAuthForbidden, "此交接单的接收人不是您，无权确认"))
		return
	}

	tx, _ := db.DB.Begin()
	defer tx.Rollback()

	now := time.Now()
	newHandoverStatus := models.HandoverAccepted
	if !req.Accepted {
		newHandoverStatus = models.HandoverRejected
	}

	_, err = tx.Exec(`
		UPDATE handovers SET status=?, accept_remark=?, confirmed_at=? WHERE id=?`,
		newHandoverStatus, req.Remark, now, id)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "更新交接状态失败"))
		return
	}

	if req.Accepted {
		_, err = tx.Exec(`
			UPDATE applications SET current_handler_id=?, updated_at=? WHERE id=?`,
			user.ID, now, appID)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(utils.Fail(500, "更新申请处理人失败"))
			return
		}

		opDetail := "【交接确认-接收】交出人：" + fromUserName + "（" + fromShift + "）→ 接收人：" + toUserName + "（" + toShift + "）"
		opDetail += "，交接说明：" + handoverRemark
		if req.Remark != "" {
			opDetail += "，接收备注：" + req.Remark
		}
		opDetail += "，申请当前状态：【" + models.ApplicationStatus(appStatus).DisplayName() + "】"
		opDetail += "，处理人已变更为：" + user.RealName + "（" + user.Shift + "）"
		writeOpLog(tx, appID, appNo, user,
			"接收交接", opDetail, appStatus, appStatus, r.RemoteAddr)
	} else {
		opDetail := "【交接确认-拒绝】交出人：" + fromUserName + "（" + fromShift + "）→ 接收人：" + toUserName + "（" + toShift + "）"
		opDetail += "，交接说明：" + handoverRemark
		opDetail += "，拒绝原因：" + req.Remark
		opDetail += "，申请当前状态：【" + models.ApplicationStatus(appStatus).DisplayName() + "】"
		opDetail += "，原处理人保持不变"
		writeOpLog(tx, appID, appNo, user,
			"拒绝交接", opDetail, appStatus, appStatus, r.RemoteAddr)
	}

	tx.Commit()

	msg := "交接已确认接收，此申请的当前处理人已变更为您【" + user.RealName + "(" + user.Shift + ")】"
	if !req.Accepted {
		msg = "已拒绝接收该交接，原处理人不变"
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.SuccessMsg(msg, nil))
}

func ListHandovers(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(middleware.ContextUserKey).(*models.User)
	statusFilter := r.URL.Query().Get("status")
	scope := r.URL.Query().Get("scope")

	where := []string{"1=1"}
	args := []interface{}{}
	idx := 1

	if statusFilter != "" {
		where = append(where, "h.status = $"+strconv.Itoa(idx))
		args = append(args, statusFilter)
		idx++
	}

	switch scope {
	case "incoming":
		where = append(where, "h.to_user_id = $"+strconv.Itoa(idx))
		args = append(args, user.ID)
		idx++
	case "outgoing":
		where = append(where, "h.from_user_id = $"+strconv.Itoa(idx))
		args = append(args, user.ID)
		idx++
	case "mine":
		where = append(where, "(h.to_user_id = $"+strconv.Itoa(idx)+" OR h.from_user_id = $"+strconv.Itoa(idx+1)+")")
		args = append(args, user.ID, user.ID)
		idx += 2
	}

	whereSQL := "WHERE " + joinStrings(where, " AND ")
	sql := `
	SELECT h.id, h.application_id, a.application_no, a.applicant_name,
		a.status, a.current_handler_id, ch.real_name, ch.role,
		h.from_user_id, fu.real_name, fu.role, h.from_shift,
		h.to_user_id, tu.real_name, tu.role, h.to_shift,
		h.status, h.handover_remark, h.accept_remark,
		h.created_at, h.confirmed_at
	FROM handovers h
	JOIN applications a ON h.application_id = a.id
	JOIN users fu ON h.from_user_id = fu.id
	JOIN users tu ON h.to_user_id = tu.id
	JOIN users ch ON a.current_handler_id = ch.id
	` + whereSQL + `
	ORDER BY h.id DESC
	LIMIT 100
	`

	rows, err := db.DB.Query(sql, args...)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "查询交接列表失败: "+err.Error()))
		return
	}
	defer rows.Close()

	list := []models.Handover{}
	for rows.Next() {
		var h models.Handover
		var fromRole, toRole, currentHandlerRole, appStatus string
		var confirmedAt *time.Time
		err := rows.Scan(
			&h.ID, &h.ApplicationID, &h.ApplicationNo, &h.ApplicantName,
			&appStatus, &h.CurrentHandlerID, &h.CurrentHandlerName, &currentHandlerRole,
			&h.FromUserID, &h.FromUserName, &fromRole, &h.FromShift,
			&h.ToUserID, &h.ToUserName, &toRole, &h.ToShift,
			&h.Status, &h.HandoverRemark, &h.AcceptRemark,
			&h.CreatedAt, &confirmedAt,
		)
		if err != nil {
			continue
		}
		h.AppStatus = appStatus
		h.AppStatusDisplay = models.ApplicationStatus(appStatus).DisplayName()
		h.CurrentHandlerRole = models.Role(currentHandlerRole).DisplayName()
		h.StatusDisplay = h.Status.DisplayName()
		h.FromUserRole = models.Role(fromRole).DisplayName()
		h.ToUserRole = models.Role(toRole).DisplayName()
		if confirmedAt != nil {
			h.ConfirmedAt = confirmedAt
		}
		list = append(list, h)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.Success(list))
}

func joinStrings(arr []string, sep string) string {
	res := ""
	for i, s := range arr {
		if i > 0 {
			res += sep
		}
		res += s
	}
	return res
}
