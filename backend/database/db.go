package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

func InitDB(dbPath string) *sql.DB {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		panic(fmt.Sprintf("Failed to open database: %v", err))
	}

	createTables(db)
	return db
}

func createTables(db *sql.DB) {
	createUsersTable := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		role TEXT NOT NULL,
		display_name TEXT NOT NULL
	);`

	createOrdersTable := `
	CREATE TABLE IF NOT EXISTS after_sale_orders (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		order_no TEXT UNIQUE NOT NULL,
		customer_name TEXT NOT NULL,
		product_name TEXT NOT NULL,
		order_amount REAL NOT NULL,
		refund_amount REAL NOT NULL,
		risk_level TEXT NOT NULL,
		current_stage TEXT NOT NULL,
		current_step TEXT NOT NULL,
		status TEXT NOT NULL,
		handler_role TEXT NOT NULL,
		handler_name TEXT NOT NULL,
		required_evidence TEXT NOT NULL DEFAULT '[]',
		evidence_provided TEXT NOT NULL DEFAULT '[]',
		version INTEGER NOT NULL DEFAULT 1,
		deadline DATETIME,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);`

	createRecordsTable := `
	CREATE TABLE IF NOT EXISTS processing_records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		order_id INTEGER NOT NULL,
		stage TEXT NOT NULL,
		step TEXT NOT NULL,
		action TEXT NOT NULL,
		handler_role TEXT NOT NULL,
		handler_name TEXT NOT NULL,
		opinion TEXT,
		result TEXT,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (order_id) REFERENCES after_sale_orders(id)
	);`

	createRiskLogsTable := `
	CREATE TABLE IF NOT EXISTS risk_change_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		order_id INTEGER NOT NULL,
		old_level TEXT NOT NULL,
		new_level TEXT NOT NULL,
		reason TEXT NOT NULL,
		operator TEXT NOT NULL,
		operator_role TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (order_id) REFERENCES after_sale_orders(id)
	);`

	tables := []string{createUsersTable, createOrdersTable, createRecordsTable, createRiskLogsTable}
	for _, table := range tables {
		if _, err := db.Exec(table); err != nil {
			panic(fmt.Sprintf("Failed to create table: %v", err))
		}
	}
}

func SeedData(db *sql.DB) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil || count > 0 {
		return
	}

	tx, err := db.Begin()
	if err != nil {
		panic(fmt.Sprintf("Failed to begin transaction: %v", err))
	}

	users := []struct {
		Name        string
		Role        string
		DisplayName string
	}{
		{"zhangsan", "clerk", "张三(登记员)"},
		{"lisi", "supervisor", "李四(审核主管)"},
		{"wangwu", "reviewer", "王五(复核负责人)"},
	}

	for _, u := range users {
		_, err := tx.Exec("INSERT INTO users (name, role, display_name) VALUES (?, ?, ?)", u.Name, u.Role, u.DisplayName)
		if err != nil {
			tx.Rollback()
			panic(fmt.Sprintf("Failed to insert user: %v", err))
		}
	}

	now := time.Now()
	layout := "2006-01-02 15:04:05"

	orders := []struct {
		OrderNo          string
		CustomerName     string
		ProductName      string
		OrderAmount      float64
		RefundAmount     float64
		RiskLevel        string
		CurrentStage     string
		CurrentStep      string
		Status           string
		HandlerRole      string
		HandlerName      string
		RequiredEvidence []string
		EvidenceProvided []string
		Version          int
		Deadline         string
		CreatedAt        string
		UpdatedAt        string
	}{
		{
			"AS20240601001", "陈小明", "iPhone 15 Pro", 8999, 8999,
			"low", "refund", "initiate", "draft", "clerk", "张三(登记员)",
			[]string{"订单截图", "退款申请"}, []string{"订单截图"},
			1, "2024-06-15 23:59:59", "2024-06-01 09:00:00", now.Format(layout),
		},
		{
			"AS20240601002", "李芳", "MacBook Air M3", 10999, 10999,
			"high", "refund", "review", "pending_review", "reviewer", "王五(复核负责人)",
			[]string{"订单截图", "退款申请", "支付凭证"}, []string{"订单截图", "退款申请", "支付凭证"},
			3, "2024-06-10 23:59:59", "2024-06-01 10:00:00", now.Format(layout),
		},
		{
			"AS20240601003", "王大伟", "AirPods Pro", 1899, 1899,
			"medium", "warehouse", "initiate", "draft", "clerk", "张三(登记员)",
			[]string{"订单截图", "退货物流单", "退款申请"}, []string{"订单截图"},
			2, "2024-06-08 23:59:59", "2024-06-01 11:00:00", now.Format(layout),
		},
		{
			"AS20240601004", "赵丽", "iPad Air", 4799, 4799,
			"low", "refund", "initiate", "returned", "clerk", "张三(登记员)",
			[]string{"订单截图", "退款申请"}, []string{"订单截图"},
			2, "2024-06-20 23:59:59", "2024-06-01 12:00:00", now.Format(layout),
		},
		{
			"AS20240601005", "孙志强", "Apple Watch Ultra", 6499, 6499,
			"high", "followup", "process", "pending_process", "supervisor", "李四(审核主管)",
			[]string{"订单截图", "退款申请", "支付凭证", "仓库签收单"}, []string{"订单截图", "退款申请", "支付凭证", "仓库签收单"},
			5, "2024-06-25 23:59:59", "2024-06-01 13:00:00", now.Format(layout),
		},
		{
			"AS20240601006", "周小琳", "Mac Mini M2", 4499, 3999,
			"medium", "warehouse", "review", "pending_review", "reviewer", "王五(复核负责人)",
			[]string{"订单截图", "退货物流单", "退款申请"}, []string{"订单截图", "退货物流单", "退款申请"},
			4, "2024-06-18 23:59:59", "2024-06-01 14:00:00", now.Format(layout),
		},
		{
			"AS20240601007", "吴刚", "HomePod Mini", 749, 749,
			"low", "refund", "review", "conflict", "reviewer", "王五(复核负责人)",
			[]string{"订单截图", "退款申请"}, []string{"订单截图"},
			1, "2024-06-05 23:59:59", "2024-06-01 15:00:00", now.Format(layout),
		},
		{
			"AS20240601008", "郑雅文", "Vision Pro", 29999, 29999,
			"high", "refund", "process", "pending_process", "supervisor", "李四(审核主管)",
			[]string{"订单截图", "退款申请", "支付凭证", "身份验证", "大额审批单"}, []string{"订单截图", "退款申请"},
			2, "2024-06-12 23:59:59", "2024-06-01 16:00:00", now.Format(layout),
		},
	}

	orderIDs := make([]int64, len(orders))
	for i, o := range orders {
		reqJSON, _ := json.Marshal(o.RequiredEvidence)
		eviJSON, _ := json.Marshal(o.EvidenceProvided)
		result, err := tx.Exec(
			`INSERT INTO after_sale_orders (order_no, customer_name, product_name, order_amount, refund_amount, risk_level, current_stage, current_step, status, handler_role, handler_name, required_evidence, evidence_provided, version, deadline, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			o.OrderNo, o.CustomerName, o.ProductName, o.OrderAmount, o.RefundAmount, o.RiskLevel, o.CurrentStage, o.CurrentStep, o.Status, o.HandlerRole, o.HandlerName, string(reqJSON), string(eviJSON), o.Version, o.Deadline, o.CreatedAt, o.UpdatedAt,
		)
		if err != nil {
			tx.Rollback()
			panic(fmt.Sprintf("Failed to insert order: %v", err))
		}
		orderIDs[i], _ = result.LastInsertId()
	}

	records := []struct {
		OrderID     int64
		Stage       string
		Step        string
		Action      string
		HandlerRole string
		HandlerName string
		Opinion     string
		Result      string
		CreatedAt   string
	}{
		{orderIDs[0], "refund", "initiate", "create", "clerk", "张三(登记员)", "创建售后工单", "已创建", "2024-06-01 09:00:00"},
		{orderIDs[0], "refund", "initiate", "update_evidence", "clerk", "张三(登记员)", "上传订单截图", "更新证据材料", "2024-06-01 09:05:00"},
		{orderIDs[0], "refund", "initiate", "evidence_update_failed", "clerk", "张三(登记员)", "", "缺少必填证据: 退款申请", "2024-06-01 09:08:00"},
		{orderIDs[0], "refund", "initiate", "validation_failed", "clerk", "张三(登记员)", "", "缺少必要证据: 退款申请", "2024-06-01 09:10:00"},

		{orderIDs[1], "refund", "initiate", "update_evidence", "clerk", "张三(登记员)", "上传订单截图、退款申请、支付凭证", "更新证据材料: 订单截图、退款申请、支付凭证", "2024-06-01 09:50:00"},
		{orderIDs[1], "refund", "initiate", "initiate", "clerk", "张三(登记员)", "提交退款申请，金额较大需审核", "已提交审核", "2024-06-01 10:00:00"},
		{orderIDs[1], "refund", "initiate", "evidence_update_failed", "supervisor", "李四(审核主管)", "", "越权变更证据: 角色 supervisor 不允许操作", "2024-06-01 10:05:00"},
		{orderIDs[1], "refund", "initiate", "validation_failed", "supervisor", "李四(审核主管)", "", "角色不匹配", "2024-06-01 10:10:00"},
		{orderIDs[1], "refund", "process", "process", "supervisor", "李四(审核主管)", "审核通过，金额与订单一致，建议复核", "审核通过", "2024-06-01 10:30:00"},
		{orderIDs[1], "refund", "review", "review_archive", "reviewer", "王五(复核负责人)", "复核中，等待确认", "待复核", "2024-06-01 11:00:00"},

		{orderIDs[2], "refund", "initiate", "initiate", "clerk", "张三(登记员)", "提交退款申请", "已提交审核", "2024-06-01 11:00:00"},
		{orderIDs[2], "refund", "process", "review_archive", "supervisor", "李四(审核主管)", "审核通过，进入仓库阶段", "进入仓库阶段", "2024-06-01 11:30:00"},
		{orderIDs[2], "warehouse", "initiate", "evidence_update_failed", "clerk", "张三(登记员)", "", "证据未覆盖必填项: 退货物流单、退款申请", "2024-06-01 11:35:00"},
		{orderIDs[2], "warehouse", "initiate", "evidence_update_failed", "reviewer", "王五(复核负责人)", "", "越权变更证据: 角色 reviewer 不允许操作", "2024-06-01 11:38:00"},
		{orderIDs[2], "warehouse", "initiate", "validation_failed", "clerk", "张三(登记员)", "", "缺少必要证据: 退货物流单、退款申请", "2024-06-01 11:45:00"},

		{orderIDs[3], "refund", "initiate", "initiate", "clerk", "张三(登记员)", "提交退款申请", "已提交审核", "2024-06-01 12:00:00"},
		{orderIDs[3], "refund", "process", "return", "supervisor", "李四(审核主管)", "证据不完整，退回补充退款申请单", "已退回", "2024-06-01 12:30:00"},
		{orderIDs[3], "refund", "initiate", "evidence_update_failed", "clerk", "张三(登记员)", "", "版本冲突: 当前版本 2, 提交版本 1", "2024-06-01 12:35:00"},
		{orderIDs[3], "refund", "initiate", "validation_failed", "clerk", "张三(登记员)", "", "缺少必要证据: 退款申请", "2024-06-01 12:40:00"},
		{orderIDs[3], "refund", "initiate", "update_evidence", "clerk", "张三(登记员)", "", "更新证据材料: 订单截图、退款申请", "2024-06-01 12:45:00"},
		{orderIDs[3], "refund", "initiate", "correct", "clerk", "张三(登记员)", "补齐退款申请单，重新提交", "已修正并重新提交", "2024-06-01 12:50:00"},

		{orderIDs[4], "refund", "initiate", "initiate", "clerk", "张三(登记员)", "高风险订单，提交审核", "已提交审核", "2024-06-01 13:00:00"},
		{orderIDs[4], "refund", "process", "process", "supervisor", "李四(审核主管)", "审核通过，进入仓库阶段", "审核通过", "2024-06-01 13:30:00"},
		{orderIDs[4], "warehouse", "process", "process", "supervisor", "李四(审核主管)", "仓库确认收货，进入跟进阶段", "进入跟进阶段", "2024-06-01 14:00:00"},
		{orderIDs[4], "followup", "process", "validation_failed", "supervisor", "李四(审核主管)", "", "版本冲突", "2024-06-01 14:10:00"},

		{orderIDs[5], "refund", "initiate", "initiate", "clerk", "张三(登记员)", "提交退款申请", "已提交审核", "2024-06-01 14:00:00"},
		{orderIDs[5], "refund", "process", "process", "supervisor", "李四(审核主管)", "审核通过", "审核通过", "2024-06-01 14:30:00"},
		{orderIDs[5], "warehouse", "process", "review_archive", "reviewer", "王五(复核负责人)", "仓库阶段复核完成", "复核通过", "2024-06-01 15:00:00"},

		{orderIDs[6], "refund", "initiate", "initiate", "clerk", "张三(登记员)", "提交退款申请", "已提交审核", "2024-06-01 15:00:00"},
		{orderIDs[6], "refund", "initiate", "process", "reviewer", "王五(复核负责人)", "越权操作，状态被强行推进", "状态异常", "2024-06-01 15:15:00"},
		{orderIDs[6], "refund", "review", "review_archive", "reviewer", "王五(复核负责人)", "状态异常，证据不完整但已到复核阶段", "冲突状态", "2024-06-01 15:30:00"},
		{orderIDs[6], "refund", "review", "validation_failed", "reviewer", "王五(复核负责人)", "", "缺少必要证据: 退款申请", "2024-06-01 15:35:00"},

		{orderIDs[7], "refund", "initiate", "create", "clerk", "张三(登记员)", "创建大额退款工单", "已创建", "2024-06-01 15:40:00"},
		{orderIDs[7], "refund", "initiate", "evidence_update_failed", "clerk", "张三(登记员)", "", "证据未覆盖必填项: 身份验证、大额审批单", "2024-06-01 15:45:00"},
		{orderIDs[7], "refund", "initiate", "evidence_update_failed", "reviewer", "王五(复核负责人)", "", "越权变更证据: 角色 reviewer 不允许操作", "2024-06-01 15:48:00"},
		{orderIDs[7], "refund", "initiate", "update_evidence", "clerk", "张三(登记员)", "", "更新证据材料: 订单截图、退款申请、支付凭证、身份验证、大额审批单", "2024-06-01 15:55:00"},
		{orderIDs[7], "refund", "initiate", "initiate", "clerk", "张三(登记员)", "大额退款申请，需高级审核", "已提交审核", "2024-06-01 16:00:00"},
		{orderIDs[7], "refund", "process", "evidence_update_failed", "clerk", "张三(登记员)", "", "状态 pending_process 不允许维护证据", "2024-06-01 16:10:00"},
		{orderIDs[7], "refund", "process", "validation_failed", "supervisor", "李四(审核主管)", "", "缺少必要证据: 身份验证、大额审批单", "2024-06-01 16:15:00"},
		{orderIDs[7], "refund", "process", "validation_failed", "supervisor", "李四(审核主管)", "", "版本冲突", "2024-06-01 16:20:00"},
		{orderIDs[7], "refund", "process", "process", "supervisor", "李四(审核主管)", "审核进行中，缺少身份验证和大额审批单，暂挂起", "审核中", "2024-06-01 16:30:00"},
	}

	for _, r := range records {
		_, err := tx.Exec(
			`INSERT INTO processing_records (order_id, stage, step, action, handler_role, handler_name, opinion, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			r.OrderID, r.Stage, r.Step, r.Action, r.HandlerRole, r.HandlerName, r.Opinion, r.Result, r.CreatedAt,
		)
		if err != nil {
			tx.Rollback()
			panic(fmt.Sprintf("Failed to insert record: %v", err))
		}
	}

	riskLogs := []struct {
		OrderID      int64
		OldLevel     string
		NewLevel     string
		Reason       string
		Operator     string
		OperatorRole string
		CreatedAt    string
	}{
		{orderIDs[2], "medium", "low", "仓库核实阶段，客户确认退货，风险降级", "王五(复核负责人)", "reviewer", "2024-06-01 11:20:00"},
		{orderIDs[2], "low", "medium", "逾期未处理，风险恢复为中等级别", "李四(审核主管)", "supervisor", "2024-06-09 09:00:00"},
		{orderIDs[4], "medium", "high", "订单金额较大且客户历史退款频率高，升级风险等级", "李四(审核主管)", "supervisor", "2024-06-01 13:15:00"},
		{orderIDs[7], "medium", "high", "Vision Pro大额退款，升级为高风险", "李四(审核主管)", "supervisor", "2024-06-01 16:15:00"},
	}

	for _, rl := range riskLogs {
		_, err := tx.Exec(
			`INSERT INTO risk_change_logs (order_id, old_level, new_level, reason, operator, operator_role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			rl.OrderID, rl.OldLevel, rl.NewLevel, rl.Reason, rl.Operator, rl.OperatorRole, rl.CreatedAt,
		)
		if err != nil {
			tx.Rollback()
			panic(fmt.Sprintf("Failed to insert risk log: %v", err))
		}
	}

	if err := tx.Commit(); err != nil {
		panic(fmt.Sprintf("Failed to commit transaction: %v", err))
	}
}
