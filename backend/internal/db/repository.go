package db

import (
	"database/sql"
	"time"

	"live-selection-backend/internal/model"
)

func GetUsers() ([]model.User, error) {
	rows, err := DB.Query("SELECT id, username, role, name FROM users ORDER BY role, id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.Name); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func GetUserByID(id string) (*model.User, error) {
	var u model.User
	err := DB.QueryRow("SELECT id, username, role, name FROM users WHERE id = ?", id).
		Scan(&u.ID, &u.Username, &u.Role, &u.Name)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func parseTime(ns sql.NullString) *time.Time {
	if !ns.Valid || ns.String == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, ns.String)
	if err != nil {
		return nil
	}
	return &t
}

func scanSelection(rows *sql.Rows) (*model.Selection, error) {
	var (
		s                          model.Selection
		planned, deadline          sql.NullString
		reject, audit, pr          sql.NullString
		createdAtStr, updatedAtStr string
	)
	err := rows.Scan(
		&s.ID, &s.ProductName, &s.ProductCategory, &s.Brand, &s.Supplier,
		&s.EstimatedPrice, &s.CommissionRate, &planned, &s.Description,
		&s.Status, &s.CreatedBy, &s.CreatedByName, &createdAtStr, &updatedAtStr,
		&deadline, &reject, &audit, &pr,
	)
	if err != nil {
		return nil, err
	}
	s.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
	s.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAtStr)
	s.PlannedLiveDate = parseTime(planned)
	s.Deadline = parseTime(deadline)
	if reject.Valid {
		s.RejectReason = reject.String
	}
	if audit.Valid {
		s.AuditNote = audit.String
	}
	if pr.Valid {
		s.ProcessResult = pr.String
	}
	return &s, nil
}

func GetSelections(status, role, userID string, exceptionOnly bool) ([]model.Selection, error) {
	query := `SELECT id, product_name, product_category, brand, supplier,
		estimated_price, commission_rate, planned_live_date, description,
		status, created_by, created_by_name, created_at, updated_at,
		deadline, reject_reason, audit_note, process_result FROM selections WHERE 1=1`
	args := []interface{}{}
	if exceptionOnly {
		switch role {
		case string(model.RoleRegistrar):
			query += " AND status IN (?, ?, ?) AND created_by = ?"
			args = append(args, model.StatusMissingAttachment, model.StatusRejected, model.StatusTimeout, userID)
		case string(model.RoleSupervisor):
			query += " AND status IN (?, ?, ?)"
			args = append(args, model.StatusMissingAttachment, model.StatusRejected, model.StatusTimeout)
		case string(model.RoleReviewer):
			query += " AND status = ?"
			args = append(args, model.StatusTimeout)
		default:
			query += " AND status IN (?, ?, ?)"
			args = append(args, model.StatusMissingAttachment, model.StatusRejected, model.StatusTimeout)
		}
	} else {
		if status != "" && status != "all" {
			query += " AND status = ?"
			args = append(args, status)
		}
		switch role {
		case string(model.RoleRegistrar):
			query += " AND created_by = ?"
			args = append(args, userID)
		case string(model.RoleSupervisor):
			query += " AND status IN (?, ?, ?, ?)"
			args = append(args, model.StatusPending, model.StatusMissingAttachment, model.StatusRejected, model.StatusApproved)
		case string(model.RoleReviewer):
			query += " AND status IN (?, ?, ?)"
			args = append(args, model.StatusApproved, model.StatusArchived, model.StatusTimeout)
		}
	}
	query += " ORDER BY status, created_at DESC"
	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []model.Selection
	for rows.Next() {
		s, err := scanSelection(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *s)
	}
	return list, rows.Err()
}

func GetSelectionByID(id string) (*model.Selection, error) {
	query := `SELECT id, product_name, product_category, brand, supplier,
		estimated_price, commission_rate, planned_live_date, description,
		status, created_by, created_by_name, created_at, updated_at,
		deadline, reject_reason, audit_note, process_result FROM selections WHERE id = ?`
	rows, err := DB.Query(query, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, nil
	}
	return scanSelection(rows)
}

func CreateSelection(s *model.Selection) error {
	_, err := DB.Exec(`INSERT INTO selections (
		id, product_name, product_category, brand, supplier,
		estimated_price, commission_rate, planned_live_date, description,
		status, created_by, created_by_name, created_at, updated_at, deadline
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		s.ID, s.ProductName, s.ProductCategory, s.Brand, s.Supplier,
		s.EstimatedPrice, s.CommissionRate, nil, s.Description,
		s.Status, s.CreatedBy, s.CreatedByName, s.CreatedAt, s.UpdatedAt, nil,
	)
	return err
}

func UpdateSelectionStatus(id string, status model.SelectionStatus, rejectReason, processResult, auditNote string, updatedAt time.Time) error {
	_, err := DB.Exec(`UPDATE selections SET status=?, reject_reason=?, process_result=?, audit_note=?, updated_at=? WHERE id=?`,
		status, nullStr(rejectReason), nullStr(processResult), nullStr(auditNote), updatedAt.Format(time.RFC3339), id)
	return err
}

func nullStr(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}

func GetAttachments(selectionID string) ([]model.Attachment, error) {
	rows, err := DB.Query(`SELECT id, selection_id, name, type, url, uploaded_by, uploaded_at,
		COALESCE(rejected,0), reject_reason, rejected_by, rejected_at FROM attachments WHERE selection_id=? ORDER BY uploaded_at`, selectionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []model.Attachment
	for rows.Next() {
		var a model.Attachment
		var rejected int
		var rr, rb, rat sql.NullString
		var uploadedAt string
		if err := rows.Scan(&a.ID, &a.SelectionID, &a.Name, &a.Type, &a.URL, &a.UploadedBy, &uploadedAt, &rejected, &rr, &rb, &rat); err != nil {
			return nil, err
		}
		a.UploadedAt, _ = time.Parse(time.RFC3339, uploadedAt)
		a.Rejected = rejected == 1
		if rr.Valid {
			a.RejectReason = rr.String
		}
		if rb.Valid {
			a.RejectedBy = rb.String
		}
		if rat.Valid {
			if t, err := time.Parse(time.RFC3339, rat.String); err == nil {
				a.RejectedAt = &t
			}
		}
		list = append(list, a)
	}
	return list, rows.Err()
}

func AddAttachment(a *model.Attachment) error {
	_, err := DB.Exec(`INSERT INTO attachments (
		id, selection_id, name, type, url, uploaded_by, uploaded_at, rejected
	) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
		a.ID, a.SelectionID, a.Name, a.Type, a.URL, a.UploadedBy, a.UploadedAt.Format(time.RFC3339))
	return err
}

func RejectAttachment(attID, reason, userID string, t time.Time) error {
	_, err := DB.Exec(`UPDATE attachments SET rejected=1, reject_reason=?, rejected_by=?, rejected_at=? WHERE id=?`,
		reason, userID, t.Format(time.RFC3339), attID)
	return err
}

func GetAuditLogs(selectionID string) ([]model.AuditLog, error) {
	rows, err := DB.Query(`SELECT id, selection_id, user_id, user_name, action, detail, created_at FROM audit_logs WHERE selection_id=? ORDER BY created_at`, selectionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []model.AuditLog
	for rows.Next() {
		var a model.AuditLog
		var ca string
		if err := rows.Scan(&a.ID, &a.SelectionID, &a.UserID, &a.UserName, &a.Action, &a.Detail, &ca); err != nil {
			return nil, err
		}
		a.CreatedAt, _ = time.Parse(time.RFC3339, ca)
		list = append(list, a)
	}
	return list, rows.Err()
}

func AddAuditLog(log *model.AuditLog) error {
	_, err := DB.Exec(`INSERT INTO audit_logs (id, selection_id, user_id, user_name, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		log.ID, log.SelectionID, log.UserID, log.UserName, log.Action, log.Detail, log.CreatedAt.Format(time.RFC3339))
	return err
}
