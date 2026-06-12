package seed

import (
	"backend/config"
	"backend/database"
	"backend/models"
	"log"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func SeedData() {
	seedUsers()
	seedTasks()
}

func seedUsers() {
	var count int64
	database.DB.Model(&models.User{}).Count(&count)
	if count > 0 {
		log.Println("Users already exist, skipping seed")
		return
	}

	users := []models.User{
		{Username: "registrar", PasswordHash: hashPassword("123456"), Role: config.RoleRegistrar, Name: "张三", CreatedAt: time.Now()},
		{Username: "supervisor", PasswordHash: hashPassword("123456"), Role: config.RoleSupervisor, Name: "李四", CreatedAt: time.Now()},
		{Username: "reviewer", PasswordHash: hashPassword("123456"), Role: config.RoleReviewer, Name: "王五", CreatedAt: time.Now()},
	}

	for _, user := range users {
		database.DB.Create(&user)
	}

	log.Println("Users seeded successfully")
}

func hashPassword(password string) string {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}
	return string(hash)
}

func seedTasks() {
	var count int64
	database.DB.Model(&models.SamplingTask{}).Count(&count)
	if count > 0 {
		log.Println("Tasks already exist, skipping seed")
		return
	}

	var registrar models.User
	database.DB.Where("username = ?", "registrar").First(&registrar)
	var supervisor models.User
	database.DB.Where("username = ?", "supervisor").First(&supervisor)
	var reviewer models.User
	database.DB.Where("username = ?", "reviewer").First(&reviewer)

	now := time.Now()

	tasks := []models.SamplingTask{
		{
			TaskNo:         "T202401001",
			ProjectName:    "长江水质监测项目",
			SampleLocation: "长江武汉段",
			SampleType:     "地表水",
			Status:         config.StatusPendingReview,
			Version:        1,
			RegistrarID:    registrar.ID,
			RegistrarName:  registrar.Name,
			CreatedAt:      now.AddDate(0, 0, -5),
			UpdatedAt:      now.AddDate(0, 0, -5),
		},
		{
			TaskNo:         "T202401002",
			ProjectName:    "东湖生态监测项目",
			SampleLocation: "东湖风景区",
			SampleType:     "湖泊水",
			Status:         config.StatusPendingReview,
			Version:        1,
			RegistrarID:    registrar.ID,
			RegistrarName:  registrar.Name,
			CreatedAt:      now.AddDate(0, 0, -4),
			UpdatedAt:      now.AddDate(0, 0, -4),
		},
		{
			TaskNo:         "T202401003",
			ProjectName:    "汉江污染调查项目",
			SampleLocation: "汉江襄阳段",
			SampleType:     "河流水",
			Status:         config.StatusReviewPassed,
			Version:        2,
			RegistrarID:    registrar.ID,
			RegistrarName:  registrar.Name,
			SupervisorID:   &supervisor.ID,
			SupervisorName: supervisor.Name,
			CreatedAt:      now.AddDate(0, 0, -10),
			UpdatedAt:      now.AddDate(0, 0, -8),
		},
		{
			TaskNo:          "T202401004",
			ProjectName:     "洪湖湿地监测项目",
			SampleLocation:  "洪湖保护区",
			SampleType:      "湿地水",
			Status:          config.StatusReviewRejected,
			Version:         2,
			RegistrarID:     registrar.ID,
			RegistrarName:   registrar.Name,
			SupervisorID:    &supervisor.ID,
			SupervisorName:  supervisor.Name,
			RejectReason:    "采样地点描述不清晰，缺少具体经纬度信息；样品编号不规范，请重新核对后提交。",
			CreatedAt:       now.AddDate(0, 0, -7),
			UpdatedAt:       now.AddDate(0, 0, -6),
		},
		{
			TaskNo:         "T202401005",
			ProjectName:    "三峡库区水质监测",
			SampleLocation: "三峡大坝上游",
			SampleType:     "水库水",
			Status:         config.StatusReviewReturned,
			Version:        3,
			RegistrarID:    registrar.ID,
			RegistrarName:  registrar.Name,
			SupervisorID:   &supervisor.ID,
			SupervisorName: supervisor.Name,
			ReviewerID:     &reviewer.ID,
			ReviewerName:   reviewer.Name,
			ReturnReason:   "复核发现过程核验证据不足，采样过程照片缺少时间戳，部分检测项目缺少原始记录，请补充完善后重新提交。",
			CreatedAt:      now.AddDate(0, 0, -15),
			UpdatedAt:      now.AddDate(0, 0, -10),
		},
		{
			TaskNo:         "T202401006",
			ProjectName:    "丹江口水库监测",
			SampleLocation: "丹江口库区",
			SampleType:     "饮用水源地",
			Status:         config.StatusReviewApproved,
			Version:        3,
			RegistrarID:    registrar.ID,
			RegistrarName:  registrar.Name,
			SupervisorID:   &supervisor.ID,
			SupervisorName: supervisor.Name,
			ReviewerID:     &reviewer.ID,
			ReviewerName:   reviewer.Name,
			CreatedAt:      now.AddDate(0, 0, -20),
			UpdatedAt:      now.AddDate(0, 0, -18),
		},
		{
			TaskNo:         "T202401007",
			ProjectName:    "清江流域生态调查",
			SampleLocation: "清江恩施段",
			SampleType:     "河流水",
			Status:         config.StatusReviewPassed,
			Version:        2,
			RegistrarID:    registrar.ID,
			RegistrarName:  registrar.Name,
			SupervisorID:   &supervisor.ID,
			SupervisorName: supervisor.Name,
			CreatedAt:      now.AddDate(0, 0, -12),
			UpdatedAt:      now.AddDate(0, 0, -11),
		},
		{
			TaskNo:         "T202401008",
			ProjectName:    "梁子湖水质评价",
			SampleLocation: "梁子湖鄂州段",
			SampleType:     "湖泊水",
			Status:         config.StatusReviewPassed,
			Version:        2,
			RegistrarID:    registrar.ID,
			RegistrarName:  registrar.Name,
			SupervisorID:   &supervisor.ID,
			SupervisorName: supervisor.Name,
			CreatedAt:      now.AddDate(0, 0, -9),
			UpdatedAt:      now.AddDate(0, 0, -7),
		},
	}

	for i := range tasks {
		database.DB.Create(&tasks[i])
	}

	seedEvidences(tasks, registrar, supervisor, reviewer)
	seedTaskLogs(tasks, registrar, supervisor, reviewer)

	log.Println("Tasks seeded successfully")
}

func seedEvidences(tasks []models.SamplingTask, registrar, supervisor, reviewer models.User) {
	now := time.Now()

	evidences := []models.Evidence{
		{TaskID: tasks[0].ID, Type: config.EvidenceTypeRegistration, Title: "采样登记表", Description: "长江武汉段采样点基本信息登记表", FileURL: "/files/T202401001_reg_01.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -5)},
		{TaskID: tasks[0].ID, Type: config.EvidenceTypeRegistration, Title: "采样点照片", Description: "采样现场照片", FileURL: "/files/T202401001_reg_02.jpg", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -5)},

		{TaskID: tasks[1].ID, Type: config.EvidenceTypeRegistration, Title: "采样登记表", Description: "东湖采样点登记表", FileURL: "", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -4)},

		{TaskID: tasks[2].ID, Type: config.EvidenceTypeRegistration, Title: "采样登记表", Description: "汉江襄阳段采样登记表", FileURL: "/files/T202401003_reg_01.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -10)},
		{TaskID: tasks[2].ID, Type: config.EvidenceTypeProcess, Title: "过程核验记录", Description: "主管现场核验记录单", FileURL: "/files/T202401003_proc_01.pdf", UploadedBy: supervisor.Name, UploadedAt: now.AddDate(0, 0, -8)},
		{TaskID: tasks[2].ID, Type: config.EvidenceTypeProcess, Title: "核验照片", Description: "主管现场核验照片", FileURL: "/files/T202401003_proc_02.jpg", UploadedBy: supervisor.Name, UploadedAt: now.AddDate(0, 0, -8)},

		{TaskID: tasks[3].ID, Type: config.EvidenceTypeRegistration, Title: "采样登记表", Description: "洪湖采样登记表", FileURL: "/files/T202401004_reg_01.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -7)},
		{TaskID: tasks[3].ID, Type: config.EvidenceTypeRegistration, Title: "采样照片", Description: "采样现场照片", FileURL: "/files/T202401004_reg_02.jpg", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -7)},

		{TaskID: tasks[4].ID, Type: config.EvidenceTypeRegistration, Title: "采样登记表", Description: "三峡库区采样登记表", FileURL: "/files/T202401005_reg_01.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -15)},
		{TaskID: tasks[4].ID, Type: config.EvidenceTypeProcess, Title: "主管核验记录", Description: "主管过程核验记录", FileURL: "/files/T202401005_proc_01.pdf", UploadedBy: supervisor.Name, UploadedAt: now.AddDate(0, 0, -12)},
		{TaskID: tasks[4].ID, Type: config.EvidenceTypeReview, Title: "复核意见", Description: "复核初步意见", FileURL: "/files/T202401005_rev_01.pdf", UploadedBy: reviewer.Name, UploadedAt: now.AddDate(0, 0, -10)},

		{TaskID: tasks[5].ID, Type: config.EvidenceTypeRegistration, Title: "采样登记表", Description: "丹江口水库采样登记表", FileURL: "/files/T202401006_reg_01.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -20)},
		{TaskID: tasks[5].ID, Type: config.EvidenceTypeRegistration, Title: "采样照片", Description: "采样现场照片", FileURL: "/files/T202401006_reg_02.jpg", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -20)},
		{TaskID: tasks[5].ID, Type: config.EvidenceTypeProcess, Title: "过程核验记录", Description: "主管现场核验记录", FileURL: "/files/T202401006_proc_01.pdf", UploadedBy: supervisor.Name, UploadedAt: now.AddDate(0, 0, -19)},
		{TaskID: tasks[5].ID, Type: config.EvidenceTypeProcess, Title: "检测报告", Description: "实验室检测原始报告", FileURL: "/files/T202401006_proc_02.pdf", UploadedBy: supervisor.Name, UploadedAt: now.AddDate(0, 0, -19)},
		{TaskID: tasks[5].ID, Type: config.EvidenceTypeReview, Title: "复核报告", Description: "复核负责人最终审核报告", FileURL: "/files/T202401006_rev_01.pdf", UploadedBy: reviewer.Name, UploadedAt: now.AddDate(0, 0, -18)},
		{TaskID: tasks[5].ID, Type: config.EvidenceTypeReview, Title: "归档确认单", Description: "归档确认签字单", FileURL: "/files/T202401006_rev_02.pdf", UploadedBy: reviewer.Name, UploadedAt: now.AddDate(0, 0, -18)},

		{TaskID: tasks[6].ID, Type: config.EvidenceTypeRegistration, Title: "采样登记表", Description: "清江流域采样登记表", FileURL: "/files/T202401007_reg_01.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -12)},

		{TaskID: tasks[7].ID, Type: config.EvidenceTypeRegistration, Title: "采样登记表", Description: "梁子湖采样登记表", FileURL: "/files/T202401008_reg_01.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -9)},
		{TaskID: tasks[7].ID, Type: config.EvidenceTypeProcess, Title: "过程核验记录", Description: "主管核验记录", FileURL: "/files/T202401008_proc_01.pdf", UploadedBy: supervisor.Name, UploadedAt: now.AddDate(0, 0, -7)},
	}

	for _, ev := range evidences {
		database.DB.Create(&ev)
	}
}

func seedTaskLogs(tasks []models.SamplingTask, registrar, supervisor, reviewer models.User) {
	now := time.Now()

	logs := []models.TaskLog{
		{TaskID: tasks[0].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务", CreatedAt: now.AddDate(0, 0, -5)},

		{TaskID: tasks[1].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务", CreatedAt: now.AddDate(0, 0, -4)},

		{TaskID: tasks[2].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务", CreatedAt: now.AddDate(0, 0, -10)},
		{TaskID: tasks[2].ID, Action: config.ActionSupervisorPass, OperatorID: supervisor.ID, OperatorName: supervisor.Name, OperatorRole: supervisor.Role, Remark: "主管审核通过，材料齐全", CreatedAt: now.AddDate(0, 0, -8)},

		{TaskID: tasks[3].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务", CreatedAt: now.AddDate(0, 0, -7)},
		{TaskID: tasks[3].ID, Action: config.ActionSupervisorReject, OperatorID: supervisor.ID, OperatorName: supervisor.Name, OperatorRole: supervisor.Role, Remark: "主管审核驳回：采样地点描述不清晰，缺少具体经纬度信息；样品编号不规范，请重新核对后提交。", CreatedAt: now.AddDate(0, 0, -6)},

		{TaskID: tasks[4].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务", CreatedAt: now.AddDate(0, 0, -15)},
		{TaskID: tasks[4].ID, Action: config.ActionSupervisorPass, OperatorID: supervisor.ID, OperatorName: supervisor.Name, OperatorRole: supervisor.Role, Remark: "主管审核通过", CreatedAt: now.AddDate(0, 0, -12)},
		{TaskID: tasks[4].ID, Action: config.ActionReviewerReturn, OperatorID: reviewer.ID, OperatorName: reviewer.Name, OperatorRole: reviewer.Role, Remark: "复核退回：复核发现过程核验证据不足，采样过程照片缺少时间戳，部分检测项目缺少原始记录，请补充完善后重新提交。", CreatedAt: now.AddDate(0, 0, -10)},

		{TaskID: tasks[5].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务", CreatedAt: now.AddDate(0, 0, -20)},
		{TaskID: tasks[5].ID, Action: config.ActionSupervisorPass, OperatorID: supervisor.ID, OperatorName: supervisor.Name, OperatorRole: supervisor.Role, Remark: "主管审核通过，证据链完整", CreatedAt: now.AddDate(0, 0, -19)},
		{TaskID: tasks[5].ID, Action: config.ActionReviewerApprove, OperatorID: reviewer.ID, OperatorName: reviewer.Name, OperatorRole: reviewer.Role, Remark: "复核通过，已归档", CreatedAt: now.AddDate(0, 0, -18)},

		{TaskID: tasks[6].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务", CreatedAt: now.AddDate(0, 0, -12)},
		{TaskID: tasks[6].ID, Action: config.ActionSupervisorPass, OperatorID: supervisor.ID, OperatorName: supervisor.Name, OperatorRole: supervisor.Role, Remark: "主管审核通过", CreatedAt: now.AddDate(0, 0, -11)},

		{TaskID: tasks[7].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务", CreatedAt: now.AddDate(0, 0, -9)},
		{TaskID: tasks[7].ID, Action: config.ActionSupervisorPass, OperatorID: supervisor.ID, OperatorName: supervisor.Name, OperatorRole: supervisor.Role, Remark: "主管审核通过", CreatedAt: now.AddDate(0, 0, -7)},
	}

	for _, log := range logs {
		database.DB.Create(&log)
	}
}
