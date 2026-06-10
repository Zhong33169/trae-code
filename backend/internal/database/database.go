package database

import (
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
	)

	seedUsers()
	seedApplications()
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
			ApplicationNo:  fmt.Sprintf("ZY%s005", now.Format("200601")),
			TenantName:     "租客五",
			TenantIDCard:   "110101199105055678",
			TenantPhone:    "13800138005",
			ApartmentName:  "阳光公寓",
			RoomNo:         "B-1101",
			RoomArea:       48.0,
			MonthlyRent:    3800,
			LeaseStartDate: "2025-01-10",
			LeaseEndDate:   "2026-01-09",
			DepositAmount:  7600,
			PaymentMethod:  "押二付一",
			Status:         models.StatusCompleted,
			CurrentNode:    models.NodeArchive,
			Remark:         "全部流程完成，已归档",
			CreatedBy:      registrar.ID,
			CreatedByName:  registrar.RealName,
			CompletedAt:    &now,
		},
	}

	for i := range applications {
		DB.Create(&applications[i])
		createInitialNodeTimelines(&applications[i])
		createInitialOperationLog(&applications[i], registrar)
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
		case models.StatusRoomConfirmed, models.StatusPendingHandover:
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
