package handlers

import (
	"consultation-system/internal/middleware"
	"consultation-system/internal/models"
	"consultation-system/internal/utils"
	"database/sql"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type AppealRequest struct {
	Version int    `json:"version"`
	Reason  string `json:"reason"`
	Opinion string `json:"opinion"`
}

func SubmitAppeal(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	var req AppealRequest
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

	if req.Reason == "" {
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           "appeal_submit",
			ActionName:       "提交申诉",
			FromStatus:       status,
			Version:          version,
			RejectReason:     "申诉理由不能为空",
			Opinion:          req.Opinion,
		})
		return c.Status(400).JSON(fiber.Map{"error": "申诉理由不能为空"})
	}

	canAppeal := status == models.StatusEvidenceMissing ||
		status == models.StatusCorrectionReq ||
		status == models.StatusConflict ||
		status == models.StatusRejected

	if !canAppeal {
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           "appeal_submit",
			ActionName:       "提交申诉",
			FromStatus:       status,
			Version:          version,
			RejectReason:     fmt.Sprintf("当前状态不允许申诉: %s", status),
			Opinion:          req.Reason,
		})
		return c.Status(400).JSON(fiber.Map{
			"error":          "当前状态不允许申诉",
			"current_status": status,
		})
	}

	if registrarID != user.UserID && user.Role != models.RoleRegistrar {
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           "appeal_submit",
			ActionName:       "提交申诉",
			FromStatus:       status,
			Version:          version,
			RejectReason:     "只有登记人可以提交申诉",
			Opinion:          req.Reason,
		})
		return c.Status(403).JSON(fiber.Map{"error": "只有登记人可以提交申诉"})
	}

	if req.Version != version {
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           "appeal_submit",
			ActionName:       "提交申诉",
			FromStatus:       status,
			Version:          version,
			RejectReason:     fmt.Sprintf("版本冲突，当前版本: %d", version),
			Opinion:          req.Reason,
		})
		return c.Status(409).JSON(fiber.Map{
			"error":   "版本冲突，请刷新后重试",
			"version": version,
		})
	}

	fromStatus := status
	newStatus := models.StatusAppealSubmitted
	action := "appeal_submit"
	actionName := "提交申诉"

	now := time.Now()

	tx, err := models.DB.Begin()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		UPDATE consultations SET
			status = ?, status_name = ?, has_appeal = 1,
			appeal_status = ?, appeal_status_name = ?,
			appeal_reason = ?, latest_opinion = ?, updated_at = ?
		WHERE id = ?
	`,
		newStatus, utils.StatusName(newStatus),
		models.StatusAppealSubmitted, utils.StatusName(models.StatusAppealSubmitted),
		req.Reason, req.Opinion, now, id,
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
		req.Reason, version, now,
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
	})
}

type AppealHandleRequest struct {
	Version int    `json:"version"`
	Opinion string `json:"opinion"`
}

func AcceptAppeal(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	var req AppealHandleRequest
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

	if user.Role != models.RoleDirector {
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           "appeal_accept",
			ActionName:       "受理申诉",
			FromStatus:       status,
			Version:          version,
			RejectReason:     "只有医务部复核负责人可以受理申诉",
			Opinion:          req.Opinion,
		})
		return c.Status(403).JSON(fiber.Map{"error": "只有医务部复核负责人可以受理申诉"})
	}

	if status != models.StatusAppealSubmitted {
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           "appeal_accept",
			ActionName:       "受理申诉",
			FromStatus:       status,
			Version:          version,
			RejectReason:     fmt.Sprintf("当前状态不允许受理申诉: %s", status),
			Opinion:          req.Opinion,
		})
		return c.Status(400).JSON(fiber.Map{
			"error":          "当前状态不允许受理申诉",
			"current_status": status,
		})
	}

	if req.Version != version {
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           "appeal_accept",
			ActionName:       "受理申诉",
			FromStatus:       status,
			Version:          version,
			RejectReason:     fmt.Sprintf("版本冲突，当前版本: %d", version),
			Opinion:          req.Opinion,
		})
		return c.Status(409).JSON(fiber.Map{
			"error":   "版本冲突，请刷新后重试",
			"version": version,
		})
	}

	if req.Opinion == "" {
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           "appeal_accept",
			ActionName:       "受理申诉",
			FromStatus:       status,
			Version:          version,
			RejectReason:     "受理申诉必须填写意见",
			Opinion:          req.Opinion,
		})
		return c.Status(400).JSON(fiber.Map{"error": "受理申诉必须填写意见"})
	}

	newStatus := models.StatusAppealAccepted
	action := "appeal_accept"
	actionName := "受理申诉"

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
			appeal_status = ?, appeal_status_name = ?,
			director_id = ?, director_name = ?,
			latest_opinion = ?, updated_at = ?
		WHERE id = ?
	`,
		newStatus, utils.StatusName(newStatus), newVersion,
		models.StatusAppealAccepted, utils.StatusName(models.StatusAppealAccepted),
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

func RejectAppeal(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	var req AppealHandleRequest
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

	if user.Role != models.RoleDirector {
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           "appeal_reject",
			ActionName:       "驳回申诉",
			FromStatus:       status,
			Version:          version,
			RejectReason:     "只有医务部复核负责人可以驳回申诉",
			Opinion:          req.Opinion,
		})
		return c.Status(403).JSON(fiber.Map{"error": "只有医务部复核负责人可以驳回申诉"})
	}

	if req.Opinion == "" {
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           "appeal_reject",
			ActionName:       "驳回申诉",
			FromStatus:       status,
			Version:          version,
			RejectReason:     "驳回申诉必须填写理由",
			Opinion:          req.Opinion,
		})
		return c.Status(400).JSON(fiber.Map{"error": "驳回申诉必须填写理由"})
	}

	if status != models.StatusAppealSubmitted && status != models.StatusAppealAccepted {
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           "appeal_reject",
			ActionName:       "驳回申诉",
			FromStatus:       status,
			Version:          version,
			RejectReason:     fmt.Sprintf("当前状态不允许驳回申诉: %s", status),
			Opinion:          req.Opinion,
		})
		return c.Status(400).JSON(fiber.Map{
			"error":          "当前状态不允许驳回申诉",
			"current_status": status,
		})
	}

	if req.Version != version {
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           "appeal_reject",
			ActionName:       "驳回申诉",
			FromStatus:       status,
			Version:          version,
			RejectReason:     fmt.Sprintf("版本冲突，当前版本: %d", version),
			Opinion:          req.Opinion,
		})
		return c.Status(409).JSON(fiber.Map{
			"error":   "版本冲突，请刷新后重试",
			"version": version,
		})
	}

	newStatus := models.StatusAppealRejected
	action := "appeal_reject"
	actionName := "驳回申诉"

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
			appeal_status = ?, appeal_status_name = ?,
			director_id = ?, director_name = ?,
			latest_reject_reason = ?, updated_at = ?
		WHERE id = ?
	`,
		newStatus, utils.StatusName(newStatus), newVersion,
		models.StatusAppealRejected, utils.StatusName(models.StatusAppealRejected),
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
			to_status, to_status_name, reject_reason, version, created_at
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

type RecheckRequest struct {
	Version      int    `json:"version"`
	Action       string `json:"action"`
	Opinion      string `json:"opinion"`
	RejectReason string `json:"reject_reason"`
}

func RecheckAppeal(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	var req RecheckRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "请求参数无效"})
	}

	row := models.DB.QueryRow(`
		SELECT status, version, evidence_list, appeal_reason
		FROM consultations WHERE id = ?
	`, id)

	var status string
	var version int
	var evidenceList string
	var appealReason string
	err := row.Scan(&status, &version, &evidenceList, &appealReason)
	if err == sql.ErrNoRows {
		return c.Status(404).JSON(fiber.Map{"error": "申请单不存在"})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if user.Role != models.RoleDirector {
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           "recheck",
			ActionName:       "重新核实",
			FromStatus:       status,
			Version:          version,
			RejectReason:     "只有医务部复核负责人可以执行重新核实",
			Opinion:          req.Opinion,
		})
		return c.Status(403).JSON(fiber.Map{"error": "只有医务部复核负责人可以执行重新核实"})
	}

	if status != models.StatusAppealAccepted {
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           "recheck",
			ActionName:       "重新核实",
			FromStatus:       status,
			Version:          version,
			RejectReason:     fmt.Sprintf("当前状态不允许重新核实: %s", status),
			Opinion:          req.Opinion,
		})
		return c.Status(400).JSON(fiber.Map{
			"error":          "当前状态不允许重新核实",
			"current_status": status,
		})
	}

	if req.Version != version {
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           "recheck",
			ActionName:       "重新核实",
			FromStatus:       status,
			Version:          version,
			RejectReason:     fmt.Sprintf("版本冲突，当前版本: %d", version),
			Opinion:          req.Opinion,
		})
		return c.Status(409).JSON(fiber.Map{
			"error":   "版本冲突，请刷新后重试",
			"version": version,
		})
	}

	var newStatus string
	var action string
	var actionName string
	var needRejectReason bool
	var needEvidenceCheck bool
	var newAppealStatus string

	switch req.Action {
	case "pass":
		newStatus = models.StatusReviewPassed
		action = "recheck_pass"
		actionName = "核实通过"
		newAppealStatus = models.StatusAppealResolved
	case "reject_correction":
		newStatus = models.StatusCorrectionReq
		action = "recheck_reject_correction"
		actionName = "核实退回补正"
		needRejectReason = true
		newAppealStatus = models.StatusAppealAccepted
	case "evidence_missing":
		newStatus = models.StatusEvidenceMissing
		action = "recheck_evidence_missing"
		actionName = "核实证据不足"
		needRejectReason = true
		newAppealStatus = models.StatusAppealAccepted
	case "resolve":
		newStatus = models.StatusAppealResolved
		action = "appeal_resolve"
		actionName = "申诉解决"
		newAppealStatus = models.StatusAppealResolved
	case "archive":
		newStatus = models.StatusArchived
		action = "recheck_archive"
		actionName = "核实后归档"
		needEvidenceCheck = true
		newAppealStatus = models.StatusAppealResolved
	default:
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           "recheck",
			ActionName:       "重新核实",
			FromStatus:       status,
			Version:          version,
			RejectReason:     fmt.Sprintf("无效的核实操作: %s", req.Action),
			Opinion:          req.Opinion,
		})
		return c.Status(400).JSON(fiber.Map{"error": "无效的核实操作"})
	}

	if needRejectReason && req.RejectReason == "" {
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           action,
			ActionName:       actionName,
			FromStatus:       status,
			Version:          version,
			RejectReason:     "必须填写原因",
			Opinion:          req.Opinion,
		})
		return c.Status(400).JSON(fiber.Map{"error": "必须填写原因"})
	}

	if needEvidenceCheck {
		missing := utils.CheckRequiredEvidence(evidenceList)
		if len(missing) > 0 {
			_ = WriteFailRecord(FailRecordParams{
				ConsultationID:   id,
				OperatorID:       user.UserID,
				OperatorName:     user.UserName,
				OperatorRole:     user.Role,
				OperatorRoleName: user.RoleName,
				Action:           action,
				ActionName:       actionName,
				FromStatus:       status,
				Version:          version,
				RejectReason:     fmt.Sprintf("缺少必填证据材料，无法归档: %v", missing),
				Opinion:          req.Opinion,
			})
			return c.Status(400).JSON(fiber.Map{
				"error":            "缺少必填证据材料，无法归档",
				"missing_evidence": missing,
			})
		}
	}

	if req.Opinion == "" {
		_ = WriteFailRecord(FailRecordParams{
			ConsultationID:   id,
			OperatorID:       user.UserID,
			OperatorName:     user.UserName,
			OperatorRole:     user.Role,
			OperatorRoleName: user.RoleName,
			Action:           action,
			ActionName:       actionName,
			FromStatus:       status,
			Version:          version,
			RejectReason:     "请填写核实意见",
			Opinion:          req.Opinion,
		})
		return c.Status(400).JSON(fiber.Map{"error": "请填写核实意见"})
	}

	now := time.Now()
	newVersion := version + 1

	tx, err := models.DB.Begin()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer tx.Rollback()

	if newStatus == models.StatusArchived {
		_, err = tx.Exec(`
			UPDATE consultations SET
				status = ?, status_name = ?, version = ?,
				director_id = ?, director_name = ?,
				latest_opinion = ?, has_appeal = 1,
				appeal_status = ?, appeal_status_name = ?,
				updated_at = ?
			WHERE id = ?
		`,
			newStatus, utils.StatusName(newStatus), newVersion,
			user.UserID, user.UserName,
			req.Opinion,
			newAppealStatus, utils.StatusName(newAppealStatus),
			now, id,
		)
	} else if newStatus == models.StatusAppealResolved {
		_, err = tx.Exec(`
			UPDATE consultations SET
				status = ?, status_name = ?, version = ?,
				director_id = ?, director_name = ?,
				latest_opinion = ?,
				appeal_status = ?, appeal_status_name = ?,
				updated_at = ?
			WHERE id = ?
		`,
			newStatus, utils.StatusName(newStatus), newVersion,
			user.UserID, user.UserName,
			req.Opinion,
			newAppealStatus, utils.StatusName(newAppealStatus),
			now, id,
		)
	} else {
		_, err = tx.Exec(`
			UPDATE consultations SET
				status = ?, status_name = ?, version = ?,
				director_id = ?, director_name = ?,
				latest_opinion = ?, latest_reject_reason = ?,
				has_appeal = 1,
				appeal_status = ?, appeal_status_name = ?,
				updated_at = ?
			WHERE id = ?
		`,
			newStatus, utils.StatusName(newStatus), newVersion,
			user.UserID, user.UserName,
			req.Opinion, req.RejectReason,
			newAppealStatus, utils.StatusName(newAppealStatus),
			now, id,
		)
	}
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
