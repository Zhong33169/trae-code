package seed

import (
	"log"
	"news-clue-backend/internal/db"
	"news-clue-backend/internal/models"
	"time"

	"github.com/google/uuid"
)

func Seed() {
	var userCnt int64
	db.DB.Model(&models.User{}).Count(&userCnt)
	if userCnt > 0 {
		log.Println("已有用户数据，跳过初始化")
		return
	}
	log.Println("开始填充初始样例数据...")

	users := []models.User{
		{ID: uuid.New().String(), Username: "registrar1", Password: "123456", RealName: "王登记", Role: models.RoleRegistrar},
		{ID: uuid.New().String(), Username: "registrar2", Password: "123456", RealName: "李录入", Role: models.RoleRegistrar},
		{ID: uuid.New().String(), Username: "auditor1", Password: "123456", RealName: "张主管", Role: models.RoleAuditor},
		{ID: uuid.New().String(), Username: "auditor2", Password: "123456", RealName: "赵审核", Role: models.RoleAuditor},
		{ID: uuid.New().String(), Username: "reviewer1", Password: "123456", RealName: "陈复核", Role: models.RoleReviewer},
	}
	for _, u := range users {
		db.DB.Create(&u)
	}
	log.Println("用户初始化完成")

	var reg1, reg2, aud1, aud2, rev1 models.User
	db.DB.Where("username=?", "registrar1").First(&reg1)
	db.DB.Where("username=?", "registrar2").First(&reg2)
	db.DB.Where("username=?", "auditor1").First(&aud1)
	db.DB.Where("username=?", "auditor2").First(&aud2)
	db.DB.Where("username=?", "reviewer1").First(&rev1)

	now := time.Now()

	// 1. 正常通过的线索单（已归档）
	clue1 := createClue(
		"城南老旧小区改造工程违规施工扰民",
		"市民反映城南佳苑小区改造项目深夜23点仍在施工，噪音严重扰民，且未公示夜间施工许可。现场有挖掘机和水泥罐车作业，附近居民无法休息。",
		reg1, &aud1, &rev1,
		models.StatusArchived,
		"核实属实，施工单位无夜间施工许可，已责令停工并按规定处罚。回访居民表示已无夜间施工现象。",
	)
	clue1.SubmittedAt = ptr(now.Add(-72 * time.Hour))
	clue1.AssignedAt = ptr(now.Add(-70 * time.Hour))
	clue1.VerifiedAt = ptr(now.Add(-30 * time.Hour))
	clue1.ArchivedAt = ptr(now.Add(-24 * time.Hour))
	clue1.DueAt = ptr(now.Add(-20 * time.Hour))
	clue1.LastHandlerID = rev1.ID
	clue1.LastHandlerName = rev1.RealName
	clue1.LastOpinion = "符合归档条件"
	clue1.LastResult = "复核完成，已归档"
	clue1.VerifyComment = "现场核查属实，执法已介入"
	clue1.ArchiveResult = "整改到位，居民满意，归档。"
	db.DB.Create(&clue1)
	addEvidences(clue1.ID, reg1.ID, 3)
	addFlowLogsNormal(clue1, reg1, aud1, rev1)
	addLog2(clue1.ID, aud2.ID, aud2.RealName, string(aud2.Role), "❌ 非当前处理人拦截", "", "", "赵审核越权尝试重新分派非本人办理的已归档单据，被系统拦截", "", "", 5, 5)
	addLog2(clue1.ID, reg2.ID, reg2.RealName, string(reg2.Role), "❌ 越权查看被拒", "", "", "李录入尝试查看非本人登记的已归档线索单详情，被系统拦截", "", "", 5, 5)
	db.DB.Model(&clue1).Update("version", 5)

	// 2. 缺证据的线索单
	clue2 := createClue(
		"某餐饮门店疑似使用过期食材",
		"群众匿名举报位于幸福路的某川菜馆在后厨使用已过期一周的冷冻肉制品，且未按规定留样。",
		reg2, &aud2, nil,
		models.StatusLackEvidence,
		"",
	)
	clue2.SubmittedAt = ptr(now.Add(-36 * time.Hour))
	clue2.AssignedAt = ptr(now.Add(-34 * time.Hour))
	clue2.DueAt = ptr(now.Add(60 * time.Hour))
	clue2.LastHandlerID = aud2.ID
	clue2.LastHandlerName = aud2.RealName
	clue2.LastOpinion = "需要补充"
	clue2.LastResult = "标记缺证据，等待登记员补充现场照片、录像等材料"
	clue2.VerifyComment = "举报人未提供有效图片证据，仅文字描述难以核实"
	db.DB.Create(&clue2)
	addEvidences(clue2.ID, reg2.ID, 1)
	addLog2(clue2.ID, reg2.ID, reg2.RealName, string(reg2.Role), "登记并提交线索", "", string(models.StatusSubmitted), "", "", "", 0, 1)
	addLog2(clue2.ID, aud2.ID, aud2.RealName, string(aud2.Role), "核实分派", string(models.StatusSubmitted), string(models.StatusAssigned), "分派给赵审核处理", "", "", 1, 2)
	addLog2(clue2.ID, aud2.ID, aud2.RealName, string(aud2.Role), "标记缺证据", string(models.StatusAssigned), string(models.StatusLackEvidence), "需补充：1.现场照片 2.购买凭证/消费记录 3.具体过期时间", "缺少现场照片和实物证据", "", 2, 3)
	addLog2(clue2.ID, reg2.ID, reg2.RealName, string(reg2.Role), "❌ 证据缺失拦截", "", "", "李录入在零证据情况下尝试提交线索单，被系统拦截（需至少 1 份证据）", "", "", 3, 3)
	db.DB.Model(&clue2).Update("version", 3)

	// 3. 已逾期的线索单
	clue3 := createClue(
		"辖区河流断面水质疑似异常发黑",
		"市民反映流经辖区的滨江河段近三天水面颜色发黑并伴有异味，下游为取水口，担心影响饮水安全。",
		reg1, &aud1, nil,
		models.StatusOverdue,
		"",
	)
	clue3.SubmittedAt = ptr(now.Add(-140 * time.Hour))
	clue3.AssignedAt = ptr(now.Add(-138 * time.Hour))
	clue3.DueAt = ptr(now.Add(-48 * time.Hour)) // 已逾期 2 天
	clue3.LastHandlerID = rev1.ID
	clue3.LastHandlerName = rev1.RealName
	clue3.LastOpinion = "超过办理时限"
	clue3.LastResult = "复核负责人标记逾期，纳入异常台账"
	db.DB.Create(&clue3)
	addEvidences(clue3.ID, reg1.ID, 2)
	addLog2(clue3.ID, reg1.ID, reg1.RealName, string(reg1.Role), "登记并提交线索", "", string(models.StatusSubmitted), "", "", "", 0, 1)
	addLog2(clue3.ID, aud1.ID, aud1.RealName, string(aud1.Role), "核实分派", string(models.StatusSubmitted), string(models.StatusAssigned), "分派给张主管（本人）处理，5天内反馈", "", "", 1, 2)
	addLog2(clue3.ID, rev1.ID, rev1.RealName, string(rev1.Role), "标记逾期", string(models.StatusAssigned), string(models.StatusOverdue), "已超过办理时限 48 小时，登记员和审核人均未提交进展，请尽快处理并说明原因", "", "", 2, 3)
	db.DB.Model(&clue3).Update("version", 3)

	// 4. 退回补正（登记员可再次提交或申诉）
	clue4 := createClue(
		"某培训机构无资质办学并违规收费",
		"家长反映某培训机构在未取得办学许可证情况下招收寒假班，预收家长学费后突然停课。涉及金额约50万元。",
		reg2, &aud1, nil,
		models.StatusReturned,
		"",
	)
	clue4.SubmittedAt = ptr(now.Add(-50 * time.Hour))
	clue4.AssignedAt = ptr(now.Add(-48 * time.Hour))
	clue4.DueAt = ptr(now.Add(30 * time.Hour))
	clue4.LastHandlerID = aud1.ID
	clue4.LastHandlerName = aud1.RealName
	clue4.LastOpinion = "材料不完整"
	clue4.LastResult = "退回补正，请补充涉及学员名单、收费凭证等关键证据"
	db.DB.Create(&clue4)
	addEvidences(clue4.ID, reg2.ID, 1)
	addLog2(clue4.ID, reg2.ID, reg2.RealName, string(reg2.Role), "登记并提交线索", "", string(models.StatusSubmitted), "", "", "", 0, 1)
	addLog2(clue4.ID, aud1.ID, aud1.RealName, string(aud1.Role), "核实分派", string(models.StatusSubmitted), string(models.StatusAssigned), "分派张主管处理", "", "", 1, 2)
	addLog2(clue4.ID, aud1.ID, aud1.RealName, string(aud1.Role), "退回补正", string(models.StatusAssigned), string(models.StatusReturned), "请补充：1.涉事学员名单及联系方式 2.收费凭证或转账记录 3.培训合同或协议照片", "证据链不完整，缺少参与学员清单和收费凭证，无法核实涉案金额", "", 2, 3)
	db.DB.Model(&clue4).Update("version", 3)

	// 5. 申诉中的线索单（状态冲突异常 -> 登记员申诉）
	clue5 := createClue(
		"主干道井盖破损无人维修致多车爆胎",
		"车主反映人民北路与解放路交叉口井盖破损近一周，至少3辆车经过时爆胎，报警后仍未处理，怀疑相关部门推诿。",
		reg1, &aud2, nil,
		models.StatusAppealed,
		"",
	)
	clue5.SubmittedAt = ptr(now.Add(-96 * time.Hour))
	clue5.AssignedAt = ptr(now.Add(-94 * time.Hour))
	clue5.DueAt = ptr(now.Add(-10 * time.Hour))
	clue5.LastHandlerID = reg1.ID
	clue5.LastHandlerName = reg1.RealName
	clue5.LastOpinion = "登记员不认可退回决定，发起申诉"
	clue5.LastResult = "异常申诉中，等待复核负责人处理"
	db.DB.Create(&clue5)
	addEvidences(clue5.ID, reg1.ID, 3)
	// 构造冲突：审核员退回但登记员认为证据已经足够
	addLog2(clue5.ID, reg1.ID, reg1.RealName, string(reg1.Role), "登记并提交线索", "", string(models.StatusSubmitted), "", "", "", 0, 1)
	addLog2(clue5.ID, aud2.ID, aud2.RealName, string(aud2.Role), "核实分派", string(models.StatusSubmitted), string(models.StatusAssigned), "分派赵审核处理", "", "", 1, 2)
	addLog2(clue5.ID, aud2.ID, aud2.RealName, string(aud2.Role), "开始核实", string(models.StatusAssigned), string(models.StatusVerifying), "现场勘察核实井盖破损", "", "", 2, 3)
	addLog2(clue5.ID, aud2.ID, aud2.RealName, string(aud2.Role), "退回补正", string(models.StatusVerifying), string(models.StatusReturned), "请补充路政部门交接记录", "缺少路政部门确认责任主体的书面记录", "", 3, 4)
	addLog2(clue5.ID, reg1.ID, reg1.RealName, string(reg1.Role), "提交异常申诉", string(models.StatusReturned), string(models.StatusAppealed), "登记员不认可退回决定：已提供现场照片、交警报案记录及3位车主联系方式，责任主体清晰（市政养护中心），无需更多材料，请复核负责人裁决。", "", "", 4, 5)
	db.DB.Model(&clue5).Update("version", 5)

	// 插入对应申诉记录
	appeal := models.AppealRecord{
		ID:             uuid.New().String(),
		ClueID:         clue5.ID,
		AppellantID:    reg1.ID,
		AppellantName:  reg1.RealName,
		Reason:         "登记员不认可退回决定：已提供现场照片、交警报案记录及3位车主联系方式，责任主体清晰（市政养护中心），无需更多材料，请复核负责人裁决。",
		Status:         "pending",
		OriginalStatus: string(models.StatusReturned),
	}
	db.DB.Create(&appeal)

	// 6. 状态冲突（样例：多个审核人修改后产生冲突标记，由复核负责人介入）
	clue6 := createClue(
		"公园公共设施被故意损毁",
		"晨练市民反映滨河公园儿童游乐区多处设施近一周内被人为损毁，包括滑梯护栏断裂、秋千丢失，存在严重安全隐患。",
		reg1, &aud1, nil,
		models.StatusConflict,
		"",
	)
	clue6.SubmittedAt = ptr(now.Add(-80 * time.Hour))
	clue6.AssignedAt = ptr(now.Add(-78 * time.Hour))
	clue6.DueAt = ptr(now.Add(20 * time.Hour))
	clue6.LastHandlerID = rev1.ID
	clue6.LastHandlerName = rev1.RealName
	clue6.LastOpinion = "系统检测状态冲突"
	clue6.LastResult = "状态冲突，已标记由复核负责人牵头协调处理"
	db.DB.Create(&clue6)
	addEvidences(clue6.ID, reg1.ID, 2)
	addLog2(clue6.ID, reg1.ID, reg1.RealName, string(reg1.Role), "登记并提交线索", "", string(models.StatusSubmitted), "", "", "", 0, 1)
	addLog2(clue6.ID, aud1.ID, aud1.RealName, string(aud1.Role), "核实分派", string(models.StatusSubmitted), string(models.StatusAssigned), "分派张主管", "", "", 1, 2)
	addLog2(clue6.ID, aud1.ID, aud1.RealName, string(aud1.Role), "开始核实", string(models.StatusAssigned), string(models.StatusVerifying), "开始现场核实", "", "", 2, 3)
	addLog2(clue6.ID, rev1.ID, rev1.RealName, string(rev1.Role), "标记状态冲突", string(models.StatusVerifying), string(models.StatusConflict), "审核系统出现多人交叉修改，需复核负责人介入厘清责任并重新分派处理", "", "", 3, 4)
	addLog2(clue6.ID, aud2.ID, aud2.RealName, string(aud2.Role), "❌ 版本冲突拦截", "", "", "赵审核在携带过期版本(v2) 尝试修改已被张主管更新为v3的线索单，系统返回409并保留原状态", "", "", 4, 4)
	addLog2(clue6.ID, aud1.ID, aud1.RealName, string(aud1.Role), "❌ 非当前处理人拦截", "", "", "张主管尝试在已标记为状态冲突的单据上继续办理，被系统拦截（需复核负责人先裁决）", "", "", 4, 4)
	db.DB.Model(&clue6).Update("version", 4)

	// 7. 补正重提（登记员补正后再次提交的样例）
	clue7 := createClue(
		"临街商铺占道经营堵塞消防通道",
		"市民反映美食街多间商铺外溢经营，桌椅堆放在人行道和消防通道上，一旦发生火灾后果不堪设想。",
		reg2, &aud2, nil,
		models.StatusReSubmit,
		"",
	)
	clue7.SubmittedAt = ptr(now.Add(-60 * time.Hour))
	clue7.AssignedAt = ptr(now.Add(-55 * time.Hour))
	clue7.DueAt = ptr(now.Add(40 * time.Hour))
	clue7.LastHandlerID = reg2.ID
	clue7.LastHandlerName = reg2.RealName
	clue7.LastOpinion = "已按要求补充消防通道照片、周边店铺位置图"
	clue7.LastResult = "补正重提，等待审核主管分派核实"
	db.DB.Create(&clue7)
	addEvidences(clue7.ID, reg2.ID, 3)
	addLog2(clue7.ID, reg2.ID, reg2.RealName, string(reg2.Role), "登记并提交线索", "", string(models.StatusSubmitted), "", "", "", 0, 1)
	addLog2(clue7.ID, aud2.ID, aud2.RealName, string(aud2.Role), "核实分派", string(models.StatusSubmitted), string(models.StatusAssigned), "分派赵审核", "", "", 1, 2)
	addLog2(clue7.ID, aud2.ID, aud2.RealName, string(aud2.Role), "退回补正", string(models.StatusAssigned), string(models.StatusReturned), "补充消防通道位置示意图及更多现场照片", "缺少消防通道位置示意图，无法确认消防通道是否被堵", "", 2, 3)
	addLog2(clue7.ID, reg2.ID, reg2.RealName, string(reg2.Role), "补正后再次提交", string(models.StatusReturned), string(models.StatusReSubmit), "已补充：1.消防通道示意图 2.多角度现场照片 3.3户居民旁证陈述", "", "", 3, 4)
	db.DB.Model(&clue7).Update("version", 4)

	// 8. 已受理的申诉（申诉受理后等待登记员补正）
	clue8 := createClue(
		"辖区网吧允许未成年人上网被举报",
		"家长举报某网吧内有多名穿校服学生上网，吧台未核验身份证直接收费开机，且网吧内有人吸烟无人管理。",
		reg1, &aud1, nil,
		models.StatusAppealAccept,
		"",
	)
	clue8.SubmittedAt = ptr(now.Add(-100 * time.Hour))
	clue8.AssignedAt = ptr(now.Add(-98 * time.Hour))
	clue8.DueAt = ptr(now.Add(10 * time.Hour))
	clue8.LastHandlerID = rev1.ID
	clue8.LastHandlerName = rev1.RealName
	clue8.LastOpinion = "申诉成立，登记员可补充材料后再次提交"
	clue8.LastResult = "申诉已受理，等待登记员补正并重新提交"
	db.DB.Create(&clue8)
	addEvidences(clue8.ID, reg1.ID, 2)
	addLog2(clue8.ID, reg1.ID, reg1.RealName, string(reg1.Role), "登记并提交线索", "", string(models.StatusSubmitted), "", "", "", 0, 1)
	addLog2(clue8.ID, aud1.ID, aud1.RealName, string(aud1.Role), "核实分派", string(models.StatusSubmitted), string(models.StatusAssigned), "分派张主管", "", "", 1, 2)
	addLog2(clue8.ID, aud1.ID, aud1.RealName, string(aud1.Role), "标记缺证据", string(models.StatusAssigned), string(models.StatusLackEvidence), "需补充涉事未成年人身份确认信息", "缺乏未成年人具体信息和高清正面照片", "", 2, 3)
	addLog2(clue8.ID, reg1.ID, reg1.RealName, string(reg1.Role), "提交异常申诉", string(models.StatusLackEvidence), string(models.StatusAppealed), "举报为匿名家长，未成年人身份信息难以获取，已提供学校校服细节及网吧收费记录，符合立案条件。", "", "", 3, 4)
	addLog2(clue8.ID, rev1.ID, rev1.RealName, string(rev1.Role), "受理申诉", string(models.StatusAppealed), string(models.StatusAppealAccept), "申诉理由成立，无需获取未成年人具体身份，由登记员补充网吧外观照片及收费时段录像后可再次提交。", "", "申诉理由成立，无需获取未成年人具体身份，由登记员补充网吧外观照片及收费时段录像后可再次提交。", 4, 5)

	appeal8 := models.AppealRecord{
		ID:              uuid.New().String(),
		ClueID:          clue8.ID,
		AppellantID:     reg1.ID,
		AppellantName:   reg1.RealName,
		Reason:          "举报为匿名家长，未成年人身份信息难以获取，已提供学校校服细节及网吧收费记录，符合立案条件。",
		Status:          "accepted",
		ReviewerID:      rev1.ID,
		ReviewerName:    rev1.RealName,
		ReviewOpinion:   "申诉理由成立，无需获取未成年人具体身份，由登记员补充网吧外观照片及收费时段录像后可再次提交。",
		OriginalStatus:  string(models.StatusLackEvidence),
	}
	appeal8.CreatedAt = now.Add(-6 * time.Hour)
	rvwAt := now.Add(-2 * time.Hour)
	appeal8.ReviewedAt = &rvwAt
	db.DB.Create(&appeal8)
	db.DB.Model(&clue8).Update("version", 5)

	// 9. 申诉被驳回（登记员对缺证据不满申诉 → 复核驳回，需进一步补正）
	clue9 := createClue(
		"某小区物业公司擅自提高物业费被集体投诉",
		"业主反映阳光花园小区物业公司未召开业主大会擅自将物业费从1.8元涨到2.5元，且服务质量下降，已有30多户业主拒缴物业费表示抗议。",
		reg2, &aud2, nil,
		models.StatusAppealReject,
		"",
	)
	clue9.SubmittedAt = ptr(now.Add(-120 * time.Hour))
	clue9.AssignedAt = ptr(now.Add(-118 * time.Hour))
	clue9.DueAt = ptr(now.Add(24 * time.Hour))
	clue9.LastHandlerID = rev1.ID
	clue9.LastHandlerName = rev1.RealName
	clue9.LastOpinion = "申诉理由不充分，驳回申诉，需按要求补充证据"
	clue9.LastResult = "申诉已驳回，请补充物业合同原件及涨价公示照片等关键证据"
	db.DB.Create(&clue9)
	addEvidences(clue9.ID, reg2.ID, 2)
	addLog2(clue9.ID, reg2.ID, reg2.RealName, string(reg2.Role), "登记并提交线索", "", string(models.StatusSubmitted), "", "", "", 0, 1)
	addLog2(clue9.ID, aud2.ID, aud2.RealName, string(aud2.Role), "核实分派", string(models.StatusSubmitted), string(models.StatusAssigned), "分派赵审核处理，重点核实物业涨价程序合法性", "", "", 1, 2)
	addLog2(clue9.ID, aud2.ID, aud2.RealName, string(aud2.Role), "标记缺证据", string(models.StatusAssigned), string(models.StatusLackEvidence), "需补充：1.物业合同原件 2.涨价公示照片 3.业主大会决议记录", "缺少关键证据，无法确认涨价是否违法", "", 2, 3)
	addLog2(clue9.ID, reg2.ID, reg2.RealName, string(reg2.Role), "提交异常申诉", string(models.StatusLackEvidence), string(models.StatusAppealed), "登记员认为已提供20位业主签字证明，且物业涨价是既成事实，无需更多材料即可立案查处。", "", "", 3, 4)
	addLog2(clue9.ID, rev1.ID, rev1.RealName, string(rev1.Role), "驳回申诉", string(models.StatusAppealed), string(models.StatusAppealReject), "申诉理由不成立。根据《物业管理条例》，物业涨价必须经业主大会双过半同意，登记员需补充物业合同原件及涨价公示等关键书证，20位业主签字不能替代法定程序。请补充后可再次提交。", "缺少物业合同、涨价公示等核心书证，仅凭业主签字不足以立案", "申诉理由不成立，需补充法定书证", 4, 5)
	db.DB.Model(&clue9).Update("version", 5)

	appeal9 := models.AppealRecord{
		ID:              uuid.New().String(),
		ClueID:          clue9.ID,
		AppellantID:     reg2.ID,
		AppellantName:   reg2.RealName,
		Reason:          "登记员认为已提供20位业主签字证明，且物业涨价是既成事实，无需更多材料即可立案查处。",
		Status:          "rejected",
		ReviewerID:      rev1.ID,
		ReviewerName:    rev1.RealName,
		ReviewOpinion:   "申诉理由不成立。根据《物业管理条例》，物业涨价必须经业主大会双过半同意，登记员需补充物业合同原件及涨价公示等关键书证，20位业主签字不能替代法定程序。请补充后可再次提交。",
		RejectReason:    "缺少物业合同、涨价公示等核心书证，仅凭业主签字不足以立案",
		OriginalStatus:  string(models.StatusLackEvidence),
	}
	appeal9.CreatedAt = now.Add(-40 * time.Hour)
	rvwAt9 := now.Add(-12 * time.Hour)
	appeal9.ReviewedAt = &rvwAt9
	db.DB.Create(&appeal9)

	log.Println("样例线索单填充完成，共 9 条，覆盖正常/缺证据/逾期/退回补正/申诉中/申诉已受理/申诉已驳回/状态冲突/补正重提 9 种情形")
}

func ptr(t time.Time) *time.Time { return &t }

func createClue(title, content string, registrar models.User, auditor, reviewer *models.User, status models.ClueStatus, archiveResult string) models.NewsClue {
	id := uuid.New().String()
	clue := models.NewsClue{
		ID:            id,
		Title:         title,
		Content:       content,
		Source:        "市民热线12345",
		ContactPerson: "匿名市民",
		ContactPhone:  "138****" + rand4(),
		Priority:      "normal",
		Location:      "本市辖区",
		Tags:          "民生,投诉",
		RegistrarID:   registrar.ID,
		RegistrarName: registrar.RealName,
		Status:        status,
		ArchiveResult: archiveResult,
		Version:       1,
	}
	if auditor != nil {
		clue.AuditorID = auditor.ID
		clue.AuditorName = auditor.RealName
	}
	if reviewer != nil {
		clue.ReviewerID = reviewer.ID
		clue.ReviewerName = reviewer.RealName
	}
	return clue
}

func rand4() string {
	return "8821"
}

func addEvidences(clueID, uploaderID string, n int) {
	types := []string{"image", "video", "audio", "document"}
	names := []string{"现场照片", "投诉录像", "录音", "书面证明", "转办单", "消费凭证", "位置示意图"}
	for i := 0; i < n; i++ {
		ev := models.Evidence{
			ID:         uuid.New().String(),
			ClueID:     clueID,
			Type:       types[i%len(types)],
			Name:       names[i%len(names)],
			Desc:       "编号:" + uuid.New().String()[:8],
			UploaderID: uploaderID,
		}
		db.DB.Create(&ev)
	}
}

func addLog2(clueID, operatorID, operatorName, operatorRole, action, fromStatus, toStatus, comment, rejectReason, reviewOpinion string, vb, va int) {
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
	db.DB.Create(&log)
}

func addFlowLogsNormal(clue models.NewsClue, reg, aud, rev models.User) {
	addLog2(clue.ID, reg.ID, reg.RealName, string(reg.Role), "登记并提交线索", "", string(models.StatusSubmitted), "登记员按要求上传证据后提交", "", "", 0, 1)
	addLog2(clue.ID, aud.ID, aud.RealName, string(aud.Role), "核实分派", string(models.StatusSubmitted), string(models.StatusAssigned), "分派给张主管，5天内回复", "", "", 1, 2)
	addLog2(clue.ID, aud.ID, aud.RealName, string(aud.Role), "开始核实", string(models.StatusAssigned), string(models.StatusVerifying), "当日下午赴现场核实", "", "", 2, 3)
	addLog2(clue.ID, aud.ID, aud.RealName, string(aud.Role), "核实完成，提交复核归档", string(models.StatusVerifying), string(models.StatusVerifying), "现场情况属实，已责令整改并约谈项目负责人，附执法记录4份", "", "", 3, 4)
	addLog2(clue.ID, rev.ID, rev.RealName, string(rev.Role), "复核归档", string(models.StatusVerifying), string(models.StatusArchived), "核实流程完整，证据充分，处置合规，同意归档。回访居民确认问题已解决。", "", "", 4, 5)
}
