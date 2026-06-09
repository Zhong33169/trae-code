package service

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"prescription-transfer/internal/model"
)

var (
	ErrForbidden        = errors.New("无权限执行此操作")
	ErrInvalidStatus    = errors.New("当前状态不允许此操作")
	ErrVersionConflict  = errors.New("数据已被修改，请刷新后重试")
	ErrEvidenceRequired = errors.New("操作证据不能为空")
	ErrNotFound         = errors.New("记录不存在")
)

type TransferService struct {
	db *sql.DB
}

func NewTransferService(db *sql.DB) *TransferService {
	return &TransferService{db: db}
}

type TransferListFilter struct {
	Status   string
	Keyword  string
	Page     int
	PageSize int
}

func (s *TransferService) List(filter TransferListFilter) ([]model.PrescriptionTransfer, int, error) {
	offset := (filter.Page - 1) * filter.PageSize

	where := "1=1"
	args := []interface{}{}
	argIdx := 1

	if filter.Status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, filter.Status)
		argIdx++
	}

	if filter.Keyword != "" {
		keyword := "%" + filter.Keyword + "%"
		where += fmt.Sprintf(" AND (patient_name LIKE $%d OR transfer_no LIKE $%d OR id_card LIKE $%d)", argIdx, argIdx+1, argIdx+2)
		args = append(args, keyword, keyword, keyword)
		argIdx += 3
	}

	var total int
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM prescription_transfers WHERE %s", where)
	err := s.db.QueryRow(countSQL, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count transfers: %w", err)
	}

	querySQL := fmt.Sprintf(
		`SELECT id, transfer_no, patient_name, id_card, department, doctor_name,
		 medicine_list, total_amount, status, version, created_at, updated_at
		 FROM prescription_transfers WHERE %s
		 ORDER BY id DESC LIMIT $%d OFFSET $%d`,
		where, argIdx, argIdx+1,
	)
	args = append(args, filter.PageSize, offset)

	rows, err := s.db.Query(querySQL, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query transfers: %w", err)
	}
	defer rows.Close()

	var items []model.PrescriptionTransfer
	for rows.Next() {
		var t model.PrescriptionTransfer
		err := rows.Scan(
			&t.ID, &t.TransferNo, &t.PatientName, &t.IDCard,
			&t.Department, &t.DoctorName, &t.MedicineList,
			&t.TotalAmount, &t.Status, &t.Version, &t.CreatedAt, &t.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan transfer: %w", err)
		}
		items = append(items, t)
	}

	return items, total, nil
}

func (s *TransferService) GetByID(id int64) (*model.PrescriptionTransfer, error) {
	var t model.PrescriptionTransfer
	err := s.db.QueryRow(
		`SELECT id, transfer_no, patient_name, id_card, department, doctor_name,
		 medicine_list, total_amount, status, version, created_at, updated_at
		 FROM prescription_transfers WHERE id = ?`,
		id,
	).Scan(
		&t.ID, &t.TransferNo, &t.PatientName, &t.IDCard,
		&t.Department, &t.DoctorName, &t.MedicineList,
		&t.TotalAmount, &t.Status, &t.Version, &t.CreatedAt, &t.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get transfer: %w", err)
	}
	return &t, nil
}

type CreateTransferRequest struct {
	PatientName  string
	IDCard       string
	Department   string
	DoctorName   string
	MedicineList string
	TotalAmount  float64
}

func (s *TransferService) Create(req CreateTransferRequest, user *model.User) (*model.PrescriptionTransfer, error) {
	transferNo := fmt.Sprintf("RX%s%06d", time.Now().Format("20060102150405"), time.Now().UnixNano()%1000000)

	result, err := s.db.Exec(
		`INSERT INTO prescription_transfers
		 (transfer_no, patient_name, id_card, department, doctor_name, medicine_list, total_amount, status, version)
		 VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 1)`,
		transferNo, req.PatientName, req.IDCard, req.Department, req.DoctorName, req.MedicineList, req.TotalAmount,
	)
	if err != nil {
		return nil, fmt.Errorf("create transfer: %w", err)
	}

	id, _ := result.LastInsertId()
	return s.GetByID(id)
}

func (s *TransferService) Register(id int64, version int, evidenceContent, remark string, user *model.User) (*model.PrescriptionTransfer, error) {
	if user.Role != model.RoleReceptionAssistant {
		return nil, ErrForbidden
	}
	if evidenceContent == "" {
		return nil, ErrEvidenceRequired
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	var t model.PrescriptionTransfer
	err = tx.QueryRow(
		`SELECT id, status, version FROM prescription_transfers WHERE id = ?`,
		id,
	).Scan(&t.ID, &t.Status, &t.Version)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get transfer: %w", err)
	}

	if t.Version != version {
		return nil, ErrVersionConflict
	}

	if t.Status != model.StatusDraft && t.Status != model.StatusPendingRegistration {
		return nil, ErrInvalidStatus
	}

	oldStatus := t.Status
	newStatus := model.StatusPendingVerification
	newVersion := version + 1

	result, err := tx.Exec(
		`UPDATE prescription_transfers
		 SET status = ?, version = ?, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ? AND version = ?`,
		newStatus, newVersion, id, version,
	)
	if err != nil {
		return nil, fmt.Errorf("update transfer: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return nil, ErrVersionConflict
	}

	_, err = tx.Exec(
		`INSERT INTO transfer_evidences
		 (transfer_id, evidence_type, operator_id, operator_name, operator_role, evidence_content, remark)
		 VALUES (?, 'registration', ?, ?, ?, ?, ?)`,
		id, user.ID, user.Name, user.Role, evidenceContent, remark,
	)
	if err != nil {
		return nil, fmt.Errorf("insert evidence: %w", err)
	}

	oldJSON, _ := json.Marshal(map[string]interface{}{"status": oldStatus, "version": version})
	newJSON, _ := json.Marshal(map[string]interface{}{"status": newStatus, "version": newVersion})

	_, err = tx.Exec(
		`INSERT INTO audit_logs
		 (user_id, user_name, role, action, target_type, target_id, old_value, new_value)
		 VALUES (?, ?, ?, 'register', 'transfer', ?, ?, ?)`,
		user.ID, user.Name, user.Role, id, string(oldJSON), string(newJSON),
	)
	if err != nil {
		return nil, fmt.Errorf("insert audit: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return s.GetByID(id)
}

func (s *TransferService) Verify(id int64, version int, evidenceContent, remark string, user *model.User) (*model.PrescriptionTransfer, error) {
	if user.Role != model.RoleAttendingPhysician {
		return nil, ErrForbidden
	}
	if evidenceContent == "" {
		return nil, ErrEvidenceRequired
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	var t model.PrescriptionTransfer
	err = tx.QueryRow(
		`SELECT id, status, version FROM prescription_transfers WHERE id = ?`,
		id,
	).Scan(&t.ID, &t.Status, &t.Version)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get transfer: %w", err)
	}

	if t.Version != version {
		return nil, ErrVersionConflict
	}

	if t.Status != model.StatusRegistered && t.Status != model.StatusPendingVerification {
		return nil, ErrInvalidStatus
	}

	oldStatus := t.Status
	newStatus := model.StatusPendingReview
	newVersion := version + 1

	result, err := tx.Exec(
		`UPDATE prescription_transfers
		 SET status = ?, version = ?, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ? AND version = ?`,
		newStatus, newVersion, id, version,
	)
	if err != nil {
		return nil, fmt.Errorf("update transfer: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return nil, ErrVersionConflict
	}

	_, err = tx.Exec(
		`INSERT INTO transfer_evidences
		 (transfer_id, evidence_type, operator_id, operator_name, operator_role, evidence_content, remark)
		 VALUES (?, 'verification', ?, ?, ?, ?, ?)`,
		id, user.ID, user.Name, user.Role, evidenceContent, remark,
	)
	if err != nil {
		return nil, fmt.Errorf("insert evidence: %w", err)
	}

	oldJSON, _ := json.Marshal(map[string]interface{}{"status": oldStatus, "version": version})
	newJSON, _ := json.Marshal(map[string]interface{}{"status": newStatus, "version": newVersion})

	_, err = tx.Exec(
		`INSERT INTO audit_logs
		 (user_id, user_name, role, action, target_type, target_id, old_value, new_value)
		 VALUES (?, ?, ?, 'verify', 'transfer', ?, ?, ?)`,
		user.ID, user.Name, user.Role, id, string(oldJSON), string(newJSON),
	)
	if err != nil {
		return nil, fmt.Errorf("insert audit: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return s.GetByID(id)
}

func (s *TransferService) Review(id int64, version int, evidenceContent, remark string, user *model.User) (*model.PrescriptionTransfer, error) {
	if user.Role != model.RolePharmacyAdmin {
		return nil, ErrForbidden
	}
	if evidenceContent == "" {
		return nil, ErrEvidenceRequired
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	var t model.PrescriptionTransfer
	err = tx.QueryRow(
		`SELECT id, status, version FROM prescription_transfers WHERE id = ?`,
		id,
	).Scan(&t.ID, &t.Status, &t.Version)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get transfer: %w", err)
	}

	if t.Version != version {
		return nil, ErrVersionConflict
	}

	if t.Status != model.StatusVerified && t.Status != model.StatusPendingReview {
		return nil, ErrInvalidStatus
	}

	oldStatus := t.Status
	newStatus := model.StatusArchived
	newVersion := version + 1

	result, err := tx.Exec(
		`UPDATE prescription_transfers
		 SET status = ?, version = ?, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ? AND version = ?`,
		newStatus, newVersion, id, version,
	)
	if err != nil {
		return nil, fmt.Errorf("update transfer: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return nil, ErrVersionConflict
	}

	_, err = tx.Exec(
		`INSERT INTO transfer_evidences
		 (transfer_id, evidence_type, operator_id, operator_name, operator_role, evidence_content, remark)
		 VALUES (?, 'review', ?, ?, ?, ?, ?)`,
		id, user.ID, user.Name, user.Role, evidenceContent, remark,
	)
	if err != nil {
		return nil, fmt.Errorf("insert evidence: %w", err)
	}

	oldJSON, _ := json.Marshal(map[string]interface{}{"status": oldStatus, "version": version})
	newJSON, _ := json.Marshal(map[string]interface{}{"status": newStatus, "version": newVersion})

	_, err = tx.Exec(
		`INSERT INTO audit_logs
		 (user_id, user_name, role, action, target_type, target_id, old_value, new_value)
		 VALUES (?, ?, ?, 'review', 'transfer', ?, ?, ?)`,
		user.ID, user.Name, user.Role, id, string(oldJSON), string(newJSON),
	)
	if err != nil {
		return nil, fmt.Errorf("insert audit: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return s.GetByID(id)
}

func (s *TransferService) ListEvidences(transferID int64) ([]model.TransferEvidence, error) {
	rows, err := s.db.Query(
		`SELECT id, transfer_id, evidence_type, operator_id, operator_name,
		 operator_role, evidence_content, remark, created_at
		 FROM transfer_evidences WHERE transfer_id = ? ORDER BY id ASC`,
		transferID,
	)
	if err != nil {
		return nil, fmt.Errorf("query evidences: %w", err)
	}
	defer rows.Close()

	var items []model.TransferEvidence
	for rows.Next() {
		var e model.TransferEvidence
		err := rows.Scan(
			&e.ID, &e.TransferID, &e.EvidenceType, &e.OperatorID,
			&e.OperatorName, &e.OperatorRole, &e.EvidenceContent, &e.Remark, &e.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan evidence: %w", err)
		}
		items = append(items, e)
	}

	return items, nil
}
