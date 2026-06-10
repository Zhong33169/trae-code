package service

import (
	"database/sql"
	"fmt"

	"prescription-transfer/internal/model"
)

type AuditService struct {
	db *sql.DB
}

func NewAuditService(db *sql.DB) *AuditService {
	return &AuditService{db: db}
}

func (s *AuditService) Log(user *model.User, action, targetType string, targetID int64, oldValue, newValue, ipAddress string) error {
	_, err := s.db.Exec(
		`INSERT INTO audit_logs
		 (user_id, user_name, role, action, target_type, target_id, old_value, new_value, ip_address)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		user.ID, user.Name, user.Role, action, targetType, targetID, oldValue, newValue, ipAddress,
	)
	return err
}

type AuditListFilter struct {
	Page     int
	PageSize int
	Action   string
	UserID   int64
}

func (s *AuditService) List(filter AuditListFilter) ([]model.AuditLog, int, error) {
	offset := (filter.Page - 1) * filter.PageSize

	where := "1=1"
	args := []interface{}{}
	argIdx := 1

	if filter.Action != "" {
		where += fmt.Sprintf(" AND action = $%d", argIdx)
		args = append(args, filter.Action)
		argIdx++
	}

	if filter.UserID > 0 {
		where += fmt.Sprintf(" AND user_id = $%d", argIdx)
		args = append(args, filter.UserID)
		argIdx++
	}

	var total int
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM audit_logs WHERE %s", where)
	err := s.db.QueryRow(countSQL, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count audit logs: %w", err)
	}

	querySQL := fmt.Sprintf(
		`SELECT id, user_id, user_name, role, action, target_type, target_id,
		 old_value, new_value, ip_address, created_at
		 FROM audit_logs WHERE %s
		 ORDER BY id DESC LIMIT $%d OFFSET $%d`,
		where, argIdx, argIdx+1,
	)
	args = append(args, filter.PageSize, offset)

	rows, err := s.db.Query(querySQL, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query audit logs: %w", err)
	}
	defer rows.Close()

	var items []model.AuditLog
	for rows.Next() {
		var a model.AuditLog
		err := rows.Scan(
			&a.ID, &a.UserID, &a.UserName, &a.Role, &a.Action,
			&a.TargetType, &a.TargetID, &a.OldValue, &a.NewValue,
			&a.IPAddress, &a.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan audit log: %w", err)
		}
		items = append(items, a)
	}

	return items, total, nil
}
