package data

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"fmt"
	"log"
	"repair-platform/models"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func genQuoteNo() string {
	b := make([]byte, 6)
	rand.Read(b)
	suffix := base64.RawURLEncoding.EncodeToString(b)[:6]
	return fmt.Sprintf("WX%s%s", time.Now().Format("20060102"), suffix)
}

func SeedData(db *sql.DB) error {
	var count int
	db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if count > 0 {
		log.Println("种子数据已存在，跳过初始化")
		return nil
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	users := []models.User{
		{Username: "admin", RealName: "张经理", Role: models.RoleServiceManager, Phone: "13800000001", Shift: models.ShiftMorning},
		{Username: "dispatcher1", RealName: "李调度", Role: models.RoleDispatcher, Phone: "13800000002", Shift: models.ShiftMorning},
		{Username: "dispatcher2", RealName: "王调度", Role: models.RoleDispatcher, Phone: "13800000003", Shift: models.ShiftAfternoon},
		{Username: "cs1", RealName: "赵客服", Role: models.RoleCustomerService, Phone: "13800000004", Shift: models.ShiftMorning},
		{Username: "cs2", RealName: "孙客服", Role: models.RoleCustomerService, Phone: "13800000005", Shift: models.ShiftAfternoon},
		{Username: "tech1", RealName: "钱师傅", Role: models.RoleTechnician, Phone: "13800000006", Shift: models.ShiftMorning},
		{Username: "tech2", RealName: "周师傅", Role: models.RoleTechnician, Phone: "13800000007", Shift: models.ShiftAfternoon},
		{Username: "tech3", RealName: "吴师傅", Role: models.RoleTechnician, Phone: "13800000008", Shift: models.ShiftNight},
	}

	userIDs := make([]int64, len(users))
	for i, u := range users {
		pwdHash, _ := hashPassword("123456")
		res, err := tx.Exec(
			"INSERT INTO users (username, password_hash, real_name, role, phone, shift) VALUES (?, ?, ?, ?, ?, ?)",
			u.Username, pwdHash, u.RealName, u.Role, u.Phone, u.Shift,
		)
		if err != nil {
			return fmt.Errorf("创建用户失败: %w", err)
		}
		userIDs[i], _ = res.LastInsertId()
	}

	now := time.Now()
	customers := []struct {
		customerName string
		phone        string
		deviceType   string
		deviceModel  string
		faultDesc    string
		status       string
		estimate     float64
		actual       float64
		handlerIdx   int
		creatorIdx   int
		techIdx      int
	}{
		{"陈先生", "13910001001", "空调", "格力 KFR-35GW", "不制冷，开机2分钟后自动停机", models.StatusPendingQuote, 0, 0, 1, 3, -1},
		{"刘女士", "13910001002", "冰箱", "海尔 BCD-520", "冷藏室结冰严重", models.StatusQuoted, 380, 380, 3, 3, 5},
		{"王先生", "13910001003", "洗衣机", "小天鹅 TG100", "脱水时异响大，无法高速旋转", models.StatusConfirmed, 520, 520, 1, 3, 5},
		{"张女士", "13910001004", "热水器", "美的 F60", "不出热水，显示故障码E1", models.StatusCustomerPaid, 450, 450, 5, 3, 5},
		{"李先生", "13910001005", "电视机", "海信 65U7H", "屏幕有竖线，显示异常", models.StatusRepairing, 880, 880, 6, 3, 6},
		{"赵先生", "13910001006", "油烟机", "方太 EM16T", "风力变小，清洗后仍无改善", models.StatusCompleted, 300, 300, 3, 4, 5},
		{"孙女士", "13910001007", "微波炉", "格兰仕 G80", "转盘不转，加热正常", models.StatusReturned, 200, 0, 1, 4, 6},
		{"周先生", "13910001008", "燃气灶", "老板 9B00", "左边火点不着，右边正常", models.StatusDraft, 0, 0, 4, 4, -1},
		{"吴先生", "13910001009", "空调", "美的 KFR-51LW", "制冷效果差，出风不凉", models.StatusPendingQuote, 0, 0, 2, 4, -1},
		{"郑女士", "13910001010", "冰箱", "西门子 KA92", "不启动，无任何反应", models.StatusCustomerPaid, 680, 680, 6, 4, 6},
		{"冯先生", "13910001011", "净水器", "安吉尔 A6", "不出水，更换滤芯后故障", models.StatusRepairing, 350, 350, 5, 4, 5},
		{"陈女士", "13910001012", "干衣机", "海尔 GDNE9", "烘干时间特别长，效果差", models.StatusCancelled, 400, 0, 3, 4, -1},
	}

	quoteIDs := make([]int64, 0, len(customers))
	for _, c := range customers {
		handlerID := userIDs[c.handlerIdx]
		handlerName := users[c.handlerIdx].RealName
		handlerShift := users[c.handlerIdx].Shift
		creatorID := userIDs[c.creatorIdx]
		creatorName := users[c.creatorIdx].RealName

		var techID int64
		var techName string
		if c.techIdx >= 0 {
			techID = userIDs[c.techIdx]
			techName = users[c.techIdx].RealName
		}

		paymentStatus := "unpaid"
		if c.status == models.StatusCustomerPaid || c.status == models.StatusRepairing || c.status == models.StatusCompleted {
			paymentStatus = "paid"
		}

		var confirmedAt, paidAt, completedAt *time.Time
		if c.status == models.StatusConfirmed || c.status == models.StatusCustomerPaid || c.status == models.StatusRepairing || c.status == models.StatusCompleted {
			t := now.Add(-48 * time.Hour)
			confirmedAt = &t
		}
		if c.status == models.StatusCustomerPaid || c.status == models.StatusRepairing || c.status == models.StatusCompleted {
			t := now.Add(-24 * time.Hour)
			paidAt = &t
		}
		if c.status == models.StatusCompleted {
			t := now.Add(-2 * time.Hour)
			completedAt = &t
		}

		quoteDetail := ""
		if c.estimate > 0 {
			quoteDetail = fmt.Sprintf("配件费: %.0f元 + 人工费: %.0f元 = 合计 %.0f元", c.estimate*0.6, c.estimate*0.4, c.estimate)
		}

		res, err := tx.Exec(`INSERT INTO repair_quotes
			(quote_no, customer_name, customer_phone, device_type, device_model, fault_description,
			 status, current_handler_id, current_handler, shift,
			 estimate_amount, actual_amount, payment_status, payment_method, quote_detail,
			 confirmed_at, paid_at, completed_at,
			 assigned_technician_id, assigned_technician,
			 creator_id, creator_name, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			genQuoteNo(), c.customerName, c.phone, c.deviceType, c.deviceModel, c.faultDesc,
			c.status, handlerID, handlerName, handlerShift,
			c.estimate, c.actual, paymentStatus, "", quoteDetail,
			confirmedAt, paidAt, completedAt,
			techID, techName,
			creatorID, creatorName, now, now,
		)
		if err != nil {
			return fmt.Errorf("创建报价单失败: %w", err)
		}
		qid, _ := res.LastInsertId()
		quoteIDs = append(quoteIDs, qid)
	}

	operations := []struct {
		quoteIdx int
		op       string
		oldSt    string
		newSt    string
		usrIdx   int
		remark   string
		offset   time.Duration
	}{
		{0, "登记维修报价单", "", models.StatusDraft, 3, "客户通过电话报修", -72 * time.Hour},
		{0, "提交待报价", models.StatusDraft, models.StatusPendingQuote, 3, "", -70 * time.Hour},
		{1, "登记维修报价单", "", models.StatusDraft, 3, "客户到店报修", -96 * time.Hour},
		{1, "提交待报价", models.StatusDraft, models.StatusPendingQuote, 3, "", -94 * time.Hour},
		{1, "完成报价", models.StatusPendingQuote, models.StatusQuoted, 1, "报价380元: 除冰阀+充氟利昂+人工费", -90 * time.Hour},
		{2, "登记维修报价单", "", models.StatusDraft, 3, "APP线上报修", -120 * time.Hour},
		{2, "提交待报价", models.StatusDraft, models.StatusPendingQuote, 3, "", -118 * time.Hour},
		{2, "完成报价", models.StatusPendingQuote, models.StatusQuoted, 1, "报价520元: 更换减震器3个+拆机检修", -110 * time.Hour},
		{2, "客户确认报价", models.StatusQuoted, models.StatusConfirmed, 3, "客户电话确认接受报价", -100 * time.Hour},
		{2, "分配维修师傅", models.StatusConfirmed, models.StatusConfirmed, 1, "分配给钱师傅处理", -98 * time.Hour},
		{3, "登记维修报价单", "", models.StatusDraft, 3, "", -144 * time.Hour},
		{3, "提交待报价", models.StatusDraft, models.StatusPendingQuote, 3, "", -142 * time.Hour},
		{3, "完成报价", models.StatusPendingQuote, models.StatusQuoted, 1, "报价450元: 更换加热棒+检测温控", -135 * time.Hour},
		{3, "客户确认报价", models.StatusQuoted, models.StatusConfirmed, 3, "微信确认", -130 * time.Hour},
		{3, "客户支付", models.StatusConfirmed, models.StatusCustomerPaid, 3, "到店刷卡支付450元", -50 * time.Hour},
		{3, "分配维修师傅", models.StatusCustomerPaid, models.StatusCustomerPaid, 1, "分配给钱师傅", -48 * time.Hour},
		{4, "登记维修报价单", "", models.StatusDraft, 4, "VIP客户报修", -200 * time.Hour},
		{4, "提交待报价", models.StatusDraft, models.StatusPendingQuote, 4, "", -198 * time.Hour},
		{4, "完成报价", models.StatusPendingQuote, models.StatusQuoted, 2, "报价880元: 检测屏幕排线，更换驱动板", -190 * time.Hour},
		{4, "客户确认报价", models.StatusQuoted, models.StatusConfirmed, 4, "上门时当面确认", -180 * time.Hour},
		{4, "客户支付", models.StatusConfirmed, models.StatusCustomerPaid, 4, "微信扫码支付880元", -170 * time.Hour},
		{4, "开始维修", models.StatusCustomerPaid, models.StatusRepairing, 6, "周师傅已上门，正在维修中", -40 * time.Hour},
		{5, "登记维修报价单", "", models.StatusDraft, 4, "", -168 * time.Hour},
		{5, "提交待报价", models.StatusDraft, models.StatusPendingQuote, 4, "", -166 * time.Hour},
		{5, "完成报价", models.StatusPendingQuote, models.StatusQuoted, 2, "报价300元: 深度清洗+更换风轮", -160 * time.Hour},
		{5, "客户确认报价", models.StatusQuoted, models.StatusConfirmed, 4, "电话确认", -155 * time.Hour},
		{5, "客户支付", models.StatusConfirmed, models.StatusCustomerPaid, 4, "支付宝转账300元", -150 * time.Hour},
		{5, "开始维修", models.StatusCustomerPaid, models.StatusRepairing, 5, "钱师傅开始维修", -145 * time.Hour},
		{5, "维修完成", models.StatusRepairing, models.StatusCompleted, 0, "张经理归档，客户验收满意", -6 * time.Hour},
		{6, "登记维修报价单", "", models.StatusDraft, 4, "", -80 * time.Hour},
		{6, "提交待报价", models.StatusDraft, models.StatusPendingQuote, 4, "", -78 * time.Hour},
		{6, "完成报价", models.StatusPendingQuote, models.StatusQuoted, 2, "报价200元: 更换转盘电机", -72 * time.Hour},
		{6, "客户确认报价", models.StatusQuoted, models.StatusConfirmed, 4, "", -68 * time.Hour},
		{6, "补充证据-退回", models.StatusConfirmed, models.StatusReturned, 0, "客户反馈产品已过保，暂不维修。备注: 等待客户进一步决定", -20 * time.Hour},
		{7, "登记维修报价单", "", models.StatusDraft, 4, "新客户首次报修", -10 * time.Hour},
		{8, "登记维修报价单", "", models.StatusDraft, 4, "老客户报修", -30 * time.Hour},
		{8, "提交待报价", models.StatusDraft, models.StatusPendingQuote, 4, "", -28 * time.Hour},
		{9, "登记维修报价单", "", models.StatusDraft, 4, "", -180 * time.Hour},
		{9, "提交待报价", models.StatusDraft, models.StatusPendingQuote, 4, "", -178 * time.Hour},
		{9, "完成报价", models.StatusPendingQuote, models.StatusQuoted, 2, "报价680元: 检测压缩机，更换启动器", -170 * time.Hour},
		{9, "客户确认报价", models.StatusQuoted, models.StatusConfirmed, 4, "", -160 * time.Hour},
		{9, "客户支付", models.StatusConfirmed, models.StatusCustomerPaid, 4, "微信支付680元", -155 * time.Hour},
		{9, "开始维修", models.StatusCustomerPaid, models.StatusRepairing, 6, "周师傅维修中", -80 * time.Hour},
		{10, "登记维修报价单", "", models.StatusDraft, 4, "", -90 * time.Hour},
		{10, "提交待报价", models.StatusDraft, models.StatusPendingQuote, 4, "", -88 * time.Hour},
		{10, "完成报价", models.StatusPendingQuote, models.StatusQuoted, 1, "报价350元: 更换水泵+检测水路", -82 * time.Hour},
		{10, "客户确认报价", models.StatusQuoted, models.StatusConfirmed, 4, "", -78 * time.Hour},
		{10, "客户支付", models.StatusConfirmed, models.StatusCustomerPaid, 4, "到店支付350元", -72 * time.Hour},
		{10, "开始维修", models.StatusCustomerPaid, models.StatusRepairing, 5, "钱师傅维修", -68 * time.Hour},
		{10, "补充证据-补录", models.StatusRepairing, models.StatusRepairing, 1, "上传证据: 折价审批单.pdf，备注: 补录：折价处理审批单", -36 * time.Hour},
		{11, "登记维修报价单", "", models.StatusDraft, 4, "", -50 * time.Hour},
		{11, "提交待报价", models.StatusDraft, models.StatusPendingQuote, 4, "", -48 * time.Hour},
		{11, "完成报价", models.StatusPendingQuote, models.StatusQuoted, 2, "报价400元: 更换加热管+清理冷凝器", -42 * time.Hour},
		{11, "取消报价单", models.StatusQuoted, models.StatusCancelled, 0, "客户反馈新买了一台，取消本次维修", -15 * time.Hour},
	}

	for _, op := range operations {
		qid := quoteIDs[op.quoteIdx]
		usr := users[op.usrIdx]
		opTime := now.Add(op.offset)
		_, err := tx.Exec(`INSERT INTO operation_logs
			(quote_id, operation, old_status, new_status, operator_id, operator_name, operator_role, remark, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			qid, op.op, op.oldSt, op.newSt, userIDs[op.usrIdx], usr.RealName, usr.Role, op.remark, opTime,
		)
		if err != nil {
			return fmt.Errorf("创建操作记录失败: %w", err)
		}
	}

	handovers := []struct {
		quoteIdx  int
		fromIdx   int
		toIdx     int
		remark    string
		confirmed bool
		offset    time.Duration
	}{
		{5, 3, 6, "白班转中班，钱师傅已完成维修，请中班师傅协调验收", true, -25 * time.Hour},
		{4, 1, 2, "李调度交班给王调度：海信电视维修进度跟踪", true, -45 * time.Hour},
		{3, 1, 2, "热水器维修：客户已付款，请中班联系师傅上门", true, -60 * time.Hour},
		{0, 1, 2, "空调维修报价单，已待报价状态，请跟进", true, -70 * time.Hour},
		{6, 2, 1, "微波炉：已退回状态，请白班继续跟进客户", false, -18 * time.Hour},
	}

	for _, h := range handovers {
		qid := quoteIDs[h.quoteIdx]
		from := users[h.fromIdx]
		to := users[h.toIdx]

		var confirmedAt *time.Time
		status := "pending"
		if h.confirmed {
			t := now.Add(h.offset + 30*time.Minute)
			confirmedAt = &t
			status = "confirmed"
		}

		_, err := tx.Exec(`INSERT INTO shift_handovers
			(quote_id, from_user_id, from_user_name, from_user_role, from_shift,
			 to_user_id, to_user_name, to_user_role, to_shift,
			 handover_remark, confirmed_at, status, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			qid,
			userIDs[h.fromIdx], from.RealName, from.Role, from.Shift,
			userIDs[h.toIdx], to.RealName, to.Role, to.Shift,
			h.remark, confirmedAt, status, now.Add(h.offset),
		)
		if err != nil {
			return fmt.Errorf("创建交接记录失败: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	log.Println("种子数据初始化成功")
	return nil
}
