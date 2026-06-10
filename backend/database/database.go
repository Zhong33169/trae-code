package database

import (
	"log"
	"time"
	"zqzl/backend/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Init() {
	var err error
	DB, err = gorm.Open(sqlite.Open("zqzl.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("failed to connect database:", err)
	}

	err = DB.AutoMigrate(&models.User{}, &models.Enrollment{}, &models.Attachment{}, &models.AuditLog{})
	if err != nil {
		log.Fatal("failed to migrate database:", err)
	}

	seed()
}

func seed() {
	var count int64
	DB.Model(&models.User{}).Count(&count)
	if count > 0 {
		return
	}

	log.Println("Seeding database...")

	users := []models.User{
		{Username: "admission1", Name: "张老师", Role: models.RoleAdmission, Password: "123456"},
		{Username: "admission2", Name: "李老师", Role: models.RoleAdmission, Password: "123456"},
		{Username: "academic1", Name: "王主任", Role: models.RoleAcademic, Password: "123456"},
		{Username: "admin1", Name: "赵校长", Role: models.RoleAdmin, Password: "123456"},
	}
	for i := range users {
		DB.Create(&users[i])
	}

	now := time.Now()
	pastDeadline := now.AddDate(0, 0, -3)
	futureDeadline := now.AddDate(0, 0, 7)

	enrollments := []models.Enrollment{
		{
			StudentName: "陈小明", IDCard: "110101200001011234", Phone: "13800138001",
			Major: "计算机应用", Status: models.StatusPendingVerify,
			CreatedBy: users[0].ID, CreatedByName: users[0].Name,
			Deadline: &futureDeadline,
		},
		{
			StudentName: "刘小红", IDCard: "110101200002022345", Phone: "13800138002",
			Major: "电子商务", Status: models.StatusPendingCorrection,
			CreatedBy: users[0].ID, CreatedByName: users[0].Name,
			Deadline: &futureDeadline, RejectReason: "缺少身份证复印件和学历证明",
		},
		{
			StudentName: "王小强", IDCard: "110101200003033456", Phone: "13800138003",
			Major: "机电一体化", Status: models.StatusPendingReview,
			CreatedBy: users[1].ID, CreatedByName: users[1].Name,
			Deadline: &futureDeadline,
		},
		{
			StudentName: "赵小美", IDCard: "110101200004044567", Phone: "13800138004",
			Major: "护理", Status: models.StatusArchived,
			CreatedBy: users[0].ID, CreatedByName: users[0].Name,
			AdminRemark: "材料齐全，符合入学条件",
		},
		{
			StudentName: "孙小伟", IDCard: "110101200005055678", Phone: "13800138005",
			Major: "会计", Status: models.StatusPendingCorrection,
			CreatedBy: users[1].ID, CreatedByName: users[1].Name,
			Deadline: &pastDeadline, RejectReason: "照片不符合要求，需重新提交",
		},
		{
			StudentName: "周小丽", IDCard: "110101200006066789", Phone: "13800138006",
			Major: "学前教育", Status: models.StatusRejected,
			CreatedBy: users[0].ID, CreatedByName: users[0].Name,
			RejectReason: "学历不符合报名要求",
		},
		{
			StudentName: "吴小军", IDCard: "110101200007077890", Phone: "13800138007",
			Major: "汽车维修", Status: models.StatusDraft,
			CreatedBy: users[1].ID, CreatedByName: users[1].Name,
		},
	}
	for i := range enrollments {
		DB.Create(&enrollments[i])
	}

	attachments := []models.Attachment{
		{EnrollmentID: 1, Name: "身份证正面.jpg", Type: "id_card_front", FileKey: "attachments/1/id_front.jpg", Status: models.AttachPending, UploadedBy: users[0].ID, UploadedByName: users[0].Name},
		{EnrollmentID: 1, Name: "身份证背面.jpg", Type: "id_card_back", FileKey: "attachments/1/id_back.jpg", Status: models.AttachPending, UploadedBy: users[0].ID, UploadedByName: users[0].Name},
		{EnrollmentID: 1, Name: "学历证明.pdf", Type: "education", FileKey: "attachments/1/edu.pdf", Status: models.AttachPending, UploadedBy: users[0].ID, UploadedByName: users[0].Name},
		{EnrollmentID: 1, Name: "一寸照片.jpg", Type: "photo", FileKey: "attachments/1/photo.jpg", Status: models.AttachPending, UploadedBy: users[0].ID, UploadedByName: users[0].Name},

		{EnrollmentID: 2, Name: "身份证正面.jpg", Type: "id_card_front", FileKey: "attachments/2/id_front.jpg", Status: models.AttachApproved, UploadedBy: users[0].ID, UploadedByName: users[0].Name},
		{EnrollmentID: 2, Name: "一寸照片.jpg", Type: "photo", FileKey: "attachments/2/photo.jpg", Status: models.AttachApproved, UploadedBy: users[0].ID, UploadedByName: users[0].Name},

		{EnrollmentID: 3, Name: "身份证正面.jpg", Type: "id_card_front", FileKey: "attachments/3/id_front.jpg", Status: models.AttachApproved, UploadedBy: users[1].ID, UploadedByName: users[1].Name},
		{EnrollmentID: 3, Name: "身份证背面.jpg", Type: "id_card_back", FileKey: "attachments/3/id_back.jpg", Status: models.AttachApproved, UploadedBy: users[1].ID, UploadedByName: users[1].Name},
		{EnrollmentID: 3, Name: "学历证明.pdf", Type: "education", FileKey: "attachments/3/edu.pdf", Status: models.AttachApproved, UploadedBy: users[1].ID, UploadedByName: users[1].Name},
		{EnrollmentID: 3, Name: "一寸照片.jpg", Type: "photo", FileKey: "attachments/3/photo.jpg", Status: models.AttachApproved, UploadedBy: users[1].ID, UploadedByName: users[1].Name},

		{EnrollmentID: 4, Name: "身份证正面.jpg", Type: "id_card_front", FileKey: "attachments/4/id_front.jpg", Status: models.AttachApproved, UploadedBy: users[0].ID, UploadedByName: users[0].Name},
		{EnrollmentID: 4, Name: "身份证背面.jpg", Type: "id_card_back", FileKey: "attachments/4/id_back.jpg", Status: models.AttachApproved, UploadedBy: users[0].ID, UploadedByName: users[0].Name},
		{EnrollmentID: 4, Name: "学历证明.pdf", Type: "education", FileKey: "attachments/4/edu.pdf", Status: models.AttachApproved, UploadedBy: users[0].ID, UploadedByName: users[0].Name},
		{EnrollmentID: 4, Name: "一寸照片.jpg", Type: "photo", FileKey: "attachments/4/photo.jpg", Status: models.AttachApproved, UploadedBy: users[0].ID, UploadedByName: users[0].Name},

		{EnrollmentID: 5, Name: "身份证正面.jpg", Type: "id_card_front", FileKey: "attachments/5/id_front.jpg", Status: models.AttachApproved, UploadedBy: users[1].ID, UploadedByName: users[1].Name},
		{EnrollmentID: 5, Name: "一寸照片.jpg", Type: "photo", FileKey: "attachments/5/photo.jpg", Status: models.AttachRejected, RejectReason: "照片模糊，不符合证件照要求", UploadedBy: users[1].ID, UploadedByName: users[1].Name},

		{EnrollmentID: 6, Name: "身份证正面.jpg", Type: "id_card_front", FileKey: "attachments/6/id_front.jpg", Status: models.AttachApproved, UploadedBy: users[0].ID, UploadedByName: users[0].Name},
		{EnrollmentID: 6, Name: "学历证明.pdf", Type: "education", FileKey: "attachments/6/edu.pdf", Status: models.AttachRejected, RejectReason: "学历层次不满足报名要求", UploadedBy: users[0].ID, UploadedByName: users[0].Name},

		{EnrollmentID: 7, Name: "身份证正面.jpg", Type: "id_card_front", FileKey: "attachments/7/id_front.jpg", Status: models.AttachPending, UploadedBy: users[1].ID, UploadedByName: users[1].Name},
	}
	for i := range attachments {
		DB.Create(&attachments[i])
	}

	auditLogs := []models.AuditLog{
		{EnrollmentID: 1, UserID: users[0].ID, UserName: users[0].Name, UserRole: string(users[0].Role), Action: "创建报名单", FromStatus: "", ToStatus: string(models.StatusDraft)},
		{EnrollmentID: 1, UserID: users[0].ID, UserName: users[0].Name, UserRole: string(users[0].Role), Action: "提交核验", FromStatus: string(models.StatusDraft), ToStatus: string(models.StatusPendingVerify)},

		{EnrollmentID: 2, UserID: users[0].ID, UserName: users[0].Name, UserRole: string(users[0].Role), Action: "创建报名单", FromStatus: "", ToStatus: string(models.StatusDraft)},
		{EnrollmentID: 2, UserID: users[0].ID, UserName: users[0].Name, UserRole: string(users[0].Role), Action: "提交核验", FromStatus: string(models.StatusDraft), ToStatus: string(models.StatusPendingVerify)},
		{EnrollmentID: 2, UserID: users[2].ID, UserName: users[2].Name, UserRole: string(users[2].Role), Action: "退回补正", Reason: "缺少身份证复印件和学历证明", FromStatus: string(models.StatusPendingVerify), ToStatus: string(models.StatusPendingCorrection)},

		{EnrollmentID: 3, UserID: users[1].ID, UserName: users[1].Name, UserRole: string(users[1].Role), Action: "创建报名单", FromStatus: "", ToStatus: string(models.StatusDraft)},
		{EnrollmentID: 3, UserID: users[1].ID, UserName: users[1].Name, UserRole: string(users[1].Role), Action: "提交核验", FromStatus: string(models.StatusDraft), ToStatus: string(models.StatusPendingVerify)},
		{EnrollmentID: 3, UserID: users[2].ID, UserName: users[2].Name, UserRole: string(users[2].Role), Action: "核验通过", FromStatus: string(models.StatusPendingVerify), ToStatus: string(models.StatusPendingReview)},

		{EnrollmentID: 4, UserID: users[0].ID, UserName: users[0].Name, UserRole: string(users[0].Role), Action: "创建报名单", FromStatus: "", ToStatus: string(models.StatusDraft)},
		{EnrollmentID: 4, UserID: users[0].ID, UserName: users[0].Name, UserRole: string(users[0].Role), Action: "提交核验", FromStatus: string(models.StatusDraft), ToStatus: string(models.StatusPendingVerify)},
		{EnrollmentID: 4, UserID: users[2].ID, UserName: users[2].Name, UserRole: string(users[2].Role), Action: "核验通过", FromStatus: string(models.StatusPendingVerify), ToStatus: string(models.StatusPendingReview)},
		{EnrollmentID: 4, UserID: users[3].ID, UserName: users[3].Name, UserRole: string(users[3].Role), Action: "复核归档", Reason: "材料齐全，符合入学条件", FromStatus: string(models.StatusPendingReview), ToStatus: string(models.StatusArchived)},

		{EnrollmentID: 5, UserID: users[1].ID, UserName: users[1].Name, UserRole: string(users[1].Role), Action: "创建报名单", FromStatus: "", ToStatus: string(models.StatusDraft)},
		{EnrollmentID: 5, UserID: users[1].ID, UserName: users[1].Name, UserRole: string(users[1].Role), Action: "提交核验", FromStatus: string(models.StatusDraft), ToStatus: string(models.StatusPendingVerify)},
		{EnrollmentID: 5, UserID: users[2].ID, UserName: users[2].Name, UserRole: string(users[2].Role), Action: "退回补正", Reason: "照片不符合要求，需重新提交", FromStatus: string(models.StatusPendingVerify), ToStatus: string(models.StatusPendingCorrection)},

		{EnrollmentID: 6, UserID: users[0].ID, UserName: users[0].Name, UserRole: string(users[0].Role), Action: "创建报名单", FromStatus: "", ToStatus: string(models.StatusDraft)},
		{EnrollmentID: 6, UserID: users[0].ID, UserName: users[0].Name, UserRole: string(users[0].Role), Action: "提交核验", FromStatus: string(models.StatusDraft), ToStatus: string(models.StatusPendingVerify)},
		{EnrollmentID: 6, UserID: users[2].ID, UserName: users[2].Name, UserRole: string(users[2].Role), Action: "核验不通过", Reason: "学历不符合报名要求", FromStatus: string(models.StatusPendingVerify), ToStatus: string(models.StatusRejected)},

		{EnrollmentID: 7, UserID: users[1].ID, UserName: users[1].Name, UserRole: string(users[1].Role), Action: "创建报名单", FromStatus: "", ToStatus: string(models.StatusDraft)},
	}
	for i := range auditLogs {
		DB.Create(&auditLogs[i])
	}

	log.Println("Database seeded successfully.")
}
