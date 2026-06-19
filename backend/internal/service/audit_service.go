package service

import (
	"database/sql"

	"knowledge-revision-system/internal/model"
	"knowledge-revision-system/internal/repository"
)

func ListAuditLogs(db *sql.DB, orderID, actorID, action, startDate, endDate string, page, pageSize int) ([]model.AuditLog, int, error) {
	return repository.GetAuditLogs(db, orderID, actorID, action, startDate, endDate, page, pageSize)
}

func GetAuditLogsByOrder(db *sql.DB, orderID string) ([]model.AuditLog, error) {
	return repository.GetAuditLogsByOrderID(db, orderID)
}
