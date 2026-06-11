package handlers

import (
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"checkin-system/database"
	"checkin-system/middleware"
	"checkin-system/models"
)

type AttachmentHandler struct{}

func NewAttachmentHandler() *AttachmentHandler {
	return &AttachmentHandler{}
}

func (h *AttachmentHandler) Upload(c echo.Context) error {
	recordID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid record id"})
	}

	var exists int
	database.DB.QueryRow("SELECT 1 FROM checkin_records WHERE id = ?", recordID).Scan(&exists)
	if exists == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "record not found"})
	}

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no file uploaded"})
	}

	uploadDir := filepath.Join("uploads", strconv.Itoa(recordID))
	os.MkdirAll(uploadDir, 0755)

	ext := filepath.Ext(file.Filename)
	newFileName := fmt.Sprintf("%d_%d%s", recordID, time.Now().UnixMilli(), ext)
	savePath := filepath.Join(uploadDir, newFileName)

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer src.Close()

	dst, err := os.Create(savePath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	userID, _ := middleware.GetUserID(c)

	result, err := database.DB.Exec(`
		INSERT INTO attachments (checkin_record_id, file_name, file_path, file_type, file_size, uploaded_by)
		VALUES (?, ?, ?, ?, ?, ?)
	`, recordID, file.Filename, savePath, file.Header.Get("Content-Type"), file.Size, userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	attachID, _ := result.LastInsertId()
	writeAuditLog(recordID, userID, "upload_attachment", "", "", fmt.Sprintf("上传附件: %s", file.Filename), "")

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"id":       attachID,
		"file_name": file.Filename,
		"file_path": savePath,
		"file_size": file.Size,
	})
}

func (h *AttachmentHandler) List(c echo.Context) error {
	recordID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id"})
	}

	rows, err := database.DB.Query(`
		SELECT a.id, a.checkin_record_id, a.file_name, a.file_path, a.file_type, a.file_size,
		       a.uploaded_by, a.uploaded_at, u.real_name
		FROM attachments a LEFT JOIN users u ON a.uploaded_by = u.id
		WHERE a.checkin_record_id = ? ORDER BY a.uploaded_at DESC
	`, recordID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer rows.Close()

	list := []models.Attachment{}
	for rows.Next() {
		var a models.Attachment
		var uploaderName, fileType sql.NullString
		rows.Scan(&a.ID, &a.RecordID, &a.FileName, &a.FilePath, &fileType, &a.FileSize,
			&a.UploadedBy, &a.UploadedAt, &uploaderName)
		a.FileType = fileType.String
		a.UploaderName = uploaderName.String
		list = append(list, a)
	}
	return c.JSON(http.StatusOK, list)
}

func (h *AttachmentHandler) Delete(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id"})
	}

	var filePath string
	var recordID int
	err = database.DB.QueryRow("SELECT file_path, checkin_record_id FROM attachments WHERE id = ?", id).Scan(&filePath, &recordID)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "attachment not found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	os.Remove(filePath)

	if _, err := database.DB.Exec("DELETE FROM attachments WHERE id = ?", id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	userID, _ := middleware.GetUserID(c)
	writeAuditLog(recordID, userID, "delete_attachment", "", "", fmt.Sprintf("删除附件: %s", filePath), "")

	return c.JSON(http.StatusOK, map[string]string{"message": "deleted"})
}

type AuditHandler struct{}

func NewAuditHandler() *AuditHandler {
	return &AuditHandler{}
}

func (h *AuditHandler) ListByRecord(c echo.Context) error {
	recordID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id"})
	}

	rows, err := database.DB.Query(`
		SELECT l.id, l.checkin_record_id, l.user_id, u.real_name, l.action, l.old_status,
		       l.new_status, l.detail, l.failure_reason, l.created_at
		FROM audit_logs l LEFT JOIN users u ON l.user_id = u.id
		WHERE l.checkin_record_id = ? ORDER BY l.created_at DESC
	`, recordID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer rows.Close()

	list := []models.AuditLog{}
	for rows.Next() {
		var l models.AuditLog
		var recordID sql.NullInt64
		var userName, oldStatus, newStatus, detail, failureReason sql.NullString
		rows.Scan(&l.ID, &recordID, &l.UserID, &userName, &l.Action, &oldStatus,
			&newStatus, &detail, &failureReason, &l.CreatedAt)
		if recordID.Valid {
			rid := int(recordID.Int64)
			l.RecordID = &rid
		}
		l.UserName = userName.String
		l.OldStatus = oldStatus.String
		l.NewStatus = newStatus.String
		l.Detail = detail.String
		l.FailureReason = failureReason.String
		list = append(list, l)
	}
	return c.JSON(http.StatusOK, list)
}

func (h *AuditHandler) ListFailures(c echo.Context) error {
	userID := c.QueryParam("user_id")
	limit := 100

	query := `
		SELECT l.id, l.checkin_record_id, l.user_id, u.real_name, l.action, l.old_status,
		       l.new_status, l.detail, l.failure_reason, l.created_at
		FROM audit_logs l LEFT JOIN users u ON l.user_id = u.id
		WHERE l.failure_reason IS NOT NULL AND l.failure_reason != ''
	`
	args := []interface{}{}
	if userID != "" {
		query += " AND l.user_id = ?"
		args = append(args, userID)
	}
	query += " ORDER BY l.created_at DESC LIMIT ?"
	args = append(args, limit)

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer rows.Close()

	list := []models.AuditLog{}
	for rows.Next() {
		var l models.AuditLog
		var recordID sql.NullInt64
		var userName, oldStatus, newStatus, detail, failureReason sql.NullString
		rows.Scan(&l.ID, &recordID, &l.UserID, &userName, &l.Action, &oldStatus,
			&newStatus, &detail, &failureReason, &l.CreatedAt)
		if recordID.Valid {
			rid := int(recordID.Int64)
			l.RecordID = &rid
		}
		l.UserName = userName.String
		l.OldStatus = oldStatus.String
		l.NewStatus = newStatus.String
		l.Detail = detail.String
		l.FailureReason = failureReason.String
		list = append(list, l)
	}
	return c.JSON(http.StatusOK, list)
}
