package service

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"prescription-transfer/internal/model"
)

type BatchService struct {
	db         *sql.DB
	transferSvc *TransferService
	mu         sync.Mutex
	counter    int
}

func NewBatchService(db *sql.DB) *BatchService {
	return &BatchService{
		db:          db,
		transferSvc: NewTransferService(db),
		counter:     0,
	}
}

func (s *BatchService) generateBatchNo() string {
	s.mu.Lock()
	s.counter++
	c := s.counter
	s.mu.Unlock()
	return fmt.Sprintf("BATCH-%s-%03d", time.Now().Format("20060102150405"), c)
}

type BatchOperationRequest struct {
	TransferIDs     []int64 `json:"transfer_ids"`
	EvidenceContent string  `json:"evidence_content"`
	Remark          string  `json:"remark"`
}

type BatchDetailResult struct {
	Batch  *model.BatchOperation `json:"batch"`
	Items  []model.BatchItem     `json:"items"`
}

func (s *BatchService) BatchRegister(req BatchOperationRequest, user *model.User) (*model.BatchOperation, error) {
	if user.Role != model.RoleReceptionAssistant {
		return nil, ErrForbidden
	}
	if req.EvidenceContent == "" {
		return nil, ErrEvidenceRequired
	}
	if len(req.TransferIDs) == 0 {
		return nil, errors.New("请选择要操作的记录")
	}

	batchNo := s.generateBatchNo()

	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	result, err := tx.Exec(
		`INSERT INTO batch_operations
		 (batch_no, operation_type, operator_id, operator_name, total_count, success_count, fail_count, status)
		 VALUES (?, 'register', ?, ?, ?, 0, 0, 'processing')`,
		batchNo, user.ID, user.Name, len(req.TransferIDs),
	)
	if err != nil {
		return nil, fmt.Errorf("create batch: %w", err)
	}

	batchID, _ := result.LastInsertId()

	for _, tid := range req.TransferIDs {
		_, err := tx.Exec(
			`INSERT INTO batch_items (batch_id, transfer_id, status, error_message)
			 VALUES (?, ?, 'pending', '')`,
			batchID, tid,
		)
		if err != nil {
			return nil, fmt.Errorf("create batch item: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	go s.processBatch(batchID, req.EvidenceContent, req.Remark, user, model.BatchOpRegister)

	return s.getBatchByID(batchID)
}

func (s *BatchService) BatchVerify(req BatchOperationRequest, user *model.User) (*model.BatchOperation, error) {
	if user.Role != model.RoleAttendingPhysician {
		return nil, ErrForbidden
	}
	if req.EvidenceContent == "" {
		return nil, ErrEvidenceRequired
	}
	if len(req.TransferIDs) == 0 {
		return nil, errors.New("请选择要操作的记录")
	}

	batchNo := s.generateBatchNo()

	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	result, err := tx.Exec(
		`INSERT INTO batch_operations
		 (batch_no, operation_type, operator_id, operator_name, total_count, success_count, fail_count, status)
		 VALUES (?, 'verify', ?, ?, ?, 0, 0, 'processing')`,
		batchNo, user.ID, user.Name, len(req.TransferIDs),
	)
	if err != nil {
		return nil, fmt.Errorf("create batch: %w", err)
	}

	batchID, _ := result.LastInsertId()

	for _, tid := range req.TransferIDs {
		_, err := tx.Exec(
			`INSERT INTO batch_items (batch_id, transfer_id, status, error_message)
			 VALUES (?, ?, 'pending', '')`,
			batchID, tid,
		)
		if err != nil {
			return nil, fmt.Errorf("create batch item: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	go s.processBatch(batchID, req.EvidenceContent, req.Remark, user, model.BatchOpVerify)

	return s.getBatchByID(batchID)
}

func (s *BatchService) BatchReview(req BatchOperationRequest, user *model.User) (*model.BatchOperation, error) {
	if user.Role != model.RolePharmacyAdmin {
		return nil, ErrForbidden
	}
	if req.EvidenceContent == "" {
		return nil, ErrEvidenceRequired
	}
	if len(req.TransferIDs) == 0 {
		return nil, errors.New("请选择要操作的记录")
	}

	batchNo := s.generateBatchNo()

	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	result, err := tx.Exec(
		`INSERT INTO batch_operations
		 (batch_no, operation_type, operator_id, operator_name, total_count, success_count, fail_count, status)
		 VALUES (?, 'review', ?, ?, ?, 0, 0, 'processing')`,
		batchNo, user.ID, user.Name, len(req.TransferIDs),
	)
	if err != nil {
		return nil, fmt.Errorf("create batch: %w", err)
	}

	batchID, _ := result.LastInsertId()

	for _, tid := range req.TransferIDs {
		_, err := tx.Exec(
			`INSERT INTO batch_items (batch_id, transfer_id, status, error_message)
			 VALUES (?, ?, 'pending', '')`,
			batchID, tid,
		)
		if err != nil {
			return nil, fmt.Errorf("create batch item: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	go s.processBatch(batchID, req.EvidenceContent, req.Remark, user, model.BatchOpReview)

	return s.getBatchByID(batchID)
}

func (s *BatchService) processBatch(batchID int64, evidenceContent, remark string, user *model.User, opType string) {
	items, err := s.getBatchItems(batchID)
	if err != nil {
		return
	}

	successCount := 0
	failCount := 0

	for _, item := range items {
		resultData := ""
		errMsg := ""
		itemStatus := model.BatchItemStatusSuccess

		transfer, err := s.transferSvc.GetByID(item.TransferID)
		if err != nil {
			itemStatus = model.BatchItemStatusFailed
			errMsg = err.Error()
		} else {
			var opErr error
			switch opType {
			case model.BatchOpRegister:
				_, opErr = s.transferSvc.Register(item.TransferID, transfer.Version, evidenceContent, remark, user)
			case model.BatchOpVerify:
				_, opErr = s.transferSvc.Verify(item.TransferID, transfer.Version, evidenceContent, remark, user)
			case model.BatchOpReview:
				_, opErr = s.transferSvc.Review(item.TransferID, transfer.Version, evidenceContent, remark, user)
			}

			if opErr != nil {
				itemStatus = model.BatchItemStatusFailed
				errMsg = opErr.Error()
			} else {
				resultJSON, _ := json.Marshal(map[string]interface{}{"status": "success"})
				resultData = string(resultJSON)
			}
		}

		if itemStatus == model.BatchItemStatusSuccess {
			successCount++
		} else {
			failCount++
		}

		s.db.Exec(
			`UPDATE batch_items SET status = ?, error_message = ?, result_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
			itemStatus, errMsg, resultData, item.ID,
		)
	}

	s.db.Exec(
		`UPDATE batch_operations SET success_count = ?, fail_count = ?, status = 'completed' WHERE id = ?`,
		successCount, failCount, batchID,
	)
}

func (s *BatchService) getBatchItems(batchID int64) ([]model.BatchItem, error) {
	rows, err := s.db.Query(
		`SELECT bi.id, bi.batch_id, bi.transfer_id, bi.status, bi.error_message, bi.result_data, bi.created_at, bi.updated_at,
		 pt.transfer_no
		 FROM batch_items bi
		 LEFT JOIN prescription_transfers pt ON bi.transfer_id = pt.id
		 WHERE bi.batch_id = ?
		 ORDER BY bi.id ASC`,
		batchID,
	)
	if err != nil {
		return nil, fmt.Errorf("query batch items: %w", err)
	}
	defer rows.Close()

	var items []model.BatchItem
	for rows.Next() {
		var item model.BatchItem
		var transferNo sql.NullString
		err := rows.Scan(
			&item.ID, &item.BatchID, &item.TransferID, &item.Status,
			&item.ErrorMessage, &item.ResultData, &item.CreatedAt, &item.UpdatedAt,
			&transferNo,
		)
		if err != nil {
			return nil, fmt.Errorf("scan batch item: %w", err)
		}
		if transferNo.Valid {
			item.TransferNo = transferNo.String
		}
		items = append(items, item)
	}

	return items, nil
}

func (s *BatchService) getBatchByID(batchID int64) (*model.BatchOperation, error) {
	var b model.BatchOperation
	err := s.db.QueryRow(
		`SELECT id, batch_no, operation_type, operator_id, operator_name,
		 total_count, success_count, fail_count, status, created_at
		 FROM batch_operations WHERE id = ?`,
		batchID,
	).Scan(
		&b.ID, &b.BatchNo, &b.OperationType, &b.OperatorID, &b.OperatorName,
		&b.TotalCount, &b.SuccessCount, &b.FailCount, &b.Status, &b.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get batch: %w", err)
	}
	return &b, nil
}

func (s *BatchService) GetBatch(batchNo string) (*BatchDetailResult, error) {
	var b model.BatchOperation
	err := s.db.QueryRow(
		`SELECT id, batch_no, operation_type, operator_id, operator_name,
		 total_count, success_count, fail_count, status, created_at
		 FROM batch_operations WHERE batch_no = ?`,
		batchNo,
	).Scan(
		&b.ID, &b.BatchNo, &b.OperationType, &b.OperatorID, &b.OperatorName,
		&b.TotalCount, &b.SuccessCount, &b.FailCount, &b.Status, &b.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get batch: %w", err)
	}

	items, err := s.getBatchItems(b.ID)
	if err != nil {
		return nil, err
	}

	return &BatchDetailResult{
		Batch: &b,
		Items: items,
	}, nil
}

func (s *BatchService) RetryBatch(batchNo string, user *model.User) (*BatchDetailResult, error) {
	batch, err := s.GetBatch(batchNo)
	if err != nil {
		return nil, err
	}

	if user.Role != model.RoleReceptionAssistant &&
		user.Role != model.RoleAttendingPhysician &&
		user.Role != model.RolePharmacyAdmin {
		return nil, ErrForbidden
	}

	opType := batch.Batch.OperationType
	if opType == model.BatchOpRegister && user.Role != model.RoleReceptionAssistant {
		return nil, ErrForbidden
	}
	if opType == model.BatchOpVerify && user.Role != model.RoleAttendingPhysician {
		return nil, ErrForbidden
	}
	if opType == model.BatchOpReview && user.Role != model.RolePharmacyAdmin {
		return nil, ErrForbidden
	}

	failedItems := []model.BatchItem{}
	for _, item := range batch.Items {
		if item.Status == model.BatchItemStatusFailed {
			failedItems = append(failedItems, item)
		}
	}

	if len(failedItems) == 0 {
		return nil, errors.New("没有需要重试的失败项")
	}

	s.db.Exec(
		`UPDATE batch_operations SET status = 'processing' WHERE id = ?`,
		batch.Batch.ID,
	)

	for _, item := range failedItems {
		s.db.Exec(
			`UPDATE batch_items SET status = 'pending', error_message = '', result_data = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
			item.ID,
		)
	}

	go s.retryBatchItems(batch.Batch.ID, user, opType)

	return s.GetBatch(batchNo)
}

func (s *BatchService) retryBatchItems(batchID int64, user *model.User, opType string) {
	items, err := s.getBatchItems(batchID)
	if err != nil {
		return
	}

	successCount := 0
	failCount := 0

	for _, item := range items {
		if item.Status != model.BatchItemStatusPending {
			if item.Status == model.BatchItemStatusSuccess {
				successCount++
			} else {
				failCount++
			}
			continue
		}

		transfer, err := s.transferSvc.GetByID(item.TransferID)
		if err != nil {
			failCount++
			s.db.Exec(
				`UPDATE batch_items SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
				err.Error(), item.ID,
			)
			continue
		}

		var opErr error
		evidenceContent := fmt.Sprintf("批量重试-%s操作", opType)
		switch opType {
		case model.BatchOpRegister:
			_, opErr = s.transferSvc.Register(item.TransferID, transfer.Version, evidenceContent, "批量重试", user)
		case model.BatchOpVerify:
			_, opErr = s.transferSvc.Verify(item.TransferID, transfer.Version, evidenceContent, "批量重试", user)
		case model.BatchOpReview:
			_, opErr = s.transferSvc.Review(item.TransferID, transfer.Version, evidenceContent, "批量重试", user)
		}

		if opErr != nil {
			failCount++
			s.db.Exec(
				`UPDATE batch_items SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
				opErr.Error(), item.ID,
			)
		} else {
			successCount++
			resultJSON, _ := json.Marshal(map[string]interface{}{"status": "success"})
			s.db.Exec(
				`UPDATE batch_items SET status = 'success', result_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
				string(resultJSON), item.ID,
			)
		}
	}

	s.db.Exec(
		`UPDATE batch_operations SET success_count = ?, fail_count = ?, status = 'completed' WHERE id = ?`,
		successCount, failCount, batchID,
	)
}

type BatchListFilter struct {
	Page     int
	PageSize int
}

func (s *BatchService) ListBatches(filter BatchListFilter) ([]model.BatchOperation, int, error) {
	offset := (filter.Page - 1) * filter.PageSize

	var total int
	err := s.db.QueryRow("SELECT COUNT(*) FROM batch_operations").Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count batches: %w", err)
	}

	rows, err := s.db.Query(
		`SELECT id, batch_no, operation_type, operator_id, operator_name,
		 total_count, success_count, fail_count, status, created_at
		 FROM batch_operations ORDER BY id DESC LIMIT ? OFFSET ?`,
		filter.PageSize, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("query batches: %w", err)
	}
	defer rows.Close()

	var items []model.BatchOperation
	for rows.Next() {
		var b model.BatchOperation
		err := rows.Scan(
			&b.ID, &b.BatchNo, &b.OperationType, &b.OperatorID, &b.OperatorName,
			&b.TotalCount, &b.SuccessCount, &b.FailCount, &b.Status, &b.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan batch: %w", err)
		}
		items = append(items, b)
	}

	return items, total, nil
}
