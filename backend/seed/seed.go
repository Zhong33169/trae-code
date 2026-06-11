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
	for _, u := range users {
		result, err := database.DB.Exec("INSERT INTO users (username, display_name, role) VALUES (?, ?, ?)", u.Username, u.DisplayName, u.Role)
		if err != nil {
			return fmt.Errorf("seed user %s: %w", u.Username, err)
		}
		id, _ := result.LastInsertId()
		userIDs[u.Role] = int(id)
	}

	keeperID := userIDs["warehouse_keeper"]
	supervisorID := userIDs["temp_supervisor"]
	managerID := userIDs["warehouse_manager"]

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
		EvidenceTemperature bool
		EvidenceQuality     bool
		EvidenceQuantity    bool
		Notes               string
		CreatedAt           string
		UpdatedAt           string
		Records             []struct {
			HandlerID   int
			HandlerName string
			HandlerRole string
			Action      string
			Opinion     string
			Result      string
		}
	}

	orders := []seedOrder{
		{
			OrderNo: "CC20260601001", ProductName: "冻虾仁", Supplier: "远洋水产有限公司",
			TemperatureRange: "-18℃~-22℃", StorageLocation: "A区-01号库", RiskLevel: "high",
			Status: "verifying", CurrentHandlerID: supervisorID, CreatedBy: keeperID,
			EvidenceTemperature: true, EvidenceQuality: true, EvidenceQuantity: true,
			Notes: "高风险冷链产品，全程温控", CreatedAt: "2026-06-01 08:30:00", UpdatedAt: "2026-06-01 09:00:00",
			Records: []struct {
				HandlerID   int
				HandlerName string
				HandlerRole string
				Action      string
				Opinion     string
				Result      string
			}{
				{keeperID, "张三", "warehouse_keeper", "submit", "冻虾仁到货，温度-20℃，开始登记入库", "passed"},
				{supervisorID, "王五", "temp_supervisor", "advance", "温度记录完整，进入核验阶段", "passed"},
			},
		},
		{
			OrderNo: "CC20260601002", ProductName: "鲜牛奶", Supplier: "绿源牧业有限公司",
			TemperatureRange: "2℃~8℃", StorageLocation: "B区-03号库", RiskLevel: "medium",
			Status: "archived", CurrentHandlerID: managerID, CreatedBy: keeperID,
			EvidenceTemperature: true, EvidenceQuality: true, EvidenceQuantity: true,
			Notes: "中风险产品，已完成全流程", CreatedAt: "2026-05-28 10:00:00", UpdatedAt: "2026-05-28 16:00:00",
			Records: []struct {
				HandlerID   int
				HandlerName string
				HandlerRole string
				Action      string
				Opinion     string
				Result      string
			}{
				{keeperID, "张三", "warehouse_keeper", "submit", "鲜牛奶到货，温度4℃，登记入库", "passed"},
				{supervisorID, "王五", "temp_supervisor", "advance", "温控记录正常，推荐复核通过", "passed"},
				{managerID, "赵六", "warehouse_manager", "approve", "所有证据齐全，同意归档", "passed"},
			},
		},
		{
			OrderNo: "CC20260602001", ProductName: "冰鲜三文鱼", Supplier: "北海渔业有限公司",
			TemperatureRange: "0℃~4℃", StorageLocation: "C区-02号库", RiskLevel: "high",
			Status: "registered", CurrentHandlerID: keeperID, CreatedBy: keeperID,
			EvidenceTemperature: false, EvidenceQuality: false, EvidenceQuantity: false,
			Notes: "高风险产品，缺少温度和质量证据", CreatedAt: "2026-06-02 11:00:00", UpdatedAt: "2026-06-02 11:00:00",
			Records: []struct {
				HandlerID   int
				HandlerName string
				HandlerRole string
				Action      string
				Opinion     string
				Result      string
			}{
				{keeperID, "张三", "warehouse_keeper", "submit", "三文鱼到货，温度记录仪故障，暂缺温控数据", "passed"},
			},
		},
		{
			OrderNo: "CC20260602002", ProductName: "速冻水饺", Supplier: "中原食品集团",
			TemperatureRange: "-15℃~-18℃", StorageLocation: "A区-05号库", RiskLevel: "low",
			Status: "registered", CurrentHandlerID: keeperID, CreatedBy: keeperID,
			EvidenceTemperature: true, EvidenceQuality: false, EvidenceQuantity: false,
			Notes: "低风险产品，仅有温度记录", CreatedAt: "2026-06-02 14:00:00", UpdatedAt: "2026-06-02 14:00:00",
			Records: []struct {
				HandlerID   int
				HandlerName string
				HandlerRole string
				Action      string
				Opinion     string
				Result      string
			}{
				{keeperID, "张三", "warehouse_keeper", "submit", "速冻水饺到货，温度-16℃正常", "passed"},
			},
		},
		{
			OrderNo: "CC20260603001", ProductName: "冷鲜牛肉", Supplier: "草原肉业有限公司",
			TemperatureRange: "0℃~4℃", StorageLocation: "D区-01号库", RiskLevel: "high",
			Status: "overdue", CurrentHandlerID: supervisorID, CreatedBy: keeperID,
			EvidenceTemperature: true, EvidenceQuality: true, EvidenceQuantity: false,
			Notes: "高风险产品，核验阶段已逾期7天", CreatedAt: "2026-05-25 09:00:00", UpdatedAt: "2026-06-03 09:00:00",
			Records: []struct {
				HandlerID   int
				HandlerName string
				HandlerRole string
				Action      string
				Opinion     string
				Result      string
			}{
				{keeperID, "张三", "warehouse_keeper", "submit", "冷鲜牛肉到货登记", "passed"},
				{supervisorID, "王五", "temp_supervisor", "advance", "缺少数量证据，暂时无法推进", "passed"},
			},
		},
		{
			OrderNo: "CC20260603002", ProductName: "冷藏酸奶", Supplier: "优酪乳业有限公司",
			TemperatureRange: "2℃~6℃", StorageLocation: "B区-02号库", RiskLevel: "medium",
			Status: "returned", CurrentHandlerID: keeperID, CreatedBy: keeperID,
			EvidenceTemperature: true, EvidenceQuality: false, EvidenceQuantity: false,
			Notes: "中风险产品，被退回要求补正相关证据", CreatedAt: "2026-05-30 10:00:00", UpdatedAt: "2026-06-03 11:00:00",
			Records: []struct {
				HandlerID   int
				HandlerName string
				HandlerRole string
				Action      string
				Opinion     string
				Result      string
			}{
				{keeperID, "张三", "warehouse_keeper", "submit", "酸奶到货，温度4℃正常", "passed"},
				{supervisorID, "王五", "temp_supervisor", "return", "质量检测报告缺失，退回补正", "returned"},
			},
		},
		{
			OrderNo: "CC20260604001", ProductName: "冷冻羊肉卷", Supplier: "蒙东肉业集团",
			TemperatureRange: "-18℃~-22℃", StorageLocation: "A区-03号库", RiskLevel: "high",
			Status: "conflict", CurrentHandlerID: managerID, CreatedBy: keeperID,
			EvidenceTemperature: true, EvidenceQuality: true, EvidenceQuantity: true,
			Notes: "高风险产品，出现版本冲突状态异常", CreatedAt: "2026-06-04 08:00:00", UpdatedAt: "2026-06-04 10:00:00",
			Records: []struct {
				HandlerID   int
				HandlerName string
				HandlerRole string
				Action      string
				Opinion     string
				Result      string
			}{
				{keeperID, "张三", "warehouse_keeper", "submit", "羊肉卷到货登记", "passed"},
				{supervisorID, "王五", "temp_supervisor", "advance", "核验通过，提交复核", "passed"},
				{managerID, "赵六", "warehouse_manager", "advance", "版本冲突：并发操作导致状态异常", "conflict"},
			},
		},
		{
			OrderNo: "CC20260605001", ProductName: "冷鲜猪肉", Supplier: "金锣肉业集团",
			TemperatureRange: "0℃~4℃", StorageLocation: "D区-03号库", RiskLevel: "medium",
			Status: "verifying", CurrentHandlerID: supervisorID, CreatedBy: keeperID,
			EvidenceTemperature: true, EvidenceQuality: false, EvidenceQuantity: true,
			Notes: "中风险产品，核验中缺质量证据", CreatedAt: "2026-06-05 13:00:00", UpdatedAt: "2026-06-05 14:00:00",
			Records: []struct {
				HandlerID   int
				HandlerName string
				HandlerRole string
				Action      string
				Opinion     string
				Result      string
			}{
				{keeperID, "李四", "warehouse_keeper", "submit", "冷鲜猪肉到货，温度2℃，登记入库", "passed"},
			},
		},
	}

	for _, o := range orders {
		result, err := database.DB.Exec(
			`INSERT INTO orders (order_no, product_name, supplier, temperature_range, storage_location, risk_level, status, current_handler_id, version, created_by, evidence_temperature, evidence_quality, evidence_quantity, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
			o.OrderNo, o.ProductName, o.Supplier, o.TemperatureRange, o.StorageLocation, o.RiskLevel, o.Status, o.CurrentHandlerID, o.CreatedBy,
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
	fmt.Println("样例数据已初始化完成")
	return nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
