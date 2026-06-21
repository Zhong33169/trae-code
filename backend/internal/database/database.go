package database

import (
	"log"
	"member-service/internal/models"
	"os"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Init() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "data/member_service.db"
	}

	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}

	err = DB.AutoMigrate(&models.User{}, &models.MemberServiceOrder{}, &models.Attachment{}, &models.AuditLog{})
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	seedData()
}

func seedData() {
	var count int64
	DB.Model(&models.User{}).Count(&count)
	if count > 0 {
		return
	}

	users := []models.User{
		{Username: "registrar01", Name: "李登记", Role: models.RoleRegistrar},
		{Username: "auditor01", Name: "王审核", Role: models.RoleAuditor},
		{Username: "reviewer01", Name: "张复核", Role: models.RoleReviewer},
	}
	for i := range users {
		DB.Create(&users[i])
	}

	now := time.Now()
	dueSoon := now.Add(2 * time.Hour)
	duePast := now.Add(-1 * time.Hour)

	orders := []models.MemberServiceOrder{
		{
			OrderNo:        "MSO20250601001",
			MemberName:     "陈小明",
			MemberPhone:    "13800138001",
			ServiceType:    "洁牙服务",
			Status:         models.StatusPending,
			Priority:       "normal",
			Description:    "会员预约洁牙服务，需核验会员卡有效性",
			CreatedBy:      users[0].ID,
			CreatedByName:  users[0].Name,
			CurrentHandler: users[1].ID,
			HandlerName:    users[1].Name,
			DueAt:          &dueSoon,
			CreatedAt:      now.Add(-30 * time.Minute),
			UpdatedAt:      now.Add(-30 * time.Minute),
		},
		{
			OrderNo:        "MSO20250601002",
			MemberName:     "刘芳芳",
			MemberPhone:    "13800138002",
			ServiceType:    "正畸咨询",
			Status:         models.StatusSupplement,
			Priority:       "high",
			Description:    "正畸咨询服务，缺少身份证复印件",
			RejectReason:   "缺少有效身份证明文件，请补充身份证正反面复印件",
			CreatedBy:      users[0].ID,
			CreatedByName:  users[0].Name,
			CurrentHandler: users[0].ID,
			HandlerName:    users[0].Name,
			DueAt:          &duePast,
			CreatedAt:      now.Add(-3 * time.Hour),
			UpdatedAt:      now.Add(-1 * time.Hour),
		},
		{
			OrderNo:        "MSO20250601003",
			MemberName:     "王大伟",
			MemberPhone:    "13800138003",
			ServiceType:    "种植牙服务",
			Status:         models.StatusProcessing,
			Priority:       "high",
			Description:    "种植牙会员服务，正在审核中",
			CreatedBy:      users[0].ID,
			CreatedByName:  users[0].Name,
			CurrentHandler: users[1].ID,
			HandlerName:    users[1].Name,
			DueAt:          &dueSoon,
			CreatedAt:      now.Add(-5 * time.Hour),
			UpdatedAt:      now.Add(-2 * time.Hour),
		},
		{
			OrderNo:        "MSO20250601004",
			MemberName:     "赵晓红",
			MemberPhone:    "13800138004",
			ServiceType:    "儿童涂氟",
			Status:         models.StatusReview,
			Priority:       "normal",
			Description:    "儿童涂氟服务，已完成审核，待复核归档",
			Result:         "审核通过，会员有效，服务已安排",
			CreatedBy:      users[0].ID,
			CreatedByName:  users[0].Name,
			CurrentHandler: users[2].ID,
			HandlerName:    users[2].Name,
			CreatedAt:      now.Add(-8 * time.Hour),
			UpdatedAt:      now.Add(-30 * time.Minute),
		},
		{
			OrderNo:        "MSO20250601005",
			MemberName:     "孙志强",
			MemberPhone:    "13800138005",
			ServiceType:    "根管治疗",
			Status:         models.StatusCompleted,
			Priority:       "normal",
			Description:    "根管治疗会员服务，已完成归档",
			Result:         "服务完成，会员权益已使用",
			AuditRemark:    "资料齐全，流程规范，同意归档",
			CreatedBy:      users[0].ID,
			CreatedByName:  users[0].Name,
			CurrentHandler: 0,
			HandlerName:    "",
			CompletedAt:    &now,
			CreatedAt:      now.Add(-48 * time.Hour),
			UpdatedAt:      now.Add(-2 * time.Hour),
		},
		{
			OrderNo:        "MSO20250601006",
			MemberName:     "周美玲",
			MemberPhone:    "13800138006",
			ServiceType:    "美白牙齿",
			Status:         models.StatusReturned,
			Priority:       "low",
			Description:    "美白牙齿服务，被退回补充材料",
			ReturnReason:   "口腔检查报告不完整，需补充全景片",
			CreatedBy:      users[0].ID,
			CreatedByName:  users[0].Name,
			CurrentHandler: users[0].ID,
			HandlerName:    users[0].Name,
			DueAt:          &duePast,
			CreatedAt:      now.Add(-24 * time.Hour),
			UpdatedAt:      now.Add(-6 * time.Hour),
		},
		{
			OrderNo:        "MSO20250601007",
			MemberName:     "吴建军",
			MemberPhone:    "13800138007",
			ServiceType:    "镶牙服务",
			Status:         models.StatusRejected,
			Priority:       "normal",
			Description:    "镶牙服务申请",
			RejectReason:   "会员已过期，无法享受服务",
			CreatedBy:      users[0].ID,
			CreatedByName:  users[0].Name,
			CurrentHandler: 0,
			HandlerName:    "",
			CreatedAt:      now.Add(-72 * time.Hour),
			UpdatedAt:      now.Add(-48 * time.Hour),
		},
	}

	for i := range orders {
		DB.Create(&orders[i])
	}

	attachments := []models.Attachment{
		{OrderID: 1, FileName: "会员卡正面.jpg", FileType: "image/jpeg", FileSize: 1024000, MaterialType: "member_card", UploadedBy: users[0].ID, UploadedByName: users[0].Name, Status: "approved", CreatedAt: now.Add(-30 * time.Minute), UpdatedAt: now.Add(-30 * time.Minute)},
		{OrderID: 1, FileName: "身份证正面.jpg", FileType: "image/jpeg", FileSize: 850000, MaterialType: "id_card", UploadedBy: users[0].ID, UploadedByName: users[0].Name, Status: "approved", CreatedAt: now.Add(-30 * time.Minute), UpdatedAt: now.Add(-30 * time.Minute)},
		{OrderID: 2, FileName: "会员卡照片(首次-模糊).jpg", FileType: "image/jpeg", FileSize: 920000, MaterialType: "member_card", UploadedBy: users[0].ID, UploadedByName: users[0].Name, Status: "rejected", RejectReason: "照片模糊，无法识别会员信息", CreatedAt: now.Add(-3 * time.Hour), UpdatedAt: now.Add(-2 * time.Hour)},
		{OrderID: 2, FileName: "会员卡照片(重传-清晰).jpg", FileType: "image/jpeg", FileSize: 1100000, MaterialType: "member_card", UploadedBy: users[0].ID, UploadedByName: users[0].Name, Status: "approved", CreatedAt: now.Add(-1 * time.Hour), UpdatedAt: now.Add(-45 * time.Minute)},
		{OrderID: 3, FileName: "会员证明.pdf", FileType: "application/pdf", FileSize: 2048000, MaterialType: "member_card", UploadedBy: users[0].ID, UploadedByName: users[0].Name, Status: "approved", CreatedAt: now.Add(-5 * time.Hour), UpdatedAt: now.Add(-5 * time.Hour)},
		{OrderID: 3, FileName: "口腔检查报告.pdf", FileType: "application/pdf", FileSize: 1536000, MaterialType: "oral_report", UploadedBy: users[0].ID, UploadedByName: users[0].Name, Status: "pending", CreatedAt: now.Add(-2 * time.Hour), UpdatedAt: now.Add(-2 * time.Hour)},
		{OrderID: 4, FileName: "会员卡.jpg", FileType: "image/jpeg", FileSize: 768000, MaterialType: "member_card", UploadedBy: users[0].ID, UploadedByName: users[0].Name, Status: "approved", CreatedAt: now.Add(-8 * time.Hour), UpdatedAt: now.Add(-8 * time.Hour)},
		{OrderID: 4, FileName: "诊疗方案.pdf", FileType: "application/pdf", FileSize: 1280000, MaterialType: "other", UploadedBy: users[0].ID, UploadedByName: users[0].Name, Status: "approved", CreatedAt: now.Add(-8 * time.Hour), UpdatedAt: now.Add(-8 * time.Hour)},
		{OrderID: 5, FileName: "服务确认单.pdf", FileType: "application/pdf", FileSize: 512000, MaterialType: "other", UploadedBy: users[0].ID, UploadedByName: users[0].Name, Status: "approved", CreatedAt: now.Add(-48 * time.Hour), UpdatedAt: now.Add(-48 * time.Hour)},
		{OrderID: 6, FileName: "会员卡.jpg", FileType: "image/jpeg", FileSize: 780000, MaterialType: "member_card", UploadedBy: users[0].ID, UploadedByName: users[0].Name, Status: "approved", CreatedAt: now.Add(-24 * time.Hour), UpdatedAt: now.Add(-24 * time.Hour)},
		{OrderID: 6, FileName: "身份证.jpg", FileType: "image/jpeg", FileSize: 690000, MaterialType: "id_card", UploadedBy: users[0].ID, UploadedByName: users[0].Name, Status: "approved", CreatedAt: now.Add(-24 * time.Hour), UpdatedAt: now.Add(-24 * time.Hour)},
		{OrderID: 6, FileName: "口腔检查报告(首次-缺全景片).pdf", FileType: "application/pdf", FileSize: 1024000, MaterialType: "oral_report", UploadedBy: users[0].ID, UploadedByName: users[0].Name, Status: "rejected", RejectReason: "报告缺少全景片，不完整", CreatedAt: now.Add(-24 * time.Hour), UpdatedAt: now.Add(-6 * time.Hour)},
		{OrderID: 6, FileName: "口腔检查报告(重传-含全景片).pdf", FileType: "application/pdf", FileSize: 2048000, MaterialType: "oral_report", UploadedBy: users[0].ID, UploadedByName: users[0].Name, Status: "approved", CreatedAt: now.Add(-4 * time.Hour), UpdatedAt: now.Add(-3 * time.Hour)},
		{OrderID: 7, FileName: "过期会员卡.jpg", FileType: "image/jpeg", FileSize: 640000, MaterialType: "member_card", UploadedBy: users[0].ID, UploadedByName: users[0].Name, Status: "approved", CreatedAt: now.Add(-72 * time.Hour), UpdatedAt: now.Add(-72 * time.Hour)},
	}

	for i := range attachments {
		DB.Create(&attachments[i])
	}

	logs := []models.AuditLog{
		{OrderID: 1, Action: "创建工单", OperatorID: users[0].ID, Operator: users[0].Name, Role: string(users[0].Role), Remark: "提交会员服务单申请", ToStatus: string(models.StatusPending), CreatedAt: now.Add(-30 * time.Minute)},
		{OrderID: 2, Action: "创建工单", OperatorID: users[0].ID, Operator: users[0].Name, Role: string(users[0].Role), Remark: "提交正畸咨询申请", ToStatus: string(models.StatusPending), CreatedAt: now.Add(-3 * time.Hour)},
		{OrderID: 2, Action: "附件驳回", OperatorID: users[1].ID, Operator: users[1].Name, Role: string(users[1].Role), Remark: "驳回附件[会员卡照片(首次-模糊).jpg]：照片模糊，无法识别会员信息", FromStatus: string(models.StatusPending), ToStatus: string(models.StatusPending), CreatedAt: now.Add(-2 * time.Hour)},
		{OrderID: 2, Action: "附件重传", OperatorID: users[0].ID, Operator: users[0].Name, Role: string(users[0].Role), Remark: "重新上传会员卡：会员卡照片(重传-清晰).jpg", FromStatus: string(models.StatusPending), ToStatus: string(models.StatusPending), CreatedAt: now.Add(-1 * time.Hour)},
		{OrderID: 2, Action: "附件通过", OperatorID: users[1].ID, Operator: users[1].Name, Role: string(users[1].Role), Remark: "通过附件[会员卡照片(重传-清晰).jpg]", FromStatus: string(models.StatusPending), ToStatus: string(models.StatusPending), CreatedAt: now.Add(-45 * time.Minute)},
		{OrderID: 2, Action: "退回补正", OperatorID: users[1].ID, Operator: users[1].Name, Role: string(users[1].Role), Remark: "缺少有效身份证明文件", FromStatus: string(models.StatusPending), ToStatus: string(models.StatusSupplement), CreatedAt: now.Add(-1 * time.Hour)},
		{OrderID: 3, Action: "创建工单", OperatorID: users[0].ID, Operator: users[0].Name, Role: string(users[0].Role), Remark: "提交种植牙服务申请", ToStatus: string(models.StatusPending), CreatedAt: now.Add(-5 * time.Hour)},
		{OrderID: 3, Action: "开始审核", OperatorID: users[1].ID, Operator: users[1].Name, Role: string(users[1].Role), Remark: "接收工单，开始审核", FromStatus: string(models.StatusPending), ToStatus: string(models.StatusProcessing), CreatedAt: now.Add(-2 * time.Hour)},
		{OrderID: 4, Action: "创建工单", OperatorID: users[0].ID, Operator: users[0].Name, Role: string(users[0].Role), Remark: "提交儿童涂氟服务", ToStatus: string(models.StatusPending), CreatedAt: now.Add(-8 * time.Hour)},
		{OrderID: 4, Action: "审核通过", OperatorID: users[1].ID, Operator: users[1].Name, Role: string(users[1].Role), Remark: "资料齐全，审核通过", FromStatus: string(models.StatusProcessing), ToStatus: string(models.StatusReview), CreatedAt: now.Add(-30 * time.Minute)},
		{OrderID: 5, Action: "创建工单", OperatorID: users[0].ID, Operator: users[0].Name, Role: string(users[0].Role), Remark: "提交根管治疗服务", ToStatus: string(models.StatusPending), CreatedAt: now.Add(-48 * time.Hour)},
		{OrderID: 5, Action: "审核通过", OperatorID: users[1].ID, Operator: users[1].Name, Role: string(users[1].Role), Remark: "审核通过", FromStatus: string(models.StatusProcessing), ToStatus: string(models.StatusReview), CreatedAt: now.Add(-24 * time.Hour)},
		{OrderID: 5, Action: "复核归档", OperatorID: users[2].ID, Operator: users[2].Name, Role: string(users[2].Role), Remark: "资料齐全，流程规范，同意归档", FromStatus: string(models.StatusReview), ToStatus: string(models.StatusCompleted), CreatedAt: now.Add(-2 * time.Hour)},
		{OrderID: 6, Action: "创建工单", OperatorID: users[0].ID, Operator: users[0].Name, Role: string(users[0].Role), Remark: "提交美白牙齿服务", ToStatus: string(models.StatusPending), CreatedAt: now.Add(-24 * time.Hour)},
		{OrderID: 6, Action: "审核通过", OperatorID: users[1].ID, Operator: users[1].Name, Role: string(users[1].Role), Remark: "资料初审通过，进入复核", FromStatus: string(models.StatusProcessing), ToStatus: string(models.StatusReview), CreatedAt: now.Add(-12 * time.Hour)},
		{OrderID: 6, Action: "附件驳回", OperatorID: users[2].ID, Operator: users[2].Name, Role: string(users[2].Role), Remark: "驳回附件[口腔检查报告(首次-缺全景片).pdf]：报告缺少全景片，不完整", FromStatus: string(models.StatusReview), ToStatus: string(models.StatusReview), CreatedAt: now.Add(-6 * time.Hour)},
		{OrderID: 6, Action: "退回补正", OperatorID: users[2].ID, Operator: users[2].Name, Role: string(users[2].Role), Remark: "口腔检查报告不完整，需补充全景片", FromStatus: string(models.StatusReview), ToStatus: string(models.StatusReturned), CreatedAt: now.Add(-6 * time.Hour)},
		{OrderID: 6, Action: "附件重传", OperatorID: users[0].ID, Operator: users[0].Name, Role: string(users[0].Role), Remark: "重新上传口腔检查报告：口腔检查报告(重传-含全景片).pdf", FromStatus: string(models.StatusReturned), ToStatus: string(models.StatusReturned), CreatedAt: now.Add(-4 * time.Hour)},
		{OrderID: 6, Action: "附件通过", OperatorID: users[2].ID, Operator: users[2].Name, Role: string(users[2].Role), Remark: "通过附件[口腔检查报告(重传-含全景片).pdf]", FromStatus: string(models.StatusReturned), ToStatus: string(models.StatusReturned), CreatedAt: now.Add(-3 * time.Hour)},
		{OrderID: 7, Action: "创建工单", OperatorID: users[0].ID, Operator: users[0].Name, Role: string(users[0].Role), Remark: "提交镶牙服务申请", ToStatus: string(models.StatusPending), CreatedAt: now.Add(-72 * time.Hour)},
		{OrderID: 7, Action: "审核驳回", OperatorID: users[1].ID, Operator: users[1].Name, Role: string(users[1].Role), Remark: "会员已过期，无法享受服务", FromStatus: string(models.StatusProcessing), ToStatus: string(models.StatusRejected), CreatedAt: now.Add(-48 * time.Hour)},
		{OrderID: 2, Action: "批量审核失败", OperatorID: users[1].ID, Operator: users[1].Name, Role: string(users[1].Role), Remark: "批量审核失败: 必需材料不齐全或存在未修正的驳回附件：身份证", FromStatus: string(models.StatusSupplement), ToStatus: string(models.StatusSupplement), CreatedAt: now.Add(-45 * time.Minute)},
		{OrderID: 7, Action: "批量审核失败", OperatorID: users[1].ID, Operator: users[1].Name, Role: string(users[1].Role), Remark: "批量审核失败: 当前状态[已驳回]不可开始审核", FromStatus: string(models.StatusRejected), ToStatus: string(models.StatusRejected), CreatedAt: now.Add(-45 * time.Minute)},
		{OrderID: 0, Action: "批量处理汇总", OperatorID: users[1].ID, Operator: users[1].Name, Role: string(users[1].Role), Remark: "批量开始审核共3单，成功1单，失败2单。失败订单：MSO20250601002(必需材料不齐全)、MSO20250601007(已驳回状态不可处理)", CreatedAt: now.Add(-45 * time.Minute)},
	}

	for i := range logs {
		DB.Create(&logs[i])
	}

	log.Println("Seed data created successfully")
}
