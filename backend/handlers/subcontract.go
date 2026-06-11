package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"subcontract-system/db"
	"subcontract-system/middleware"
	"subcontract-system/models"
	"subcontract-system/utils"
)

type BatchItemResult struct {
	FormID  string `json:"form_id"`
	Code    string `json:"code"`
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Reason  string `json:"reason,omitempty"`
}

func scanForm(row *sql.Row) (*models.SubcontractForm, error) {
	var f models.SubcontractForm
	var rejectReason sql.NullString
	err := row.Scan(&f.ID, &f.Code, &f.SubcontractorName, &f.ProjectName, &f.EntryDate,
		&f.WorkersCount, &f.WorkContent, &f.Status, &f.Version, &f.CreatedBy,
		&f.CreatedAt, &f.UpdatedAt, &f.CurrentHandler, &rejectReason)
	if rejectReason.Valid {
		f.RejectReason = rejectReason.String
	}
	return &f, err
}

func getFormByID(id string) (*models.SubcontractForm, error) {
	row := db.DB.QueryRow(`SELECT id, code, subcontractor_name, project_name, entry_date, workers_count,
		work_content, status, version, created_by, created_at, updated_at, current_handler, reject_reason
		FROM subcontract_forms WHERE id = ?`, id)
	return scanForm(row)
}

func getEvidencesByFormID(formID string) ([]models.Evidence, error) {
	rows, err := db.DB.Query(`SELECT id, form_id, type, name, uploaded_by, uploaded_at, is_supplemental, supplement_note
		FROM evidences WHERE form_id = ? ORDER BY uploaded_at`, formID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Evidence
	for rows.Next() {
		var e models.Evidence
		var supNote sql.NullString
		var isSup int
		rows.Scan(&e.ID, &e.FormID, &e.Type, &e.Name, &e.UploadedBy, &e.UploadedAt, &isSup, &supNote)
		e.IsSupplemental = isSup == 1
		if supNote.Valid {
			e.SupplementNote = supNote.String
		}
		list = append(list, e)
	}
	return list, nil
}

func getSupplementsByFormID(formID string) ([]models.SupplementRecord, error) {
	rows, err := db.DB.Query(`SELECT id, form_id, performed_by, performed_at, action, details, reason
		FROM supplement_records WHERE form_id = ? ORDER BY performed_at DESC`, formID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.SupplementRecord
	for rows.Next() {
		var r models.SupplementRecord
		var detailsStr string
		var reason sql.NullString
		rows.Scan(&r.ID, &r.FormID, &r.PerformedBy, &r.PerformedAt, &r.Action, &detailsStr, &reason)
		json.Unmarshal([]byte(detailsStr), &r.Details)
		if reason.Valid {
			r.Reason = reason.String
		}
		list = append(list, r)
	}
	return list, nil
}

func getAuditLogsByFormID(formID string) ([]models.AuditLog, error) {
	rows, err := db.DB.Query(`SELECT id, form_id, user_id, action, from_status, to_status, timestamp, details
		FROM audit_logs WHERE form_id = ? ORDER BY timestamp DESC`, formID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.AuditLog
	for rows.Next() {
		var l models.AuditLog
		rows.Scan(&l.ID, &l.FormID, &l.UserID, &l.Action, &l.FromStatus, &l.ToStatus, &l.Timestamp, &l.Details)
		list = append(list, l)
	}
	return list, nil
}

func insertAuditLog(formID, userID, action, fromStatus, toStatus, details string) {
	db.DB.Exec(`INSERT INTO audit_logs (id, form_id, user_id, action, from_status, to_status, timestamp, details)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		utils.NewID(), formID, userID, action, fromStatus, toStatus, time.Now(), details)
}

func insertSupplement(formID, userID, action string, details map[string]string, reason string) {
	detStr, _ := json.Marshal(details)
	db.DB.Exec(`INSERT INTO supplement_records (id, form_id, performed_by, performed_at, action, details, reason)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		utils.NewID(), formID, userID, time.Now(), action, string(detStr), reason)
}

func getRequiredEvidenceTypes(status models.SubcontractStatus) []models.EvidenceType {
	switch status {
	case models.StatusPendingForeman:
		return []models.EvidenceType{models.EvidenceRegistration}
	case models.StatusPendingManager:
		return []models.EvidenceType{models.EvidenceRegistration, models.EvidenceInspection}
	case models.StatusVerified, models.StatusArchived:
		return []models.EvidenceType{models.EvidenceRegistration, models.EvidenceInspection, models.EvidenceArchive}
	default:
		return nil
	}
}

func hasEvidenceType(evidences []models.Evidence, et models.EvidenceType) bool {
	for _, e := range evidences {
		if e.Type == et {
			return true
		}
	}
	return false
}

func processFormCore(formID, action, userID string, userRole models.Role, expectedVersion int, reason string) (*models.SubcontractForm, *models.ErrorResponse) {
	form, err := getFormByID(formID)
	if err == sql.ErrNoRows {
		return nil, &models.ErrorResponse{Code: 404, Message: "分包进场单不存在", Reason: "form_not_found"}
	}
	if err != nil {
		return nil, &models.ErrorResponse{Code: 500, Message: "查询失败", Reason: "db_error"}
	}

	if expectedVersion > 0 && expectedVersion != form.Version {
		return form, &models.ErrorResponse{
			Code:    409,
			Message: fmt.Sprintf("表单版本冲突，当前版本为%d，您提交的是%d", form.Version, expectedVersion),
			Reason:  "version_conflict",
		}
	}

	switch action {
	case "submit":
		if userRole != models.RoleClerk {
			return form, &models.ErrorResponse{Code: 403, Message: "只有资料员可以提交登记", Reason: "wrong_role_submit"}
		}
		if form.Status != models.StatusDraft && form.Status != models.StatusRejected && form.Status != models.StatusPendingClerk {
			return form, &models.ErrorResponse{Code: 400, Message: fmt.Sprintf("当前状态%s不允许提交登记", form.Status), Reason: "wrong_status_submit"}
		}
		evidences, _ := getEvidencesByFormID(form.ID)
		required := getRequiredEvidenceTypes(models.StatusPendingForeman)
		var missing []string
		for _, et := range required {
			if !hasEvidenceType(evidences, et) {
				missing = append(missing, string(et))
			}
		}
		if len(missing) > 0 {
			return form, &models.ErrorResponse{Code: 400, Message: fmt.Sprintf("缺少必要证据: %s", strings.Join(missing, ", ")), Reason: "missing_evidence_registration"}
		}
		var foremanID string
		db.DB.QueryRow("SELECT id FROM users WHERE role = 'foreman' LIMIT 1").Scan(&foremanID)
		newVersion := form.Version + 1
		newStatus := models.StatusPendingForeman
		oldStatus := form.Status
		db.DB.Exec(`UPDATE subcontract_forms SET status=?, version=?, current_handler=?, updated_at=?, reject_reason='' WHERE id=?`,
			newStatus, newVersion, foremanID, time.Now(), form.ID)
		insertAuditLog(form.ID, userID, "submit", string(oldStatus), string(newStatus), "资料员提交登记，转施工负责人核验")
		insertSupplement(form.ID, userID, "submit", map[string]string{
			"from_version": fmt.Sprintf("%d", form.Version),
			"to_version":   fmt.Sprintf("%d", newVersion),
		}, "提交登记")
		form.Status = newStatus
		form.Version = newVersion
		form.CurrentHandler = foremanID
		form.RejectReason = ""

	case "verify_foreman":
		if userRole != models.RoleForeman {
			return form, &models.ErrorResponse{Code: 403, Message: "只有施工负责人可以执行现场核验", Reason: "wrong_role_foreman_verify"}
		}
		if form.Status != models.StatusPendingForeman {
			return form, &models.ErrorResponse{Code: 400, Message: fmt.Sprintf("当前状态%s不是待施工负责人核验", form.Status), Reason: "wrong_status_foreman_verify"}
		}
		if form.CurrentHandler != userID {
			return form, &models.ErrorResponse{Code: 403, Message: "该表单不由您处理，请等待分配", Reason: "not_current_handler"}
		}
		evidences, _ := getEvidencesByFormID(form.ID)
		if !hasEvidenceType(evidences, models.EvidenceInspection) {
			return form, &models.ErrorResponse{Code: 400, Message: "缺少现场核验证据，请先上传核验记录", Reason: "missing_evidence_inspection"}
		}
		var managerID string
		db.DB.QueryRow("SELECT id FROM users WHERE role = 'manager' LIMIT 1").Scan(&managerID)
		newVersion := form.Version + 1
		newStatus := models.StatusPendingManager
		oldStatus := form.Status
		db.DB.Exec(`UPDATE subcontract_forms SET status=?, version=?, current_handler=?, updated_at=? WHERE id=?`,
			newStatus, newVersion, managerID, time.Now(), form.ID)
		insertAuditLog(form.ID, userID, "verify_foreman", string(oldStatus), string(newStatus), "施工负责人现场核验通过，转项目经理确认")
		insertSupplement(form.ID, userID, "verify_foreman", map[string]string{
			"from_version": fmt.Sprintf("%d", form.Version),
			"to_version":   fmt.Sprintf("%d", newVersion),
		}, "现场核验通过")
		form.Status = newStatus
		form.Version = newVersion
		form.CurrentHandler = managerID

	case "reject_foreman":
		if userRole != models.RoleForeman {
			return form, &models.ErrorResponse{Code: 403, Message: "只有施工负责人可以驳回", Reason: "wrong_role_foreman_reject"}
		}
		if form.Status != models.StatusPendingForeman {
			return form, &models.ErrorResponse{Code: 400, Message: fmt.Sprintf("当前状态%s不允许驳回", form.Status), Reason: "wrong_status_foreman_reject"}
		}
		if form.CurrentHandler != userID {
			return form, &models.ErrorResponse{Code: 403, Message: "该表单不由您处理", Reason: "not_current_handler"}
		}
		if strings.TrimSpace(reason) == "" {
			return form, &models.ErrorResponse{Code: 400, Message: "驳回必须填写原因", Reason: "missing_reject_reason"}
		}
		var clerkID string
		db.DB.QueryRow("SELECT id FROM users WHERE role = 'clerk' LIMIT 1").Scan(&clerkID)
		newVersion := form.Version + 1
		newStatus := models.StatusPendingClerk
		oldStatus := form.Status
		db.DB.Exec(`UPDATE subcontract_forms SET status=?, version=?, current_handler=?, updated_at=?, reject_reason=? WHERE id=?`,
			newStatus, newVersion, clerkID, time.Now(), reason, form.ID)
		insertAuditLog(form.ID, userID, "reject_foreman", string(oldStatus), string(newStatus), "施工负责人核验驳回: "+reason)
		insertSupplement(form.ID, userID, "reject_foreman", map[string]string{"reason": reason}, reason)
		form.Status = newStatus
		form.Version = newVersion
		form.CurrentHandler = clerkID
		form.RejectReason = reason

	case "confirm_manager":
		if userRole != models.RoleManager {
			return form, &models.ErrorResponse{Code: 403, Message: "只有项目经理可以确认", Reason: "wrong_role_manager_confirm"}
		}
		if form.Status != models.StatusPendingManager {
			return form, &models.ErrorResponse{Code: 400, Message: fmt.Sprintf("当前状态%s不是待项目经理确认", form.Status), Reason: "wrong_status_manager_confirm"}
		}
		if form.CurrentHandler != userID {
			return form, &models.ErrorResponse{Code: 403, Message: "该表单不由您处理", Reason: "not_current_handler"}
		}
		evidences, _ := getEvidencesByFormID(form.ID)
		required := getRequiredEvidenceTypes(models.StatusVerified)
		var missing []string
		for _, et := range required {
			if !hasEvidenceType(evidences, et) {
				missing = append(missing, string(et))
			}
		}
		if len(missing) > 0 {
			return form, &models.ErrorResponse{Code: 400, Message: fmt.Sprintf("缺少必要证据: %s", strings.Join(missing, ", ")), Reason: "missing_evidence_final"}
		}
		newVersion := form.Version + 1
		newStatus := models.StatusVerified
		oldStatus := form.Status
		db.DB.Exec(`UPDATE subcontract_forms SET status=?, version=?, current_handler='', updated_at=? WHERE id=?`,
			newStatus, newVersion, time.Now(), form.ID)
		insertAuditLog(form.ID, userID, "confirm_manager", string(oldStatus), string(newStatus), "项目经理确认通过")
		insertSupplement(form.ID, userID, "confirm_manager", map[string]string{
			"from_version": fmt.Sprintf("%d", form.Version),
			"to_version":   fmt.Sprintf("%d", newVersion),
		}, "项目经理确认通过")
		form.Status = newStatus
		form.Version = newVersion
		form.CurrentHandler = ""

	case "reject_manager":
		if userRole != models.RoleManager {
			return form, &models.ErrorResponse{Code: 403, Message: "只有项目经理可以驳回", Reason: "wrong_role_manager_reject"}
		}
		if form.Status != models.StatusPendingManager {
			return form, &models.ErrorResponse{Code: 400, Message: fmt.Sprintf("当前状态%s不允许驳回", form.Status), Reason: "wrong_status_manager_reject"}
		}
		if form.CurrentHandler != userID {
			return form, &models.ErrorResponse{Code: 403, Message: "该表单不由您处理", Reason: "not_current_handler"}
		}
		if strings.TrimSpace(reason) == "" {
			return form, &models.ErrorResponse{Code: 400, Message: "驳回必须填写原因", Reason: "missing_reject_reason"}
		}
		var clerkID string
		db.DB.QueryRow("SELECT id FROM users WHERE role = 'clerk' LIMIT 1").Scan(&clerkID)
		newVersion := form.Version + 1
		newStatus := models.StatusPendingClerk
		oldStatus := form.Status
		db.DB.Exec(`UPDATE subcontract_forms SET status=?, version=?, current_handler=?, updated_at=?, reject_reason=? WHERE id=?`,
			newStatus, newVersion, clerkID, time.Now(), reason, form.ID)
		insertAuditLog(form.ID, userID, "reject_manager", string(oldStatus), string(newStatus), "项目经理驳回: "+reason)
		insertSupplement(form.ID, userID, "reject_manager", map[string]string{"reason": reason}, reason)
		form.Status = newStatus
		form.Version = newVersion
		form.CurrentHandler = clerkID
		form.RejectReason = reason

	case "archive":
		if userRole != models.RoleClerk {
			return form, &models.ErrorResponse{Code: 403, Message: "只有资料员可以归档", Reason: "wrong_role_archive"}
		}
		if form.Status != models.StatusVerified {
			return form, &models.ErrorResponse{Code: 400, Message: fmt.Sprintf("当前状态%s不允许归档，需先通过确认", form.Status), Reason: "wrong_status_archive"}
		}
		newStatus := models.StatusArchived
		oldStatus := form.Status
		db.DB.Exec(`UPDATE subcontract_forms SET status=?, updated_at=? WHERE id=?`,
			newStatus, time.Now(), form.ID)
		insertAuditLog(form.ID, userID, "archive", string(oldStatus), string(newStatus), "资料员归档")
		insertSupplement(form.ID, userID, "archive", map[string]string{}, "资料归档")
		form.Status = newStatus

	case "update_draft":
		if userRole != models.RoleClerk {
			return form, &models.ErrorResponse{Code: 403, Message: "只有资料员可以编辑草稿", Reason: "wrong_role_update_draft"}
		}
		if form.Status != models.StatusDraft && form.Status != models.StatusPendingClerk && form.Status != models.StatusRejected {
			return form, &models.ErrorResponse{Code: 400, Message: fmt.Sprintf("当前状态%s不允许编辑", form.Status), Reason: "wrong_status_update"}
		}
		db.DB.Exec(`UPDATE subcontract_forms SET updated_at=? WHERE id=?`, time.Now(), form.ID)
		insertSupplement(form.ID, userID, "update_draft", map[string]string{}, "编辑表单内容")

	default:
		return form, &models.ErrorResponse{Code: 400, Message: fmt.Sprintf("未知操作: %s", action), Reason: "unknown_action"}
	}

	return form, nil
}

func ListForms(c echo.Context) error {
	userRole := middleware.GetUserRole(c)
	userID := middleware.GetUserID(c)
	statusFilter := c.QueryParam("status")
	projectFilter := c.QueryParam("project")
	search := c.QueryParam("search")

	query := `SELECT id, code, subcontractor_name, project_name, entry_date, workers_count,
		work_content, status, version, created_by, created_at, updated_at, current_handler, reject_reason
		FROM subcontract_forms WHERE 1=1`
	args := []interface{}{}

	if statusFilter != "" {
		query += " AND status = ?"
		args = append(args, statusFilter)
	}
	if projectFilter != "" {
		query += " AND project_name = ?"
		args = append(args, projectFilter)
	}
	if search != "" {
		query += " AND (code LIKE ? OR subcontractor_name LIKE ? OR work_content LIKE ?)"
		s := "%" + search + "%"
		args = append(args, s, s, s)
	}

	if userRole == models.RoleClerk {
		query += " AND (status IN ('draft','pending_clerk','verified','archived','rejected') OR current_handler = ?)"
		args = append(args, userID)
	} else if userRole == models.RoleForeman {
		query += " AND (status = 'pending_foreman' OR current_handler = ?)"
		args = append(args, userID)
	} else if userRole == models.RoleManager {
		query += " AND (status = 'pending_manager' OR current_handler = ? OR status = 'verified' OR status = 'archived')"
		args = append(args, userID)
	}

	query += " ORDER BY updated_at DESC"

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: "查询失败"})
	}
	defer rows.Close()

	forms := []models.SubcontractForm{}
	for rows.Next() {
		var f models.SubcontractForm
		var rejectReason sql.NullString
		rows.Scan(&f.ID, &f.Code, &f.SubcontractorName, &f.ProjectName, &f.EntryDate,
			&f.WorkersCount, &f.WorkContent, &f.Status, &f.Version, &f.CreatedBy,
			&f.CreatedAt, &f.UpdatedAt, &f.CurrentHandler, &rejectReason)
		if rejectReason.Valid {
			f.RejectReason = rejectReason.String
		}
		forms = append(forms, f)
	}

	return c.JSON(http.StatusOK, forms)
}

func GetFormDetail(c echo.Context) error {
	id := c.Param("id")
	form, err := getFormByID(id)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, models.ErrorResponse{Code: 404, Message: "分包进场单不存在", Reason: "form_not_found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: "查询失败"})
	}

	evidences, _ := getEvidencesByFormID(id)
	supplements, _ := getSupplementsByFormID(id)
	auditLogs, _ := getAuditLogsByFormID(id)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"form":         form,
		"evidences":    evidences,
		"supplements":  supplements,
		"audit_logs":   auditLogs,
	})
}

func nextFormCode() string {
	var maxCode string
	db.DB.QueryRow("SELECT code FROM subcontract_forms ORDER BY code DESC LIMIT 1").Scan(&maxCode)
	nextNum := 1
	if maxCode != "" {
		parts := strings.Split(maxCode, "-")
		if len(parts) >= 2 {
			lastPart := parts[len(parts)-1]
			fmt.Sscanf(lastPart, "%d", &nextNum)
			nextNum++
		}
	}
	return fmt.Sprintf("FB-%04d", nextNum)
}

func CreateForm(c echo.Context) error {
	userRole := middleware.GetUserRole(c)
	if userRole != models.RoleClerk {
		return c.JSON(http.StatusForbidden, models.ErrorResponse{
			Code:    403,
			Message: "只有资料员可以创建分包进场单",
			Reason:  "wrong_role_create",
		})
	}

	var req models.CreateFormRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "参数格式错误", Reason: "invalid_request"})
	}

	if strings.TrimSpace(req.SubcontractorName) == "" {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "分包单位名称不能为空", Reason: "missing_subcontractor"})
	}
	if strings.TrimSpace(req.ProjectName) == "" {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "项目名称不能为空", Reason: "missing_project"})
	}
	if strings.TrimSpace(req.WorkContent) == "" {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "施工内容不能为空", Reason: "missing_work_content"})
	}
	if req.WorkersCount <= 0 {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "进场人数必须大于0", Reason: "invalid_workers_count"})
	}

	entryDate, err := time.Parse("2006-01-02", req.EntryDate)
	if err != nil {
		entryDate, _ = time.Parse(time.RFC3339, req.EntryDate)
	}
	if entryDate.IsZero() {
		entryDate = time.Now()
	}

	code := nextFormCode()

	form := models.SubcontractForm{
		ID:                utils.NewID(),
		Code:              code,
		SubcontractorName: req.SubcontractorName,
		ProjectName:       req.ProjectName,
		EntryDate:         entryDate,
		WorkersCount:      req.WorkersCount,
		WorkContent:       req.WorkContent,
		Status:            models.StatusDraft,
		Version:           1,
		CreatedBy:         middleware.GetUserID(c),
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
		CurrentHandler:    middleware.GetUserID(c),
	}

	_, err = db.DB.Exec(`INSERT INTO subcontract_forms 
		(id, code, subcontractor_name, project_name, entry_date, workers_count, work_content, 
		 status, version, created_by, created_at, updated_at, current_handler, reject_reason)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		form.ID, form.Code, form.SubcontractorName, form.ProjectName, form.EntryDate,
		form.WorkersCount, form.WorkContent, form.Status, form.Version, form.CreatedBy,
		form.CreatedAt, form.UpdatedAt, form.CurrentHandler, "")

	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: "创建失败", Reason: err.Error()})
	}

	insertAuditLog(form.ID, middleware.GetUserID(c), "create", "", string(models.StatusDraft),
		fmt.Sprintf("创建分包进场单 %s", form.Code))
	insertSupplement(form.ID, middleware.GetUserID(c), "create", map[string]string{
		"code":               form.Code,
		"subcontractor_name": form.SubcontractorName,
	}, "新建表单")

	return c.JSON(http.StatusCreated, form)
}

func ProcessForm(c echo.Context) error {
	var req models.ProcessFormRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "参数格式错误", Reason: "invalid_request"})
	}

	if req.FormID == "" {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "表单ID不能为空", Reason: "missing_form_id"})
	}

	if req.ExpectedVersion <= 0 {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    400,
			Message: "缺少版本号，请刷新页面后重试",
			Reason:  "missing_version",
		})
	}

	userID := middleware.GetUserID(c)
	userRole := middleware.GetUserRole(c)

	form, errResp := processFormCore(req.FormID, req.Action, userID, userRole, req.ExpectedVersion, req.Reason)
	if errResp != nil {
		return c.JSON(errResp.Code, errResp)
	}

	return c.JSON(http.StatusOK, form)
}

func BatchProcess(c echo.Context) error {
	var req models.BatchProcessRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "参数格式错误", Reason: "invalid_request"})
	}

	if len(req.FormIDs) == 0 {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "未选择任何表单", Reason: "no_forms_selected"})
	}

	userID := middleware.GetUserID(c)
	userRole := middleware.GetUserRole(c)

	results := []BatchItemResult{}
	successCount := 0
	failCount := 0

	for _, fid := range req.FormIDs {
		expectedVersion := 0
		hasVersion := false
		if req.FormVersions != nil {
			if v, ok := req.FormVersions[fid]; ok {
				expectedVersion = v
				hasVersion = true
			}
		}
		if !hasVersion || expectedVersion <= 0 {
			form, _ := getFormByID(fid)
			code := fid
			if form != nil {
				code = form.Code
			}
			results = append(results, BatchItemResult{
				FormID:  fid,
				Code:    code,
				Success: false,
				Message: "缺少选中时的版本号，请刷新列表后重新勾选",
				Reason:  "missing_version",
			})
			failCount++
			continue
		}
		form, errResp := processFormCore(fid, req.Action, userID, userRole, expectedVersion, req.Reason)
		item := BatchItemResult{
			FormID:  fid,
			Success: errResp == nil,
		}
		if form != nil {
			item.Code = form.Code
		} else {
			item.Code = fid
		}
		if errResp != nil {
			item.Message = errResp.Message
			item.Reason = errResp.Reason
			failCount++
		} else {
			successCount++
		}
		results = append(results, item)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"total":         len(req.FormIDs),
		"success_count": successCount,
		"fail_count":    failCount,
		"results":       results,
	})
}

func UploadEvidence(c echo.Context) error {
	var req models.UploadEvidenceRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "参数格式错误", Reason: "invalid_request"})
	}

	if req.FormID == "" || req.Name == "" || req.Type == "" {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    400,
			Message: "表单ID、证据名称、证据类型不能为空",
			Reason:  "missing_evidence_fields",
		})
	}

	form, err := getFormByID(req.FormID)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, models.ErrorResponse{Code: 404, Message: "分包进场单不存在", Reason: "form_not_found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: "查询失败"})
	}

	userID := middleware.GetUserID(c)

	if req.IsSupplemental {
		if form.CurrentHandler != userID {
			return c.JSON(http.StatusForbidden, models.ErrorResponse{
				Code:    403,
				Message: "补录证据只能由当前处理人执行",
				Reason:  "not_current_handler_supplement",
			})
		}
		if strings.TrimSpace(req.SupplementNote) == "" {
			return c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Code:    400,
				Message: "补录证据必须填写补录原因说明",
				Reason:  "missing_supplement_note",
			})
		}
	}

	evidences, _ := getEvidencesByFormID(req.FormID)
	for _, e := range evidences {
		if e.Name == req.Name && e.Type == req.Type && !e.IsSupplemental {
			return c.JSON(http.StatusConflict, models.ErrorResponse{
				Code:    409,
				Message: fmt.Sprintf("已存在同名证据 [%s]，请检查是否重复上传", req.Name),
				Reason:  "duplicate_evidence",
			})
		}
	}

	validTypes := map[models.EvidenceType]bool{
		models.EvidenceRegistration: true,
		models.EvidenceInspection:   true,
		models.EvidenceArchive:      true,
	}
	if !validTypes[req.Type] {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    400,
			Message: fmt.Sprintf("未知证据类型: %s", req.Type),
			Reason:  "invalid_evidence_type",
		})
	}

	evidence := models.Evidence{
		ID:             utils.NewID(),
		FormID:         req.FormID,
		Type:           req.Type,
		Name:           req.Name,
		UploadedBy:     userID,
		UploadedAt:     time.Now(),
		IsSupplemental: req.IsSupplemental,
		SupplementNote: req.SupplementNote,
	}

	_, err = db.DB.Exec(`INSERT INTO evidences (id, form_id, type, name, uploaded_by, uploaded_at, is_supplemental, supplement_note)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		evidence.ID, evidence.FormID, evidence.Type, evidence.Name, evidence.UploadedBy,
		evidence.UploadedAt, evidence.IsSupplemental, evidence.SupplementNote)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: "上传失败"})
	}

	action := "upload_evidence"
	reason := "上传证据"
	if req.IsSupplemental {
		action = "supplement_evidence"
		reason = req.SupplementNote
	}
	insertSupplement(req.FormID, userID, action, map[string]string{
		"evidence_name": req.Name,
		"evidence_type": string(req.Type),
	}, reason)

	return c.JSON(http.StatusCreated, evidence)
}

func DeleteEvidence(c echo.Context) error {
	id := c.Param("id")
	userRole := middleware.GetUserRole(c)

	var evidence models.Evidence
	var supNote sql.NullString
	var isSup int
	err := db.DB.QueryRow(`SELECT id, form_id, type, name, uploaded_by, uploaded_at, is_supplemental, supplement_note
		FROM evidences WHERE id=?`, id).Scan(&evidence.ID, &evidence.FormID, &evidence.Type, &evidence.Name,
		&evidence.UploadedBy, &evidence.UploadedAt, &isSup, &supNote)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, models.ErrorResponse{Code: 404, Message: "证据不存在"})
	}
	evidence.IsSupplemental = isSup == 1
	if supNote.Valid {
		evidence.SupplementNote = supNote.String
	}

	if userRole != models.RoleClerk {
		return c.JSON(http.StatusForbidden, models.ErrorResponse{
			Code:    403,
			Message: "只有资料员可以删除证据",
			Reason:  "wrong_role_delete_evidence",
		})
	}
	if evidence.UploadedBy != middleware.GetUserID(c) {
		return c.JSON(http.StatusForbidden, models.ErrorResponse{
			Code:    403,
			Message: "只能删除自己上传的证据",
			Reason:  "not_evidence_uploader",
		})
	}

	_, err = db.DB.Exec("DELETE FROM evidences WHERE id=?", id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: "删除失败"})
	}

	insertSupplement(evidence.FormID, middleware.GetUserID(c), "delete_evidence", map[string]string{
		"evidence_name": evidence.Name,
		"evidence_type": string(evidence.Type),
	}, "删除证据")

	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

func ListProjects(c echo.Context) error {
	rows, err := db.DB.Query("SELECT DISTINCT project_name FROM subcontract_forms ORDER BY project_name")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: "查询失败"})
	}
	defer rows.Close()

	projects := []string{}
	for rows.Next() {
		var p string
		rows.Scan(&p)
		projects = append(projects, p)
	}
	return c.JSON(http.StatusOK, projects)
}
