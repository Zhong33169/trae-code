package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type DBTX interface {
	ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row
	QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
}

type Queries struct {
	DB DBTX
}

type Repo struct {
	db *sql.DB
}

func NewRepo(db *sql.DB) *Repo {
	return &Repo{db: db}
}

func (r *Repo) Queries() *Queries {
	return &Queries{DB: r.db}
}

func (r *Repo) WithTx(ctx context.Context, fn func(q *Queries) error) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	q := &Queries{DB: tx}
	if err := fn(q); err != nil {
		_ = tx.Rollback()
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}

func parseTime(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return time.Time{}
	}
	return t
}

func nowUTC() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func fmtTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}

func nullString(s string) sql.NullString {
	return sql.NullString{String: s, Valid: s != ""}
}

func nullTimePtr(t *time.Time) sql.NullString {
	if t == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: fmtTime(*t), Valid: true}
}

func ptrTime(s sql.NullString) *time.Time {
	if !s.Valid || s.String == "" {
		return nil
	}
	t := parseTime(s.String)
	return &t
}

func ptrInt(n sql.NullInt64) *int {
	if !n.Valid {
		return nil
	}
	v := int(n.Int64)
	return &v
}

func ptrStr(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	return &s.String
}

func (q *Queries) ListUsers(ctx context.Context) ([]User, error) {
	rows, err := q.DB.QueryContext(ctx, `SELECT id, name, role FROM users ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Name, &u.Role); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (q *Queries) GetUser(ctx context.Context, id int) (User, error) {
	var u User
	err := q.DB.QueryRowContext(ctx, `SELECT id, name, role FROM users WHERE id=?`, id).
		Scan(&u.ID, &u.Name, &u.Role)
	if err == sql.ErrNoRows {
		return u, ErrNotFound("用户不存在")
	}
	return u, err
}

func (q *Queries) ListOrders(ctx context.Context, role Role, status string, stage string, warning string, now time.Time) ([]OrderListItem, error) {
	var b strings.Builder
	b.WriteString(`SELECT o.id, o.order_no, o.title, o.customer_name, o.customer_phone, o.address,
		o.repair_type, o.priority, o.status, o.current_stage, o.deadline, o.sla_hours,
		o.created_by, u.name, o.version, o.created_at, o.updated_at, s.status as stage_status
		FROM work_orders o
		LEFT JOIN users u ON u.id = o.created_by
		LEFT JOIN stage_records s ON s.order_id = o.id AND s.stage = o.current_stage
		WHERE 1=1`)
	args := []interface{}{}
	if string(role) != "" {
		b.WriteString(` AND o.current_stage = (SELECT CASE ? WHEN 'window_staff' THEN 'registration' WHEN 'meter_supervisor' THEN 'verification' WHEN 'business_manager' THEN 'archiving' END)`)
		args = append(args, string(role))
	}
	if status != "" {
		b.WriteString(` AND o.status = ?`)
		args = append(args, status)
	}
	if stage != "" {
		b.WriteString(` AND o.current_stage = ?`)
		args = append(args, stage)
	}
	b.WriteString(` ORDER BY o.deadline ASC`)
	rows, err := q.DB.QueryContext(ctx, b.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []OrderListItem
	for rows.Next() {
		var item OrderListItem
		var deadline, created, updated sql.NullString
		var stageStatus sql.NullString
		if err := rows.Scan(&item.ID, &item.OrderNo, &item.Title, &item.CustomerName,
			&item.CustomerPhone, &item.Address, &item.RepairType, &item.Priority, &item.Status,
			&item.CurrentStage, &deadline, &item.SlaHours, &item.CreatedBy, &item.CreatedByName,
			&item.Version, &created, &updated, &stageStatus); err != nil {
			return nil, err
		}
		item.Deadline = parseTime(deadline.String)
		item.CreatedAt = parseTime(created.String)
		item.UpdatedAt = parseTime(updated.String)
		item.StageStatus = StageStatus(stageStatus.String)
		item.Warning = ComputeWarning(item.Deadline, now)
		out = append(out, item)
	}
	if warning != "" {
		filtered := out[:0]
		for _, o := range out {
			if string(o.Warning.Level) == warning {
				filtered = append(filtered, o)
			}
		}
		out = filtered
	}
	return out, rows.Err()
}

func (q *Queries) GetOrder(ctx context.Context, id int) (WorkOrder, error) {
	var o WorkOrder
	var deadline, created, updated, phone sql.NullString
	err := q.DB.QueryRowContext(ctx, `SELECT o.id, o.order_no, o.title, o.customer_name, o.customer_phone,
		o.address, o.repair_type, o.priority, o.status, o.current_stage, o.deadline, o.sla_hours,
		o.created_by, u.name, o.version, o.created_at, o.updated_at
		FROM work_orders o LEFT JOIN users u ON u.id = o.created_by WHERE o.id=?`, id).
		Scan(&o.ID, &o.OrderNo, &o.Title, &o.CustomerName, &phone, &o.Address, &o.RepairType,
			&o.Priority, &o.Status, &o.CurrentStage, &deadline, &o.SlaHours, &o.CreatedBy,
			&o.CreatedByName, &o.Version, &created, &updated)
	if err == sql.ErrNoRows {
		return o, ErrNotFound("工单不存在")
	}
	if err != nil {
		return o, err
	}
	o.CustomerPhone = phone.String
	o.Deadline = parseTime(deadline.String)
	o.CreatedAt = parseTime(created.String)
	o.UpdatedAt = parseTime(updated.String)
	return o, nil
}

func (q *Queries) CreateOrder(ctx context.Context, o *WorkOrder) (int, error) {
	res, err := q.DB.ExecContext(ctx, `INSERT INTO work_orders
		(order_no, title, customer_name, customer_phone, address, repair_type, priority,
		status, current_stage, deadline, sla_hours, created_by, version, created_at, updated_at)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		o.OrderNo, o.Title, o.CustomerName, o.CustomerPhone, o.Address, o.RepairType, o.Priority,
		string(o.Status), string(o.CurrentStage), fmtTime(o.Deadline), o.SlaHours, o.CreatedBy, 1, nowUTC(), nowUTC())
	if err != nil {
		return 0, err
	}
	id, _ := res.LastInsertId()
	return int(id), nil
}

func (q *Queries) UpdateOrderState(ctx context.Context, id int, version int, stage Stage, status OrderStatus) (int64, error) {
	res, err := q.DB.ExecContext(ctx, `UPDATE work_orders SET current_stage=?, status=?, version=version+1, updated_at=? WHERE id=? AND version=?`,
		string(stage), string(status), nowUTC(), id, version)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func (q *Queries) ListStagesByOrder(ctx context.Context, orderID int) ([]StageRecord, error) {
	rows, err := q.DB.QueryContext(ctx, `SELECT s.id, s.order_id, s.stage, s.handler_role, s.handler_id,
		COALESCE(u.name,''), s.materials_json, s.processing_opinion, s.status, s.started_at,
		s.time_limit_hours, s.submitted_at, s.reviewed_at, s.reviewer_id, s.review_comment
		FROM stage_records s LEFT JOIN users u ON u.id = s.handler_id
		WHERE s.order_id=? ORDER BY CASE s.stage WHEN 'registration' THEN 1 WHEN 'verification' THEN 2 WHEN 'archiving' THEN 3 END`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []StageRecord
	for rows.Next() {
		s, err := scanStage(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (q *Queries) GetStage(ctx context.Context, orderID int, stage Stage) (StageRecord, error) {
	row := q.DB.QueryRowContext(ctx, `SELECT s.id, s.order_id, s.stage, s.handler_role, s.handler_id,
		COALESCE(u.name,''), s.materials_json, s.processing_opinion, s.status, s.started_at,
		s.time_limit_hours, s.submitted_at, s.reviewed_at, s.reviewer_id, s.review_comment
		FROM stage_records s LEFT JOIN users u ON u.id = s.handler_id
		WHERE s.order_id=? AND s.stage=?`, orderID, string(stage))
	return scanStage(row)
}

type scanner interface {
	Scan(dest ...interface{}) error
}

func scanStage(sc scanner) (StageRecord, error) {
	var s StageRecord
	var materials string
	var opinion sql.NullString
	var started, submitted, reviewed sql.NullString
	var handlerID sql.NullInt64
	var reviewerID sql.NullInt64
	var reviewComment sql.NullString
	if err := sc.Scan(&s.ID, &s.OrderID, &s.Stage, &s.HandlerRole, &handlerID, &s.HandlerName,
		&materials, &opinion, &s.Status, &started, &s.TimeLimitHours, &submitted, &reviewed,
		&reviewerID, &reviewComment); err != nil {
		if err == sql.ErrNoRows {
			return s, ErrNotFound("阶段记录不存在")
		}
		return s, err
	}
	s.ProcessingOpinion = opinion.String
	s.StartedAt = parseTime(started.String)
	s.SubmittedAt = ptrTime(submitted)
	s.ReviewedAt = ptrTime(reviewed)
	s.HandlerID = ptrInt(handlerID)
	s.ReviewerID = ptrInt(reviewerID)
	s.ReviewComment = reviewComment.String
	_ = json.Unmarshal([]byte(materials), &s.Materials)
	if s.Materials == nil {
		s.Materials = []Material{}
	}
	return s, nil
}

func (q *Queries) UpdateStageSubmit(ctx context.Context, orderID int, stage Stage, handlerID int, materials []Material, opinion string) error {
	mj, _ := json.Marshal(materials)
	_, err := q.DB.ExecContext(ctx, `UPDATE stage_records SET handler_id=?, materials_json=?, processing_opinion=?, status='submitted', submitted_at=?, updated_at=? WHERE order_id=? AND stage=?`,
		handlerID, string(mj), opinion, nowUTC(), nowUTC(), orderID, string(stage))
	return err
}

func (q *Queries) UpdateStageReview(ctx context.Context, orderID int, stage Stage, reviewerID int, status StageStatus, comment string) error {
	_, err := q.DB.ExecContext(ctx, `UPDATE stage_records SET reviewer_id=?, status=?, review_comment=?, reviewed_at=?, updated_at=? WHERE order_id=? AND stage=?`,
		reviewerID, string(status), comment, nowUTC(), nowUTC(), orderID, string(stage))
	return err
}

func (q *Queries) ReactivateStage(ctx context.Context, orderID int, stage Stage) error {
	_, err := q.DB.ExecContext(ctx, `UPDATE stage_records SET status='pending', submitted_at=NULL, reviewed_at=NULL, started_at=?, updated_at=? WHERE order_id=? AND stage=?`,
		nowUTC(), nowUTC(), orderID, string(stage))
	return err
}

func (q *Queries) CreateStage(ctx context.Context, orderID int, stage Stage, role Role, materials []Material, timeLimit int) error {
	mj, _ := json.Marshal(materials)
	_, err := q.DB.ExecContext(ctx, `INSERT INTO stage_records (order_id, stage, handler_role, materials_json, status, started_at, time_limit_hours, created_at, updated_at)
		VALUES (?,?,?,?,'pending',?,?,?,?)`,
		orderID, string(stage), string(role), string(mj), nowUTC(), timeLimit, nowUTC(), nowUTC())
	return err
}

func (q *Queries) ListAuditLogs(ctx context.Context, orderID int) ([]AuditLog, error) {
	rows, err := q.DB.QueryContext(ctx, `SELECT a.id, a.order_id, a.action, a.actor_id, COALESCE(u.name,''),
		a.actor_role, a.from_status, a.to_status, a.from_stage, a.to_stage, a.detail,
		a.version_before, a.version_after, a.created_at
		FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
		WHERE a.order_id=? ORDER BY a.id ASC`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AuditLog
	for rows.Next() {
		var a AuditLog
		var actorID sql.NullInt64
		var fromS, toS, fromSt, toSt, detail, created sql.NullString
		var vB, vA sql.NullInt64
		if err := rows.Scan(&a.ID, &a.OrderID, &a.Action, &actorID, &a.ActorName, &a.ActorRole,
			&fromS, &toS, &fromSt, &toSt, &detail, &vB, &vA, &created); err != nil {
			return nil, err
		}
		a.ActorID = ptrInt(actorID)
		if fromS.Valid {
			s := OrderStatus(fromS.String)
			a.FromStatus = &s
		}
		if toS.Valid {
			s := OrderStatus(toS.String)
			a.ToStatus = &s
		}
		if fromSt.Valid {
			st := Stage(fromSt.String)
			a.FromStage = &st
		}
		if toSt.Valid {
			st := Stage(toSt.String)
			a.ToStage = &st
		}
		a.Detail = detail.String
		a.VersionBefore = ptrInt(vB)
		a.VersionAfter = ptrInt(vA)
		a.CreatedAt = parseTime(created.String)
		out = append(out, a)
	}
	return out, rows.Err()
}

func (q *Queries) InsertAuditLog(ctx context.Context, a AuditLog) error {
	var actorID, vB, vA interface{}
	if a.ActorID != nil {
		actorID = *a.ActorID
	}
	if a.VersionBefore != nil {
		vB = *a.VersionBefore
	}
	if a.VersionAfter != nil {
		vA = *a.VersionAfter
	}
	_, err := q.DB.ExecContext(ctx, `INSERT INTO audit_logs (order_id, action, actor_id, actor_role, from_status, to_status, from_stage, to_stage, detail, version_before, version_after, created_at)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
		a.OrderID, a.Action, actorID, string(a.ActorRole),
		ordStatus(a.FromStatus), ordStatus(a.ToStatus), stageStr(a.FromStage), stageStr(a.ToStage),
		a.Detail, vB, vA, nowUTC())
	return err
}

func ordStatus(s *OrderStatus) interface{} {
	if s == nil {
		return nil
	}
	return string(*s)
}

func stageStr(s *Stage) interface{} {
	if s == nil {
		return nil
	}
	return string(*s)
}

func (q *Queries) CountStats(ctx context.Context, now time.Time) (Stats, error) {
	var s Stats
	rows, err := q.DB.QueryContext(ctx, `SELECT status, deadline FROM work_orders`)
	if err != nil {
		return s, err
	}
	defer rows.Close()
	for rows.Next() {
		var status, deadline sql.NullString
		if err := rows.Scan(&status, &deadline); err != nil {
			return s, err
		}
		switch OrderStatus(status.String) {
		case StatusPendingReview:
			s.PendingReview++
		case StatusApproved:
			s.Approved++
		case StatusSynced:
			s.Synced++
		}
		w := ComputeWarning(parseTime(deadline.String), now)
		switch w.Level {
		case WarningNearDue:
			s.NearDue++
		case WarningOverdue:
			s.Overdue++
		}
	}
	return s, rows.Err()
}
