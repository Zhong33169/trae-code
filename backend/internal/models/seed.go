package models

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

func SeedIfEmpty() error {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	users := []User{
		{ID: "u001", Name: "张登记员", Role: RoleRegistrar, RoleName: "会诊申请登记员", Dept: "门诊登记处"},
		{ID: "u002", Name: "李登记员", Role: RoleRegistrar, RoleName: "会诊申请登记员", Dept: "住院登记处"},
		{ID: "u003", Name: "王主管", Role: RoleReviewer, RoleName: "会诊申请审核主管", Dept: "医务部审核组"},
		{ID: "u004", Name: "赵主管", Role: RoleReviewer, RoleName: "会诊申请审核主管", Dept: "医务部审核组"},
		{ID: "u005", Name: "陈主任", Role: RoleDirector, RoleName: "医务部复核负责人", Dept: "医务部"},
		{ID: "u006", Name: "刘主任", Role: RoleDirector, RoleName: "医务部复核负责人", Dept: "医务部"},
	}

	for _, u := range users {
		_, err := tx.Exec(
			"INSERT INTO users (id, name, role, role_name, dept) VALUES (?, ?, ?, ?, ?)",
			u.ID, u.Name, u.Role, u.RoleName, u.Dept,
		)
		if err != nil {
			return err
		}
	}

	now := time.Now()
	consultations := []struct {
		c          Consultation
		history    []HistoryRecord
	}{
		{
			c: Consultation{
				ID:              "c001",
				Title:           "心内科疑难病例会诊",
				PatientName:     "王建国",
				PatientID:       "P20240001",
				Dept:            "心内科",
				ChiefComplaint:  "反复胸痛3月，加重1周",
				ConsultType:     "科间会诊",
				ConsultDept:     "心外科",
				Status:          StatusArchived,
				StatusName:      "已归档",
				Version:         3,
				RegistrarID:     "u001",
				RegistrarName:   "张登记员",
				ReviewerID:      "u003",
				ReviewerName:    "王主管",
				DirectorID:      "u005",
				DirectorName:    "陈主任",
				LatestOpinion:   "复核通过，同意归档。病例资料完整，会诊指征明确。",
				EvidenceList:    "病历记录,心电图,心脏彩超,冠脉CTA,实验室检查",
				HasAppeal:       false,
				Deadline:        now.AddDate(0, 0, 7),
				CreatedAt:       now.AddDate(0, 0, -10),
				UpdatedAt:       now.AddDate(0, 0, -2),
			},
			history: []HistoryRecord{
				{
					ID: "h001", ConsultationID: "c001",
					OperatorID: "u001", OperatorName: "张登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "create", ActionName: "创建申请单",
					FromStatus: "", FromStatusName: "", ToStatus: StatusDraft, ToStatusName: "草稿",
					Version: 1, CreatedAt: now.AddDate(0, 0, -10),
				},
				{
					ID: "h002", ConsultationID: "c001",
					OperatorID: "u001", OperatorName: "张登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "submit", ActionName: "提交申请",
					FromStatus: StatusDraft, FromStatusName: "草稿", ToStatus: StatusSubmitted, ToStatusName: "已提交",
					Opinion: "资料齐全，提交审核。",
					Version: 1, CreatedAt: now.AddDate(0, 0, -9),
				},
				{
					ID: "h003", ConsultationID: "c001",
					OperatorID: "u003", OperatorName: "王主管", OperatorRole: RoleReviewer, OperatorRoleName: "会诊申请审核主管",
					Action: "review_pass", ActionName: "审核通过",
					FromStatus: StatusSubmitted, FromStatusName: "已提交", ToStatus: StatusReviewPassed, ToStatusName: "审核通过",
					Opinion: "病例资料完整，会诊指征明确，同意提交医务部复核。",
					Version: 2, CreatedAt: now.AddDate(0, 0, -5),
				},
				{
					ID: "h004", ConsultationID: "c001",
					OperatorID: "u005", OperatorName: "陈主任", OperatorRole: RoleDirector, OperatorRoleName: "医务部复核负责人",
					Action: "archive", ActionName: "复核归档",
					FromStatus: StatusReviewPassed, FromStatusName: "审核通过", ToStatus: StatusArchived, ToStatusName: "已归档",
					Opinion: "复核通过，同意归档。病例资料完整，会诊指征明确。",
					Version: 3, CreatedAt: now.AddDate(0, 0, -2),
				},
			},
		},
		{
			c: Consultation{
				ID:              "c002",
				Title:           "神经内科重症患者多学科会诊",
				PatientName:     "李小明",
				PatientID:       "P20240002",
				Dept:            "神经内科",
				ChiefComplaint:  "突发意识障碍伴右侧肢体无力",
				ConsultType:     "多学科会诊",
				ConsultDept:     "神经外科+影像科+康复科",
				Status:          StatusCorrectionReq,
				StatusName:      "退回补正",
				Version:         2,
				RegistrarID:     "u002",
				RegistrarName:   "李登记员",
				ReviewerID:      "u004",
				ReviewerName:    "赵主管",
				LatestOpinion:   "",
				LatestRejectReason: "缺少头颅MRI弥散加权成像报告及凝血功能全套检查结果，请补充后重新提交。",
				EvidenceList:    "病历记录,头颅CT,血常规",
				HasAppeal:       false,
				Deadline:        now.AddDate(0, 0, 2),
				CreatedAt:       now.AddDate(0, 0, -7),
				UpdatedAt:       now.AddDate(0, 0, -1),
			},
			history: []HistoryRecord{
				{
					ID: "h005", ConsultationID: "c002",
					OperatorID: "u002", OperatorName: "李登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "create", ActionName: "创建申请单",
					FromStatus: "", FromStatusName: "", ToStatus: StatusDraft, ToStatusName: "草稿",
					Version: 1, CreatedAt: now.AddDate(0, 0, -7),
				},
				{
					ID: "h006", ConsultationID: "c002",
					OperatorID: "u002", OperatorName: "李登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "submit", ActionName: "提交申请",
					FromStatus: StatusDraft, FromStatusName: "草稿", ToStatus: StatusSubmitted, ToStatusName: "已提交",
					Opinion: "重症患者，加急处理。",
					Version: 1, CreatedAt: now.AddDate(0, 0, -6),
				},
				{
					ID: "h007", ConsultationID: "c002",
					OperatorID: "u004", OperatorName: "赵主管", OperatorRole: RoleReviewer, OperatorRoleName: "会诊申请审核主管",
					Action: "reject_correction", ActionName: "退回补正",
					FromStatus: StatusSubmitted, FromStatusName: "已提交", ToStatus: StatusCorrectionReq, ToStatusName: "退回补正",
					RejectReason: "缺少头颅MRI弥散加权成像报告及凝血功能全套检查结果，请补充后重新提交。",
					Version: 2, CreatedAt: now.AddDate(0, 0, -1),
				},
			},
		},
		{
			c: Consultation{
				ID:              "c003",
				Title:           "呼吸科发热待查患者会诊",
				PatientName:     "赵秀兰",
				PatientID:       "P20240003",
				Dept:            "呼吸内科",
				ChiefComplaint:  "持续发热2周，咳嗽咳痰",
				ConsultType:     "科间会诊",
				ConsultDept:     "感染科",
				Status:          StatusEvidenceMissing,
				StatusName:      "缺证据",
				Version:         2,
				RegistrarID:     "u001",
				RegistrarName:   "张登记员",
				ReviewerID:      "u003",
				ReviewerName:    "王主管",
				LatestOpinion:   "",
				LatestRejectReason: "缺少血培养结果及降钙素原检查，无法明确感染指征。",
				EvidenceList:    "病历记录,胸部CT,血常规,CRP",
				IsOverdue:       false,
				HasAppeal:       true,
				AppealStatus:    StatusAppealSubmitted,
				AppealStatusName: "申诉已提交",
				AppealReason:    "患者目前临床症状典型，虽血培养暂未回报，但结合影像学及炎症指标可先行会诊。血培养预计48小时内回报，后续可补充。申请加急安排会诊。",
				Deadline:        now.AddDate(0, 0, 3),
				CreatedAt:       now.AddDate(0, 0, -6),
				UpdatedAt:       now.AddDate(0, 0, -1),
			},
			history: []HistoryRecord{
				{
					ID: "h008", ConsultationID: "c003",
					OperatorID: "u001", OperatorName: "张登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "create", ActionName: "创建申请单",
					FromStatus: "", FromStatusName: "", ToStatus: StatusDraft, ToStatusName: "草稿",
					Version: 1, CreatedAt: now.AddDate(0, 0, -6),
				},
				{
					ID: "h009", ConsultationID: "c003",
					OperatorID: "u001", OperatorName: "张登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "submit", ActionName: "提交申请",
					FromStatus: StatusDraft, FromStatusName: "草稿", ToStatus: StatusSubmitted, ToStatusName: "已提交",
					Opinion: "发热原因待查，申请感染科会诊。",
					Version: 1, CreatedAt: now.AddDate(0, 0, -5),
				},
				{
					ID: "h010", ConsultationID: "c003",
					OperatorID: "u003", OperatorName: "王主管", OperatorRole: RoleReviewer, OperatorRoleName: "会诊申请审核主管",
					Action: "evidence_missing", ActionName: "证据不足",
					FromStatus: StatusSubmitted, FromStatusName: "已提交", ToStatus: StatusEvidenceMissing, ToStatusName: "缺证据",
					RejectReason: "缺少血培养结果及降钙素原检查，无法明确感染指征。",
					Version: 2, CreatedAt: now.AddDate(0, 0, -3),
				},
				{
					ID: "h011", ConsultationID: "c003",
					OperatorID: "u001", OperatorName: "张登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "appeal_submit", ActionName: "提交申诉",
					FromStatus: StatusEvidenceMissing, FromStatusName: "缺证据", ToStatus: StatusAppealSubmitted, ToStatusName: "申诉已提交",
					Opinion: "患者目前临床症状典型，虽血培养暂未回报，但结合影像学及炎症指标可先行会诊。血培养预计48小时内回报，后续可补充。申请加急安排会诊。",
					Version: 2, CreatedAt: now.AddDate(0, 0, -1),
				},
			},
		},
		{
			c: Consultation{
				ID:              "c004",
				Title:           "骨科术后并发症会诊",
				PatientName:     "孙大伟",
				PatientID:       "P20240004",
				Dept:            "骨科",
				ChiefComplaint:  "左股骨骨折术后伤口不愈合",
				ConsultType:     "科间会诊",
				ConsultDept:     "整形外科",
				Status:          StatusReviewPassed,
				StatusName:      "审核通过",
				Version:         3,
				RegistrarID:     "u002",
				RegistrarName:   "李登记员",
				ReviewerID:      "u004",
				ReviewerName:    "赵主管",
				LatestOpinion:   "审核通过，资料齐全，同意提交医务部复核归档。",
				EvidenceList:    "病历记录,手术记录,伤口照片,实验室检查,X线片",
				HasAppeal:       false,
				Deadline:        now.AddDate(0, 0, 5),
				CreatedAt:       now.AddDate(0, 0, -8),
				UpdatedAt:       now.AddDate(0, 0, -1),
			},
			history: []HistoryRecord{
				{
					ID: "h012", ConsultationID: "c004",
					OperatorID: "u002", OperatorName: "李登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "create", ActionName: "创建申请单",
					FromStatus: "", FromStatusName: "", ToStatus: StatusDraft, ToStatusName: "草稿",
					Version: 1, CreatedAt: now.AddDate(0, 0, -8),
				},
				{
					ID: "h013", ConsultationID: "c004",
					OperatorID: "u002", OperatorName: "李登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "submit", ActionName: "提交申请",
					FromStatus: StatusDraft, FromStatusName: "草稿", ToStatus: StatusSubmitted, ToStatusName: "已提交",
					Opinion: "术后伤口不愈合，申请整形外科会诊。",
					Version: 1, CreatedAt: now.AddDate(0, 0, -7),
				},
				{
					ID: "h014", ConsultationID: "c004",
					OperatorID: "u004", OperatorName: "赵主管", OperatorRole: RoleReviewer, OperatorRoleName: "会诊申请审核主管",
					Action: "reject_correction", ActionName: "退回补正",
					FromStatus: StatusSubmitted, FromStatusName: "已提交", ToStatus: StatusCorrectionReq, ToStatusName: "退回补正",
					RejectReason: "缺少伤口近期彩色照片及细菌培养药敏结果，请补充。",
					Version: 2, CreatedAt: now.AddDate(0, 0, -5),
				},
				{
					ID: "h015", ConsultationID: "c004",
					OperatorID: "u002", OperatorName: "李登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "resubmit", ActionName: "补正重提",
					FromStatus: StatusCorrectionReq, FromStatusName: "退回补正", ToStatus: StatusResubmitted, ToStatusName: "再次提交",
					Opinion: "已补充伤口彩色照片和细菌培养报告，请审核。",
					Version: 2, CreatedAt: now.AddDate(0, 0, -3),
				},
				{
					ID: "h016", ConsultationID: "c004",
					OperatorID: "u004", OperatorName: "赵主管", OperatorRole: RoleReviewer, OperatorRoleName: "会诊申请审核主管",
					Action: "review_pass", ActionName: "审核通过",
					FromStatus: StatusResubmitted, FromStatusName: "再次提交", ToStatus: StatusReviewPassed, ToStatusName: "审核通过",
					Opinion: "审核通过，资料齐全，同意提交医务部复核归档。",
					Version: 3, CreatedAt: now.AddDate(0, 0, -1),
				},
			},
		},
		{
			c: Consultation{
				ID:              "c005",
				Title:           "消化科消化道出血急诊会诊",
				PatientName:     "周富贵",
				PatientID:       "P20240005",
				Dept:            "消化内科",
				ChiefComplaint:  "呕血黑便2天",
				ConsultType:     "急诊会诊",
				ConsultDept:     "胃肠外科",
				Status:          StatusUnderFinal,
				StatusName:      "复核中",
				Version:         2,
				RegistrarID:     "u001",
				RegistrarName:   "张登记员",
				ReviewerID:      "u003",
				ReviewerName:    "王主管",
				DirectorID:      "u006",
				DirectorName:    "刘主任",
				LatestOpinion:   "急诊病例，已紧急审核通过，请医务部加急复核。",
				EvidenceList:    "病历记录,急诊胃镜报告,血常规,凝血功能,腹部CT",
				IsOverdue:       false,
				HasAppeal:       false,
				Deadline:        now.AddDate(0, 0, 1),
				CreatedAt:       now.AddDate(0, 0, -3),
				UpdatedAt:       now.AddDate(0, 0, -1),
			},
			history: []HistoryRecord{
				{
					ID: "h017", ConsultationID: "c005",
					OperatorID: "u001", OperatorName: "张登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "create", ActionName: "创建申请单",
					FromStatus: "", FromStatusName: "", ToStatus: StatusDraft, ToStatusName: "草稿",
					Version: 1, CreatedAt: now.AddDate(0, 0, -3),
				},
				{
					ID: "h018", ConsultationID: "c005",
					OperatorID: "u001", OperatorName: "张登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "submit", ActionName: "提交申请",
					FromStatus: StatusDraft, FromStatusName: "草稿", ToStatus: StatusSubmitted, ToStatusName: "已提交",
					Opinion: "急诊病例，消化道大出血，请加急处理。",
					Version: 1, CreatedAt: now.AddDate(0, 0, -3),
				},
				{
					ID: "h019", ConsultationID: "c005",
					OperatorID: "u003", OperatorName: "王主管", OperatorRole: RoleReviewer, OperatorRoleName: "会诊申请审核主管",
					Action: "review_pass", ActionName: "审核通过",
					FromStatus: StatusSubmitted, FromStatusName: "已提交", ToStatus: StatusReviewPassed, ToStatusName: "审核通过",
					Opinion: "急诊病例，已紧急审核通过，请医务部加急复核。",
					Version: 2, CreatedAt: now.AddDate(0, 0, -2),
				},
				{
					ID: "h020", ConsultationID: "c005",
					OperatorID: "u006", OperatorName: "刘主任", OperatorRole: RoleDirector, OperatorRoleName: "医务部复核负责人",
					Action: "start_final", ActionName: "开始复核",
					FromStatus: StatusReviewPassed, FromStatusName: "审核通过", ToStatus: StatusUnderFinal, ToStatusName: "复核中",
					Opinion: "正在复核中...",
					Version: 2, CreatedAt: now.AddDate(0, 0, -1),
				},
			},
		},
		{
			c: Consultation{
				ID:              "c006",
				Title:           "内分泌科糖尿病足会诊",
				PatientName:     "吴桂芳",
				PatientID:       "P20240006",
				Dept:            "内分泌科",
				ChiefComplaint:  "左足破溃1月，伴发热3天",
				ConsultType:     "多学科会诊",
				ConsultDept:     "血管外科+骨科+创面修复科",
				Status:          StatusOverdue,
				StatusName:      "逾期",
				Version:         1,
				RegistrarID:     "u002",
				RegistrarName:   "李登记员",
				LatestOpinion:   "",
				EvidenceList:    "病历记录,血糖监测,下肢血管彩超",
				IsOverdue:       true,
				HasAppeal:       false,
				Deadline:        now.AddDate(0, 0, -2),
				CreatedAt:       now.AddDate(0, 0, -10),
				UpdatedAt:       now.AddDate(0, 0, -10),
			},
			history: []HistoryRecord{
				{
					ID: "h021", ConsultationID: "c006",
					OperatorID: "u002", OperatorName: "李登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "create", ActionName: "创建申请单",
					FromStatus: "", FromStatusName: "", ToStatus: StatusDraft, ToStatusName: "草稿",
					Version: 1, CreatedAt: now.AddDate(0, 0, -10),
				},
			},
		},
		{
			c: Consultation{
				ID:              "c007",
				Title:           "肾内科尿毒症患者肾移植前评估会诊",
				PatientName:     "郑建设",
				PatientID:       "P20240007",
				Dept:            "肾内科",
				ChiefComplaint:  "维持性血液透析5年，拟肾移植评估",
				ConsultType:     "多学科会诊",
				ConsultDept:     "泌尿外科+移植科+心内科+麻醉科",
				Status:          StatusAppealAccepted,
				StatusName:      "申诉已受理",
				Version:         4,
				RegistrarID:     "u001",
				RegistrarName:   "张登记员",
				ReviewerID:      "u003",
				ReviewerName:    "王主管",
				DirectorID:      "u005",
				DirectorName:    "陈主任",
				LatestOpinion:   "复核中发现患者已于3日前转入ICU，原申请科室与当前所在科室不一致，存在状态冲突，需核实。",
				LatestRejectReason: "状态冲突：患者已转入ICU，原申请科室信息与实际情况不符，请核实患者当前状态后重新提交。",
				EvidenceList:    "病历记录,肾功能检查,透析记录,血型配型,心脏超声",
				HasAppeal:       true,
				AppealStatus:    StatusAppealAccepted,
				AppealStatusName: "申诉已受理",
				AppealReason:    "患者虽已转入ICU，但肾移植评估工作仍需继续推进，多学科会诊仍有必要。建议重新评估状态冲突问题。",
				Deadline:        now.AddDate(0, 0, 4),
				CreatedAt:       now.AddDate(0, 0, -12),
				UpdatedAt:       now.AddDate(0, 0, -1),
			},
			history: []HistoryRecord{
				{
					ID: "h022", ConsultationID: "c007",
					OperatorID: "u001", OperatorName: "张登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "create", ActionName: "创建申请单",
					FromStatus: "", FromStatusName: "", ToStatus: StatusDraft, ToStatusName: "草稿",
					Version: 1, CreatedAt: now.AddDate(0, 0, -12),
				},
				{
					ID: "h023", ConsultationID: "c007",
					OperatorID: "u001", OperatorName: "张登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "submit", ActionName: "提交申请",
					FromStatus: StatusDraft, FromStatusName: "草稿", ToStatus: StatusSubmitted, ToStatusName: "已提交",
					Opinion: "肾移植前多学科评估会诊。",
					Version: 1, CreatedAt: now.AddDate(0, 0, -11),
				},
				{
					ID: "h024", ConsultationID: "c007",
					OperatorID: "u003", OperatorName: "王主管", OperatorRole: RoleReviewer, OperatorRoleName: "会诊申请审核主管",
					Action: "review_pass", ActionName: "审核通过",
					FromStatus: StatusSubmitted, FromStatusName: "已提交", ToStatus: StatusReviewPassed, ToStatusName: "审核通过",
					Opinion: "资料齐全，符合肾移植前多学科评估指征。",
					Version: 2, CreatedAt: now.AddDate(0, 0, -8),
				},
				{
					ID: "h025", ConsultationID: "c007",
					OperatorID: "u005", OperatorName: "陈主任", OperatorRole: RoleDirector, OperatorRoleName: "医务部复核负责人",
					Action: "conflict", ActionName: "状态冲突",
					FromStatus: StatusReviewPassed, FromStatusName: "审核通过", ToStatus: StatusConflict, ToStatusName: "状态冲突",
					Opinion: "复核中发现患者已于3日前转入ICU，原申请科室与当前所在科室不一致，存在状态冲突，需核实。",
					RejectReason: "状态冲突：患者已转入ICU，原申请科室信息与实际情况不符，请核实患者当前状态后重新提交。",
					Version: 3, CreatedAt: now.AddDate(0, 0, -4),
				},
				{
					ID: "h026", ConsultationID: "c007",
					OperatorID: "u001", OperatorName: "张登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "appeal_submit", ActionName: "提交申诉",
					FromStatus: StatusConflict, FromStatusName: "状态冲突", ToStatus: StatusAppealSubmitted, ToStatusName: "申诉已提交",
					Opinion: "患者虽已转入ICU，但肾移植评估工作仍需继续推进，多学科会诊仍有必要。建议重新评估状态冲突问题。",
					Version: 3, CreatedAt: now.AddDate(0, 0, -2),
				},
				{
					ID: "h027", ConsultationID: "c007",
					OperatorID: "u005", OperatorName: "陈主任", OperatorRole: RoleDirector, OperatorRoleName: "医务部复核负责人",
					Action: "appeal_accept", ActionName: "受理申诉",
					FromStatus: StatusAppealSubmitted, FromStatusName: "申诉已提交", ToStatus: StatusAppealAccepted, ToStatusName: "申诉已受理",
					Opinion: "已受理申诉，将协调相关科室核实患者状态后重新处理。",
					Version: 4, CreatedAt: now.AddDate(0, 0, -1),
				},
			},
		},
		{
			c: Consultation{
				ID:              "c008",
				Title:           "儿科重症肺炎会诊",
				PatientName:     "钱小宝",
				PatientID:       "P20240008",
				Dept:            "儿科",
				ChiefComplaint:  "发热咳嗽5天，气促1天",
				ConsultType:     "科间会诊",
				ConsultDept:     "儿童重症医学科",
				Status:          StatusDraft,
				StatusName:      "草稿",
				Version:         1,
				RegistrarID:     "u002",
				RegistrarName:   "李登记员",
				LatestOpinion:   "",
				EvidenceList:    "病历记录,胸片,血常规",
				HasAppeal:       false,
				Deadline:        now.AddDate(0, 0, 5),
				CreatedAt:       now.AddDate(0, 0, -1),
				UpdatedAt:       now.AddDate(0, 0, -1),
			},
			history: []HistoryRecord{
				{
					ID: "h028", ConsultationID: "c008",
					OperatorID: "u002", OperatorName: "李登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "create", ActionName: "创建申请单",
					FromStatus: "", FromStatusName: "", ToStatus: StatusDraft, ToStatusName: "草稿",
					Version: 1, CreatedAt: now.AddDate(0, 0, -1),
				},
			},
		},
		{
			c: Consultation{
				ID:              "c009",
				Title:           "骨科疑难病例会诊申诉复核",
				PatientName:     "孙建国",
				PatientID:       "P20240009",
				Dept:            "骨科",
				ChiefComplaint:  "右髋关节疼痛伴活动受限2月",
				ConsultType:     "科间会诊",
				ConsultDept:     "骨关节科",
				Status:          StatusArchived,
				StatusName:      "已归档",
				Version:         9,
				RegistrarID:     "u001",
				RegistrarName:   "张登记员",
				ReviewerID:      "u003",
				ReviewerName:    "王主管",
				DirectorID:      "u005",
				DirectorName:    "陈主任",
				LatestOpinion:   "补正后资料完整，符合会诊要求，予以归档",
				EvidenceList:    "病历记录,实验室检查,影像学检查(MRI),体格检查",
				HasAppeal:       true,
				AppealStatus:    StatusAppealResolved,
				AppealStatusName: "申诉已解决",
				AppealReason:    "患者近一周疼痛加剧，影响行走功能，MRI显示关节积液增多，需骨关节科会诊明确治疗方案",
				Deadline:        now.AddDate(0, 0, -1),
				CreatedAt:       now.AddDate(0, 0, -10),
				UpdatedAt:       now.AddDate(0, 0, -1),
			},
			history: []HistoryRecord{
				{
					ID: "h029", ConsultationID: "c009",
					OperatorID: "u001", OperatorName: "张登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "create", ActionName: "创建申请单",
					FromStatus: "", FromStatusName: "", ToStatus: StatusDraft, ToStatusName: "草稿",
					Version: 1, CreatedAt: now.AddDate(0, 0, -10),
				},
				{
					ID: "h030", ConsultationID: "c009",
					OperatorID: "u001", OperatorName: "张登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "submit", ActionName: "提交申请",
					FromStatus: StatusDraft, FromStatusName: "草稿", ToStatus: StatusSubmitted, ToStatusName: "已提交",
					Opinion: "申请资料已备齐，请审核",
					Version: 2, CreatedAt: now.AddDate(0, 0, -9),
				},
				{
					ID: "h031", ConsultationID: "c009",
					OperatorID: "u003", OperatorName: "王主管", OperatorRole: RoleReviewer, OperatorRoleName: "会诊申请审核主管",
					Action: "review_pass", ActionName: "审核通过",
					FromStatus: StatusSubmitted, FromStatusName: "已提交", ToStatus: StatusReviewPassed, ToStatusName: "审核通过",
					Opinion: "资料齐全，符合会诊条件",
					Version: 3, CreatedAt: now.AddDate(0, 0, -8),
				},
				{
					ID: "h032", ConsultationID: "c009",
					OperatorID: "u005", OperatorName: "陈主任", OperatorRole: RoleDirector, OperatorRoleName: "医务部复核负责人",
					Action: "final_reject", ActionName: "复核驳回",
					FromStatus: StatusReviewPassed, FromStatusName: "审核通过", ToStatus: StatusRejected, ToStatusName: "已驳回",
					Opinion: "会诊必要性存疑",
					RejectReason: "患者症状较轻，保守治疗即可，暂无需科间会诊",
					Version: 4, CreatedAt: now.AddDate(0, 0, -7),
				},
				{
					ID: "h033", ConsultationID: "c009",
					OperatorID: "u001", OperatorName: "张登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "appeal_submit", ActionName: "提交申诉",
					FromStatus: StatusRejected, FromStatusName: "已驳回", ToStatus: StatusAppealSubmitted, ToStatusName: "申诉待受理",
					Opinion: "患者近一周疼痛加剧，影响行走功能，MRI显示关节积液增多，需骨关节科会诊明确治疗方案",
					Version: 5, CreatedAt: now.AddDate(0, 0, -6),
				},
				{
					ID: "h034", ConsultationID: "c009",
					OperatorID: "u005", OperatorName: "陈主任", OperatorRole: RoleDirector, OperatorRoleName: "医务部复核负责人",
					Action: "appeal_accept", ActionName: "受理申诉",
					FromStatus: StatusAppealSubmitted, FromStatusName: "申诉待受理", ToStatus: StatusAppealAccepted, ToStatusName: "申诉已受理",
					Opinion: "申诉理由充分，予以受理，重新核实",
					Version: 6, CreatedAt: now.AddDate(0, 0, -5),
				},
				{
					ID: "h035", ConsultationID: "c009",
					OperatorID: "u005", OperatorName: "陈主任", OperatorRole: RoleDirector, OperatorRoleName: "医务部复核负责人",
					Action: "recheck_reject_correction", ActionName: "核实退回补正",
					FromStatus: StatusAppealAccepted, FromStatusName: "申诉已受理", ToStatus: StatusCorrectionReq, ToStatusName: "退回补正",
					Opinion: "需补充相关检查报告",
					RejectReason: "申诉材料中缺少最新的实验室检查结果和体格检查记录，请补充后重新提交",
					Version: 7, CreatedAt: now.AddDate(0, 0, -4),
				},
				{
					ID: "h036", ConsultationID: "c009",
					OperatorID: "u001", OperatorName: "张登记员", OperatorRole: RoleRegistrar, OperatorRoleName: "会诊申请登记员",
					Action: "correct", ActionName: "补正资料",
					FromStatus: StatusCorrectionReq, FromStatusName: "退回补正", ToStatus: StatusResubmitted, ToStatusName: "补正重提",
					Opinion: "已补充实验室检查和体格检查记录",
					Version: 8, CreatedAt: now.AddDate(0, 0, -2),
				},
				{
					ID: "h037", ConsultationID: "c009",
					OperatorID: "u003", OperatorName: "王主管", OperatorRole: RoleReviewer, OperatorRoleName: "会诊申请审核主管",
					Action: "review_pass", ActionName: "审核通过",
					FromStatus: StatusResubmitted, FromStatusName: "补正重提", ToStatus: StatusReviewPassed, ToStatusName: "审核通过",
					Opinion: "补正后资料齐全，符合会诊条件",
					Version: 9, CreatedAt: now.AddDate(0, 0, -1),
				},
				{
					ID: "h038", ConsultationID: "c009",
					OperatorID: "u005", OperatorName: "陈主任", OperatorRole: RoleDirector, OperatorRoleName: "医务部复核负责人",
					Action: "archive", ActionName: "复核归档",
					FromStatus: StatusReviewPassed, FromStatusName: "审核通过", ToStatus: StatusArchived, ToStatusName: "已归档",
					Opinion: "补正后资料完整，符合会诊要求，予以归档",
					Version: 9, CreatedAt: now.AddDate(0, 0, -1),
				},
			},
		},
		{
			c: Consultation{
				ID: "c010", Title: "发热查因多学科会诊申请", PatientName: "孙九", PatientID: "P2024010",
				Dept: "呼吸内科", ChiefComplaint: "反复发热10天，伴咳嗽咳痰",
				ConsultType: "多学科会诊", ConsultDept: "感染科、血液科、风湿免疫科",
				Status: StatusReviewPassed, StatusName: "审核通过", Version: 3,
				RegistrarID: "u001", RegistrarName: "李登记",
				ReviewerID: "u003", ReviewerName: "王主管",
				LatestOpinion: "资料齐全，建议安排多学科会诊",
				EvidenceList:  "病历记录,实验室检查,影像学检查,痰培养,血培养",
				IsOverdue:     false,
				HasAppeal:     false,
				CreatedAt:     now.AddDate(0, 0, -2),
				UpdatedAt:     now.AddDate(0, 0, -1).Add(-time.Hour),
			},
			history: []HistoryRecord{
				{
					ID: "h039", ConsultationID: "c010",
					OperatorID: "u001", OperatorName: "李登记", OperatorRole: RoleRegistrar, OperatorRoleName: "登记员",
					Action: "create", ActionName: "创建申请单",
					FromStatus: "", FromStatusName: "", ToStatus: StatusDraft, ToStatusName: "草稿",
					Opinion: "初步填写申请单信息",
					Version: 1, CreatedAt: now.AddDate(0, 0, -2),
				},
				{
					ID: "h040", ConsultationID: "c010",
					OperatorID: "u001", OperatorName: "李登记", OperatorRole: RoleRegistrar, OperatorRoleName: "登记员",
					Action: "fail_submit", ActionName: "[失败]提交申请",
					FromStatus: StatusDraft, FromStatusName: "草稿", ToStatus: StatusDraft, ToStatusName: "草稿",
					Opinion:      "首次申请提交，请审核",
					RejectReason: "必填证据缺失：缺少「实验室检查」，请补充后再提交",
					Version: 1, CreatedAt: now.AddDate(0, 0, -2).Add(2 * time.Hour),
				},
				{
					ID: "h041", ConsultationID: "c010",
					OperatorID: "u001", OperatorName: "李登记", OperatorRole: RoleRegistrar, OperatorRoleName: "登记员",
					Action: "fail_submit", ActionName: "[失败]提交申请",
					FromStatus: StatusDraft, FromStatusName: "草稿", ToStatus: StatusDraft, ToStatusName: "草稿",
					Opinion:      "补充了实验室检查结果，再次提交",
					RejectReason: "版本冲突：当前版本已不是最新版本，请刷新后重试",
					Version: 1, CreatedAt: now.AddDate(0, 0, -2).Add(3 * time.Hour),
				},
				{
					ID: "h042", ConsultationID: "c010",
					OperatorID: "u001", OperatorName: "李登记", OperatorRole: RoleRegistrar, OperatorRoleName: "登记员",
					Action: "submit", ActionName: "提交申请",
					FromStatus: StatusDraft, FromStatusName: "草稿", ToStatus: StatusSubmitted, ToStatusName: "待审核",
					Opinion: "补充完整检查资料后正式提交",
					Version: 2, CreatedAt: now.AddDate(0, 0, -2).Add(4 * time.Hour),
				},
				{
					ID: "h043", ConsultationID: "c010",
					OperatorID: "u003", OperatorName: "王主管", OperatorRole: RoleReviewer, OperatorRoleName: "审核主管",
					Action: "review_pass", ActionName: "审核通过",
					FromStatus: StatusSubmitted, FromStatusName: "待审核", ToStatus: StatusReviewPassed, ToStatusName: "审核通过",
					Opinion: "资料齐全，建议安排多学科会诊",
					Version: 3, CreatedAt: now.AddDate(0, 0, -1).Add(-2 * time.Hour),
				},
				{
					ID: "h044", ConsultationID: "c010",
					OperatorID: "u003", OperatorName: "王主管", OperatorRole: RoleReviewer, OperatorRoleName: "审核主管",
					Action: "fail_review", ActionName: "[失败]审核通过",
					FromStatus: StatusSubmitted, FromStatusName: "待审核", ToStatus: StatusSubmitted, ToStatusName: "待审核",
					Opinion:      "再次尝试审核通过",
					RejectReason: "状态错误：当前状态不是待审核状态，无法执行此操作",
					Version: 3, CreatedAt: now.AddDate(0, 0, -1).Add(-time.Hour),
				},
			},
		},
		{
			c: Consultation{
				ID: "c011", Title: "右髋关节置换术后康复会诊申请", PatientName: "周十", PatientID: "P2024011",
				Dept: "骨科", ChiefComplaint: "右髋关节置换术后疼痛，活动受限",
				ConsultType: "科间会诊", ConsultDept: "康复医学科",
				Status: StatusAppealSubmitted, StatusName: "申诉待受理", Version: 4,
				RegistrarID: "u002", RegistrarName: "张登记",
				ReviewerID: "u004", ReviewerName: "李主管",
				LatestOpinion: "对证据不足的判定有异议，申请重新复核",
				LatestRejectReason: "缺少术后影像学复查资料，证据不足",
				EvidenceList: "病历记录,实验室检查,手术记录,知情同意书",
				IsOverdue: false,
				HasAppeal: true,
				AppealStatus: StatusAppealSubmitted, AppealStatusName: "申诉待受理",
				AppealReason: "患者术后影像学资料已在病历系统中存档，只是未打印附在申请单后，请求调阅电子病历核实",
				CreatedAt: now.AddDate(0, 0, -3),
				UpdatedAt: now.AddDate(0, 0, -1).Add(time.Hour),
			},
			history: []HistoryRecord{
				{
					ID: "h045", ConsultationID: "c011",
					OperatorID: "u002", OperatorName: "张登记", OperatorRole: RoleRegistrar, OperatorRoleName: "登记员",
					Action: "create", ActionName: "创建申请单",
					FromStatus: "", FromStatusName: "", ToStatus: StatusDraft, ToStatusName: "草稿",
					Opinion: "骨科术后康复会诊申请",
					Version: 1, CreatedAt: now.AddDate(0, 0, -3),
				},
				{
					ID: "h046", ConsultationID: "c011",
					OperatorID: "u002", OperatorName: "张登记", OperatorRole: RoleRegistrar, OperatorRoleName: "登记员",
					Action: "submit", ActionName: "提交申请",
					FromStatus: StatusDraft, FromStatusName: "草稿", ToStatus: StatusSubmitted, ToStatusName: "待审核",
					Opinion: "资料齐全，提交审核",
					Version: 2, CreatedAt: now.AddDate(0, 0, -3).Add(3 * time.Hour),
				},
				{
					ID: "h047", ConsultationID: "c011",
					OperatorID: "u004", OperatorName: "李主管", OperatorRole: RoleReviewer, OperatorRoleName: "审核主管",
					Action: "evidence_missing", ActionName: "证据不足",
					FromStatus: StatusSubmitted, FromStatusName: "待审核", ToStatus: StatusEvidenceMissing, ToStatusName: "证据不足",
					Opinion:      "术后影像资料不完整",
					RejectReason: "缺少术后影像学复查资料，无法评估康复进展，请补充",
					Version: 3, CreatedAt: now.AddDate(0, 0, -2),
				},
				{
					ID: "h048", ConsultationID: "c011",
					OperatorID: "u002", OperatorName: "张登记", OperatorRole: RoleRegistrar, OperatorRoleName: "登记员",
					Action: "fail_appeal_submit", ActionName: "[失败]提交申诉",
					FromStatus: StatusEvidenceMissing, FromStatusName: "证据不足", ToStatus: StatusEvidenceMissing, ToStatusName: "证据不足",
					Opinion:      "有异议，申请申诉",
					RejectReason: "申诉理由不能为空，请详细说明申诉原因",
					Version: 3, CreatedAt: now.AddDate(0, 0, -2).Add(2 * time.Hour),
				},
				{
					ID: "h049", ConsultationID: "c011",
					OperatorID: "u002", OperatorName: "张登记", OperatorRole: RoleRegistrar, OperatorRoleName: "登记员",
					Action: "fail_appeal_submit", ActionName: "[失败]提交申诉",
					FromStatus: StatusEvidenceMissing, FromStatusName: "证据不足", ToStatus: StatusEvidenceMissing, ToStatusName: "证据不足",
					Opinion:      "患者影像资料在电子病历系统中可查",
					RejectReason: "版本冲突：当前版本已不是最新版本，请刷新后重试",
					Version: 3, CreatedAt: now.AddDate(0, 0, -2).Add(3 * time.Hour),
				},
				{
					ID: "h050", ConsultationID: "c011",
					OperatorID: "u001", OperatorName: "李登记", OperatorRole: RoleRegistrar, OperatorRoleName: "登记员",
					Action: "fail_appeal_submit", ActionName: "[失败]提交申诉",
					FromStatus: StatusEvidenceMissing, FromStatusName: "证据不足", ToStatus: StatusEvidenceMissing, ToStatusName: "证据不足",
					Opinion:      "代同事提交申诉",
					RejectReason: "权限不足：只有该申请单的登记人可以提交申诉",
					Version: 3, CreatedAt: now.AddDate(0, 0, -2).Add(4 * time.Hour),
				},
				{
					ID: "h051", ConsultationID: "c011",
					OperatorID: "u002", OperatorName: "张登记", OperatorRole: RoleRegistrar, OperatorRoleName: "登记员",
					Action: "appeal_submit", ActionName: "提交申诉",
					FromStatus: StatusEvidenceMissing, FromStatusName: "证据不足", ToStatus: StatusAppealSubmitted, ToStatusName: "申诉待受理",
					Opinion: "对证据不足判定有异议，附电子病历调阅说明",
					Version: 4, CreatedAt: now.AddDate(0, 0, -1).Add(time.Hour),
				},
			},
		},
	}

	for _, item := range consultations {
		c := item.c
		_, err := tx.Exec(`
			INSERT INTO consultations (
				id, title, patient_name, patient_id, dept, chief_complaint,
				consult_type, consult_dept, status, status_name, version,
				registrar_id, registrar_name, reviewer_id, reviewer_name,
				director_id, director_name, latest_opinion, latest_reject_reason,
				evidence_list, is_overdue, has_appeal, appeal_status, appeal_status_name,
				appeal_reason, deadline, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			c.ID, c.Title, c.PatientName, c.PatientID, c.Dept, c.ChiefComplaint,
			c.ConsultType, c.ConsultDept, c.Status, c.StatusName, c.Version,
			c.RegistrarID, c.RegistrarName, c.ReviewerID, c.ReviewerName,
			c.DirectorID, c.DirectorName, c.LatestOpinion, c.LatestRejectReason,
			c.EvidenceList, boolToInt(c.IsOverdue), boolToInt(c.HasAppeal),
			c.AppealStatus, c.AppealStatusName, c.AppealReason,
			c.Deadline, c.CreatedAt, c.UpdatedAt,
		)
		if err != nil {
			return err
		}

		for _, h := range item.history {
			h.ID = uuid.New().String()
			_, err := tx.Exec(`
				INSERT INTO history_records (
					id, consultation_id, operator_id, operator_name, operator_role,
					operator_role_name, action, action_name, from_status, from_status_name,
					to_status, to_status_name, opinion, reject_reason, version, created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				h.ID, h.ConsultationID, h.OperatorID, h.OperatorName, h.OperatorRole,
				h.OperatorRoleName, h.Action, h.ActionName, h.FromStatus, h.FromStatusName,
				h.ToStatus, h.ToStatusName, h.Opinion, h.RejectReason, h.Version, h.CreatedAt,
			)
			if err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func scanConsultation(row *sql.Row) (*Consultation, error) {
	var c Consultation
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

func scanConsultationRows(rows *sql.Rows) ([]Consultation, error) {
	var list []Consultation
	for rows.Next() {
		var c Consultation
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
