package database

import (
	"database/sql"
	"fmt"
	"log"
	"repair-platform/models"
	"time"
)

func SeedData() error {
	var userCount int
	DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&userCount)
	if userCount > 0 {
		log.Println("已存在用户数据，跳过初始化")
		return nil
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}

	users := []struct {
		username string
		name     string
		role     models.UserRole
	}{
		{"registrar1", "张登记", models.RoleRegistrar},
		{"registrar2", "李登记", models.RoleRegistrar},
		{"supervisor1", "王主管", models.RoleSupervisor},
		{"supervisor2", "赵主管", models.RoleSupervisor},
		{"reviewer1", "陈复核", models.RoleReviewer},
		{"reviewer2", "刘复核", models.RoleReviewer},
	}

	userIDs := make([]int, len(users))
	for i, u := range users {
		res, _ := tx.Exec(`
			INSERT INTO users (username, name, role) VALUES (?, ?, ?)
		`, u.username, u.name, string(u.role))
		id, _ := res.LastInsertId()
		userIDs[i] = int(id)
	}

	type opStep struct {
		action      string
		operatorIdx int
		fromStatus  string
		toStatus    string
	}

	type orderTemplate struct {
		title       string
		description string
		risk        models.RiskLevel
		status      models.OrderStatus
		stage       models.ProcessStage
		handlerIdx  int
		dueDays     int
		evidences   int
		isOverdue   bool
		lastOpinion string
		conflict    string
		steps       []opStep
	}

	templates := []orderTemplate{
		{
			"小区电梯故障维修", "3号楼2单元电梯异响，运行卡顿，需紧急维修",
			models.RiskHigh, models.StatusRegistered, models.StageDispatch,
			2, 1, 0, false, "已完成登记，等待派单", "",
			[]opStep{
				{"创建订单", 0, string(models.StatusPendingRegistration), string(models.StatusRegistered)},
			},
		},
		{
			"办公室空调不制冷", "行政部3楼会议室空调不制冷，天气炎热影响办公",
			models.RiskMedium, models.StatusDispatched, models.StageAcceptance,
			2, 3, 1, false, "已派单给李师傅，等待完工", "",
			[]opStep{
				{"创建订单", 0, string(models.StatusPendingRegistration), string(models.StatusRegistered)},
				{"师傅派单", 2, string(models.StatusRegistered), string(models.StatusDispatched)},
			},
		},
		{
			"公共区域照明维修", "地下车库B区有5盏灯不亮，存在安全隐患",
			models.RiskLow, models.StatusCompleted, models.StageReview,
			4, 7, 2, false, "已完工验收，等待复核归档", "",
			[]opStep{
				{"创建订单", 0, string(models.StatusPendingRegistration), string(models.StatusRegistered)},
				{"师傅派单", 2, string(models.StatusRegistered), string(models.StatusDispatched)},
				{"完工验收", 2, string(models.StatusDispatched), string(models.StatusCompleted)},
			},
		},
		{
			"消防喷淋漏水", "5楼走廊消防喷淋头漏水，已临时关闭阀门",
			models.RiskHigh, models.StatusMissingEvidence, models.StageAcceptance,
			2, 1, 1, false, "证据不足，缺少漏水现场照片和维修前检测报告", "",
			[]opStep{
				{"创建订单", 0, string(models.StatusPendingRegistration), string(models.StatusRegistered)},
				{"师傅派单", 2, string(models.StatusRegistered), string(models.StatusDispatched)},
				{"标记缺证据", 2, string(models.StatusDispatched), string(models.StatusMissingEvidence)},
			},
		},
		{
			"门禁系统升级", "园区东门禁系统需升级人脸识别模块",
			models.RiskMedium, models.StatusOverdue, models.StageDispatch,
			2, -2, 0, true, "已逾期2天，请尽快处理", "",
			[]opStep{
				{"创建订单", 0, string(models.StatusPendingRegistration), string(models.StatusRegistered)},
				{"标记逾期", 2, string(models.StatusRegistered), string(models.StatusOverdue)},
			},
		},
		{
			"会议室投影仪故障", "1号会议室投影仪无法开机，影响下周重要会议",
			models.RiskMedium, models.StatusReturnedForCorrection, models.StageRegistration,
			0, 5, 0, false, "故障描述不够详细，请补充具体现象和已尝试的解决方法", "",
			[]opStep{
				{"创建订单", 0, string(models.StatusPendingRegistration), string(models.StatusRegistered)},
				{"退回补正", 2, string(models.StatusRegistered), string(models.StatusReturnedForCorrection)},
			},
		},
		{
			"停车场道闸维修", "北门停车场道闸抬杆不顺畅，偶尔无法识别车牌",
			models.RiskHigh, models.StatusConflict, models.StageAcceptance,
			2, 2, 3, false, "状态冲突：系统显示已完工但现场实际未完成", "系统状态与实际情况不符",
			[]opStep{
				{"创建订单", 0, string(models.StatusPendingRegistration), string(models.StatusRegistered)},
				{"师傅派单", 2, string(models.StatusRegistered), string(models.StatusDispatched)},
				{"标记状态冲突", 2, string(models.StatusDispatched), string(models.StatusConflict)},
			},
		},
		{
			"卫生间水龙头漏水", "2楼男卫生间3号洗手池水龙头漏水",
			models.RiskLow, models.StatusArchived, models.StageReview,
			4, 10, 1, false, "已完成维修并归档", "",
			[]opStep{
				{"创建订单", 0, string(models.StatusPendingRegistration), string(models.StatusRegistered)},
				{"师傅派单", 2, string(models.StatusRegistered), string(models.StatusDispatched)},
				{"完工验收", 2, string(models.StatusDispatched), string(models.StatusCompleted)},
				{"复核归档", 4, string(models.StatusCompleted), string(models.StatusArchived)},
			},
		},
		{
			"数据中心空调告警", "机房精密空调出现高压告警，需紧急排查",
			models.RiskHigh, models.StatusDispatched, models.StageAcceptance,
			2, 0, 2, true, "紧急工单，已派单", "",
			[]opStep{
				{"创建订单", 0, string(models.StatusPendingRegistration), string(models.StatusRegistered)},
				{"师傅派单", 2, string(models.StatusRegistered), string(models.StatusDispatched)},
			},
		},
		{
			"员工餐厅设备维修", "餐厅2号蒸箱无法加热，影响员工用餐",
			models.RiskMedium, models.StatusRegistered, models.StageDispatch,
			2, 2, 0, false, "新登记，等待派单", "",
			[]opStep{
				{"创建订单", 0, string(models.StatusPendingRegistration), string(models.StatusRegistered)},
			},
		},
		{
			"档案室恒温设备", "档案室恒温恒湿设备温度异常偏高",
			models.RiskHigh, models.StatusArchived, models.StageReview,
			4, 15, 1, false, "归档后订单 - 办理不可见边界演示", "",
			[]opStep{
				{"创建订单", 0, string(models.StatusPendingRegistration), string(models.StatusRegistered)},
				{"师傅派单", 2, string(models.StatusRegistered), string(models.StatusDispatched)},
				{"完工验收", 2, string(models.StatusDispatched), string(models.StatusCompleted)},
				{"复核归档", 4, string(models.StatusCompleted), string(models.StatusArchived)},
			},
		},
		{
			"大堂玻璃门维修", "大堂玻璃门地弹簧损坏，门体无法正常闭合",
			models.RiskMedium, models.StatusRegistered, models.StageDispatch,
			3, 2, 0, false, "非当前处理人订单 - 权限不可见边界演示", "",
			[]opStep{
				{"创建订单", 1, string(models.StatusPendingRegistration), string(models.StatusRegistered)},
			},
		},
	}

	for i, tpl := range templates {
		orderNo := fmt.Sprintf("WX%s%04d", time.Now().AddDate(0, 0, -i).Format("20060102"), i+1)
		dueDate := time.Now().AddDate(0, 0, tpl.dueDays)
		requiredEvidences := calculateRequiredEvidences(tpl.risk)
		priority := calculatePriority(tpl.risk, tpl.isOverdue)
		version := len(tpl.steps)

		var masterName, masterPhone sql.NullString
		var dispatchTime, completeTime, archiveTime sql.NullTime

		if tpl.status == models.StatusDispatched || tpl.status == models.StatusCompleted ||
			tpl.status == models.StatusArchived || tpl.status == models.StatusConflict ||
			tpl.status == models.StatusMissingEvidence {
			masterName = sql.NullString{String: "李师傅", Valid: true}
			masterPhone = sql.NullString{String: "13800138001", Valid: true}
			dispatchTime = sql.NullTime{Time: time.Now().AddDate(0, 0, -1), Valid: true}
		}
		if tpl.status == models.StatusCompleted || tpl.status == models.StatusArchived {
			completeTime = sql.NullTime{Time: time.Now().AddDate(0, 0, 0), Valid: true}
		}
		if tpl.status == models.StatusArchived {
			archiveTime = sql.NullTime{Time: time.Now().AddDate(0, 0, 0), Valid: true}
		}

		res, err := tx.Exec(`
			INSERT INTO repair_orders (
				order_no, title, description, contact_name, contact_phone, address,
				risk_level, status, current_stage, current_handler_id,
				registrar_id, supervisor_id, reviewer_id,
				master_name, master_phone, dispatch_time, complete_time, archive_time,
				due_date, priority, version, evidence_count, required_evidences,
				is_overdue, last_opinion, last_operator, last_operator_role, conflict_note,
				created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			orderNo, tpl.title, tpl.description, "报修人"+fmt.Sprintf("%d", i+1),
			fmt.Sprintf("138%08d", i+1), "园区"+fmt.Sprintf("%d号楼", (i%10)+1),
			tpl.risk, tpl.status, tpl.stage, userIDs[tpl.handlerIdx],
			userIDs[0], userIDs[2], userIDs[4],
			masterName, masterPhone, dispatchTime, completeTime, archiveTime,
			dueDate, priority, version, tpl.evidences, requiredEvidences,
			tpl.isOverdue, tpl.lastOpinion, users[tpl.handlerIdx].name, string(users[tpl.handlerIdx].role),
			tpl.conflict,
			time.Now().AddDate(0, 0, -i-1), time.Now().AddDate(0, 0, -i),
		)
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("创建订单失败: %w", err)
		}

		orderID, _ := res.LastInsertId()

		evidenceTypes := []string{"现场照片", "维修工单", "检测报告", "验收单", "费用清单"}
		for e := 0; e < tpl.evidences; e++ {
			tx.Exec(`
				INSERT INTO evidences (order_id, type, description, uploaded_by)
				VALUES (?, ?, ?, ?)
			`, orderID, evidenceTypes[e%len(evidenceTypes)],
				fmt.Sprintf("%s%d号", evidenceTypes[e%len(evidenceTypes)], e+1),
				userIDs[e%len(users)],
			)
		}

		for s, step := range tpl.steps {
			vBefore := s
			vAfter := s + 1
			tx.Exec(`
				INSERT INTO operation_logs (
					order_id, operator_id, operator_name, operator_role,
					action, from_status, to_status, opinion, risk_level,
					version_before, version_after
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`, orderID, userIDs[step.operatorIdx], users[step.operatorIdx].name,
				string(users[step.operatorIdx].role),
				step.action, step.fromStatus, step.toStatus,
				tpl.lastOpinion, string(tpl.risk), vBefore, vAfter,
			)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("提交样例数据失败: %w", err)
	}

	log.Println("样例数据初始化完成，共创建 6 个用户和 12 个维修订单")
	return nil
}

func calculateRequiredEvidences(riskLevel models.RiskLevel) int {
	switch riskLevel {
	case models.RiskHigh:
		return 4
	case models.RiskMedium:
		return 2
	case models.RiskLow:
		return 1
	default:
		return 2
	}
}

func calculatePriority(riskLevel models.RiskLevel, isOverdue bool) int {
	base := 50
	switch riskLevel {
	case models.RiskHigh:
		base = 90
	case models.RiskMedium:
		base = 50
	case models.RiskLow:
		base = 20
	}
	if isOverdue {
		base += 30
	}
	return base
}
