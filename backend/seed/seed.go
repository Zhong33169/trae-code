package seed

import (
	"coldchain/database"
	"fmt"
	"time"
)

func SeedData() error {
	var count int
	database.DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if count > 0 {
		return nil
	}

	users := []struct {
		Username    string
		DisplayName string
		Role        string
	}{
		{"zhangsan", "张三", "warehouse_keeper"},
		{"lisi", "李四", "warehouse_keeper"},
		{"wangwu", "王五", "temp_supervisor"},
		{"zhaoliu", "赵六", "warehouse_manager"},
	}

	userIDs := map[string]int{}
	userAllIDs := []int{}
	for _, u := range users {
		result, err := database.DB.Exec("INSERT INTO users (username, display_name, role) VALUES (?, ?, ?)", u.Username, u.DisplayName, u.Role)
		if err != nil {
			return fmt.Errorf("seed user %s: %w", u.Username, err)
		}
		id, _ := result.LastInsertId()
		userIDs[u.Role] = int(id)
		userAllIDs = append(userAllIDs, int(id))
	}

	keeperID1 := userAllIDs[0]
	keeperID2 := userAllIDs[1]
	supervisorID := userAllIDs[2]
	managerID := userAllIDs[3]

	keeper1Name := "张三"
	keeper2Name := "李四"
	supervisorName := "王五"
	managerName := "赵六"

	type seedRecord struct {
		HandlerID   int
		HandlerName string
		HandlerRole string
		Action      string
		Opinion     string
		Result      string
	}

	type seedOrder struct {
		OrderNo             string
		ProductName         string
		Supplier            string
		TemperatureRange    string
		StorageLocation     string
		RiskLevel           string
		Status              string
		CurrentHandlerID    int
		CreatedBy           int
		Version             int
		EvidenceTemperature bool
		EvidenceQuality     bool
		EvidenceQuantity    bool
		Notes               string
		CreatedAt           string
		UpdatedAt           string
		Records             []seedRecord
	}

	orders := []seedOrder{
		{
			OrderNo: "CC20260601001", ProductName: "冻虾仁", Supplier: "远洋水产有限公司",
			TemperatureRange: "-18℃~-22℃", StorageLocation: "A区-01号库", RiskLevel: "high",
			Status: "reviewing", CurrentHandlerID: managerID, CreatedBy: keeperID1, Version: 3,
			EvidenceTemperature: true, EvidenceQuality: true, EvidenceQuantity: true,
			Notes: "高风险冷链产品，温控主管已核验通过，待仓储经理复核归档",
			CreatedAt: "2026-06-01 08:30:00", UpdatedAt: "2026-06-10 14:20:00",
			Records: []seedRecord{
				{keeperID1, keeper1Name, "warehouse_keeper", "submit", "冻虾仁到货，温度-20℃，核对箱数 120 箱，登记入库", "passed"},
				{supervisorID, supervisorName, "temp_supervisor", "advance", "温度曲线全程在 -18℃~-22℃ 区间，质量检测报告合格，数量核实无误，推进至经理复核", "passed"},
				{managerID, managerName, "warehouse_manager", "advance", "温控主管核验通过，流转至待复核（经理）", "passed"},
			},
		},
		{
			OrderNo: "CC20260601002", ProductName: "鲜牛奶", Supplier: "绿源牧业有限公司",
			TemperatureRange: "2℃~8℃", StorageLocation: "B区-03号库", RiskLevel: "medium",
			Status: "archived", CurrentHandlerID: managerID, CreatedBy: keeperID1, Version: 4,
			EvidenceTemperature: true, EvidenceQuality: true, EvidenceQuantity: true,
			Notes: "已完成全流程（已复核归档）",
			CreatedAt: "2026-05-28 10:00:00", UpdatedAt: "2026-05-29 09:30:00",
			Records: []seedRecord{
				{keeperID1, keeper1Name, "warehouse_keeper", "submit", "鲜牛奶到货，温度4℃，250 箱，登记入库", "passed"},
				{supervisorID, supervisorName, "temp_supervisor", "advance", "温控记录全程 3~5℃，在区间内，质量检测合格，提交复核", "passed"},
				{managerID, managerName, "warehouse_manager", "approve", "复核通过：温度、质量、数量证据齐全，同意归档", "passed"},
			},
		},
		{
			OrderNo: "CC20260602001", ProductName: "冰鲜三文鱼", Supplier: "北海渔业有限公司",
			TemperatureRange: "0℃~4℃", StorageLocation: "C区-02号库", RiskLevel: "high",
			Status: "registered", CurrentHandlerID: keeperID1, CreatedBy: keeperID1, Version: 1,
			EvidenceTemperature: false, EvidenceQuality: false, EvidenceQuantity: false,
			Notes: "高风险产品，缺少温度和质量证据",
			CreatedAt: "2026-06-02 11:00:00", UpdatedAt: "2026-06-02 11:00:00",
			Records: []seedRecord{
				{keeperID1, keeper1Name, "warehouse_keeper", "submit", "三文鱼到货，但温度记录仪故障，暂缺温控数据，质量报告尚未出具", "passed"},
			},
		},
		{
			OrderNo: "CC20260602002", ProductName: "速冻水饺", Supplier: "中原食品集团",
			TemperatureRange: "-15℃~-18℃", StorageLocation: "A区-05号库", RiskLevel: "low",
			Status: "verifying", CurrentHandlerID: supervisorID, CreatedBy: keeperID2, Version: 2,
			EvidenceTemperature: true, EvidenceQuality: false, EvidenceQuantity: false,
			Notes: "低风险产品，核验中，缺少质量和数量证据",
			CreatedAt: "2026-06-02 14:00:00", UpdatedAt: "2026-06-03 09:15:00",
			Records: []seedRecord{
				{keeperID2, keeper2Name, "warehouse_keeper", "submit", "速冻水饺到货，温度-16℃，登记入库", "passed"},
				{keeperID2, keeper2Name, "warehouse_keeper", "advance", "仓管员推进至核验环节，补充了温度记录证据", "passed"},
			},
		},
		{
			OrderNo: "CC20260603001", ProductName: "冷鲜牛肉", Supplier: "草原肉业有限公司",
			TemperatureRange: "0℃~4℃", StorageLocation: "D区-01号库", RiskLevel: "high",
			Status: "overdue", CurrentHandlerID: supervisorID, CreatedBy: keeperID1, Version: 2,
			EvidenceTemperature: true, EvidenceQuality: true, EvidenceQuantity: false,
			Notes: "高风险产品，核验阶段已逾期 7 天（缺数量证据）",
			CreatedAt: "2026-05-25 09:00:00", UpdatedAt: "2026-06-03 09:00:00",
			Records: []seedRecord{
				{keeperID1, keeper1Name, "warehouse_keeper", "submit", "冷鲜牛肉到货，登记入库", "passed"},
				{keeperID1, keeper1Name, "warehouse_keeper", "advance", "推进至核验环节", "passed"},
			},
		},
		{
			OrderNo: "CC20260603002", ProductName: "冷藏酸奶", Supplier: "优酪乳业有限公司",
			TemperatureRange: "2℃~6℃", StorageLocation: "B区-02号库", RiskLevel: "medium",
			Status: "returned", CurrentHandlerID: keeperID1, CreatedBy: keeperID1, Version: 3,
			EvidenceTemperature: true, EvidenceQuality: false, EvidenceQuantity: true,
			Notes: "被温控主管退回补正：缺少质量检测报告",
			CreatedAt: "2026-05-30 10:00:00", UpdatedAt: "2026-06-03 11:00:00",
			Records: []seedRecord{
				{keeperID1, keeper1Name, "warehouse_keeper", "submit", "酸奶到货，温度4℃正常", "passed"},
				{keeperID1, keeper1Name, "warehouse_keeper", "advance", "推进至核验", "passed"},
				{supervisorID, supervisorName, "temp_supervisor", "return", "退回原因：缺少批次质量检测报告（中风险要求必须提供温度证据+随货质检报告），请仓管员补正后重新提交", "returned"},
			},
		},
		{
			OrderNo: "CC20260604001", ProductName: "冷冻羊肉卷", Supplier: "蒙东肉业集团",
			TemperatureRange: "-18℃~-22℃", StorageLocation: "A区-03号库", RiskLevel: "high",
			Status: "rejected", CurrentHandlerID: managerID, CreatedBy: keeperID2, Version: 5,
			EvidenceTemperature: true, EvidenceQuality: true, EvidenceQuantity: true,
			Notes: "经理驳回：证据涉嫌伪造，需重新核验",
			CreatedAt: "2026-06-04 08:00:00", UpdatedAt: "2026-06-09 16:45:00",
			Records: []seedRecord{
				{keeperID2, keeper2Name, "warehouse_keeper", "submit", "羊肉卷到货登记", "passed"},
				{keeperID2, keeper2Name, "warehouse_keeper", "advance", "推进至核验", "passed"},
				{supervisorID, supervisorName, "temp_supervisor", "advance", "温度合格，证据齐全，提交经理复核", "passed"},
				{supervisorID, supervisorName, "temp_supervisor", "advance", "提交版本冲突审计：尝试 v3 提交，但数据库已到 v4", "conflict"},
				{managerID, managerName, "warehouse_manager", "reject", "驳回原因：温度记录仪编号与批次标签不一致，质量检测报告出具日期晚于到货日期，证据涉嫌伪造。需重新采集全部证据并经仓管员重新核验后再提交。（冲突审计已写入操作记录）", "rejected"},
			},
		},
		{
			OrderNo: "CC20260605001", ProductName: "冷鲜猪肉", Supplier: "金锣肉业集团",
			TemperatureRange: "0℃~4℃", StorageLocation: "D区-03号库", RiskLevel: "medium",
			Status: "verifying", CurrentHandlerID: supervisorID, CreatedBy: keeperID2, Version: 2,
			EvidenceTemperature: true, EvidenceQuality: false, EvidenceQuantity: true,
			Notes: "中风险，核验中，缺少质量证据（温度已补）",
			CreatedAt: "2026-06-05 13:00:00", UpdatedAt: "2026-06-05 14:00:00",
			Records: []seedRecord{
				{keeperID2, keeper2Name, "warehouse_keeper", "submit", "冷鲜猪肉到货，温度2℃，登记入库", "passed"},
				{keeperID2, keeper2Name, "warehouse_keeper", "advance", "推进至核验", "passed"},
			},
		},
		{
			OrderNo: "CC20260605002", ProductName: "冷冻蓝莓", Supplier: "东北鲜果集团",
			TemperatureRange: "-20℃~-25℃", StorageLocation: "E区-01号库", RiskLevel: "medium",
			Status: "reviewing", CurrentHandlerID: managerID, CreatedBy: keeperID2, Version: 3,
			EvidenceTemperature: true, EvidenceQuality: false, EvidenceQuantity: true,
			Notes: "中风险，待经理复核。缺少质量证据——需经理决策是否特批",
			CreatedAt: "2026-06-05 15:00:00", UpdatedAt: "2026-06-10 10:30:00",
			Records: []seedRecord{
				{keeperID2, keeper2Name, "warehouse_keeper", "submit", "冷冻蓝莓到货登记", "passed"},
				{keeperID2, keeper2Name, "warehouse_keeper", "advance", "推进至核验", "passed"},
				{supervisorID, supervisorName, "temp_supervisor", "advance", "温控记录全程正常，数量匹配，但随货质检报告未到（供应商电子版正在路上），特提请经理决策是否在质量证据缺失情况下先复核", "passed"},
			},
		},
		{
			OrderNo: "CC20260606001", ProductName: "冷冻虾滑", Supplier: "启东水产加工有限公司",
			TemperatureRange: "-18℃~-22℃", StorageLocation: "A区-07号库", RiskLevel: "high",
			Status: "conflict", CurrentHandlerID: managerID, CreatedBy: keeperID1, Version: 6,
			EvidenceTemperature: true, EvidenceQuality: true, EvidenceQuantity: true,
			Notes: "状态冲突：经理复核环节并发操作导致版本冲突，需强制修复",
			CreatedAt: "2026-06-06 09:00:00", UpdatedAt: "2026-06-08 11:20:00",
			Records: []seedRecord{
				{keeperID1, keeper1Name, "warehouse_keeper", "submit", "虾滑到货登记", "passed"},
				{keeperID1, keeper1Name, "warehouse_keeper", "advance", "推进至核验", "passed"},
				{supervisorID, supervisorName, "temp_supervisor", "advance", "核验通过，提交复核", "passed"},
				{managerID, managerName, "warehouse_manager", "advance", "并发冲突审计：多端同时操作，版本冲突（提交 v4，DB 已 v5）", "conflict"},
				{managerID, managerName, "warehouse_manager", "advance", "并发冲突审计：角色校验失败（临时切换用户导致）", "conflict"},
				{managerID, managerName, "warehouse_manager", "advance", "冲突修复失败：状态停留在 reviewing，但证据已被部分修改，需强制修复回登记", "conflict"},
			},
		},
	}

	for _, o := range orders {
		result, err := database.DB.Exec(
			`INSERT INTO orders (order_no, product_name, supplier, temperature_range, storage_location, risk_level, status, current_handler_id, version, created_by, evidence_temperature, evidence_quality, evidence_quantity, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			o.OrderNo, o.ProductName, o.Supplier, o.TemperatureRange, o.StorageLocation, o.RiskLevel, o.Status, o.CurrentHandlerID, o.Version, o.CreatedBy,
			boolToInt(o.EvidenceTemperature), boolToInt(o.EvidenceQuality), boolToInt(o.EvidenceQuantity), o.Notes, o.CreatedAt, o.UpdatedAt)
		if err != nil {
			return fmt.Errorf("seed order %s: %w", o.OrderNo, err)
		}
		orderID, _ := result.LastInsertId()

		for _, r := range o.Records {
			_, err := database.DB.Exec(
				`INSERT INTO operation_records (order_id, handler_id, handler_name, handler_role, action, opinion, result, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))`,
				orderID, r.HandlerID, r.HandlerName, r.HandlerRole, r.Action, r.Opinion, r.Result)
			if err != nil {
				return fmt.Errorf("seed record for order %s: %w", o.OrderNo, err)
			}
		}
	}

	_ = time.Now()
	fmt.Println("样例数据已初始化完成（含待复核/驳回/冲突审计样例）")
	return nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
