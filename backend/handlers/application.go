package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"water-office/db"
	"water-office/middleware"
	"water-office/models"
	"water-office/utils"
)

func scanApplication(row *sql.Row) (models.Application, error) {
	var app models.Application
	var auditorID, reviewerID sql.NullInt64
	var submittedAt, auditedAt, reviewedAt *time.Time

	err := row.Scan(
		&app.ID, &app.ApplicationNo,
		&app.ApplicantName, &app.ApplicantIDCard, &app.ApplicantPhone, &app.ApplicantAddress,
		&app.WaterUsageType, &app.PropertyType,
		&app.IDCardFrontImg, &app.IDCardBackImg, &app.PropertyCertificate,
		&app.Status,
		&app.CurrentHandlerID,
		&app.RegisterID, &auditorID, &reviewerID,
		&app.RejectReason, &app.LastRemark,
		&submittedAt, &auditedAt, &reviewedAt,
		&app.CreatedAt, &app.UpdatedAt,
	)
	if err != nil {
		return app, err
	}

	app.StatusDisplay = app.Status.DisplayName()
	if auditorID.Valid {
		id := auditorID.Int64
		app.AuditorID = &id
	}
	if reviewerID.Valid {
		id := reviewerID.Int64
		app.ReviewerID = &id
	}
	if submittedAt != nil {
		app.SubmittedAt = submittedAt
	}
	if auditedAt != nil {
		app.AuditedAt = auditedAt
	}
	if reviewedAt != nil {
		app.ReviewedAt = reviewedAt
	}

	registerName := getUserName(app.RegisterID)
	app.RegisterName = registerName

	if app.AuditorID != nil {
		app.AuditorName = getUserName(*app.AuditorID)
	}
	if app.ReviewerID != nil {
		app.ReviewerName = getUserName(*app.ReviewerID)
	}

	handler := getUserInfo(app.CurrentHandlerID)
	app.CurrentHandlerName = handler.RealName
	app.CurrentHandlerRole = handler.Role.DisplayName()

	return app, nil
}

func scanApplicationRows(rows *sql.Rows) ([]models.Application, error) {
	var apps []models.Application
	for rows.Next() {
		var app models.Application
		var auditorID, reviewerID sql.NullInt64
		var submittedAt, auditedAt, reviewedAt *time.Time

		err := rows.Scan(
			&app.ID, &app.ApplicationNo,
			&app.ApplicantName, &app.ApplicantIDCard, &app.ApplicantPhone, &app.ApplicantAddress,
			&app.WaterUsageType, &app.PropertyType,
			&app.IDCardFrontImg, &app.IDCardBackImg, &app.PropertyCertificate,
			&app.Status,
			&app.CurrentHandlerID,
			&app.RegisterID, &auditorID, &reviewerID,
			&app.RejectReason, &app.LastRemark,
			&submittedAt, &auditedAt, &reviewedAt,
			&app.CreatedAt, &app.UpdatedAt,
		)
		if err != nil {
			continue
		}
		app.StatusDisplay = app.Status.DisplayName()
		if auditorID.Valid {
			id := auditorID.Int64
			app.AuditorID = &id
		}
		if reviewerID.Valid {
			id := reviewerID.Int64
			app.ReviewerID = &id
		}
		if submittedAt != nil {
			app.SubmittedAt = submittedAt
		}
		if auditedAt != nil {
			app.AuditedAt = auditedAt
		}
		if reviewedAt != nil {
			app.ReviewedAt = reviewedAt
		}

		app.RegisterName = getUserName(app.RegisterID)
		if app.AuditorID != nil {
			app.AuditorName = getUserName(*app.AuditorID)
		}
		if app.ReviewerID != nil {
			app.ReviewerName = getUserName(*app.ReviewerID)
		}
		handler := getUserInfo(app.CurrentHandlerID)
		app.CurrentHandlerName = handler.RealName
		app.CurrentHandlerRole = handler.Role.DisplayName()

		apps = append(apps, app)
	}
	return apps, nil
}

type userInfo struct {
	RealName string
	Role     models.Role
	Shift    string
}

func getUserName(userID int64) string {
	var name string
	db.DB.QueryRow("SELECT real_name FROM users WHERE id=?", userID).Scan(&name)
	return name
}

func getUserInfo(userID int64) userInfo {
	var info userInfo
	db.DB.QueryRow("SELECT real_name, role, shift FROM users WHERE id=?", userID).Scan(&info.RealName, &info.Role, &info.Shift)
	return info
}

func baseSelectSQL() string {
	return `
	SELECT id, application_no,
		applicant_name, applicant_id_card, applicant_phone, applicant_address,
		water_usage_type, property_type,
		id_card_front_img, id_card_back_img, property_certificate,
		status, current_handler_id,
		register_id, auditor_id, reviewer_id,
		reject_reason, last_remark,
		submitted_at, audited_at, reviewed_at,
		created_at, updated_at
	FROM applications
	`
}

func ListApplications(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(middleware.ContextUserKey).(*models.User)

	statusFilter := r.URL.Query().Get("status")
	keyword := r.URL.Query().Get("keyword")
	onlyMine := r.URL.Query().Get("onlyMine")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	whereClauses := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if statusFilter != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, statusFilter)
		argIdx++
	}
	if keyword != "" {
		kw := "%" + keyword + "%"
		whereClauses = append(whereClauses, fmt.Sprintf("(applicant_name LIKE $%d OR application_no LIKE $%d OR applicant_phone LIKE $%d)", argIdx, argIdx+1, argIdx+2))
		args = append(args, kw, kw, kw)
		argIdx += 3
	}
	if onlyMine == "1" && user != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("current_handler_id = $%d OR register_id = $%d", argIdx, argIdx+1))
		args = append(args, user.ID, user.ID)
		argIdx += 2
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	countSQL := "SELECT COUNT(*) FROM applications WHERE " + whereSQL
	var total int64
	db.DB.QueryRow(countSQL, args...).Scan(&total)

	listSQL := baseSelectSQL() + " WHERE " + whereSQL + " ORDER BY id DESC LIMIT $" + fmt.Sprintf("%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, pageSize, (page-1)*pageSize)

	rows, err := db.DB.Query(listSQL, args...)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "查询申请列表失败: "+err.Error()))
		return
	}
	defer rows.Close()

	apps, err := scanApplicationRows(rows)
	if err != nil {
		apps = []models.Application{}
	}

	result := map[string]interface{}{
		"list":     apps,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.Success(result))
}

func GetApplication(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "申请ID格式错误"))
		return
	}

	row := db.DB.QueryRow(baseSelectSQL()+" WHERE id = ?", id)
	app, err := scanApplication(row)
	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAppNotFound, "该开户申请不存在或已被删除"))
		return
	}
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "查询申请详情失败: "+err.Error()))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.Success(app))
}

type CreateAppRequest struct {
	ApplicantName       string `json:"applicantName"`
	ApplicantIDCard     string `json:"applicantIdCard"`
	ApplicantPhone      string `json:"applicantPhone"`
	ApplicantAddress    string `json:"applicantAddress"`
	WaterUsageType      string `json:"waterUsageType"`
	PropertyType        string `json:"propertyType"`
	IDCardFrontImg      string `json:"idCardFrontImg"`
	IDCardBackImg       string `json:"idCardBackImg"`
	PropertyCertificate string `json:"propertyCertificate"`
	SubmitNow           bool   `json:"submitNow"`
}

func CreateApplication(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(middleware.ContextUserKey).(*models.User)

	var req CreateAppRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "请求参数格式错误"))
		return
	}

	requiredFields := map[string]string{
		"申请人姓名":    req.ApplicantName,
		"身份证号":     req.ApplicantIDCard,
		"联系电话":     req.ApplicantPhone,
		"申请地址":     req.ApplicantAddress,
		"用水类型":     req.WaterUsageType,
		"房屋性质":     req.PropertyType,
	}
	missing := []string{}
	for k, v := range requiredFields {
		if v == "" {
			missing = append(missing, k)
		}
	}
	if req.SubmitNow && (req.IDCardFrontImg == "" || req.IDCardBackImg == "" || req.PropertyCertificate == "") {
		missing = append(missing, "身份证正面图", "身份证反面图", "房产证明")
	}
	if len(missing) > 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAppIncompleteData, "资料不完整，缺少必填字段: "+strings.Join(missing, "、")))
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "创建事务失败: "+err.Error()))
		return
	}
	defer tx.Rollback()

	appNo := fmt.Sprintf("WS%s%04d", time.Now().Format("20060102"), time.Now().Unix()%10000)
	status := models.StatusDraft
	var submittedAt interface{} = nil
	if req.SubmitNow {
		status = models.StatusPendingAudit
		submittedAt = time.Now()
	}

	var handlerID int64
	if req.SubmitNow {
		handlerID = 3
		row := tx.QueryRow("SELECT id FROM users WHERE role = 'auditor' ORDER BY id LIMIT 1")
		row.Scan(&handlerID)
	} else {
		handlerID = user.ID
	}

	res, err := tx.Exec(`
		INSERT INTO applications(
			application_no,
			applicant_name, applicant_id_card, applicant_phone, applicant_address,
			water_usage_type, property_type,
			id_card_front_img, id_card_back_img, property_certificate,
			status, current_handler_id, register_id, submitted_at, updated_at
		) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		appNo,
		req.ApplicantName, req.ApplicantIDCard, req.ApplicantPhone, req.ApplicantAddress,
		req.WaterUsageType, req.PropertyType,
		req.IDCardFrontImg, req.IDCardBackImg, req.PropertyCertificate,
		status, handlerID, user.ID, submittedAt, time.Now(),
	)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "创建申请失败: "+err.Error()))
		return
	}
	appID, _ := res.LastInsertId()

	opType := "创建草稿"
	opDetail := "创建开户申请，申请编号：" + appNo
	fromStatus := ""
	toStatus := string(models.StatusDraft)
	if req.SubmitNow {
		opType = "提交审核"
		opDetail = "创建并提交开户申请进入审核流程，申请编号：" + appNo
		fromStatus = string(models.StatusDraft)
		toStatus = string(models.StatusPendingAudit)
	}
	writeOpLog(tx, appID, appNo, user, opType, opDetail, fromStatus, toStatus, r.RemoteAddr)

	if err = tx.Commit(); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "提交事务失败: "+err.Error()))
		return
	}

	row := db.DB.QueryRow(baseSelectSQL()+" WHERE id = ?", appID)
	app, _ := scanApplication(row)

	msg := "申请草稿保存成功"
	if req.SubmitNow {
		msg = "申请已成功提交，状态变更为【待审核】，请等待开户审核主管办理"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.SuccessMsg(msg, app))
}

type UpdateAppRequest struct {
	ApplicantName       string `json:"applicantName"`
	ApplicantIDCard     string `json:"applicantIdCard"`
	ApplicantPhone      string `json:"applicantPhone"`
	ApplicantAddress    string `json:"applicantAddress"`
	WaterUsageType      string `json:"waterUsageType"`
	PropertyType        string `json:"propertyType"`
	IDCardFrontImg      string `json:"idCardFrontImg"`
	IDCardBackImg       string `json:"idCardBackImg"`
	PropertyCertificate string `json:"propertyCertificate"`
	Remark              string `json:"remark"`
}

func UpdateApplication(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(middleware.ContextUserKey).(*models.User)
	idStr := chi.URLParam(r, "id")
	id, _ := strconv.ParseInt(idStr, 10, 64)

	oldAppRow := db.DB.QueryRow("SELECT id, status, register_id FROM applications WHERE id=?", id)
	var oldStatus string
	var registerID int64
	var appNo string
	err := oldAppRow.Scan(&id, &oldStatus, &registerID)
	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAppNotFound, "该开户申请不存在或已被删除"))
		return
	}
	db.DB.QueryRow("SELECT application_no FROM applications WHERE id=?", id).Scan(&appNo)

	if oldStatus != string(models.StatusDraft) && oldStatus != string(models.StatusNeedCorrection) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAppStatusError, "当前状态【"+models.ApplicationStatus(oldStatus).DisplayName()+"】不允许修改资料，仅草稿和需补正状态可编辑"))
		return
	}
	if user.ID != registerID {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAuthForbidden, "仅申请人本人可以修改该申请"))
		return
	}

	var req UpdateAppRequest
	if err = json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "请求参数格式错误"))
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "创建事务失败"))
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		UPDATE applications SET
			applicant_name=?, applicant_id_card=?, applicant_phone=?, applicant_address=?,
			water_usage_type=?, property_type=?,
			id_card_front_img=?, id_card_back_img=?, property_certificate=?,
			last_remark=?, updated_at=?
		WHERE id=?`,
		req.ApplicantName, req.ApplicantIDCard, req.ApplicantPhone, req.ApplicantAddress,
		req.WaterUsageType, req.PropertyType,
		req.IDCardFrontImg, req.IDCardBackImg, req.PropertyCertificate,
		req.Remark, time.Now(), id,
	)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "更新申请失败: "+err.Error()))
		return
	}

	opDetail := "修改申请资料"
	if oldStatus == string(models.StatusNeedCorrection) {
		opDetail = "补正资料后修改: " + req.Remark
	}
	writeOpLog(tx, id, appNo, user, "修改资料", opDetail, oldStatus, oldStatus, r.RemoteAddr)

	if err = tx.Commit(); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "提交事务失败"))
		return
	}

	row := db.DB.QueryRow(baseSelectSQL()+" WHERE id=?", id)
	app, _ := scanApplication(row)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.SuccessMsg("申请资料更新成功", app))
}

type StateChangeRequest struct {
	Remark string `json:"remark"`
	Reason string `json:"reason"`
}

func SubmitApplication(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(middleware.ContextUserKey).(*models.User)
	idStr := chi.URLParam(r, "id")
	id, _ := strconv.ParseInt(idStr, 10, 64)

	var req StateChangeRequest
	json.NewDecoder(r.Body).Decode(&req)

	var oldStatus string
	var registerID int64
	var appNo string
	var missingFields []string
	row := db.DB.QueryRow(`
		SELECT status, register_id, application_no,
			CASE WHEN id_card_front_img='' OR id_card_front_img IS NULL THEN '身份证正面图;' ELSE '' END ||
			CASE WHEN id_card_back_img='' OR id_card_back_img IS NULL THEN '身份证反面图;' ELSE '' END ||
			CASE WHEN property_certificate='' OR property_certificate IS NULL THEN '房产证明;' ELSE '' END
		FROM applications WHERE id=?`, id)
	var missingStr string
	err := row.Scan(&oldStatus, &registerID, &appNo, &missingStr)
	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAppNotFound, "该开户申请不存在或已被删除"))
		return
	}
	if missingStr != "" {
		missingFields = strings.Split(strings.Trim(missingStr, ";"), ";")
	}

	if oldStatus != string(models.StatusDraft) && oldStatus != string(models.StatusNeedCorrection) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAppStatusError,
			"当前状态【"+models.ApplicationStatus(oldStatus).DisplayName()+"】不允许提交审核"))
		return
	}
	if user.ID != registerID {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAuthForbidden, "仅申请人本人可以提交该申请"))
		return
	}
	if len(missingFields) > 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAppIncompleteData,
			"资料不完整，无法提交审核。请补充: "+strings.Join(missingFields, "、")))
		return
	}

	tx, _ := db.DB.Begin()
	defer tx.Rollback()

	var auditorID int64
	row2 := tx.QueryRow("SELECT id FROM users WHERE role = 'auditor' ORDER BY id LIMIT 1")
	row2.Scan(&auditorID)

	now := time.Now()
	_, err = tx.Exec(`
		UPDATE applications SET
			status=?, current_handler_id=?, reject_reason='', last_remark=?,
			submitted_at=COALESCE(submitted_at,?), updated_at=?
		WHERE id=?`,
		models.StatusPendingAudit, auditorID, req.Remark, now, now, id,
	)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "提交审核失败: "+err.Error()))
		return
	}

	opDetail := "提交审核，资料已补正完整"
	if req.Remark != "" {
		opDetail += "，备注：" + req.Remark
	}
	writeOpLog(tx, id, appNo, user, "提交审核", opDetail, oldStatus, string(models.StatusPendingAudit), r.RemoteAddr)

	tx.Commit()

	row = db.DB.QueryRow(baseSelectSQL()+" WHERE id=?", id)
	app, _ := scanApplication(row)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.SuccessMsg(
		"提交成功，申请已流转至【待审核】，当前处理人："+getUserName(auditorID), app))
}

func AuditApplication(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(middleware.ContextUserKey).(*models.User)
	idStr := chi.URLParam(r, "id")
	id, _ := strconv.ParseInt(idStr, 10, 64)
	approved := r.URL.Query().Get("approved") == "1"

	var req StateChangeRequest
	json.NewDecoder(r.Body).Decode(&req)

	var oldStatus string
	var currentHandlerID int64
	var appNo string
	var applicantName string
	err := db.DB.QueryRow("SELECT status, current_handler_id, application_no, applicant_name FROM applications WHERE id=?", id).
		Scan(&oldStatus, &currentHandlerID, &appNo, &applicantName)
	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAppNotFound, "该开户申请不存在或已被删除"))
		return
	}
	if oldStatus != string(models.StatusPendingAudit) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAppStatusError,
			"当前状态【"+models.ApplicationStatus(oldStatus).DisplayName()+"】不允许审核，仅待审核状态可办理"))
		return
	}
	if currentHandlerID != user.ID {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAuthForbidden, "当前申请处理人不是您，无权审核此申请"))
		return
	}

	if !approved && req.Reason == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "退回申请必须填写退回原因"))
		return
	}

	tx, _ := db.DB.Begin()
	defer tx.Rollback()

	var newStatus models.ApplicationStatus
	var newHandlerID int64
	var opType, opDetail string
	var now = time.Now()

	if approved {
		newStatus = models.StatusPendingReview
		row3 := tx.QueryRow("SELECT id FROM users WHERE role = 'reviewer' ORDER BY id LIMIT 1")
		row3.Scan(&newHandlerID)
		_, err = tx.Exec(`
			UPDATE applications SET
				status=?, current_handler_id=?, auditor_id=?, audited_at=?,
				reject_reason='', last_remark=?, updated_at=?
			WHERE id=?`,
			newStatus, newHandlerID, user.ID, now, req.Remark, now, id)
		opType = "审核通过"
		opDetail = "审核通过该申请，资料齐全符合要求"
		if req.Remark != "" {
			opDetail += "，审核意见：" + req.Remark
		}
	} else {
		newStatus = models.StatusNeedCorrection
		row3 := tx.QueryRow("SELECT register_id FROM applications WHERE id=?", id)
		row3.Scan(&newHandlerID)
		_, err = tx.Exec(`
			UPDATE applications SET
				status=?, current_handler_id=?, auditor_id=?, audited_at=?,
				reject_reason=?, last_remark=?, updated_at=?
			WHERE id=?`,
			newStatus, newHandlerID, user.ID, now, req.Reason, req.Remark, now, id)
		opType = "审核退回"
		opDetail = "审核退回，退回原因：" + req.Reason
	}
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "处理审核失败: "+err.Error()))
		return
	}

	writeOpLog(tx, id, appNo, user, opType, opDetail, oldStatus, string(newStatus), r.RemoteAddr)
	tx.Commit()

	row := db.DB.QueryRow(baseSelectSQL()+" WHERE id=?", id)
	app, _ := scanApplication(row)

	msg := "审核通过，申请流转至【待复核】，复核人：" + getUserName(newHandlerID)
	if !approved {
		msg = "审核退回，申请已退回登记员【" + getUserName(newHandlerID) + "】补正，退回原因：" + req.Reason
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.SuccessMsg(msg, app))
}

func ReviewApplication(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(middleware.ContextUserKey).(*models.User)
	idStr := chi.URLParam(r, "id")
	id, _ := strconv.ParseInt(idStr, 10, 64)
	approved := r.URL.Query().Get("approved") == "1"

	var req StateChangeRequest
	json.NewDecoder(r.Body).Decode(&req)

	var oldStatus string
	var currentHandlerID int64
	var appNo string
	var auditorID int64
	err := db.DB.QueryRow("SELECT status, current_handler_id, application_no, auditor_id FROM applications WHERE id=?", id).
		Scan(&oldStatus, &currentHandlerID, &appNo, &auditorID)
	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAppNotFound, "该开户申请不存在或已被删除"))
		return
	}
	if oldStatus != string(models.StatusPendingReview) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAppStatusError,
			"当前状态【"+models.ApplicationStatus(oldStatus).DisplayName()+"】不允许复核操作"))
		return
	}
	if currentHandlerID != user.ID {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(utils.Fail(utils.CodeAuthForbidden, "当前申请处理人不是您，无权复核此申请"))
		return
	}

	if !approved && req.Reason == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "复核退回必须填写退回原因"))
		return
	}

	tx, _ := db.DB.Begin()
	defer tx.Rollback()

	var newStatus models.ApplicationStatus
	var newHandlerID int64
	var opType, opDetail string
	now := time.Now()

	if approved {
		newStatus = models.StatusArchived
		newHandlerID = user.ID
		_, err = tx.Exec(`
			UPDATE applications SET
				status=?, current_handler_id=?, reviewer_id=?, reviewed_at=?,
				last_remark=?, updated_at=?
			WHERE id=?`,
			newStatus, newHandlerID, user.ID, now, req.Remark, now, id)
		opType = "复核归档"
		opDetail = "复核通过，申请已归档"
		if req.Remark != "" {
			opDetail += "，复核意见：" + req.Remark
		}
	} else {
		newStatus = models.StatusPendingAudit
		newHandlerID = auditorID
		_, err = tx.Exec(`
			UPDATE applications SET
				status=?, current_handler_id=?, reviewed_at=?,
				reject_reason=?, last_remark=?, updated_at=?
			WHERE id=?`,
			newStatus, newHandlerID, now, req.Reason, req.Remark, now, id)
		opType = "复核退回"
		opDetail = "复核退回至审核主管，原因：" + req.Reason
	}
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "处理复核失败: "+err.Error()))
		return
	}

	writeOpLog(tx, id, appNo, user, opType, opDetail, oldStatus, string(newStatus), r.RemoteAddr)
	tx.Commit()

	row := db.DB.QueryRow(baseSelectSQL()+" WHERE id=?", id)
	app, _ := scanApplication(row)

	msg := "复核通过，申请已完成归档，开户流程结束"
	if !approved {
		msg = "复核退回至审核主管【" + getUserName(newHandlerID) + "】重新审核，退回原因：" + req.Reason
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.SuccessMsg(msg, app))
}

func writeOpLog(tx *sql.Tx, appID int64, appNo string, user *models.User, opType, opDetail, fromStatus, toStatus, ip string) {
	tx.Exec(`
		INSERT INTO operation_logs(
			application_id, application_no, user_id, user_name, user_role,
			operation, operation_detail, from_status, to_status, ip_address
		) VALUES(?,?,?,?,?,?,?,?,?,?)`,
		appID, appNo, user.ID, user.RealName, user.Role.DisplayName(),
		opType, opDetail, fromStatus, toStatus, ip,
	)
}
