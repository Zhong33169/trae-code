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

type BatchAuditDetail struct {
	BatchNo      string
	OperationType string
	OperatorName string
	AuditLogs    []model.AuditLog
	TransferLogs []model.AuditLog
}

func (s *AuditService) GetByBatchNo(batchNo string) (*BatchAuditDetail, error) {
	var batchID int64
	var opType string
	var operatorName string
	err := s.db.QueryRow(
		`SELECT id, operation_type, operator_name FROM batch_operations WHERE batch_no = ?`,
		batchNo,
	).Scan(&batchID, &opType, &operatorName)
	if err != nil {
		return nil, fmt.Errorf("get batch: %w", err)
	}

	batchLogs, err := s.getBatchAuditLogs(batchID)
	if err != nil {
		return nil, err
	}

	transferLogs, err := s.getBatchTransferLogs(batchID, opType)
	if err != nil {
		return nil, err
	}

	return &BatchAuditDetail{
		BatchNo:      batchNo,
		OperationType: opType,
		OperatorName: operatorName,
		AuditLogs:    batchLogs,
		TransferLogs: transferLogs,
	}, nil
}

func (s *AuditService) getBatchAuditLogs(batchID int64) ([]model.AuditLog, error) {
	rows, err := s.db.Query(
		`SELECT id, user_id, user_name, role, action, target_type, target_id,
		 old_value, new_value, ip_address, created_at
		 FROM audit_logs
		 WHERE target_type = 'batch' AND target_id = ?
		 ORDER BY id ASC`,
		batchID,
	)
	if err != nil {
		return nil, fmt.Errorf("query batch audit logs: %w", err)
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
			return nil, fmt.Errorf("scan batch audit log: %w", err)
		}
		items = append(items, a)
	}
	return items, nil
}

func (s *AuditService) getBatchTransferLogs(batchID int64, opType string) ([]model.AuditLog, error) {
	actionMap := map[string]string{
		"register": "register",
		"verify":   "verify",
		"review":   "review",
	}
	action := actionMap[opType]
	if action == "" {
		return []model.AuditLog{}, nil
	}

	rows, err := s.db.Query(
		`SELECT al.id, al.user_id, al.user_name, al.role, al.action, al.target_type, al.target_id,
		 al.old_value, al.new_value, al.ip_address, al.created_at
		 FROM audit_logs al
		 INNER JOIN batch_items bi ON al.target_id = bi.transfer_id
		 WHERE bi.batch_id = ? AND al.action = ? AND al.target_type = 'transfer'
		 ORDER BY al.id ASC`,
		batchID, action,
	)
	if err != nil {
		return nil, fmt.Errorf("query batch transfer logs: %w", err)
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
			return nil, fmt.Errorf("scan batch transfer log: %w", err)
		}
		items = append(items, a)
	}
	return items, nil
}
