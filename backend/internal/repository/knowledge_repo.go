package repository

import (
	"database/sql"
	"fmt"

	"knowledge-revision-system/internal/model"
)

func GetKnowledgeItems(db *sql.DB) ([]model.KnowledgeItem, error) {
	rows, err := db.Query("SELECT id, title, category, expiry_date, status FROM knowledge_items ORDER BY id")
	if err != nil {
		return nil, fmt.Errorf("查询知识条目失败: %w", err)
	}
	defer rows.Close()

	var items []model.KnowledgeItem
	for rows.Next() {
		var item model.KnowledgeItem
		if err := rows.Scan(&item.ID, &item.Title, &item.Category, &item.ExpiryDate, &item.Status); err != nil {
			return nil, fmt.Errorf("扫描知识条目数据失败: %w", err)
		}
		items = append(items, item)
	}
	return items, nil
}

func GetKnowledgeItemByID(db *sql.DB, id string) (*model.KnowledgeItem, error) {
	var item model.KnowledgeItem
	err := db.QueryRow("SELECT id, title, category, expiry_date, status FROM knowledge_items WHERE id = $1", id).
		Scan(&item.ID, &item.Title, &item.Category, &item.ExpiryDate, &item.Status)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("查询知识条目失败: %w", err)
	}
	return &item, nil
}
