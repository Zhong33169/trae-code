package handlers

import (
	"errors"
	"news-clue-backend/internal/db"
	"news-clue-backend/internal/middleware"
	"news-clue-backend/internal/models"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LoginReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func LoginHandler(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req LoginReq
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "请求格式错误"})
		}
		var user models.User
		if err := db.DB.Where("username = ? AND password = ?", req.Username, req.Password).First(&user).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return c.Status(401).JSON(fiber.Map{"error": "用户名或密码错误"})
			}
			return c.Status(500).JSON(fiber.Map{"error": "系统错误"})
		}
		user.RoleLabel = user.Role.Label()
		token, err := middleware.GenerateToken(user.ID, user.Username, user.RealName, user.Role.String(), jwtSecret)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "生成凭证失败"})
		}
		return c.JSON(fiber.Map{"token": token, "user": user})
	}
}

func CurrentUser(c *fiber.Ctx) error {
	userID, username, realName, role := middleware.GetCurrentUser(c)
	_ = username
	return c.JSON(fiber.Map{
		"id":       userID,
		"username": username,
		"realName": realName,
		"role":     role,
		"roleLabel": models.Role(role).Label(),
	})
}

func ListUsers(c *fiber.Ctx) error {
	var users []models.User
	if err := db.DB.Find(&users).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	for i := range users {
		users[i].RoleLabel = users[i].Role.Label()
	}
	return c.JSON(users)
}

func addLog(clueID, operatorID, operatorName, operatorRole, action, fromStatus, toStatus, comment, rejectReason, reviewOpinion string, vb, va int) error {
	log := models.OperationLog{
		ID:            uuid.New().String(),
		ClueID:        clueID,
		OperatorID:    operatorID,
		OperatorName:  operatorName,
		OperatorRole:  operatorRole,
		Action:        action,
		FromStatus:    fromStatus,
		ToStatus:      toStatus,
		Comment:       comment,
		RejectReason:  rejectReason,
		ReviewOpinion: reviewOpinion,
		VersionBefore: vb,
		VersionAfter:  va,
	}
	return db.DB.Create(&log).Error
}

type CreateClueReq struct {
	Title         string `json:"title"`
	Content       string `json:"content"`
	Source        string `json:"source"`
	ContactPerson string `json:"contactPerson"`
	ContactPhone  string `json:"contactPhone"`
	Priority      string `json:"priority"`
	Location      string `json:"location"`
	Tags          string `json:"tags"`
	SubmitNow     bool   `json:"submitNow"`
	Evidences     []struct {
		Type string `json:"type"`
		Name string `json:"name"`
		Desc string `json:"desc"`
	} `json:"evidences"`
}

func CreateClue(c *fiber.Ctx) error {
	userID, _, realName, role := middleware.GetCurrentUser(c)
	if role != string(models.RoleRegistrar) {
		return c.Status(403).JSON(fiber.Map{"error": "只有线索登记员可以创建线索单"})
	}
	var req CreateClueReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "请求格式错误"})
	}
	if req.Title == "" || req.Content == "" {
		return c.Status(400).JSON(fiber.Map{"error": "标题和内容为必填项"})
	}
	status := models.StatusDraft
	now := time.Now()
	var submittedAt *time.Time
	if req.SubmitNow {
		if len(req.Evidences) < 1 {
			return c.Status(400).JSON(fiber.Map{"error": "提交线索单必须至少上传 1 份证据材料"})
		}
		status = models.StatusSubmitted
		t := now
		submittedAt = &t
	}
	clue := models.NewsClue{
		ID:            uuid.New().String(),
		Title:         req.Title,
		Content:       req.Content,
		Source:        req.Source,
		ContactPerson: req.ContactPerson,
		ContactPhone:  req.ContactPhone,
		Priority:      req.Priority,
		Location:      req.Location,
		Tags:          req.Tags,
		RegistrarID:   userID,
		RegistrarName: realName,
		Status:        status,
		SubmittedAt:   submittedAt,
		Version:       1,
	}
	tx := db.DB.Begin()
	if err := tx.Create(&clue).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	for _, e := range req.Evidences {
		ev := models.Evidence{
			ID:         uuid.New().String(),
			ClueID:     clue.ID,
			Type:       e.Type,
			Name:       e.Name,
			Desc:       e.Desc,
			UploaderID: userID,
		}
		if err := tx.Create(&ev).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
	}
	action := "创建草稿"
	toStatus := string(models.StatusDraft)
	if req.SubmitNow {
		action = "登记并提交线索"
		toStatus = string(models.StatusSubmitted)
	}
	if err := addLog(clue.ID, userID, realName, role, action, "", toStatus, "", "", "", 0, 1); err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	tx.Commit()
	clue.StatusLabel = clue.Status.Label()
	return c.JSON(clue)
}

func ListClues(c *fiber.Ctx) error {
	status := c.Query("status")
	role := c.Query("role")
	keyword := c.Query("keyword")
	userID, _, _, curRole := middleware.GetCurrentUser(c)

	q := db.DB.Model(&models.NewsClue{}).Preload("Evidences")

	switch models.Role(curRole) {
	case models.RoleRegistrar:
		q = q.Where("registrar_id = ?", userID)
	case models.RoleAuditor:
		q = q.Where("auditor_id = ? OR status IN ?", userID, []string{
			string(models.StatusSubmitted), string(models.StatusReSubmit),
		})
	case models.RoleReviewer:
		// 复核负责人可以看全部，重点关注需要复核的
	default:
	}

	if status != "" {
		q = q.Where("status = ?", status)
	}
	if role != "" {
		q = q.Where("status IN ?", roleRelatedStatuses(role))
	}
	if keyword != "" {
		kw := "%" + keyword + "%"
		q = q.Where("title LIKE ? OR content LIKE ? OR source LIKE ?", kw, kw, kw)
	}
	var list []models.NewsClue
	if err := q.Order("created_at DESC").Find(&list).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	for i := range list {
		list[i].StatusLabel = list[i].Status.Label()
	}
	return c.JSON(list)
}

func roleRelatedStatuses(role string) []string {
	switch role {
	case string(models.RoleRegistrar):
		return []string{string(models.StatusDraft), string(models.StatusSubmitted), string(models.StatusReSubmit),
			string(models.StatusReturned), string(models.StatusLackEvidence), string(models.StatusAppealed),
			string(models.StatusAppealAccept), string(models.StatusAppealReject)}
	case string(models.RoleAuditor):
		return []string{string(models.StatusSubmitted), string(models.StatusReSubmit), string(models.StatusAssigned),
			string(models.StatusVerifying), string(models.StatusLackEvidence), string(models.StatusReturned)}
	case string(models.RoleReviewer):
		return []string{string(models.StatusAssigned), string(models.StatusVerifying), string(models.StatusLackEvidence),
			string(models.StatusOverdue), string(models.StatusArchived), string(models.StatusAppealed),
			string(models.StatusAppealAccept), string(models.StatusAppealReject), string(models.StatusConflict)}
	default:
		return []string{}
	}
}

func GetClue(c *fiber.Ctx) error {
	id := c.Params("id")
	var clue models.NewsClue
	err := db.DB.Preload("Evidences").
		Preload("Operations", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at ASC")
		}).
		Preload("Appeals", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at ASC")
		}).
		First(&clue, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(404).JSON(fiber.Map{"error": "线索单不存在"})
		}
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	clue.StatusLabel = clue.Status.Label()
	return c.JSON(clue)
}

type AssignReq struct {
	Version    int    `json:"version"`
	AuditorID  string `json:"auditorId"`
	DueDays    int    `json:"dueDays"`
	Comment    string `json:"comment"`
}

func AssignClue(c *fiber.Ctx) error {
	userID, _, realName, role := middleware.GetCurrentUser(c)
	if role != string(models.RoleAuditor) {
		return c.Status(403).JSON(fiber.Map{"error": "只有审核主管可执行分派"})
	}
	id := c.Params("id")
	var req AssignReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "请求格式错误"})
	}

	var clue models.NewsClue
	if err := db.DB.First(&clue, "id = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "线索单不存在"})
	}
	if err := middleware.CheckVersion(clue.Version, req.Version); err != nil {
		return c.Status(409).JSON(fiber.Map{"error": err.Error(), "currentVersion": clue.Version})
	}
	if clue.Status != models.StatusSubmitted && clue.Status != models.StatusReSubmit {
		return c.Status(400).JSON(fiber.Map{
			"error": "当前状态不允许分派，仅待核实分派或补正重提可分派",
			"currentStatus": clue.Status.Label(),
		})
	}
	var auditor models.User
	if err := db.DB.First(&auditor, "id = ?", req.AuditorID).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "分派对象不存在"})
	}
	if auditor.Role != models.RoleAuditor {
		return c.Status(400).JSON(fiber.Map{"error": "只能分派给审核主管角色"})
	}

	now := time.Now()
	dueDays := req.DueDays
	if dueDays <= 0 {
		dueDays = 5
	}
	dueAt := now.AddDate(0, 0, dueDays)
	oldStatus := clue.Status.String()
	newVersion := clue.Version + 1
	tx := db.DB.Begin()

	clue.AuditorID = auditor.ID
	clue.AuditorName = auditor.RealName
	clue.Status = models.StatusAssigned
	clue.AssignedAt = &now
	clue.DueAt = &dueAt
	clue.Version = newVersion
	clue.LastHandlerID = userID
	clue.LastHandlerName = realName
	clue.LastOpinion = req.Comment
	clue.LastResult = "分派完成，审核人：" + auditor.RealName

	if err := tx.Save(&clue).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if err := addLog(clue.ID, userID, realName, role, "核实分派", oldStatus, string(models.StatusAssigned), req.Comment, "", "", req.Version, newVersion); err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	tx.Commit()
	clue.StatusLabel = clue.Status.Label()
	return c.JSON(clue)
}

type ProcessReq struct {
	Version         int    `json:"version"`
	Action          string `json:"action"`
	Comment         string `json:"comment"`
	RejectReason    string `json:"rejectReason"`
	ExtraEvidences  []struct {
		Type string `json:"type"`
		Name string `json:"name"`
		Desc string `json:"desc"`
	} `json:"extraEvidences"`
	ArchiveResult string `json:"archiveResult"`
}

func ProcessClue(c *fiber.Ctx) error {
	userID, _, realName, role := middleware.GetCurrentUser(c)
	id := c.Params("id")
	var req ProcessReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "请求格式错误"})
	}
	var clue models.NewsClue
	if err := db.DB.First(&clue, "id = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "线索单不存在"})
	}
	if err := middleware.CheckVersion(clue.Version, req.Version); err != nil {
		return c.Status(409).JSON(fiber.Map{"error": err.Error(), "currentVersion": clue.Version})
	}

	tx := db.DB.Begin()
	oldStatus := clue.Status.String()
	newStatus := clue.Status
	actionName := req.Action
	newVersion := clue.Version + 1

	switch models.Role(role) {
	case models.RoleAuditor:
		if clue.AuditorID != "" && clue.AuditorID != userID {
			// 允许审核主管之间交叉处理，但分派状态下需本人
			if clue.Status == models.StatusAssigned || clue.Status == models.StatusVerifying {
				// 放行，团队内部可代处理
			}
		}
		switch req.Action {
		case "start_verify":
			if clue.Status != models.StatusAssigned {
				tx.Rollback()
				return c.Status(400).JSON(fiber.Map{"error": "当前状态不能开始核实"})
			}
			newStatus = models.StatusVerifying
			actionName = "开始核实"
		case "lack_evidence":
			if clue.Status != models.StatusAssigned && clue.Status != models.StatusVerifying {
				tx.Rollback()
				return c.Status(400).JSON(fiber.Map{"error": "当前状态不能标记缺证据"})
			}
			if req.RejectReason == "" {
				tx.Rollback()
				return c.Status(400).JSON(fiber.Map{"error": "缺证据需说明缺少哪些材料"})
			}
			newStatus = models.StatusLackEvidence
			actionName = "标记缺证据"
		case "return_correct":
			if clue.Status != models.StatusAssigned && clue.Status != models.StatusVerifying && clue.Status != models.StatusLackEvidence {
				tx.Rollback()
				return c.Status(400).JSON(fiber.Map{"error": "当前状态不能退回补正"})
			}
			if req.RejectReason == "" {
				tx.Rollback()
				return c.Status(400).JSON(fiber.Map{"error": "退回补正必须填写驳回原因"})
			}
			newStatus = models.StatusReturned
			actionName = "退回补正"
		case "submit_review":
			if clue.Status != models.StatusVerifying {
				tx.Rollback()
				return c.Status(400).JSON(fiber.Map{"error": "当前状态不能提交复核归档"})
			}
			if req.Comment == "" {
				tx.Rollback()
				return c.Status(400).JSON(fiber.Map{"error": "请填写核实结论作为复核意见基础"})
			}
			now := time.Now()
			clue.VerifiedAt = &now
			clue.VerifyComment = req.Comment
			newStatus = models.StatusVerifying // 保持为核实中，由复核负责人归档
			actionName = "核实完成，提交复核归档"
			newStatus = models.StatusVerifying
			// 实际上可以保持状态，但最后更新人写入
		default:
			tx.Rollback()
			return c.Status(400).JSON(fiber.Map{"error": "未知审核操作"})
		}

	case models.RoleRegistrar:
		switch req.Action {
		case "submit":
			if clue.Status != models.StatusDraft && clue.Status != models.StatusReturned && clue.Status != models.StatusLackEvidence {
				tx.Rollback()
				return c.Status(400).JSON(fiber.Map{"error": "当前状态不能提交"})
			}
			// 提交必须至少有 1 条证据（原有+新增）
			var cnt int64
			tx.Model(&models.Evidence{}).Where("clue_id = ?", clue.ID).Count(&cnt)
			if cnt+int64(len(req.ExtraEvidences)) < 1 {
				tx.Rollback()
				return c.Status(400).JSON(fiber.Map{"error": "提交必须至少上传 1 份证据材料"})
			}
			now := time.Now()
			clue.SubmittedAt = &now
			if clue.Status == models.StatusReturned || clue.Status == models.StatusLackEvidence {
				newStatus = models.StatusReSubmit
				actionName = "补正后再次提交"
			} else {
				newStatus = models.StatusSubmitted
				actionName = "提交线索"
			}
			// 新增证据
			for _, e := range req.ExtraEvidences {
				ev := models.Evidence{
					ID:         uuid.New().String(),
					ClueID:     clue.ID,
					Type:       e.Type,
					Name:       e.Name,
					Desc:       e.Desc,
					UploaderID: userID,
				}
				if err := tx.Create(&ev).Error; err != nil {
					tx.Rollback()
					return c.Status(500).JSON(fiber.Map{"error": err.Error()})
				}
			}
		case "save_draft":
			if clue.Status != models.StatusDraft {
				tx.Rollback()
				return c.Status(400).JSON(fiber.Map{"error": "仅草稿可保存编辑"})
			}
			newStatus = models.StatusDraft
			actionName = "编辑草稿"
		default:
			tx.Rollback()
			return c.Status(400).JSON(fiber.Map{"error": "未知登记员操作"})
		}

	case models.RoleReviewer:
		switch req.Action {
		case "archive":
			if clue.Status != models.StatusVerifying {
				tx.Rollback()
				return c.Status(400).JSON(fiber.Map{"error": "仅核实完成的线索单可归档"})
			}
			if req.ArchiveResult == "" {
				tx.Rollback()
				return c.Status(400).JSON(fiber.Map{"error": "请填写复核归档结论"})
			}
			now := time.Now()
			clue.ArchivedAt = &now
			clue.ArchiveResult = req.ArchiveResult
			newStatus = models.StatusArchived
			actionName = "复核归档"
		case "mark_overdue":
			if clue.Status != models.StatusAssigned && clue.Status != models.StatusVerifying {
				tx.Rollback()
				return c.Status(400).JSON(fiber.Map{"error": "仅处理中单据可标记逾期"})
			}
			newStatus = models.StatusOverdue
			actionName = "标记逾期"
		case "mark_conflict":
			newStatus = models.StatusConflict
			actionName = "标记状态冲突"
		default:
			tx.Rollback()
			return c.Status(400).JSON(fiber.Map{"error": "未知复核操作"})
		}
	default:
		tx.Rollback()
		return c.Status(403).JSON(fiber.Map{"error": "未知角色"})
	}

	clue.Status = newStatus
	clue.Version = newVersion
	clue.LastHandlerID = userID
	clue.LastHandlerName = realName
	clue.LastOpinion = req.Comment
	clue.LastResult = actionName

	if err := tx.Save(&clue).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if err := addLog(clue.ID, userID, realName, role, actionName, oldStatus, newStatus.String(),
		req.Comment, req.RejectReason, "", req.Version, newVersion); err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	tx.Commit()
	clue.StatusLabel = clue.Status.Label()
	return c.JSON(clue)
}

type AppealReq struct {
	Version int    `json:"version"`
	Reason  string `json:"reason"`
}

func SubmitAppeal(c *fiber.Ctx) error {
	userID, _, realName, role := middleware.GetCurrentUser(c)
	if role != string(models.RoleRegistrar) {
		return c.Status(403).JSON(fiber.Map{"error": "仅线索登记员可发起异常申诉"})
	}
	id := c.Params("id")
	var req AppealReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "请求格式错误"})
	}
	if req.Reason == "" {
		return c.Status(400).JSON(fiber.Map{"error": "申诉理由必填"})
	}
	var clue models.NewsClue
	if err := db.DB.First(&clue, "id = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "线索单不存在"})
	}
	if err := middleware.CheckVersion(clue.Version, req.Version); err != nil {
		return c.Status(409).JSON(fiber.Map{"error": err.Error(), "currentVersion": clue.Version})
	}
	// 可发起申诉的状态
	allowed := map[models.ClueStatus]bool{
		models.StatusReturned:     true,
		models.StatusLackEvidence: true,
		models.StatusOverdue:      true,
		models.StatusConflict:     true,
		models.StatusArchived:     true,
	}
	if !allowed[clue.Status] {
		return c.Status(400).JSON(fiber.Map{"error": "当前状态不可发起异常申诉", "currentStatus": clue.Status.Label()})
	}
	if clue.RegistrarID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "仅线索登记人本人可发起申诉"})
	}
	tx := db.DB.Begin()
	oldStatus := clue.Status.String()
	newVersion := clue.Version + 1
	appeal := models.AppealRecord{
		ID:             uuid.New().String(),
		ClueID:         clue.ID,
		AppellantID:    userID,
		AppellantName:  realName,
		Reason:         req.Reason,
		Status:         "pending",
		OriginalStatus: oldStatus,
	}
	if err := tx.Create(&appeal).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	clue.Status = models.StatusAppealed
	clue.Version = newVersion
	clue.LastHandlerID = userID
	clue.LastHandlerName = realName
	clue.LastOpinion = req.Reason
	clue.LastResult = "异常申诉已提交"
	if err := tx.Save(&clue).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if err := addLog(clue.ID, userID, realName, role, "提交异常申诉", oldStatus, string(models.StatusAppealed), req.Reason, "", "", req.Version, newVersion); err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	tx.Commit()
	clue.StatusLabel = clue.Status.Label()
	return c.JSON(clue)
}

type AppealReviewReq struct {
	Version       int    `json:"version"`
	Action        string `json:"action"`
	ReviewOpinion string `json:"reviewOpinion"`
	RejectReason  string `json:"rejectReason"`
}

func ReviewAppeal(c *fiber.Ctx) error {
	userID, _, realName, role := middleware.GetCurrentUser(c)
	if role != string(models.RoleReviewer) {
		return c.Status(403).JSON(fiber.Map{"error": "仅复核负责人可处理申诉"})
	}
	id := c.Params("id")
	var req AppealReviewReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "请求格式错误"})
	}
	if req.ReviewOpinion == "" {
		return c.Status(400).JSON(fiber.Map{"error": "复核意见必填"})
	}
	var clue models.NewsClue
	if err := db.DB.First(&clue, "id = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "线索单不存在"})
	}
	if err := middleware.CheckVersion(clue.Version, req.Version); err != nil {
		return c.Status(409).JSON(fiber.Map{"error": err.Error(), "currentVersion": clue.Version})
	}
	if clue.Status != models.StatusAppealed {
		return c.Status(400).JSON(fiber.Map{"error": "当前状态不是申诉中"})
	}
	tx := db.DB.Begin()
	oldStatus := clue.Status.String()
	newVersion := clue.Version + 1
	now := time.Now()
	// 找到最近的申诉记录
	var appeal models.AppealRecord
	if err := tx.Where("clue_id = ? AND status = ?", clue.ID, "pending").Order("created_at DESC").First(&appeal).Error; err != nil {
		tx.Rollback()
		return c.Status(400).JSON(fiber.Map{"error": "未找到待处理申诉记录"})
	}
	appeal.ReviewerID = userID
	appeal.ReviewerName = realName
	appeal.ReviewOpinion = req.ReviewOpinion
	appeal.RejectReason = req.RejectReason
	appeal.ReviewedAt = &now

	switch req.Action {
	case "accept":
		appeal.Status = "accepted"
		// 申诉受理后，流转到补正重提，由登记员补充材料后再次提交
		clue.Status = models.StatusAppealAccept
		clue.LastResult = "申诉已受理，等待补正重提"
		actionName := "受理申诉"
		if err := tx.Save(&appeal).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		clue.Version = newVersion
		clue.LastHandlerID = userID
		clue.LastHandlerName = realName
		clue.LastOpinion = req.ReviewOpinion
		if err := tx.Save(&clue).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		if err := addLog(clue.ID, userID, realName, role, actionName, oldStatus, string(models.StatusAppealAccept), req.ReviewOpinion, req.RejectReason, req.ReviewOpinion, req.Version, newVersion); err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
	case "reject":
		if req.RejectReason == "" {
			tx.Rollback()
			return c.Status(400).JSON(fiber.Map{"error": "驳回申诉需填写驳回原因"})
		}
		appeal.Status = "rejected"
		clue.Status = models.StatusAppealReject
		clue.LastResult = "申诉已驳回"
		actionName := "驳回申诉"
		if err := tx.Save(&appeal).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		clue.Version = newVersion
		clue.LastHandlerID = userID
		clue.LastHandlerName = realName
		clue.LastOpinion = req.ReviewOpinion
		if err := tx.Save(&clue).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		if err := addLog(clue.ID, userID, realName, role, actionName, oldStatus, string(models.StatusAppealReject), req.ReviewOpinion, req.RejectReason, req.ReviewOpinion, req.Version, newVersion); err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
	case "resubmit_auto":
		// 申诉受理且由登记员通过操作提交后流转（模拟再次提交，实际应该由登记员走ProcessClue提交）
		appeal.Status = "accepted"
		appeal.ResubmittedAt = &now
		clue.Status = models.StatusReSubmit
		clue.LastResult = "申诉通过，补正重提"
		actionName := "申诉受理并转入补正重提"
		if err := tx.Save(&appeal).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		clue.Version = newVersion
		clue.LastHandlerID = userID
		clue.LastHandlerName = realName
		clue.LastOpinion = req.ReviewOpinion
		if err := tx.Save(&clue).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		if err := addLog(clue.ID, userID, realName, role, actionName, oldStatus, string(models.StatusReSubmit), req.ReviewOpinion, "", req.ReviewOpinion, req.Version, newVersion); err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
	default:
		tx.Rollback()
		return c.Status(400).JSON(fiber.Map{"error": "未知申诉处理操作"})
	}
	tx.Commit()
	clue.StatusLabel = clue.Status.Label()
	return c.JSON(clue)
}

// 申诉受理后，登记员补正材料后再次提交
func ResubmitAfterAppeal(c *fiber.Ctx) error {
	userID, _, realName, role := middleware.GetCurrentUser(c)
	if role != string(models.RoleRegistrar) {
		return c.Status(403).JSON(fiber.Map{"error": "仅登记员可提交补正材料"})
	}
	id := c.Params("id")
	var req ProcessReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "请求格式错误"})
	}
	var clue models.NewsClue
	if err := db.DB.First(&clue, "id = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "线索单不存在"})
	}
	if err := middleware.CheckVersion(clue.Version, req.Version); err != nil {
		return c.Status(409).JSON(fiber.Map{"error": err.Error(), "currentVersion": clue.Version})
	}
	if clue.Status != models.StatusAppealAccept {
		return c.Status(400).JSON(fiber.Map{"error": "当前状态不可执行该操作"})
	}
	if clue.RegistrarID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "仅线索登记人本人可操作"})
	}
	var cnt int64
	db.DB.Model(&models.Evidence{}).Where("clue_id = ?", clue.ID).Count(&cnt)
	if cnt+int64(len(req.ExtraEvidences)) < 1 {
		return c.Status(400).JSON(fiber.Map{"error": "至少需提供 1 份证据材料"})
	}
	tx := db.DB.Begin()
	oldStatus := clue.Status.String()
	newVersion := clue.Version + 1
	now := time.Now()
	for _, e := range req.ExtraEvidences {
		ev := models.Evidence{
			ID:         uuid.New().String(),
			ClueID:     clue.ID,
			Type:       e.Type,
			Name:       e.Name,
			Desc:       e.Desc,
			UploaderID: userID,
		}
		if err := tx.Create(&ev).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
	}
	// 更新申诉记录
	var appeal models.AppealRecord
	if err := tx.Where("clue_id = ? AND status = ?", clue.ID, "accepted").Order("created_at DESC").First(&appeal).Error; err == nil {
		appeal.ResubmittedAt = &now
		tx.Save(&appeal)
	}
	clue.Status = models.StatusReSubmit
	clue.Version = newVersion
	clue.LastHandlerID = userID
	clue.LastHandlerName = realName
	clue.LastOpinion = req.Comment
	clue.LastResult = "申诉补正后再次提交"
	clue.SubmittedAt = &now
	if err := tx.Save(&clue).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if err := addLog(clue.ID, userID, realName, role, "申诉补正重提", oldStatus, string(models.StatusReSubmit), req.Comment, "", "", req.Version, newVersion); err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	tx.Commit()
	clue.StatusLabel = clue.Status.Label()
	return c.JSON(clue)
}

func ListOperations(c *fiber.Ctx) error {
	id := c.Params("id")
	var logs []models.OperationLog
	if err := db.DB.Where("clue_id = ?", id).Order("created_at ASC").Find(&logs).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(logs)
}

type StatsResp struct {
	Total     int64            `json:"total"`
	ByStatus  map[string]int64 `json:"byStatus"`
	ByRole    map[string]int64 `json:"byRole"`
	TodayNew  int64            `json:"todayNew"`
	Archived  int64            `json:"archived"`
	Appealing int64            `json:"appealing"`
	Overdue   int64            `json:"overdue"`
}

func GetStats(c *fiber.Ctx) error {
	var resp StatsResp
	resp.ByStatus = map[string]int64{}
	resp.ByRole = map[string]int64{}

	db.DB.Model(&models.NewsClue{}).Count(&resp.Total)
	db.DB.Model(&models.NewsClue{}).Where("status = ?", models.StatusArchived).Count(&resp.Archived)
	db.DB.Model(&models.NewsClue{}).Where("status = ?", models.StatusAppealed).Count(&resp.Appealing)
	db.DB.Model(&models.NewsClue{}).Where("status = ? OR status = ?", models.StatusOverdue, models.StatusConflict).Count(&resp.Overdue)

	today := time.Now().Format("2006-01-02")
	db.DB.Model(&models.NewsClue{}).Where("date(created_at) = ?", today).Count(&resp.TodayNew)

	statuses := []models.ClueStatus{
		models.StatusDraft, models.StatusSubmitted, models.StatusReSubmit, models.StatusAssigned,
		models.StatusVerifying, models.StatusLackEvidence, models.StatusReturned,
		models.StatusOverdue, models.StatusArchived, models.StatusAppealed,
		models.StatusAppealAccept, models.StatusAppealReject, models.StatusConflict,
	}
	for _, s := range statuses {
		var cnt int64
		db.DB.Model(&models.NewsClue{}).Where("status = ?", s).Count(&cnt)
		resp.ByStatus[s.Label()] = cnt
	}
	// 按办理维度
	var reg int64
	db.DB.Model(&models.NewsClue{}).Where("status IN ?", []string{string(models.StatusDraft), string(models.StatusSubmitted), string(models.StatusReSubmit), string(models.StatusReturned), string(models.StatusLackEvidence), string(models.StatusAppealAccept)}).Count(&reg)
	resp.ByRole["登记员待办"] = reg
	var aud int64
	db.DB.Model(&models.NewsClue{}).Where("status IN ?", []string{string(models.StatusSubmitted), string(models.StatusReSubmit), string(models.StatusAssigned), string(models.StatusVerifying)}).Count(&aud)
	resp.ByRole["审核主管待办"] = aud
	var rev int64
	db.DB.Model(&models.NewsClue{}).Where("status IN ?", []string{string(models.StatusVerifying), string(models.StatusOverdue), string(models.StatusAppealed), string(models.StatusConflict)}).Count(&rev)
	resp.ByRole["复核负责人待办"] = rev

	return c.JSON(resp)
}
