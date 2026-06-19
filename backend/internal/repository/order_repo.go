package repository

import (
	"database/sql"
	"fmt"
	"strings"

	"knowledge-revision-system/internal/model"
)

func GetOrders(db *sql.DB, query model.OrderListQuery) ([]model.KnowledgeRevisionOrder, int, error) {
	var conditions []string
	var args []interface{}
	argPos := 1

	if query.Status != "" {
		conditions = append(conditions, fmt.Sprintf("o.status = $%d", argPos))
		args = append(args, query.Status)
		argPos++
	}

	if query.IsOverdue != "" {
		if query.IsOverdue == "true" || query.IsOverdue == "1" {
			conditions = append(conditions, "o.is_overdue = 1")
		} else if query.IsOverdue == "false" || query.IsOverdue == "0" {
			conditions = append(conditions, "o.is_overdue = 0")
		}
	}

	if query.Role != "" {
		conditions = append(conditions, fmt.Sprintf("o.current_handler_role = $%d", argPos))
		args = append(args, query.Role)
		argPos++
	}

	if query.Keyword != "" {
		conditions = append(conditions, fmt.Sprintf("(o.title LIKE $%d OR o.order_no LIKE $%d)", argPos, argPos+1))
		args = append(args, "%"+query.Keyword+"%", "%"+query.Keyword+"%")
		argPos += 2
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	countSQL := fmt.Sprintf(`
		SELECT COUNT(*) FROM knowledge_revision_orders o
		%s
	`, whereClause)

	var total int
	if err := db.QueryRow(countSQL, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("查询工单总数失败: %w", err)
	}

	page := query.Page
	if page < 1 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	querySQL := fmt.Sprintf(`
		SELECT o.id, o.order_no, o.title, o.knowledge_item_id, ki.title AS knowledge_item_title,
			o.status, o.is_overdue, o.overdue_days, o.overdue_reason, o.overdue_action,
			o.creator_id, u1.name AS creator_name,
			o.current_handler_id, u2.name AS current_handler_name, o.current_handler_role,
			o.time_limit_hours, o.deadline,
			o.revision_before, o.revision_after, o.revision_description, o.processing_opinion,
			o.version, o.created_at, o.updated_at,
			COALESCE(al.failure_type, ''), COALESCE(al.failure_reason, ''), COALESCE(al.created_at, '')
		FROM knowledge_revision_orders o
		LEFT JOIN knowledge_items ki ON o.knowledge_item_id = ki.id
		LEFT JOIN users u1 ON o.creator_id = u1.id
		LEFT JOIN users u2 ON o.current_handler_id = u2.id
		LEFT JOIN (
			SELECT a.order_id, a.failure_type, a.failure_reason, a.created_at
			FROM audit_logs a
			WHERE a.failure_reason IS NOT NULL AND a.failure_reason != ''
			AND a.id = (
				SELECT id FROM audit_logs b
				WHERE b.order_id = a.order_id
				AND b.failure_reason IS NOT NULL AND b.failure_reason != ''
				ORDER BY b.created_at DESC, b.id DESC
				LIMIT 1
			)
		) al ON o.id = al.order_id
		%s
		ORDER BY o.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argPos, argPos+1)

	args = append(args, pageSize, offset)

	rows, err := db.Query(querySQL, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("查询工单列表失败: %w", err)
	}
	defer rows.Close()

	var orders []model.KnowledgeRevisionOrder
	for rows.Next() {
		var o model.KnowledgeRevisionOrder
		var knowledgeItemTitle sql.NullString
		var creatorName sql.NullString
		var currentHandlerName sql.NullString
		var overdueReason sql.NullString
		var overdueAction sql.NullString
		var processingOpinion sql.NullString
		var lastFailureType sql.NullString
		var lastFailureReason sql.NullString
		var lastFailureAt sql.NullString

		err := rows.Scan(
			&o.ID, &o.OrderNo, &o.Title, &o.KnowledgeItemID, &knowledgeItemTitle,
			&o.Status, &o.IsOverdue, &o.OverdueDays, &overdueReason, &overdueAction,
			&o.CreatorID, &creatorName,
			&o.CurrentHandlerID, &currentHandlerName, &o.CurrentHandlerRole,
			&o.TimeLimitHours, &o.Deadline,
			&o.RevisionBefore, &o.RevisionAfter, &o.RevisionDesc, &processingOpinion,
			&o.Version, &o.CreatedAt, &o.UpdatedAt,
			&lastFailureType, &lastFailureReason, &lastFailureAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("扫描工单数据失败: %w", err)
		}

		if knowledgeItemTitle.Valid {
			o.KnowledgeItemTitle = knowledgeItemTitle.String
		}
		if creatorName.Valid {
			o.CreatorName = creatorName.String
		}
		if currentHandlerName.Valid {
			o.CurrentHandlerName = currentHandlerName.String
		}
		if overdueReason.Valid {
			o.OverdueReason = overdueReason.String
		}
		if overdueAction.Valid {
			o.OverdueAction = overdueAction.String
		}
		if processingOpinion.Valid {
			o.ProcessingOpinion = processingOpinion.String
		}
		if lastFailureType.Valid {
			o.LastFailureType = lastFailureType.String
		}
		if lastFailureReason.Valid {
			o.LastFailureReason = lastFailureReason.String
		}
		if lastFailureAt.Valid {
			o.LastFailureAt = lastFailureAt.String
		}

		orders = append(orders, o)
	}

	return orders, total, nil
}

func GetOrderByID(db *sql.DB, id string) (*model.KnowledgeRevisionOrder, error) {
	var o model.KnowledgeRevisionOrder
	var knowledgeItemTitle sql.NullString
	var creatorName sql.NullString
	var currentHandlerName sql.NullString
	var overdueReason sql.NullString
	var overdueAction sql.NullString
	var processingOpinion sql.NullString
	var lastFailureType sql.NullString
	var lastFailureReason sql.NullString
	var lastFailureAt sql.NullString

	err := db.QueryRow(`
		SELECT o.id, o.order_no, o.title, o.knowledge_item_id, ki.title AS knowledge_item_title,
			o.status, o.is_overdue, o.overdue_days, o.overdue_reason, o.overdue_action,
			o.creator_id, u1.name AS creator_name,
			o.current_handler_id, u2.name AS current_handler_name, o.current_handler_role,
			o.time_limit_hours, o.deadline,
			o.revision_before, o.revision_after, o.revision_description, o.processing_opinion,
			o.version, o.created_at, o.updated_at,
			COALESCE(al.failure_type, ''), COALESCE(al.failure_reason, ''), COALESCE(al.created_at, '')
		FROM knowledge_revision_orders o
		LEFT JOIN knowledge_items ki ON o.knowledge_item_id = ki.id
		LEFT JOIN users u1 ON o.creator_id = u1.id
		LEFT JOIN users u2 ON o.current_handler_id = u2.id
		LEFT JOIN (
			SELECT a.order_id, a.failure_type, a.failure_reason, a.created_at
			FROM audit_logs a
			WHERE a.failure_reason IS NOT NULL AND a.failure_reason != ''
			AND a.id = (
				SELECT id FROM audit_logs b
				WHERE b.order_id = a.order_id
				AND b.failure_reason IS NOT NULL AND b.failure_reason != ''
				ORDER BY b.created_at DESC, b.id DESC
				LIMIT 1
			)
		) al ON o.id = al.order_id
		WHERE o.id = $1
	`, id).Scan(
		&o.ID, &o.OrderNo, &o.Title, &o.KnowledgeItemID, &knowledgeItemTitle,
		&o.Status, &o.IsOverdue, &o.OverdueDays, &overdueReason, &overdueAction,
		&o.CreatorID, &creatorName,
		&o.CurrentHandlerID, &currentHandlerName, &o.CurrentHandlerRole,
		&o.TimeLimitHours, &o.Deadline,
		&o.RevisionBefore, &o.RevisionAfter, &o.RevisionDesc, &processingOpinion,
		&o.Version, &o.CreatedAt, &o.UpdatedAt,
		&lastFailureType, &lastFailureReason, &lastFailureAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("查询工单失败: %w", err)
	}

	if knowledgeItemTitle.Valid {
		o.KnowledgeItemTitle = knowledgeItemTitle.String
	}
	if creatorName.Valid {
		o.CreatorName = creatorName.String
	}
	if currentHandlerName.Valid {
		o.CurrentHandlerName = currentHandlerName.String
	}
	if overdueReason.Valid {
		o.OverdueReason = overdueReason.String
	}
	if overdueAction.Valid {
		o.OverdueAction = overdueAction.String
	}
	if processingOpinion.Valid {
		o.ProcessingOpinion = processingOpinion.String
	}
	if lastFailureType.Valid {
		o.LastFailureType = lastFailureType.String
	}
	if lastFailureReason.Valid {
		o.LastFailureReason = lastFailureReason.String
	}
	if lastFailureAt.Valid {
		o.LastFailureAt = lastFailureAt.String
	}

	materials, err := GetMaterialsByOrderID(db, id)
	if err != nil {
		return nil, err
	}
	o.Materials = materials

	feedbacks, err := GetFeedbacksByOrderID(db, id)
	if err != nil {
		return nil, err
	}
	o.Feedbacks = feedbacks

	return &o, nil
}

func GetMaterialsByOrderID(db *sql.DB, orderID string) ([]model.Material, error) {
	rows, err := db.Query(`
		SELECT id, order_id, name, file_type, is_complete, uploaded_at
		FROM materials WHERE order_id = $1 ORDER BY uploaded_at
	`, orderID)
	if err != nil {
		return nil, fmt.Errorf("查询材料失败: %w", err)
	}
	defer rows.Close()

	var materials []model.Material
	for rows.Next() {
		var m model.Material
		if err := rows.Scan(&m.ID, &m.OrderID, &m.Name, &m.FileType, &m.IsComplete, &m.UploadedAt); err != nil {
			return nil, fmt.Errorf("扫描材料数据失败: %w", err)
		}
		materials = append(materials, m)
	}
	return materials, nil
}

func GetFeedbacksByOrderID(db *sql.DB, orderID string) ([]model.KnowledgeFeedback, error) {
	rows, err := db.Query(`
		SELECT id, order_id, content, is_resolved, resolved_at
		FROM knowledge_feedbacks WHERE order_id = $1 ORDER BY id
	`, orderID)
	if err != nil {
		return nil, fmt.Errorf("查询反馈失败: %w", err)
	}
	defer rows.Close()

	var feedbacks []model.KnowledgeFeedback
	for rows.Next() {
		var f model.KnowledgeFeedback
		if err := rows.Scan(&f.ID, &f.OrderID, &f.Content, &f.IsResolved, &f.ResolvedAt); err != nil {
			return nil, fmt.Errorf("扫描反馈数据失败: %w", err)
		}
		feedbacks = append(feedbacks, f)
	}
	return feedbacks, nil
}

func CreateOrder(db *sql.DB, order *model.KnowledgeRevisionOrder) error {
	_, err := db.Exec(`
		INSERT INTO knowledge_revision_orders (
			id, order_no, title, knowledge_item_id, status,
			is_overdue, overdue_days, overdue_reason, overdue_action,
			creator_id, current_handler_id, current_handler_role,
			time_limit_hours, deadline,
			revision_before, revision_after, revision_description, processing_opinion,
			version, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
	`,
		order.ID, order.OrderNo, order.Title, order.KnowledgeItemID, order.Status,
		order.IsOverdue, order.OverdueDays, order.OverdueReason, order.OverdueAction,
		order.CreatorID, order.CurrentHandlerID, order.CurrentHandlerRole,
		order.TimeLimitHours, order.Deadline,
		order.RevisionBefore, order.RevisionAfter, order.RevisionDesc, order.ProcessingOpinion,
		order.Version, order.CreatedAt, order.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("创建工单失败: %w", err)
	}
	return nil
}

func UpdateOrder(db *sql.DB, order *model.KnowledgeRevisionOrder) error {
	result, err := db.Exec(`
		UPDATE knowledge_revision_orders SET
			title = $1, status = $2,
			is_overdue = $3, overdue_days = $4, overdue_reason = $5, overdue_action = $6,
			current_handler_id = $7, current_handler_role = $8,
			deadline = $9,
			revision_before = $10, revision_after = $11, revision_description = $12, processing_opinion = $13,
			version = version + 1, updated_at = $14
		WHERE id = $15 AND version = $16
	`,
		order.Title, order.Status,
		order.IsOverdue, order.OverdueDays, order.OverdueReason, order.OverdueAction,
		order.CurrentHandlerID, order.CurrentHandlerRole,
		order.Deadline,
		order.RevisionBefore, order.RevisionAfter, order.RevisionDesc, order.ProcessingOpinion,
		order.UpdatedAt, order.ID, order.Version,
	)
	if err != nil {
		return fmt.Errorf("更新工单失败: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("版本冲突：工单已被其他人修改，请刷新后重试")
	}

	return nil
}

func CreateMaterial(db *sql.DB, material *model.Material) error {
	_, err := db.Exec(`
		INSERT INTO materials (id, order_id, name, file_type, is_complete, uploaded_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, material.ID, material.OrderID, material.Name, material.FileType, material.IsComplete, material.UploadedAt)
	if err != nil {
		return fmt.Errorf("创建材料失败: %w", err)
	}
	return nil
}

func UpdateMaterial(db *sql.DB, material *model.Material) error {
	_, err := db.Exec(`
		UPDATE materials SET name = $1, file_type = $2, is_complete = $3
		WHERE id = $4
	`, material.Name, material.FileType, material.IsComplete, material.ID)
	if err != nil {
		return fmt.Errorf("更新材料失败: %w", err)
	}
	return nil
}

func DeleteMaterialsByOrderID(db *sql.DB, orderID string) error {
	_, err := db.Exec("DELETE FROM materials WHERE order_id = $1", orderID)
	if err != nil {
		return fmt.Errorf("删除材料失败: %w", err)
	}
	return nil
}

func CreateFeedback(db *sql.DB, feedback *model.KnowledgeFeedback) error {
	_, err := db.Exec(`
		INSERT INTO knowledge_feedbacks (id, order_id, content, is_resolved, resolved_at)
		VALUES ($1, $2, $3, $4, $5)
	`, feedback.ID, feedback.OrderID, feedback.Content, feedback.IsResolved, feedback.ResolvedAt)
	if err != nil {
		return fmt.Errorf("创建反馈失败: %w", err)
	}
	return nil
}

func UpdateFeedback(db *sql.DB, feedback *model.KnowledgeFeedback) error {
	_, err := db.Exec(`
		UPDATE knowledge_feedbacks SET content = $1, is_resolved = $2, resolved_at = $3
		WHERE id = $4
	`, feedback.Content, feedback.IsResolved, feedback.ResolvedAt, feedback.ID)
	if err != nil {
		return fmt.Errorf("更新反馈失败: %w", err)
	}
	return nil
}

func DeleteFeedbacksByOrderID(db *sql.DB, orderID string) error {
	_, err := db.Exec("DELETE FROM knowledge_feedbacks WHERE order_id = $1", orderID)
	if err != nil {
		return fmt.Errorf("删除反馈失败: %w", err)
	}
	return nil
}

func CountOrders(db *sql.DB, query model.OrderListQuery) (int, error) {
	var conditions []string
	var args []interface{}
	argPos := 1

	if query.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argPos))
		args = append(args, query.Status)
		argPos++
	}

	if query.IsOverdue == "true" || query.IsOverdue == "1" {
		conditions = append(conditions, "is_overdue = 1")
	} else if query.IsOverdue == "false" || query.IsOverdue == "0" {
		conditions = append(conditions, "is_overdue = 0")
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	sql := fmt.Sprintf("SELECT COUNT(*) FROM knowledge_revision_orders %s", whereClause)
	var total int
	if err := db.QueryRow(sql, args...).Scan(&total); err != nil {
		return 0, fmt.Errorf("统计工单数失败: %w", err)
	}
	return total, nil
}

func GetOverdueOrders(db *sql.DB) ([]model.KnowledgeRevisionOrder, error) {
	rows, err := db.Query(`
		SELECT id, order_no, title, knowledge_item_id, status,
			is_overdue, overdue_days, overdue_reason, overdue_action,
			creator_id, current_handler_id, current_handler_role,
			time_limit_hours, deadline,
			revision_before, revision_after, revision_description, processing_opinion,
			version, created_at, updated_at
		FROM knowledge_revision_orders
		WHERE deadline < datetime('now', 'localtime') AND status != 'archived'
	`)
	if err != nil {
		return nil, fmt.Errorf("查询逾期工单失败: %w", err)
	}
	defer rows.Close()

	var orders []model.KnowledgeRevisionOrder
	for rows.Next() {
		var o model.KnowledgeRevisionOrder
		var overdueReason sql.NullString
		var overdueAction sql.NullString
		var processingOpinion sql.NullString

		err := rows.Scan(
			&o.ID, &o.OrderNo, &o.Title, &o.KnowledgeItemID, &o.Status,
			&o.IsOverdue, &o.OverdueDays, &overdueReason, &overdueAction,
			&o.CreatorID, &o.CurrentHandlerID, &o.CurrentHandlerRole,
			&o.TimeLimitHours, &o.Deadline,
			&o.RevisionBefore, &o.RevisionAfter, &o.RevisionDesc, &processingOpinion,
			&o.Version, &o.CreatedAt, &o.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("扫描逾期工单数据失败: %w", err)
		}
		if overdueReason.Valid {
			o.OverdueReason = overdueReason.String
		}
		if overdueAction.Valid {
			o.OverdueAction = overdueAction.String
		}
		if processingOpinion.Valid {
			o.ProcessingOpinion = processingOpinion.String
		}
		orders = append(orders, o)
	}
	return orders, nil
}

func UpdateOverdueStatus(db *sql.DB) error {
	_, err := db.Exec(`
		UPDATE knowledge_revision_orders
		SET is_overdue = 1,
		    overdue_days = CAST(julianday(datetime('now', 'localtime')) - julianday(deadline) AS INTEGER),
		    updated_at = datetime('now', 'localtime')
		WHERE deadline < datetime('now', 'localtime')
		  AND status != 'archived'
		  AND is_overdue = 0
	`)
	if err != nil {
		return fmt.Errorf("更新逾期状态失败: %w", err)
	}
	return nil
}
