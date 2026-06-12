package seed

import (
	"backend/config"
	"backend/database"
	"backend/models"
	"log"
	"os"
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

func ResetDB() {
	dbPath := config.DBPath
	os.Remove(dbPath)
	os.Remove("./data/app.db-shm")
	os.Remove("./data/app.db-wal")
	log.Println("Database reset successfully")
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
			ProjectName:    "草稿-武汉市江岸区工业园VOC检测",
			SampleLocation: "江岸区兴业路1号工业园A栋楼顶",
			SampleType:     "环境空气",
			Status:         config.StatusDraft,
			Version:        1,
			RegistrarID:    registrar.ID,
			RegistrarName:  registrar.Name,
			CreatedAt:      now.AddDate(0, 0, -1),
			UpdatedAt:      now.AddDate(0, 0, -1),
		},
		{
			TaskNo:         "T202401002",
			ProjectName:    "草稿-东西湖区污水处理厂出水监测",
			SampleLocation: "东西湖区慈惠街污水处理厂总排放口",
			SampleType:     "废水",
			Status:         config.StatusDraft,
			Version:        1,
			RegistrarID:    registrar.ID,
			RegistrarName:  registrar.Name,
			CreatedAt:      now.AddDate(0, 0, -1),
			UpdatedAt:      now.AddDate(0, 0, -1),
		},
		{
			TaskNo:         "T202401003",
			ProjectName:    "长江武汉段国控断面水质监测",
			SampleLocation: "长江武汉关断面（东经114.305, 北纬30.593）",
			SampleType:     "地表水",
			Status:         config.StatusPendingReview,
			Version:        1,
			RegistrarID:    registrar.ID,
			RegistrarName:  registrar.Name,
			CreatedAt:      now.AddDate(0, 0, -5),
			UpdatedAt:      now.AddDate(0, 0, -5),
		},
		{
			TaskNo:         "T202401004",
			ProjectName:    "东湖风景区子湖水质监测",
			SampleLocation: "东湖听涛景区水域（无经纬度）",
			SampleType:     "湖泊水",
			Status:         config.StatusPendingReview,
			Version:        1,
			RegistrarID:    registrar.ID,
			RegistrarName:  registrar.Name,
			CreatedAt:      now.AddDate(0, 0, -4),
			UpdatedAt:      now.AddDate(0, 0, -4),
		},
		{
			TaskNo:         "T202401005",
			ProjectName:    "汉江襄阳段支流水质调查",
			SampleLocation: "汉江襄阳唐白河入江口",
			SampleType:     "河流水",
			Status:         config.StatusPendingReview,
			Version:        1,
			RegistrarID:    registrar.ID,
			RegistrarName:  registrar.Name,
			CreatedAt:      now.AddDate(0, 0, -3),
			UpdatedAt:      now.AddDate(0, 0, -3),
		},
		{
			TaskNo:         "T202401006",
			ProjectName:    "洪湖国家级自然保护区水质监测",
			SampleLocation: "洪湖保护区核心区S1监测点",
			SampleType:     "湿地水",
			Status:         config.StatusReviewRejected,
			Version:        2,
			RegistrarID:    registrar.ID,
			RegistrarName:  registrar.Name,
			SupervisorID:   &supervisor.ID,
			SupervisorName: supervisor.Name,
			RejectReason:   "采样地点描述不清晰，缺少具体经纬度信息；样品编号不规范（应为HHS-S1-YYYYMMDD格式）；登记证据缺失采样设备校准证书。",
			CreatedAt:      now.AddDate(0, 0, -7),
			UpdatedAt:      now.AddDate(0, 0, -6),
		},
		{
			TaskNo:         "T202401007",
			ProjectName:    "三峡库区回水消落带监测",
			SampleLocation: "三峡库区秭归县茅坪镇消落带",
			SampleType:     "土壤+地表水",
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
			TaskNo:         "T202401008",
			ProjectName:    "丹江口水库饮用水源地专项监测",
			SampleLocation: "丹江口水库取水口1#点位",
			SampleType:     "饮用水源地",
			Status:         config.StatusReviewPassed,
			Version:        2,
			RegistrarID:    registrar.ID,
			RegistrarName:  registrar.Name,
			SupervisorID:   &supervisor.ID,
			SupervisorName: supervisor.Name,
			CreatedAt:      now.AddDate(0, 0, -9),
			UpdatedAt:      now.AddDate(0, 0, -7),
		},
		{
			TaskNo:         "T202401009",
			ProjectName:    "清江流域恩施段水质评价",
			SampleLocation: "清江恩施城区段3个监测断面",
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
			TaskNo:         "T202401010",
			ProjectName:    "梁子湖鄂州水华预警监测",
			SampleLocation: "梁子湖鄂州监测点（共12个点位）",
			SampleType:     "湖泊水",
			Status:         config.StatusReviewReturned,
			Version:        3,
			RegistrarID:    registrar.ID,
			RegistrarName:  registrar.Name,
			SupervisorID:   &supervisor.ID,
			SupervisorName: supervisor.Name,
			ReviewerID:     &reviewer.ID,
			ReviewerName:   reviewer.Name,
			ReturnReason:   "复核发现问题：1）过程核验证据不足，仅1个点位有现场核验照片，其余11个缺失；2）采样记录缺少采样人员签字和气象条件记录；3）叶绿素a检测缺少原始分光光度读数记录。请补充完善后重新提交。",
			CreatedAt:      now.AddDate(0, 0, -15),
			UpdatedAt:      now.AddDate(0, 0, -10),
		},
		{
			TaskNo:         "T202401011",
			ProjectName:    "长湖荆门片区水产养殖尾水监测",
			SampleLocation: "长湖荆门片区5个养殖尾水排放口",
			SampleType:     "养殖废水",
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
			TaskNo:         "T202401012",
			ProjectName:    "黄盖湖湘鄂跨界断面联合监测",
			SampleLocation: "黄盖湖入江口跨界断面",
			SampleType:     "地表水",
			Status:         config.StatusReviewApproved,
			Version:        3,
			RegistrarID:    registrar.ID,
			RegistrarName:  registrar.Name,
			SupervisorID:   &supervisor.ID,
			SupervisorName: supervisor.Name,
			ReviewerID:     &reviewer.ID,
			ReviewerName:   reviewer.Name,
			CreatedAt:      now.AddDate(0, 0, -25),
			UpdatedAt:      now.AddDate(0, 0, -22),
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
		{TaskID: tasks[0].ID, Type: config.EvidenceTypeRegistration, Title: "采样方案备案表", Description: "江岸区工业园VOC采样方案（备案编号HJ-WH-2024-0012）", FileURL: "/files/T202401001/reg_scheme.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -1)},
		{TaskID: tasks[0].ID, Type: config.EvidenceTypeRegistration, Title: "采样设备清单", Description: "VOC采样罐、大气采样器等设备清单及校准证书", FileURL: "/files/T202401001/reg_equipment.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -1)},
		{TaskID: tasks[0].ID, Type: config.EvidenceTypeRegistration, Title: "点位信息截图", Description: "百度地图采样点位截图", FileURL: "/files/T202401001/reg_map.jpg", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -1)},

		{TaskID: tasks[2].ID, Type: config.EvidenceTypeRegistration, Title: "国控断面采样任务单", Description: "国家水站网2024年1月监测任务通知单", FileURL: "/files/T202401003/reg_taskorder.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -5)},
		{TaskID: tasks[2].ID, Type: config.EvidenceTypeRegistration, Title: "采样点位图", Description: "长江武汉关断面临时采样点定位图（含经纬度）", FileURL: "/files/T202401003/reg_location.jpg", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -5)},
		{TaskID: tasks[2].ID, Type: config.EvidenceTypeProcess, Title: "现场采样过程记录", Description: "主管全程现场核验，含采样器具清洗过程、样品固定过程、样品编号标签", FileURL: "/files/T202401003/proc_record.pdf", UploadedBy: supervisor.Name, UploadedAt: now.AddDate(0, 0, -5)},

		{TaskID: tasks[3].ID, Type: config.EvidenceTypeRegistration, Title: "东湖子湖监测方案", Description: "东湖听涛景区监测方案（缺点位经纬度）", FileURL: "/files/T202401004/reg_scheme.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -4)},

		{TaskID: tasks[4].ID, Type: config.EvidenceTypeRegistration, Title: "汉江支流采样登记表", Description: "唐白河入江口采样基本信息表", FileURL: "/files/T202401005/reg_form.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -3)},
		{TaskID: tasks[4].ID, Type: config.EvidenceTypeRegistration, Title: "现场照片", Description: "采样点现场照片（含采样人员）", FileURL: "/files/T202401005/reg_photo.jpg", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -3)},
		{TaskID: tasks[4].ID, Type: config.EvidenceTypeProcess, Title: "主管现场核验记录", Description: "现场核对样品编号、采样深度、采样时间等信息", FileURL: "/files/T202401005/proc_verify.pdf", UploadedBy: supervisor.Name, UploadedAt: now.AddDate(0, 0, -3)},

		{TaskID: tasks[5].ID, Type: config.EvidenceTypeRegistration, Title: "洪湖采样方案", Description: "洪湖保护区水质监测方案", FileURL: "/files/T202401006/reg_scheme.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -7)},

		{TaskID: tasks[6].ID, Type: config.EvidenceTypeRegistration, Title: "三峡库区采样任务单", Description: "消落带土壤及水质监测任务", FileURL: "/files/T202401007/reg_task.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -10)},
		{TaskID: tasks[6].ID, Type: config.EvidenceTypeRegistration, Title: "点位信息", Description: "秭归茅坪镇消落带监测点分布图", FileURL: "/files/T202401007/reg_points.jpg", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -10)},

		{TaskID: tasks[7].ID, Type: config.EvidenceTypeRegistration, Title: "丹江口采样登记", Description: "水源地专项监测登记表", FileURL: "/files/T202401008/reg_form.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -9)},
		{TaskID: tasks[7].ID, Type: config.EvidenceTypeRegistration, Title: "采样现场照", Description: "取水口1#点位采样照片", FileURL: "/files/T202401008/reg_photo.jpg", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -9)},
		{TaskID: tasks[7].ID, Type: config.EvidenceTypeProcess, Title: "过程核验单", Description: "主管核验样品瓶清洗、固定剂添加、冷链保存", FileURL: "/files/T202401008/proc_checklist.pdf", UploadedBy: supervisor.Name, UploadedAt: now.AddDate(0, 0, -7)},
		{TaskID: tasks[7].ID, Type: config.EvidenceTypeProcess, Title: "实验室检测报告", Description: "金属、微生物、有机物项目原始检测报告", FileURL: "/files/T202401008/proc_lab.pdf", UploadedBy: supervisor.Name, UploadedAt: now.AddDate(0, 0, -7)},

		{TaskID: tasks[8].ID, Type: config.EvidenceTypeRegistration, Title: "清江流域采样登记", Description: "恩施城区三个断面监测信息表", FileURL: "/files/T202401009/reg_form.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -12)},

		{TaskID: tasks[9].ID, Type: config.EvidenceTypeRegistration, Title: "梁子湖水华监测方案", Description: "12个监测点位分布及监测频率", FileURL: "/files/T202401010/reg_scheme.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -15)},
		{TaskID: tasks[9].ID, Type: config.EvidenceTypeRegistration, Title: "点位照片", Description: "部分监测点现场照片（仅1个）", FileURL: "/files/T202401010/reg_photo.jpg", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -15)},
		{TaskID: tasks[9].ID, Type: config.EvidenceTypeProcess, Title: "主管核验记录", Description: "主管现场核验部分点位记录", FileURL: "/files/T202401010/proc_verify.pdf", UploadedBy: supervisor.Name, UploadedAt: now.AddDate(0, 0, -13)},
		{TaskID: tasks[9].ID, Type: config.EvidenceTypeReview, Title: "复核初步意见", Description: "复核过程中发现问题清单初稿", FileURL: "/files/T202401010/review_draft.pdf", UploadedBy: reviewer.Name, UploadedAt: now.AddDate(0, 0, -10)},

		{TaskID: tasks[10].ID, Type: config.EvidenceTypeRegistration, Title: "长湖养殖尾水登记", Description: "5个排放口采样登记表", FileURL: "/files/T202401011/reg_form.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -20)},
		{TaskID: tasks[10].ID, Type: config.EvidenceTypeRegistration, Title: "排污口备案文件", Description: "养殖企业排污口备案证复印件", FileURL: "/files/T202401011/reg_license.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -20)},
		{TaskID: tasks[10].ID, Type: config.EvidenceTypeProcess, Title: "现场核验记录", Description: "主管核验采样及样品交接全过程", FileURL: "/files/T202401011/proc_record.pdf", UploadedBy: supervisor.Name, UploadedAt: now.AddDate(0, 0, -19)},
		{TaskID: tasks[10].ID, Type: config.EvidenceTypeProcess, Title: "实验室检测报告", Description: "COD、氨氮、总磷等项目原始检测数据", FileURL: "/files/T202401011/proc_lab.pdf", UploadedBy: supervisor.Name, UploadedAt: now.AddDate(0, 0, -19)},
		{TaskID: tasks[10].ID, Type: config.EvidenceTypeReview, Title: "复核终审报告", Description: "复核负责人最终审核意见", FileURL: "/files/T202401011/review_report.pdf", UploadedBy: reviewer.Name, UploadedAt: now.AddDate(0, 0, -18)},
		{TaskID: tasks[10].ID, Type: config.EvidenceTypeReview, Title: "归档确认单", Description: "所有材料归档签字确认单", FileURL: "/files/T202401011/review_archive.pdf", UploadedBy: reviewer.Name, UploadedAt: now.AddDate(0, 0, -18)},

		{TaskID: tasks[11].ID, Type: config.EvidenceTypeRegistration, Title: "跨界断面采样登记", Description: "湘鄂联合监测采样登记表", FileURL: "/files/T202401012/reg_form.pdf", UploadedBy: registrar.Name, UploadedAt: now.AddDate(0, 0, -25)},
		{TaskID: tasks[11].ID, Type: config.EvidenceTypeProcess, Title: "联合采样核验", Description: "双方人员共同核验签字", FileURL: "/files/T202401012/proc_joint.pdf", UploadedBy: supervisor.Name, UploadedAt: now.AddDate(0, 0, -24)},
		{TaskID: tasks[11].ID, Type: config.EvidenceTypeReview, Title: "复核意见", Description: "跨界数据比对一致，同意归档", FileURL: "/files/T202401012/review_final.pdf", UploadedBy: reviewer.Name, UploadedAt: now.AddDate(0, 0, -22)},
	}

	for _, ev := range evidences {
		database.DB.Create(&ev)
	}
}

func seedTaskLogs(tasks []models.SamplingTask, registrar, supervisor, reviewer models.User) {
	now := time.Now()

	logs := []models.TaskLog{
		{TaskID: tasks[0].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务（草稿）-工业园VOC", CreatedAt: now.AddDate(0, 0, -1)},
		{TaskID: tasks[1].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务（草稿）-污水厂出水", CreatedAt: now.AddDate(0, 0, -1)},

		{TaskID: tasks[2].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务-长江武汉关断面", CreatedAt: now.AddDate(0, 0, -5)},
		{TaskID: tasks[2].ID, Action: config.ActionSubmit, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "提交主管审核", CreatedAt: now.AddDate(0, 0, -5)},

		{TaskID: tasks[3].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务-东湖水质监测", CreatedAt: now.AddDate(0, 0, -4)},
		{TaskID: tasks[3].ID, Action: config.ActionSubmit, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "提交主管审核", CreatedAt: now.AddDate(0, 0, -4)},

		{TaskID: tasks[4].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务-汉江唐白河", CreatedAt: now.AddDate(0, 0, -3)},
		{TaskID: tasks[4].ID, Action: config.ActionSubmit, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "提交主管审核", CreatedAt: now.AddDate(0, 0, -3)},

		{TaskID: tasks[5].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务-洪湖湿地", CreatedAt: now.AddDate(0, 0, -8)},
		{TaskID: tasks[5].ID, Action: config.ActionSubmit, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "提交主管审核", CreatedAt: now.AddDate(0, 0, -7)},
		{TaskID: tasks[5].ID, Action: config.ActionSupervisorReject, OperatorID: supervisor.ID, OperatorName: supervisor.Name, OperatorRole: supervisor.Role, Remark: "主管审核驳回：采样地点描述不清晰，缺少具体经纬度信息；样品编号不规范；登记证据缺失采样设备校准证书。", CreatedAt: now.AddDate(0, 0, -6)},

		{TaskID: tasks[6].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务-三峡消落带", CreatedAt: now.AddDate(0, 0, -10)},
		{TaskID: tasks[6].ID, Action: config.ActionSubmit, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "提交主管审核", CreatedAt: now.AddDate(0, 0, -10)},
		{TaskID: tasks[6].ID, Action: config.ActionSupervisorPass, OperatorID: supervisor.ID, OperatorName: supervisor.Name, OperatorRole: supervisor.Role, Remark: "主管审核通过，同意进入复核环节", CreatedAt: now.AddDate(0, 0, -8)},

		{TaskID: tasks[7].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务-丹江口水源地", CreatedAt: now.AddDate(0, 0, -9)},
		{TaskID: tasks[7].ID, Action: config.ActionSubmit, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "提交主管审核", CreatedAt: now.AddDate(0, 0, -9)},
		{TaskID: tasks[7].ID, Action: config.ActionSupervisorPass, OperatorID: supervisor.ID, OperatorName: supervisor.Name, OperatorRole: supervisor.Role, Remark: "主管审核通过，过程核验证据齐全", CreatedAt: now.AddDate(0, 0, -7)},

		{TaskID: tasks[8].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务-清江恩施段", CreatedAt: now.AddDate(0, 0, -12)},
		{TaskID: tasks[8].ID, Action: config.ActionSubmit, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "提交主管审核", CreatedAt: now.AddDate(0, 0, -12)},
		{TaskID: tasks[8].ID, Action: config.ActionSupervisorPass, OperatorID: supervisor.ID, OperatorName: supervisor.Name, OperatorRole: supervisor.Role, Remark: "主管审核通过", CreatedAt: now.AddDate(0, 0, -11)},

		{TaskID: tasks[9].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务-梁子湖水华监测", CreatedAt: now.AddDate(0, 0, -15)},
		{TaskID: tasks[9].ID, Action: config.ActionSubmit, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "提交主管审核", CreatedAt: now.AddDate(0, 0, -15)},
		{TaskID: tasks[9].ID, Action: config.ActionSupervisorPass, OperatorID: supervisor.ID, OperatorName: supervisor.Name, OperatorRole: supervisor.Role, Remark: "主管审核通过", CreatedAt: now.AddDate(0, 0, -13)},
		{TaskID: tasks[9].ID, Action: config.ActionReviewerReturn, OperatorID: reviewer.ID, OperatorName: reviewer.Name, OperatorRole: reviewer.Role, Remark: "复核退回：1）过程核验证据不足，仅1个点位有现场核验照片；2）采样记录缺少采样人员签字和气象条件；3）叶绿素a检测缺少原始分光光度读数。请补充完善后重新提交。", CreatedAt: now.AddDate(0, 0, -10)},

		{TaskID: tasks[10].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务-长湖养殖尾水", CreatedAt: now.AddDate(0, 0, -20)},
		{TaskID: tasks[10].ID, Action: config.ActionSubmit, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "提交主管审核", CreatedAt: now.AddDate(0, 0, -20)},
		{TaskID: tasks[10].ID, Action: config.ActionSupervisorPass, OperatorID: supervisor.ID, OperatorName: supervisor.Name, OperatorRole: supervisor.Role, Remark: "主管审核通过，证据链完整", CreatedAt: now.AddDate(0, 0, -19)},
		{TaskID: tasks[10].ID, Action: config.ActionReviewerApprove, OperatorID: reviewer.ID, OperatorName: reviewer.Name, OperatorRole: reviewer.Role, Remark: "复核通过，完成归档", CreatedAt: now.AddDate(0, 0, -18)},

		{TaskID: tasks[11].ID, Action: config.ActionCreate, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "创建采样任务-黄盖湖跨界监测", CreatedAt: now.AddDate(0, 0, -25)},
		{TaskID: tasks[11].ID, Action: config.ActionSubmit, OperatorID: registrar.ID, OperatorName: registrar.Name, OperatorRole: registrar.Role, Remark: "提交主管审核", CreatedAt: now.AddDate(0, 0, -25)},
		{TaskID: tasks[11].ID, Action: config.ActionSupervisorPass, OperatorID: supervisor.ID, OperatorName: supervisor.Name, OperatorRole: supervisor.Role, Remark: "主管审核通过，联合采样证据齐全", CreatedAt: now.AddDate(0, 0, -24)},
		{TaskID: tasks[11].ID, Action: config.ActionReviewerApprove, OperatorID: reviewer.ID, OperatorName: reviewer.Name, OperatorRole: reviewer.Role, Remark: "复核通过，跨界数据比对一致，完成归档", CreatedAt: now.AddDate(0, 0, -22)},
	}

	for _, log := range logs {
		database.DB.Create(&log)
	}
}
