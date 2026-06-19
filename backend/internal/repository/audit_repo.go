package repository

import (
	"database/sql"
	"fmt"
	"strings"

	"knowledge-revision-system/internal/model"
)

func CreateAuditLog(db *sql.DB, log *model.AuditLog) error {
	_, err := db.Exec(`
		INSERT INTO audit_logs (
			id, order_id, order_no, action,
			actor_id, actor_name, actor_role,
			from_status, to_status, opinion, reason, failure_reason, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`,
		log.ID, log.OrderID, log.OrderNo, log.Action,
		log.ActorID, log.ActorName, log.ActorRole,
		log.FromStatus, log.ToStatus, log.Opinion, log.Reason, log.FailureReason, log.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("创建审计日志失败: %w", err)
	}
	return nil
}

func GetAuditLogs(db *sql.DB, orderID, actorID, action, startDate, endDate string, page, pageSize int) ([]model.AuditLog, int, error) {
	var conditions []string
	var args []interface{}
	argPos := 1

	if orderID != "" {
		conditions = append(conditions, fmt.Sprintf("order_id = $%d", argPos))
		args = append(args, orderID)
		argPos++
	}

	if actorID != "" {
		conditions = append(conditions, fmt.Sprintf("actor_id = $%d", argPos))
		args = append(args, actorID)
		argPos++
	}

	if action != "" {
		conditions = append(conditions, fmt.Sprintf("action = $%d", argPos))
		args = append(args, action)
		argPos++
	}

	if startDate != "" {
		conditions = append(conditions, fmt.Sprintf("created_at >= $%d", argPos))
		args = append(args, startDate)
		argPos++
	}

	if endDate != "" {
		conditions = append(conditions, fmt.Sprintf("created_at <= $%d", argPos))
		args = append(args, endDate)
		argPos++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM audit_logs %s", whereClause)
	var total int
	if err := db.QueryRow(countSQL, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("统计审计日志数失败: %w", err)
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	querySQL := fmt.Sprintf(`
		SELECT id, order_id, order_no, action,
			actor_id, actor_name, actor_role,
			from_status, to_status, opinion, reason, failure_reason, created_at
		FROM audit_logs
		%s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argPos, argPos+1)

	args = append(args, pageSize, offset)

	rows, err := db.Query(querySQL, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("查询审计日志失败: %w", err)
	}
	defer rows.Close()

	var logs []model.AuditLog
	for rows.Next() {
		var l model.AuditLog
		var opinion sql.NullString
		var reason sql.NullString
		var failureReason sql.NullString

		err := rows.Scan(
			&l.ID, &l.OrderID, &l.OrderNo, &l.Action,
			&l.ActorID, &l.ActorName, &l.ActorRole,
			&l.FromStatus, &l.ToStatus, &opinion, &reason, &failureReason, &l.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("扫描审计日志数据失败: %w", err)
		}
		if opinion.Valid {
			l.Opinion = opinion.String
		}
		if reason.Valid {
			l.Reason = reason.String
		}
		if failureReason.Valid {
			l.FailureReason = failureReason.String
		}
		logs = append(logs, l)
	}

	return logs, total, nil
}

func GetAuditLogsByOrderID(db *sql.DB, orderID string) ([]model.AuditLog, error) {
	rows, err := db.Query(`
		SELECT id, order_id, order_no, action,
			actor_id, actor_name, actor_role,
			from_status, to_status, opinion, reason, failure_reason, created_at
		FROM audit_logs
		WHERE order_id = $1
		ORDER BY created_at ASC
	`, orderID)
	if err != nil {
		return nil, fmt.Errorf("查询工单审计日志失败: %w", err)
	}
	defer rows.Close()

	var logs []model.AuditLog
	for rows.Next() {
		var l model.AuditLog
		var opinion sql.NullString
		var reason sql.NullString
		var failureReason sql.NullString

		err := rows.Scan(
			&l.ID, &l.OrderID, &l.OrderNo, &l.Action,
			&l.ActorID, &l.ActorName, &l.ActorRole,
			&l.FromStatus, &l.ToStatus, &opinion, &reason, &failureReason, &l.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("扫描审计日志数据失败: %w", err)
		}
		if opinion.Valid {
			l.Opinion = opinion.String
		}
		if reason.Valid {
			l.Reason = reason.String
		}
		if failureReason.Valid {
			l.FailureReason = failureReason.String
		}
		logs = append(logs, l)
	}
	return logs, nil
}
