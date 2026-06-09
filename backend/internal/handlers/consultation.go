package handlers

import (
	"consultation-system/internal/middleware"
	"consultation-system/internal/models"
	"consultation-system/internal/utils"
	"database/sql"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func ListConsultations(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	status := c.Query("status")
	role := c.Query("role_view")

	baseQuery := `
		SELECT id, title, patient_name, patient_id, dept, chief_complaint,
			consult_type, consult_dept, status, status_name, version,
			registrar_id, registrar_name, reviewer_id, reviewer_name,
			director_id, director_name, latest_opinion, latest_reject_reason,
			evidence_list, is_overdue, has_appeal, appeal_status, appeal_status_name,
			appeal_reason, deadline, created_at, updated_at
		FROM consultations WHERE 1=1
	`
	var args []interface{}

	if status != "" {
		baseQuery += " AND status = ?"
		args = append(args, status)
	}

	if role == "registrar" || user.Role == models.RoleRegistrar {
		baseQuery += " AND registrar_id = ?"
		args = append(args, user.UserID)
	} else if role == "reviewer" || user.Role == models.RoleReviewer {
		baseQuery += " AND (reviewer_id = ? OR status IN (?, ?, ?))"
		args = append(args, user.UserID, models.StatusSubmitted, models.StatusResubmitted, models.StatusUnderReview)
	} else if role == "director" || user.Role == models.RoleDirector {
		baseQuery += " AND (director_id = ? OR status IN (?, ?, ?, ?, ?, ?, ?))"
		args = append(args, user.UserID,
			models.StatusReviewPassed, models.StatusUnderFinal,
			models.StatusConflict, models.StatusAppealSubmitted,
			models.StatusAppealAccepted, models.StatusEvidenceMissing,
			models.StatusCorrectionReq)
	}

	baseQuery += " ORDER BY created_at DESC"

	rows, err := models.DB.Query(baseQuery, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	list, err := scanConsultationRows(rows)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"data":  list,
		"total": len(list),
	})
}

func GetConsultation(c *fiber.Ctx) error {
	id := c.Params("id")

	row := models.DB.QueryRow(`
		SELECT id, title, patient_name, patient_id, dept, chief_complaint,
			consult_type, consult_dept, status, status_name, version,
			registrar_id, registrar_name, reviewer_id, reviewer_name,
			director_id, director_name, latest_opinion, latest_reject_reason,
			evidence_list, is_overdue, has_appeal, appeal_status, appeal_status_name,
			appeal_reason, deadline, created_at, updated_at
		FROM consultations WHERE id = ?
	`, id)

	cs, err := scanConsultation(row)
	if err == sql.ErrNoRows {
		return c.Status(404).JSON(fiber.Map{"error": "申请单不存在"})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(cs)
}

type CreateConsultationRequest struct {
	Title          string   `json:"title"`
	PatientName    string   `json:"patient_name"`
	PatientID      string   `json:"patient_id"`
	Dept           string   `json:"dept"`
	ChiefComplaint string   `json:"chief_complaint"`
	ConsultType    string   `json:"consult_type"`
	ConsultDept    string   `json:"consult_dept"`
	EvidenceList   []string `json:"evidence_list"`
	Deadline       string   `json:"deadline"`
}

func CreateConsultation(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)

	var req CreateConsultationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "请求参数无效"})
	}

	if req.Title == "" || req.PatientName == "" || req.PatientID == "" ||
		req.Dept == "" || req.ConsultType == "" || req.ConsultDept == "" {
		return c.Status(400).JSON(fiber.Map{"error": "请填写所有必填项"})
	}

	id := uuid.New().String()
	now := time.Now()
	deadline := now.AddDate(0, 0, 7)
	if req.Deadline != "" {
		if t, err := time.Parse(time.RFC3339, req.Deadline); err == nil {
			deadline = t
		}
	}

	evidenceStr := utils.JoinEvidenceList(req.EvidenceList)

	tx, err := models.DB.Begin()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO consultations (
			id, title, patient_name, patient_id, dept, chief_complaint,
			consult_type, consult_dept, status, status_name, version,
			registrar_id, registrar_name, evidence_list, deadline, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		id, req.Title, req.PatientName, req.PatientID, req.Dept, req.ChiefComplaint,
		req.ConsultType, req.ConsultDept,
		models.StatusDraft, utils.StatusName(models.StatusDraft),
		1, user.UserID, user.UserName, evidenceStr, deadline, now, now,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	historyID := uuid.New().String()
	_, err = tx.Exec(`
		INSERT INTO history_records (
			id, consultation_id, operator_id, operator_name, operator_role,
			operator_role_name, action, action_name, from_status, from_status_name,
			to_status, to_status_name, version, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		historyID, id, user.UserID, user.UserName, user.Role, user.RoleName,
		"create", "创建申请单",
		"", "",
		models.StatusDraft, utils.StatusName(models.StatusDraft),
		1, now,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if err := tx.Commit(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(fiber.Map{
		"id":      id,
		"message": "申请单创建成功",
	})
}

type UpdateConsultationRequest struct {
	Title          string   `json:"title"`
	PatientName    string   `json:"patient_name"`
	PatientID      string   `json:"patient_id"`
	Dept           string   `json:"dept"`
	ChiefComplaint string   `json:"chief_complaint"`
	ConsultType    string   `json:"consult_type"`
	ConsultDept    string   `json:"consult_dept"`
	EvidenceList   []string `json:"evidence_list"`
	Deadline       string   `json:"deadline"`
	Version        int      `json:"version"`
}

func UpdateConsultation(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	var req UpdateConsultationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "请求参数无效"})
	}

	row := models.DB.QueryRow(`
		SELECT status, version, registrar_id
		FROM consultations WHERE id = ?
	`, id)

	var status string
	var version int
	var registrarID string
	err := row.Scan(&status, &version, &registrarID)
	if err == sql.ErrNoRows {
		return c.Status(404).JSON(fiber.Map{"error": "申请单不存在"})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if status != models.StatusDraft && status != models.StatusCorrectionReq {
		return c.Status(400).JSON(fiber.Map{
			"error": "当前状态不允许编辑申请单",
		})
	}

	if registrarID != user.UserID {
		return c.Status(403).JSON(fiber.Map{"error": "只有登记人可以编辑申请单"})
	}

	if req.Version != version {
		return c.Status(409).JSON(fiber.Map{
			"error":   "版本冲突，请刷新后重试",
			"version": version,
		})
	}

	evidenceStr := utils.JoinEvidenceList(req.EvidenceList)
	now := time.Now()

	deadline := time.Time{}
	if req.Deadline != "" {
		if t, err := time.Parse(time.RFC3339, req.Deadline); err == nil {
			deadline = t
		}
	}

	tx, err := models.DB.Begin()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		UPDATE consultations SET
			title = ?, patient_name = ?, patient_id = ?, dept = ?,
			chief_complaint = ?, consult_type = ?, consult_dept = ?,
			evidence_list = ?, updated_at = ?
		WHERE id = ?
	`,
		req.Title, req.PatientName, req.PatientID, req.Dept,
		req.ChiefComplaint, req.ConsultType, req.ConsultDept,
		evidenceStr, now, id,
	)
	if !deadline.IsZero() {
		_, err = tx.Exec("UPDATE consultations SET deadline = ? WHERE id = ?", deadline, id)
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	historyID := uuid.New().String()
	_, err = tx.Exec(`
		INSERT INTO history_records (
			id, consultation_id, operator_id, operator_name, operator_role,
			operator_role_name, action, action_name, from_status, from_status_name,
			to_status, to_status_name, version, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		historyID, id, user.UserID, user.UserName, user.Role, user.RoleName,
		"update", "更新申请单",
		status, utils.StatusName(status),
		status, utils.StatusName(status),
		version, now,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if err := tx.Commit(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "申请单更新成功"})
}
