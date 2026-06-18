package main

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

const taskColumns = `t.id, t.task_no, t.policy_no, t.customer_name, t.product, t.renewal_type,
	t.original_premium, t.new_premium, t.status, t.version,
	t.current_handler_role, t.reg_evidence, t.verify_evidence, t.archive_evidence,
	t.created_at, t.updated_at, u.display_name, b.batch_no`

const taskFrom = ` FROM tasks t
	LEFT JOIN users u ON u.id = t.submitter_id
	LEFT JOIN batches b ON b.id = t.last_batch_id`

type scanner interface {
	Scan(dest ...interface{}) error
}

func scanTask(s scanner) (*Task, error) {
	var t Task
	var handler, reg, verify, archive, submitterName, lastBatchNo sql.NullString
	if err := s.Scan(
		&t.ID, &t.TaskNo, &t.PolicyNo, &t.CustomerName, &t.Product, &t.RenewalType,
		&t.OriginalPremium, &t.NewPremium, &t.Status, &t.Version,
		&handler, &reg, &verify, &archive,
		&t.CreatedAt, &t.UpdatedAt, &submitterName, &lastBatchNo,
	); err != nil {
		return nil, err
	}
	t.CurrentHandlerRole = handler.String
	t.RegEvidence = parseEvidence(reg)
	t.VerifyEvidence = parseEvidence(verify)
	t.ArchiveEvidence = parseEvidence(archive)
	t.SubmitterName = submitterName.String
	t.LastBatchNo = lastBatchNo.String
	return &t, nil
}

func (r *Repository) GetUserByUsername(username string) (User, string, error) {
	var u User
	var hash string
	err := r.db.QueryRow(`SELECT id, username, role, display_name, password_hash FROM users WHERE username=?`, username).
		Scan(&u.ID, &u.Username, &u.Role, &u.DisplayName, &hash)
	if err == sql.ErrNoRows {
		return u, "", fmt.Errorf("用户不存在")
	}
	if err != nil {
		return u, "", err
	}
	return u, hash, nil
}

func (r *Repository) GetUserByID(id int) (User, error) {
	var u User
	err := r.db.QueryRow(`SELECT id, username, role, display_name FROM users WHERE id=?`, id).
		Scan(&u.ID, &u.Username, &u.Role, &u.DisplayName)
	if err == sql.ErrNoRows {
		return u, fmt.Errorf("用户不存在")
	}
	return u, err
}

func (r *Repository) ListTasks(q TaskListQuery) ([]Task, int, error) {
	var where []string
	var args []interface{}
	if q.Status != "" {
		where = append(where, "t.status=?")
		args = append(args, q.Status)
	}
	if q.BatchID != "" {
		where = append(where, "t.last_batch_id=?")
		args = append(args, q.BatchID)
	}
	if q.Q != "" {
		where = append(where, "(t.task_no LIKE ? OR t.policy_no LIKE ? OR t.customer_name LIKE ?)")
		pat := "%" + q.Q + "%"
		args = append(args, pat, pat, pat)
	}
	whereSQL := ""
	if len(where) > 0 {
		whereSQL = " WHERE " + strings.Join(where, " AND ")
	}

	var total int
	if err := r.db.QueryRow("SELECT COUNT(*)"+taskFrom+whereSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	if q.Size <= 0 {
		q.Size = 50
	}
	if q.Page <= 0 {
		q.Page = 1
	}
	offset := (q.Page - 1) * q.Size
	query := "SELECT " + taskColumns + taskFrom + whereSQL + " ORDER BY t.id DESC LIMIT ? OFFSET ?"
	args = append(args, q.Size, offset)
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var tasks []Task
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, 0, err
		}
		tasks = append(tasks, *t)
	}
	return tasks, total, nil
}

func (r *Repository) GetTaskByID(id int) (*Task, error) {
	row := r.db.QueryRow("SELECT "+taskColumns+taskFrom+" WHERE t.id=?", id)
	t, err := scanTask(row)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("任务不存在")
	}
	return t, err
}

func (r *Repository) CreateTask(req CreateTaskRequest, submitterID int, submitterName string) (*Task, error) {
	taskNo := fmt.Sprintf("RT-%s-%04d", time.Now().Format("20060102"), r.nextTaskSeq())
	reg, _ := marshalEvidence(req.RegEvidence, submitterName, submitterID, time.Now().Format("2006-01-02 15:04:05"))
	res, err := r.db.Exec(`INSERT INTO tasks(task_no, policy_no, customer_name, product, renewal_type, original_premium, new_premium, status, version, submitter_id, current_handler_role, reg_evidence)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
		taskNo, req.PolicyNo, req.CustomerName, req.Product, req.RenewalType, req.OriginalPremium, req.NewPremium,
		StatusDraft, 1, submitterID, RoleCustomerManager, reg)
	if err != nil {
		return nil, err
	}
	id, _ := res.LastInsertId()
	return r.GetTaskByID(int(id))
}

func (r *Repository) nextTaskSeq() int {
	var n int
	prefix := fmt.Sprintf("RT-%s-%%", time.Now().Format("20060102"))
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM tasks WHERE task_no LIKE ?`, prefix).Scan(&n)
	return n + 1
}

func (r *Repository) UpdateTask(req UpdateTaskRequest, task *Task, submitterID int, submitterName string) error {
	reg, _ := marshalEvidence(req.RegEvidence, submitterName, submitterID, time.Now().Format("2006-01-02 15:04:05"))
	res, err := r.db.Exec(`UPDATE tasks SET policy_no=?, customer_name=?, product=?, renewal_type=?, original_premium=?, new_premium=?, reg_evidence=?, version=version+1, updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='draft'`,
		req.PolicyNo, req.CustomerName, req.Product, req.RenewalType, req.OriginalPremium, req.NewPremium, reg, task.ID)
	if err != nil {
		return err
	}
	aff, _ := res.RowsAffected()
	if aff == 0 {
		return fmt.Errorf("仅可修改草稿状态任务")
	}
	return nil
}

func (r *Repository) ApplyTransition(taskID int, evidenceCol string, evidenceVal sql.NullString, newStatus, nextHandler string) error {
	var err error
	if evidenceCol != "" {
		_, err = r.db.Exec(fmt.Sprintf(`UPDATE tasks SET status=?, version=version+1, current_handler_role=?, %s=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, evidenceCol),
			newStatus, nextHandler, evidenceVal, taskID)
	} else {
		_, err = r.db.Exec(`UPDATE tasks SET status=?, version=version+1, current_handler_role=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
			newStatus, nextHandler, taskID)
	}
	return err
}

func (r *Repository) SetTaskLastBatch(taskID, batchID int) error {
	_, err := r.db.Exec(`UPDATE tasks SET last_batch_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, batchID, taskID)
	return err
}

func (r *Repository) InsertAudit(batchID sql.NullInt64, taskID int, taskNo, action string, operator principal, fromStatus, toStatus, detail string) error {
	_, err := r.db.Exec(`INSERT INTO audit_logs(batch_id, task_id, task_no, action, operator_id, operator_role, from_status, to_status, detail) VALUES(?,?,?,?,?,?,?,?,?)`,
		batchID, taskID, taskNo, action, operator.ID, operator.Role, fromStatus, toStatus, detail)
	return err
}

func (r *Repository) nextBatchNo() string {
	prefix := fmt.Sprintf("BN-%s-%%", time.Now().Format("20060102"))
	var n int
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM batches WHERE batch_no LIKE ?`, prefix).Scan(&n)
	return fmt.Sprintf("BN-%s-%04d", time.Now().Format("20060102"), n+1)
}

func (r *Repository) CreateBatch(batchNo, action string, operator principal, total int) (int, error) {
	res, err := r.db.Exec(`INSERT INTO batches(batch_no, action, operator_id, operator_role, total, success_count, fail_count, status) VALUES(?,?,?,?,?,?,?,?)`,
		batchNo, action, operator.ID, operator.Role, total, 0, 0, "processing")
	if err != nil {
		return 0, err
	}
	id, _ := res.LastInsertId()
	return int(id), nil
}

func (r *Repository) UpdateBatchCounts(batchID, success, fail int) error {
	status := "completed"
	switch {
	case success == 0 && fail > 0:
		status = "failed"
	case success > 0 && fail > 0:
		status = "partial"
	}
	_, err := r.db.Exec(`UPDATE batches SET success_count=?, fail_count=?, status=? WHERE id=?`, success, fail, status, batchID)
	return err
}

func (r *Repository) InsertBatchItem(batchID, taskID, requestVersion int, taskNo, status, errorCode, reason string, retryCount int) error {
	_, err := r.db.Exec(`INSERT INTO batch_items(batch_id, task_id, task_no, status, request_version, error_code, error_reason, retry_count) VALUES(?,?,?,?,?,?,?,?)`,
		batchID, taskID, taskNo, status, requestVersion, errorCode, reason, retryCount)
	return err
}

func (r *Repository) UpdateBatchItem(itemID int, status, errorCode, reason string, retryCount, requestVersion int) error {
	_, err := r.db.Exec(`UPDATE batch_items SET status=?, request_version=?, error_code=?, error_reason=?, retry_count=?, processed_at=CURRENT_TIMESTAMP WHERE id=?`,
		status, requestVersion, errorCode, reason, retryCount, itemID)
	return err
}

func (r *Repository) RecomputeBatchCounts(batchID int) error {
	var success, fail int
	_ = r.db.QueryRow(`SELECT
		(SELECT COUNT(*) FROM batch_items WHERE batch_id=? AND status='success'),
		(SELECT COUNT(*) FROM batch_items WHERE batch_id=? AND status='failed')`, batchID, batchID).Scan(&success, &fail)
	status := "completed"
	switch {
	case success == 0 && fail > 0:
		status = "failed"
	case success > 0 && fail > 0:
		status = "partial"
	}
	_, err := r.db.Exec(`UPDATE batches SET success_count=?, fail_count=?, status=? WHERE id=?`, success, fail, status, batchID)
	return err
}

func (r *Repository) ListBatches() ([]Batch, error) {
	rows, err := r.db.Query(`SELECT b.id, b.batch_no, b.action, u.display_name, b.operator_role, b.total, b.success_count, b.fail_count, b.status, b.created_at
		FROM batches b LEFT JOIN users u ON u.id=b.operator_id ORDER BY b.id DESC LIMIT 100`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Batch
	for rows.Next() {
		var b Batch
		var opName sql.NullString
		if err := rows.Scan(&b.ID, &b.BatchNo, &b.Action, &opName, &b.OperatorRole, &b.Total, &b.SuccessCount, &b.FailCount, &b.Status, &b.CreatedAt); err != nil {
			return nil, err
		}
		b.OperatorName = opName.String
		out = append(out, b)
	}
	return out, nil
}

func (r *Repository) GetBatch(id int) (*Batch, error) {
	var b Batch
	var opName sql.NullString
	err := r.db.QueryRow(`SELECT b.id, b.batch_no, b.action, u.display_name, b.operator_role, b.total, b.success_count, b.fail_count, b.status, b.created_at
		FROM batches b LEFT JOIN users u ON u.id=b.operator_id WHERE b.id=?`, id).
		Scan(&b.ID, &b.BatchNo, &b.Action, &opName, &b.OperatorRole, &b.Total, &b.SuccessCount, &b.FailCount, &b.Status, &b.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("批次不存在")
	}
	b.OperatorName = opName.String
	return &b, err
}

func (r *Repository) ListBatchItems(batchID int) ([]BatchItem, error) {
	rows, err := r.db.Query(`SELECT id, batch_id, task_id, task_no, status, request_version, COALESCE(error_code,''), COALESCE(error_reason,''), retry_count, processed_at FROM batch_items WHERE batch_id=? ORDER BY id`, batchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []BatchItem
	for rows.Next() {
		var it BatchItem
		var errCode, errReason sql.NullString
		if err := rows.Scan(&it.ID, &it.BatchID, &it.TaskID, &it.TaskNo, &it.Status, &it.RequestVersion, &errCode, &errReason, &it.RetryCount, &it.ProcessedAt); err != nil {
			return nil, err
		}
		it.ErrorCode = errCode.String
		it.ErrorReason = errReason.String
		out = append(out, it)
	}
	return out, nil
}

func (r *Repository) GetBatchItem(id int) (*BatchItem, error) {
	var it BatchItem
	var errCode, errReason sql.NullString
	err := r.db.QueryRow(`SELECT id, batch_id, task_id, task_no, status, request_version, COALESCE(error_code,''), COALESCE(error_reason,''), retry_count, processed_at FROM batch_items WHERE id=?`, id).
		Scan(&it.ID, &it.BatchID, &it.TaskID, &it.TaskNo, &it.Status, &it.RequestVersion, &errCode, &errReason, &it.RetryCount, &it.ProcessedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("批次明细不存在")
	}
	it.ErrorCode = errCode.String
	it.ErrorReason = errReason.String
	return &it, err
}

func (r *Repository) ListAudit(batchID, taskID string) ([]AuditLog, error) {
	var where []string
	var args []interface{}
	if batchID != "" {
		where = append(where, "batch_id=?")
		args = append(args, batchID)
	}
	if taskID != "" {
		where = append(where, "task_id=?")
		args = append(args, taskID)
	}
	whereSQL := ""
	if len(where) > 0 {
		whereSQL = " WHERE " + strings.Join(where, " AND ")
	}
	query := `SELECT a.id, COALESCE(a.batch_id,0), a.task_id, a.task_no, a.action, u.display_name, a.operator_role, COALESCE(a.from_status,''), COALESCE(a.to_status,''), COALESCE(a.detail,''), a.created_at
		FROM audit_logs a LEFT JOIN users u ON u.id=a.operator_id` + whereSQL + " ORDER BY a.id DESC LIMIT 200"
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AuditLog
	for rows.Next() {
		var a AuditLog
		var opName sql.NullString
		if err := rows.Scan(&a.ID, &a.BatchID, &a.TaskID, &a.TaskNo, &a.Action, &opName, &a.OperatorRole, &a.FromStatus, &a.ToStatus, &a.Detail, &a.CreatedAt); err != nil {
			return nil, err
		}
		a.OperatorName = opName.String
		out = append(out, a)
	}
	return out, nil
}
