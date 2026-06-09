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

type SubmitRequest struct {
	Version int      `json:"version"`
	Opinion string   `json:"opinion"`
	EvidenceList []string `json:"evidence_list"`
}

func SubmitConsultation(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	var req SubmitRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "请求参数无效"})
	}

	row := models.DB.QueryRow(`
		SELECT status, version, registrar_id, evidence_list
		FROM consultations WHERE id = ?
	`, id)

	var status string
	var version int
	var registrarID string
	var evidenceList string
	err := row.Scan(&status, &version, &registrarID, &evidenceList)
	if err == sql.ErrNoRows {
		return c.Status(404).JSON(fiber.Map{"error": "申请单不存在"})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if status != models.StatusDraft && status != models.StatusCorrectionReq {
		return c.Status(400).JSON(fiber.Map{
			"error": "当前状态不允许提交",
			"current_status": status,
		})
	}

	if registrarID != user.UserID {
		return c.Status(403).JSON(fiber.Map{"error": "只有登记人可以提交申请"})
	}

	if req.Version != version {
		return c.Status(409).JSON(fiber.Map{
			"error":   "版本冲突，请刷新后重试",
			"version": version,
		})
	}

	if len(req.EvidenceList) > 0 {
		evidenceList = utils.JoinEvidenceList(req.EvidenceList)
	}

	missing := utils.CheckRequiredEvidence(evidenceList)
	if len(missing) > 0 {
		return c.Status(400).JSON(fiber.Map{
			"error":         "缺少必填证据材料",
			"missing_evidence": missing,
		})
	}

	newStatus := models.StatusSubmitted
	action := "submit"
	actionName := "提交申请"
	fromStatus := status
	fromVersion := version

	if status == models.StatusCorrectionReq {
		newStatus = models.StatusResubmitted
		action = "resubmit"
		actionName = "补正重提"
	}

	now := time.Now()
	newVersion := version + 1

	tx, err := models.DB.Begin()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		UPDATE consultations SET
			status = ?, status_name = ?, version = ?,
			evidence_list = ?, latest_opinion = ?,
			latest_reject_reason = '', updated_at = ?
		WHERE id = ?
	`,
		newStatus, utils.StatusName(newStatus), newVersion,
		evidenceList, req.Opinion,
		now, id,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	historyID := uuid.New().String()
	_, err = tx.Exec(`
		INSERT INTO history_records (
			id, consultation_id, operator_id, operator_name, operator_role,
			operator_role_name, action, action_name, from_status, from_status_name,
			to_status, to_status_name, opinion, version, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		historyID, id, user.UserID, user.UserName, user.Role, user.RoleName,
		action, actionName,
		fromStatus, utils.StatusName(fromStatus),
		newStatus, utils.StatusName(newStatus),
		req.Opinion, fromVersion+1, now,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if err := tx.Commit(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": actionName + "成功",
		"status":  newStatus,
		"version": newVersion,
	})
}

type ReviewRequest struct {
	Version      int      `json:"version"`
	Action       string   `json:"action"`
	Opinion      string   `json:"opinion"`
	RejectReason string   `json:"reject_reason"`
	EvidenceList []string `json:"evidence_list"`
}

func ReviewConsultation(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	if user.Role != models.RoleReviewer {
		return c.Status(403).JSON(fiber.Map{"error": "只有审核主管可以执行审核操作"})
	}

	var req ReviewRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "请求参数无效"})
	}

	row := models.DB.QueryRow(`
		SELECT status, version, evidence_list
		FROM consultations WHERE id = ?
	`, id)

	var status string
	var version int
	var evidenceList string
	err := row.Scan(&status, &version, &evidenceList)
	if err == sql.ErrNoRows {
		return c.Status(404).JSON(fiber.Map{"error": "申请单不存在"})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if status != models.StatusSubmitted && status != models.StatusResubmitted {
		return c.Status(400).JSON(fiber.Map{
			"error":          "当前状态不允许审核",
			"current_status": status,
		})
	}

	if req.Version != version {
		return c.Status(409).JSON(fiber.Map{
			"error":   "版本冲突，请刷新后重试",
			"version": version,
		})
	}

	var newStatus string
	var action string
	var actionName string

	switch req.Action {
	case "pass":
		newStatus = models.StatusReviewPassed
		action = "review_pass"
		actionName = "审核通过"
	case "reject":
		newStatus = models.StatusCorrectionReq
		action = "reject_correction"
		actionName = "退回补正"
		if req.RejectReason == "" {
			return c.Status(400).JSON(fiber.Map{"error": "退回补正必须填写驳回原因"})
		}
	case "evidence_missing":
		newStatus = models.StatusEvidenceMissing
		action = "evidence_missing"
		actionName = "证据不足"
		if req.RejectReason == "" {
			return c.Status(400).JSON(fiber.Map{"error": "证据不足必须填写原因"})
		}
	default:
		return c.Status(400).JSON(fiber.Map{"error": "无效的审核操作"})
	}

	now := time.Now()
	newVersion := version + 1

	tx, err := models.DB.Begin()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		UPDATE consultations SET
			status = ?, status_name = ?, version = ?,
			reviewer_id = ?, reviewer_name = ?,
			latest_opinion = ?, latest_reject_reason = ?,
			updated_at = ?
		WHERE id = ?
	`,
		newStatus, utils.StatusName(newStatus), newVersion,
		user.UserID, user.UserName,
		req.Opinion, req.RejectReason,
		now, id,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	historyID := uuid.New().String()
	_, err = tx.Exec(`
		INSERT INTO history_records (
			id, consultation_id, operator_id, operator_name, operator_role,
			operator_role_name, action, action_name, from_status, from_status_name,
			to_status, to_status_name, opinion, reject_reason, version, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		historyID, id, user.UserID, user.UserName, user.Role, user.RoleName,
		action, actionName,
		status, utils.StatusName(status),
		newStatus, utils.StatusName(newStatus),
		req.Opinion, req.RejectReason,
		version+1, now,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if err := tx.Commit(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": actionName + "成功",
		"status":  newStatus,
		"version": newVersion,
	})
}

type CorrectRequest struct {
	Version      int      `json:"version"`
	EvidenceList []string `json:"evidence_list"`
	Opinion      string   `json:"opinion"`
}

func CorrectConsultation(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	var req CorrectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "请求参数无效"})
	}

	row := models.DB.QueryRow(`
		SELECT status, version, registrar_id, evidence_list
		FROM consultations WHERE id = ?
	`, id)

	var status string
	var version int
	var registrarID string
	var evidenceList string
	err := row.Scan(&status, &version, &registrarID, &evidenceList)
	if err == sql.ErrNoRows {
		return c.Status(404).JSON(fiber.Map{"error": "申请单不存在"})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if status != models.StatusCorrectionReq && status != models.StatusEvidenceMissing {
		return c.Status(400).JSON(fiber.Map{
			"error":          "当前状态不允许补正",
			"current_status": status,
		})
	}

	if registrarID != user.UserID {
		return c.Status(403).JSON(fiber.Map{"error": "只有登记人可以补正申请"})
	}

	if req.Version != version {
		return c.Status(409).JSON(fiber.Map{
			"error":   "版本冲突，请刷新后重试",
			"version": version,
		})
	}

	if len(req.EvidenceList) > 0 {
		evidenceList = utils.JoinEvidenceList(req.EvidenceList)
	}

	missing := utils.CheckRequiredEvidence(evidenceList)
	if len(missing) > 0 && status == models.StatusEvidenceMissing {
		return c.Status(400).JSON(fiber.Map{
			"error":            "仍缺少必填证据材料",
			"missing_evidence": missing,
		})
	}

	newStatus := models.StatusResubmitted
	action := "correct"
	actionName := "补正资料"

	now := time.Now()

	tx, err := models.DB.Begin()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		UPDATE consultations SET
			status = ?, status_name = ?, version = version + 1,
			evidence_list = ?, latest_opinion = ?,
			latest_reject_reason = '', updated_at = ?
		WHERE id = ?
	`,
		newStatus, utils.StatusName(newStatus),
		evidenceList, req.Opinion,
		now, id,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	newVersion := version + 1
	historyID := uuid.New().String()
	_, err = tx.Exec(`
		INSERT INTO history_records (
			id, consultation_id, operator_id, operator_name, operator_role,
			operator_role_name, action, action_name, from_status, from_status_name,
			to_status, to_status_name, opinion, version, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		historyID, id, user.UserID, user.UserName, user.Role, user.RoleName,
		action, actionName,
		status, utils.StatusName(status),
		newStatus, utils.StatusName(newStatus),
		req.Opinion, newVersion, now,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if err := tx.Commit(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": actionName + "成功",
		"status":  newStatus,
		"version": newVersion,
	})
}
