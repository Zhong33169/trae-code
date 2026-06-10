package database

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"backend/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	dbPath := "./data/app.db"
	os.MkdirAll("./data", 0755)

	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	DB.AutoMigrate(
		&models.User{},
		&models.LeaseApplication{},
		&models.Attachment{},
		&models.NodeTimeline{},
		&models.OperationLog{},
		&models.OverdueAudit{},
	)

	seedUsers()
	seedApplications()
	seedOverdueAudits()
	log.Println("Database initialized successfully")
}

func hashPassword(password string) string {
	bytes, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes)
}

func seedUsers() {
	var count int64
	DB.Model(&models.User{}).Count(&count)
	if count > 0 {
		return
	}

	users := []models.User{
		{
			Username: "registrar1",
			Password: hashPassword("123456"),
			RealName: "张登记",
			Role:     models.RoleRegistrar,
		},
		{
			Username: "auditor1",
			Password: hashPassword("123456"),
			RealName: "李审核",
			Role:     models.RoleAuditor,
		},
		{
			Username: "reviewer1",
			Password: hashPassword("123456"),
			RealName: "王复核",
			Role:     models.RoleReviewer,
		},
	}

	for _, u := range users {
		DB.Create(&u)
	}
	log.Println("Seed users created")
}

func seedApplications() {
	var count int64
	DB.Model(&models.LeaseApplication{}).Count(&count)
	if count > 0 {
		return
	}

	registrar := models.User{}
	DB.Where("role = ?", models.RoleRegistrar).First(&registrar)
	if registrar.ID == 0 {
		return
	}

	now := time.Now()

	applications := []models.LeaseApplication{
		{
			ApplicationNo:  fmt.Sprintf("ZY%s001", now.Format("200601")),
			TenantName:     "租客一",
			TenantIDCard:   "110101199001011234",
			TenantPhone:    "13800138001",
			ApartmentName:  "幸福公寓",
			RoomNo:         "A-1201",
			RoomArea:       45.5,
			MonthlyRent:    3500,
			LeaseStartDate: "2025-01-15",
			LeaseEndDate:   "2026-01-14",
			DepositAmount:  7000,
			PaymentMethod:  "押二付一",
			Status:         models.StatusPendingReview,
			CurrentNode:    models.NodeReview,
			Remark:         "租客签约资料齐全，提交审核",
			CreatedBy:      registrar.ID,
			CreatedByName:  registrar.RealName,
			SubmittedAt:    &now,
		},
		{
			ApplicationNo:  fmt.Sprintf("ZY%s002", now.Format("200601")),
			TenantName:     "租客二",
			TenantIDCard:   "110101199202022345",
			TenantPhone:    "13800138002",
			ApartmentName:  "阳光公寓",
			RoomNo:         "B-0805",
			RoomArea:       52.0,
			MonthlyRent:    4200,
			LeaseStartDate: "2025-02-01",
			LeaseEndDate:   "2026-01-31",
			DepositAmount:  8400,
			PaymentMethod:  "押二付三",
			Status:         models.StatusReturned,
			CurrentNode:    models.NodeReview,
			ReturnReason:   "身份证复印件不清晰，请重新上传",
			Remark:         "被审核退回补正",
			CreatedBy:      registrar.ID,
			CreatedByName:  registrar.RealName,
			SubmittedAt:    &now,
		},
		{
			ApplicationNo:  fmt.Sprintf("ZY%s003", now.Format("200601")),
			TenantName:     "租客三",
			TenantIDCard:   "110101199503033456",
			TenantPhone:    "13800138003",
			ApartmentName:  "幸福公寓",
			RoomNo:         "C-1503",
			RoomArea:       60.0,
			MonthlyRent:    5000,
			LeaseStartDate: "2025-03-01",
			LeaseEndDate:   "2026-02-28",
			DepositAmount:  10000,
			PaymentMethod:  "押二付一",
			Status:         models.StatusDraft,
			CurrentNode:    models.NodeContractSigning,
			Remark:         "草稿，待补充签约资料",
			CreatedBy:      registrar.ID,
			CreatedByName:  registrar.RealName,
		},
		{
			ApplicationNo:  fmt.Sprintf("ZY%s004", now.Format("200601")),
			TenantName:     "租客四",
			TenantIDCard:   "110101198804044567",
			TenantPhone:    "13800138004",
			ApartmentName:  "和谐家园",
			RoomNo:         "D-0302",
			RoomArea:       38.5,
			MonthlyRent:    2800,
			LeaseStartDate: "2025-01-20",
			LeaseEndDate:   "2026-01-19",
			DepositAmount:  5600,
			PaymentMethod:  "押二付一",
			Status:         models.StatusPendingConfirm,
			CurrentNode:    models.NodeRoomConfirm,
			Remark:         "审核通过，待房态确认",
			CreatedBy:      registrar.ID,
			CreatedByName:  registrar.RealName,
			SubmittedAt:    &now,
			ReviewedAt:     &now,
		},
		{
			ApplicationNo:    fmt.Sprintf("ZY%s005", now.Format("200601")),
			TenantName:       "租客五",
			TenantIDCard:     "110101199105055678",
			TenantPhone:      "13800138005",
			ApartmentName:    "阳光公寓",
			RoomNo:           "B-1101",
			RoomArea:         48.0,
			MonthlyRent:      3800,
			LeaseStartDate:   "2025-01-10",
			LeaseEndDate:     "2026-01-09",
			DepositAmount:    7600,
			PaymentMethod:    "押二付一",
			Status:           models.StatusCompleted,
			CurrentNode:      models.NodeArchive,
			Remark:           "全部流程完成，已归档",
			CreatedBy:        registrar.ID,
			CreatedByName:    registrar.RealName,
			CompletedAt:      &now,
		},
		{
			ApplicationNo:    fmt.Sprintf("ZY%s006", now.Format("200601")),
			TenantName:       "租客六",
			TenantIDCard:     "110101198706066789",
			TenantPhone:      "13800138006",
			ApartmentName:    "安居公寓",
			RoomNo:           "E-1808",
			RoomArea:         55.0,
			MonthlyRent:      4500,
			LeaseStartDate:   "2025-02-15",
			LeaseEndDate:     "2026-02-14",
			DepositAmount:    9000,
			PaymentMethod:    "押二付一",
			Status:           models.StatusRoomConfirmed,
			CurrentNode:      models.NodeArchive,
			Remark:           "入住交接已完成，等待复核归档",
			ReviewResult:     "资料齐全，符合长租公寓准入标准，同意办理",
			ConfirmResult:    "房屋已腾空，水电煤气结清，门锁、家电完好，可交付",
			HandoverResult:   "已交付房屋钥匙3把、门禁卡2张；水表读数128吨、电表读数2456度；租客确认验收无异议",
			CreatedBy:        registrar.ID,
			CreatedByName:    registrar.RealName,
			SubmittedAt:      &now,
			ReviewedAt:       &now,
			ConfirmedAt:      &now,
			HandedOverAt:     &now,
		},
	}

	for i := range applications {
		DB.Create(&applications[i])
		createInitialNodeTimelines(&applications[i])
		createInitialOperationLog(&applications[i], registrar)
	}

	// 为第6条样例申请（租客六，待复核归档状态）补充完整操作日志链条
	auditor := models.User{}
	DB.Where("role = ?", models.RoleAuditor).First(&auditor)
	reviewer := models.User{}
	DB.Where("role = ?", models.RoleReviewer).First(&reviewer)

	app6 := models.LeaseApplication{}
	DB.Where("tenant_name = ?", "租客六").First(&app6)
	if app6.ID > 0 && auditor.ID > 0 {
		CreateOperationLog(app6.ID, auditor.ID, auditor.RealName, string(models.RoleAuditor),
			"review_approve", "审核通过",
			string(models.StatusPendingReview), string(models.StatusPendingConfirm),
			fmt.Sprintf("租约审核通过，审核意见：%s", app6.ReviewResult))

		CreateOperationLog(app6.ID, auditor.ID, auditor.RealName, string(models.RoleAuditor),
			"room_confirm", "房态确认",
			string(models.StatusPendingConfirm), string(models.StatusPendingHandover),
			fmt.Sprintf("房态确认完成，确认结果：%s", app6.ConfirmResult))

		CreateOperationLog(app6.ID, auditor.ID, auditor.RealName, string(models.RoleAuditor),
			"handover", "入住交接完成",
			string(models.StatusPendingHandover), string(models.StatusRoomConfirmed),
			fmt.Sprintf("入住交接完成，交接说明：%s", app6.HandoverResult))
	}

	log.Println("Seed applications created")
}

func createInitialNodeTimelines(app *models.LeaseApplication) {
	for _, nodeLimit := range models.NodeTimeLimits {
		startTime := app.CreatedAt
		dueTime := startTime.Add(time.Duration(nodeLimit.TimeLimitHours) * time.Hour)

		timeline := models.NodeTimeline{
			ApplicationID:  app.ID,
			NodeType:       nodeLimit.NodeType,
			NodeName:       nodeLimit.NodeName,
			StartTime:      startTime,
			DueTime:        &dueTime,
			TimeLimitHours: nodeLimit.TimeLimitHours,
			Status:         "pending",
		}

		if nodeLimit.NodeType == app.CurrentNode {
			timeline.Status = "processing"
		}

		switch app.Status {
		case models.StatusDraft, models.StatusReturned:
			if nodeLimit.NodeType == models.NodeContractSigning {
				timeline.Status = "processing"
			}
		case models.StatusPendingReview:
			if nodeLimit.NodeType == models.NodeContractSigning {
				timeline.Status = "completed"
				timeline.EndTime = app.SubmittedAt
			}
			if nodeLimit.NodeType == models.NodeReview {
				timeline.Status = "processing"
			}
		case models.StatusReviewed, models.StatusPendingConfirm:
			if nodeLimit.NodeType == models.NodeContractSigning {
				timeline.Status = "completed"
				timeline.EndTime = app.SubmittedAt
			}
			if nodeLimit.NodeType == models.NodeReview {
				timeline.Status = "completed"
				timeline.EndTime = app.ReviewedAt
			}
			if nodeLimit.NodeType == models.NodeRoomConfirm {
				timeline.Status = "processing"
			}
		case models.StatusPendingHandover:
			if nodeLimit.NodeType == models.NodeContractSigning {
				timeline.Status = "completed"
				timeline.EndTime = app.SubmittedAt
			}
			if nodeLimit.NodeType == models.NodeReview {
				timeline.Status = "completed"
				timeline.EndTime = app.ReviewedAt
			}
			if nodeLimit.NodeType == models.NodeRoomConfirm {
				timeline.Status = "completed"
				timeline.EndTime = app.ConfirmedAt
			}
			if nodeLimit.NodeType == models.NodeHandover {
				timeline.Status = "processing"
			}
		case models.StatusRoomConfirmed:
			if nodeLimit.NodeType == models.NodeContractSigning {
				timeline.Status = "completed"
				timeline.EndTime = app.SubmittedAt
			}
			if nodeLimit.NodeType == models.NodeReview {
				timeline.Status = "completed"
				timeline.EndTime = app.ReviewedAt
			}
			if nodeLimit.NodeType == models.NodeRoomConfirm {
				timeline.Status = "completed"
				timeline.EndTime = app.ConfirmedAt
			}
			if nodeLimit.NodeType == models.NodeHandover {
				timeline.Status = "completed"
				timeline.EndTime = app.HandedOverAt
			}
			if nodeLimit.NodeType == models.NodeArchive {
				timeline.Status = "processing"
			}
		case models.StatusCompleted:
			timeline.Status = "completed"
		}

		DB.Create(&timeline)
	}

	checkAndUpdateOverdue(app.ID)
}

func createInitialOperationLog(app *models.LeaseApplication, user models.User) {
	log := models.OperationLog{
		ApplicationID: app.ID,
		UserID:        user.ID,
		UserName:      user.RealName,
		UserRole:      string(user.Role),
		OperationType: "create",
		OperationName: "创建租约申请",
		NewStatus:     string(app.Status),
		Detail:        "创建租约申请：" + app.ApplicationNo,
	}
	DB.Create(&log)

	if app.Status != models.StatusDraft {
		log2 := models.OperationLog{
			ApplicationID: app.ID,
			UserID:        user.ID,
			UserName:      user.RealName,
			UserRole:      string(user.Role),
			OperationType: "submit",
			OperationName: "提交租约申请",
			OldStatus:     "draft",
			NewStatus:     string(app.Status),
			Detail:        "提交租约申请至审核环节",
		}
		DB.Create(&log2)
	}
}

func seedOverdueAudits() {
	var count int64
	DB.Model(&models.OverdueAudit{}).Count(&count)
	if count > 0 {
		return
	}

	var applications []models.LeaseApplication
	DB.Find(&applications)
	if len(applications) == 0 {
		return
	}

	var auditor models.User
	DB.Where("role = ? OR role = ?", string(models.RoleAuditor), string(models.RoleReviewer)).Order("id ASC").First(&auditor)
	if auditor.ID == 0 {
		var anyUser models.User
		DB.Order("id ASC").First(&anyUser)
		auditor = anyUser
	}

	type seedAudit struct {
		appID            uint
		nodeType         models.NodeType
		auditType        string
		blockedReason    string
		overdueReason    string
		followUpAction   string
		oldStatus        string
		newStatus        string
		statusSnapshot   string
		proceedAction    string
		hoursAgo         int
	}

	now := time.Now()
	seeds := []seedAudit{}

	for i, app := range applications {
		if i >= 6 {
			break
		}
		appNode := app.CurrentNode
		if appNode == "" {
			appNode = models.NodeReview
		}
		snapshot := map[string]interface{}{
			"status":       string(app.Status),
			"currentNode":  string(appNode),
			"isOverdue":    true,
			"hasBlocked":   true,
		}
		snapshotJSON, _ := json.Marshal(snapshot)
		seeds = append(seeds, seedAudit{
			appID:          app.ID,
			nodeType:       appNode,
			auditType:      string(models.AuditTypeBlocked),
			blockedReason:  fmt.Sprintf("节点已超时，系统自动拦截 - 样例%d", i+1),
			oldStatus:      string(app.Status),
			newStatus:      string(app.Status),
			statusSnapshot: string(snapshotJSON),
			proceedAction:  "review",
			hoursAgo:       (i + 1) * 3,
		})
		if i%2 == 1 {
			targetStatus := string(app.Status)
			if appNode == models.NodeReview {
				targetStatus = string(models.StatusPendingConfirm)
			} else if appNode == models.NodeRoomConfirm {
				targetStatus = string(models.StatusPendingHandover)
			} else if appNode == models.NodeHandover {
				targetStatus = string(models.StatusRoomConfirmed)
			} else if appNode == models.NodeContractSigning {
				targetStatus = string(models.StatusPendingReview)
			}
			suppSnapshot := map[string]interface{}{
				"status":       string(app.Status),
				"currentNode":  string(appNode),
				"isOverdue":    true,
				"hasBlocked":   true,
			}
			suppJSON, _ := json.Marshal(suppSnapshot)
			seeds = append(seeds, seedAudit{
				appID:          app.ID,
				nodeType:       appNode,
				auditType:      string(models.AuditTypeSupplemented),
				overdueReason:  fmt.Sprintf("审核人因临时外出未及时处理，已补录超时说明 - 样例%d", i+1),
				followUpAction: fmt.Sprintf("已电话沟通确认，预计 %d 小时内完成处理", (i+1)*2),
				oldStatus:      string(app.Status),
				newStatus:      targetStatus,
				statusSnapshot: string(suppJSON),
				proceedAction:  "review",
				hoursAgo:       (i+1)*2 - 1,
			})
		}
	}

	for _, s := range seeds {
		createdAt := now.Add(-time.Duration(s.hoursAgo) * time.Hour)
		audit := models.OverdueAudit{
			ApplicationID:  s.appID,
			NodeType:       s.nodeType,
			AuditType:      models.AuditType(s.auditType),
			BlockedReason:  s.blockedReason,
			OverdueReason:  s.overdueReason,
			FollowUpAction: s.followUpAction,
			HandlerID:      auditor.ID,
			HandlerName:    auditor.RealName,
			HandlerRole:    string(auditor.Role),
			OldStatus:      s.oldStatus,
			NewStatus:      s.newStatus,
			StatusSnapshot: s.statusSnapshot,
			ProceedAction:  s.proceedAction,
			CreatedAt:      createdAt,
		}
		DB.Create(&audit)
	}
	log.Printf("Seed overdue audits created: %d", len(seeds))
}

func checkAndUpdateOverdue(applicationID uint) {
	now := time.Now()
	var timelines []models.NodeTimeline
	DB.Where("application_id = ? AND status = ?", applicationID, "processing").Find(&timelines)

	hasOverdue := false
	for _, t := range timelines {
		if t.DueTime != nil && now.After(*t.DueTime) {
			hasOverdue = true
			DB.Model(&t).Update("is_overdue", true)
		}
	}

	DB.Model(&models.LeaseApplication{}).Where("id = ?", applicationID).Update("is_overdue", hasOverdue)
}

func CreateOperationLog(appID uint, userID uint, userName string, userRole string, opType string, opName string, oldStatus string, newStatus string, detail string) {
	log := models.OperationLog{
		ApplicationID: appID,
		UserID:        userID,
		UserName:      userName,
		UserRole:      userRole,
		OperationType: opType,
		OperationName: opName,
		OldStatus:     oldStatus,
		NewStatus:     newStatus,
		Detail:        detail,
	}
	DB.Create(&log)
}

func CreateOverdueAudit(
	app *models.LeaseApplication,
	timeline *models.NodeTimeline,
	nodeType models.NodeType,
	auditType models.AuditType,
	blockedReason string,
	overdueReason string,
	followUpAction string,
	handlerID uint,
	handlerName string,
	handlerRole string,
	proceedAction string,
	newStatus string,
) {
	isOverdue := app.IsOverdue
	if timeline != nil {
		isOverdue = timeline.IsOverdue
	}
	snapshot := map[string]interface{}{
		"status":         app.Status,
		"statusName":     models.GetStatusName(app.Status),
		"currentNode":    app.CurrentNode,
		"isOverdue":      isOverdue,
		"overdueReason":  app.OverdueReason,
		"followUpAction": app.FollowUpAction,
	}
	snapshotJSON, _ := json.Marshal(snapshot)

	audit := models.OverdueAudit{
		ApplicationID:  app.ID,
		ApplicationNo:  app.ApplicationNo,
		NodeType:       nodeType,
		NodeName:       models.GetNodeName(nodeType),
		AuditType:      auditType,
		BlockedReason:  blockedReason,
		OverdueReason:  overdueReason,
		FollowUpAction: followUpAction,
		HandlerID:      handlerID,
		HandlerName:    handlerName,
		HandlerRole:    handlerRole,
		StatusSnapshot: string(snapshotJSON),
		OldStatus:      string(app.Status),
		NewStatus:      newStatus,
		ProceedAction:  proceedAction,
	}
	DB.Create(&audit)
}

func UpdateNodeTimeline(appID uint, nodeType models.NodeType, status string, handlerUserID uint, handlerName string, endTime *time.Time) {
	DB.Model(&models.NodeTimeline{}).
		Where("application_id = ? AND node_type = ?", appID, nodeType).
		Updates(map[string]interface{}{
			"status":          status,
			"handler_user_id": handlerUserID,
			"handler_name":    handlerName,
			"end_time":        endTime,
		})
}

func SetNodeOverdueRecord(appID uint, nodeType models.NodeType, overdueReason string, followUpAction string) {
	DB.Model(&models.NodeTimeline{}).
		Where("application_id = ? AND node_type = ?", appID, nodeType).
		Updates(map[string]interface{}{
			"overdue_reason":  overdueReason,
			"follow_up_action": followUpAction,
			"is_overdue":      true,
		})

	DB.Model(&models.LeaseApplication{}).Where("id = ?", appID).Updates(map[string]interface{}{
		"is_overdue":       true,
		"overdue_reason":   overdueReason,
		"follow_up_action": followUpAction,
	})
}
