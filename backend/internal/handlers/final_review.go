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

type FinalReviewRequest struct {
	Version      int    `json:"version"`
	Action       string `json:"action"`
	Opinion      string `json:"opinion"`
	RejectReason string `json:"reject_reason"`
}

func FinalReviewConsultation(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	if user.Role != models.RoleDirector {
		return c.Status(403).JSON(fiber.Map{"error": "只有医务部复核负责人可以执行复核操作"})
	}

	var req FinalReviewRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "请求参数无效"})
	}

	row := models.DB.QueryRow(`
		SELECT status, version
		FROM consultations WHERE id = ?
	`, id)

	var status string
	var version int
	err := row.Scan(&status, &version)
	if err == sql.ErrNoRows {
		return c.Status(404).JSON(fiber.Map{"error": "申请单不存在"})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if status != models.StatusReviewPassed && status != models.StatusUnderFinal {
		return c.Status(400).JSON(fiber.Map{
			"error":          "当前状态不允许复核",
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
	case "start":
		newStatus = models.StatusUnderFinal
		action = "start_final"
		actionName = "开始复核"
	case "conflict":
		newStatus = models.StatusConflict
		action = "conflict"
		actionName = "状态冲突"
		if req.RejectReason == "" {
			return c.Status(400).JSON(fiber.Map{"error": "状态冲突必须填写原因"})
		}
	case "reject":
		newStatus = models.StatusRejected
		action = "final_reject"
		actionName = "复核驳回"
		if req.RejectReason == "" {
			return c.Status(400).JSON(fiber.Map{"error": "复核驳回必须填写原因"})
		}
	default:
		return c.Status(400).JSON(fiber.Map{"error": "无效的复核操作"})
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
			director_id = ?, director_name = ?,
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
		newVersion, now,
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

type ArchiveRequest struct {
	Version int    `json:"version"`
	Opinion string `json:"opinion"`
}

func ArchiveConsultation(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	if user.Role != models.RoleDirector {
		return c.Status(403).JSON(fiber.Map{"error": "只有医务部复核负责人可以执行归档操作"})
	}

	var req ArchiveRequest
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

	if status != models.StatusUnderFinal && status != models.StatusReviewPassed &&
		status != models.StatusAppealResolved {
		return c.Status(400).JSON(fiber.Map{
			"error":          "当前状态不允许归档",
			"current_status": status,
		})
	}

	if req.Version != version {
		return c.Status(409).JSON(fiber.Map{
			"error":   "版本冲突，请刷新后重试",
			"version": version,
		})
	}

	missing := utils.CheckRequiredEvidence(evidenceList)
	if len(missing) > 0 {
		return c.Status(400).JSON(fiber.Map{
			"error":            "缺少必填证据材料，无法归档",
			"missing_evidence": missing,
		})
	}

	newStatus := models.StatusArchived
	action := "archive"
	actionName := "复核归档"

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
			director_id = ?, director_name = ?,
			latest_opinion = ?, updated_at = ?
		WHERE id = ?
	`,
		newStatus, utils.StatusName(newStatus), newVersion,
		user.UserID, user.UserName,
		req.Opinion, now, id,
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
