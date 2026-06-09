package handlers

import (
	"consultation-system/internal/middleware"
	"consultation-system/internal/models"
	"consultation-system/internal/utils"
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/gofiber/fiber/v2"
)

func GetConsultationHistory(c *fiber.Ctx) error {
	id := c.Params("id")

	rows, err := models.DB.Query(`
		SELECT id, consultation_id, operator_id, operator_name, operator_role,
			operator_role_name, action, action_name, from_status, from_status_name,
			to_status, to_status_name, opinion, reject_reason, version, created_at
		FROM history_records
		WHERE consultation_id = ?
		ORDER BY created_at ASC, version ASC
	`, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var records []models.HistoryRecord
	for rows.Next() {
		var r models.HistoryRecord
		var fromStatus, fromStatusName sql.NullString
		var opinion, rejectReason sql.NullString

		err := rows.Scan(
			&r.ID, &r.ConsultationID, &r.OperatorID, &r.OperatorName, &r.OperatorRole,
			&r.OperatorRoleName, &r.Action, &r.ActionName, &fromStatus, &fromStatusName,
			&r.ToStatus, &r.ToStatusName, &opinion, &rejectReason, &r.Version, &r.CreatedAt,
		)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		r.FromStatus = fromStatus.String
		r.FromStatusName = fromStatusName.String
		r.Opinion = opinion.String
		r.RejectReason = rejectReason.String

		records = append(records, r)
	}

	return c.JSON(fiber.Map{
		"data":  records,
		"total": len(records),
	})
}

func ListUsers(c *fiber.Ctx) error {
	role := c.Query("role")

	query := "SELECT id, name, role, role_name, dept FROM users WHERE 1=1"
	var args []interface{}

	if role != "" {
		query += " AND role = ?"
		args = append(args, role)
	}

	query += " ORDER BY role, name"

	rows, err := models.DB.Query(query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		err := rows.Scan(&u.ID, &u.Name, &u.Role, &u.RoleName, &u.Dept)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		users = append(users, u)
	}

	return c.JSON(fiber.Map{
		"data":  users,
		"total": len(users),
	})
}

func GetCurrentUser(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"error": "未登录"})
	}

	var u models.User
	err := models.DB.QueryRow(
		"SELECT id, name, role, role_name, dept FROM users WHERE id = ?",
		user.UserID,
	).Scan(&u.ID, &u.Name, &u.Role, &u.RoleName, &u.Dept)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(u)
}

type StatusDictItem struct {
	Value string `json:"value"`
	Label string `json:"label"`
	Group string `json:"group"`
}

func GetStatusDict(c *fiber.Ctx) error {
	statuses := []StatusDictItem{
		{Value: models.StatusDraft, Label: utils.StatusName(models.StatusDraft), Group: "登记阶段"},
		{Value: models.StatusSubmitted, Label: utils.StatusName(models.StatusSubmitted), Group: "审核阶段"},
		{Value: models.StatusUnderReview, Label: utils.StatusName(models.StatusUnderReview), Group: "审核阶段"},
		{Value: models.StatusEvidenceMissing, Label: utils.StatusName(models.StatusEvidenceMissing), Group: "异常状态"},
		{Value: models.StatusOverdue, Label: utils.StatusName(models.StatusOverdue), Group: "异常状态"},
		{Value: models.StatusCorrectionReq, Label: utils.StatusName(models.StatusCorrectionReq), Group: "异常状态"},
		{Value: models.StatusResubmitted, Label: utils.StatusName(models.StatusResubmitted), Group: "审核阶段"},
		{Value: models.StatusReviewPassed, Label: utils.StatusName(models.StatusReviewPassed), Group: "复核阶段"},
		{Value: models.StatusUnderFinal, Label: utils.StatusName(models.StatusUnderFinal), Group: "复核阶段"},
		{Value: models.StatusConflict, Label: utils.StatusName(models.StatusConflict), Group: "异常状态"},
		{Value: models.StatusArchived, Label: utils.StatusName(models.StatusArchived), Group: "已完成"},
		{Value: models.StatusRejected, Label: utils.StatusName(models.StatusRejected), Group: "已完成"},
		{Value: models.StatusAppealSubmitted, Label: utils.StatusName(models.StatusAppealSubmitted), Group: "申诉阶段"},
		{Value: models.StatusAppealAccepted, Label: utils.StatusName(models.StatusAppealAccepted), Group: "申诉阶段"},
		{Value: models.StatusAppealRejected, Label: utils.StatusName(models.StatusAppealRejected), Group: "申诉阶段"},
	}

	return c.JSON(statuses)
}

type RoleDictItem struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

func GetRoleDict(c *fiber.Ctx) error {
	roles := []RoleDictItem{
		{Value: models.RoleRegistrar, Label: "会诊申请登记员"},
		{Value: models.RoleReviewer, Label: "会诊申请审核主管"},
		{Value: models.RoleDirector, Label: "医务部复核负责人"},
	}

	return c.JSON(roles)
}

func scanConsultation(row *sql.Row) (*models.Consultation, error) {
	var c models.Consultation
	var reviewerID, reviewerName, directorID, directorName sql.NullString
	var latestOpinion, latestRejectReason sql.NullString
	var appealStatus, appealStatusName, appealReason sql.NullString
	var isOverdue, hasAppeal int

	err := row.Scan(
		&c.ID, &c.Title, &c.PatientName, &c.PatientID, &c.Dept,
		&c.ChiefComplaint, &c.ConsultType, &c.ConsultDept,
		&c.Status, &c.StatusName, &c.Version,
		&c.RegistrarID, &c.RegistrarName, &reviewerID, &reviewerName,
		&directorID, &directorName, &latestOpinion, &latestRejectReason,
		&c.EvidenceList, &isOverdue, &hasAppeal,
		&appealStatus, &appealStatusName, &appealReason,
		&c.Deadline, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	c.ReviewerID = reviewerID.String
	c.ReviewerName = reviewerName.String
	c.DirectorID = directorID.String
	c.DirectorName = directorName.String
	c.LatestOpinion = latestOpinion.String
	c.LatestRejectReason = latestRejectReason.String
	c.AppealStatus = appealStatus.String
	c.AppealStatusName = appealStatusName.String
	c.AppealReason = appealReason.String
	c.IsOverdue = isOverdue == 1
	c.HasAppeal = hasAppeal == 1

	return &c, nil
}

func scanConsultationRows(rows *sql.Rows) ([]models.Consultation, error) {
	var list []models.Consultation
	for rows.Next() {
		var c models.Consultation
		var reviewerID, reviewerName, directorID, directorName sql.NullString
		var latestOpinion, latestRejectReason sql.NullString
		var appealStatus, appealStatusName, appealReason sql.NullString
		var isOverdue, hasAppeal int

		err := rows.Scan(
			&c.ID, &c.Title, &c.PatientName, &c.PatientID, &c.Dept,
			&c.ChiefComplaint, &c.ConsultType, &c.ConsultDept,
			&c.Status, &c.StatusName, &c.Version,
			&c.RegistrarID, &c.RegistrarName, &reviewerID, &reviewerName,
			&directorID, &directorName, &latestOpinion, &latestRejectReason,
			&c.EvidenceList, &isOverdue, &hasAppeal,
			&appealStatus, &appealStatusName, &appealReason,
			&c.Deadline, &c.CreatedAt, &c.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		c.ReviewerID = reviewerID.String
		c.ReviewerName = reviewerName.String
		c.DirectorID = directorID.String
		c.DirectorName = directorName.String
		c.LatestOpinion = latestOpinion.String
		c.LatestRejectReason = latestRejectReason.String
		c.AppealStatus = appealStatus.String
		c.AppealStatusName = appealStatusName.String
		c.AppealReason = appealReason.String
		c.IsOverdue = isOverdue == 1
		c.HasAppeal = hasAppeal == 1

		list = append(list, c)
	}
	return list, rows.Err()
}

type FailRecordParams struct {
	ConsultationID string
	OperatorID     string
	OperatorName   string
	OperatorRole   string
	OperatorRoleName string
	Action         string
	ActionName     string
	FromStatus     string
	Version        int
	RejectReason   string
	Opinion        string
}

func WriteFailRecord(p FailRecordParams) error {
	now := time.Now()
	action := "fail_" + p.Action
	actionName := "[失败]" + p.ActionName

	fromStatusName := ""
	if p.FromStatus != "" {
		fromStatusName = utils.StatusName(p.FromStatus)
	}

	_, err := models.DB.Exec(`
		INSERT INTO history_records (
			id, consultation_id, operator_id, operator_name, operator_role,
			operator_role_name, action, action_name, from_status, from_status_name,
			to_status, to_status_name, opinion, reject_reason, version, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		uuid.New().String(), p.ConsultationID, p.OperatorID, p.OperatorName, p.OperatorRole, p.OperatorRoleName,
		action, actionName,
		p.FromStatus, fromStatusName,
		p.FromStatus, fromStatusName,
		p.Opinion, p.RejectReason,
		p.Version, now,
	)
	return err
}
