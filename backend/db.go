package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

func MustInitDB(path string) *sql.DB {
	dir := filepath.Dir(path)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Fatalf("创建数据目录失败: %v", err)
		}
	}
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_txlock=immediate", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		log.Fatalf("打开数据库失败: %v", err)
	}
	db.SetMaxOpenConns(1)
	if err := db.Ping(); err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}
	migrate(db)
	return db
}

func migrate(db *sql.DB) {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL CHECK(role IN ('customer_manager','underwriting_specialist','business_owner')),
			display_name TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS tasks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			task_no TEXT UNIQUE NOT NULL,
			policy_no TEXT NOT NULL,
			customer_name TEXT NOT NULL,
			product TEXT NOT NULL,
			renewal_type TEXT NOT NULL,
			original_premium REAL NOT NULL,
			new_premium REAL NOT NULL,
			status TEXT NOT NULL DEFAULT 'draft',
			version INTEGER NOT NULL DEFAULT 1,
			submitter_id INTEGER REFERENCES users(id),
			current_handler_role TEXT,
			reg_evidence TEXT,
			verify_evidence TEXT,
			archive_evidence TEXT,
			last_batch_id INTEGER,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS batches (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			batch_no TEXT UNIQUE NOT NULL,
			action TEXT NOT NULL,
			operator_id INTEGER REFERENCES users(id),
			operator_role TEXT NOT NULL,
			total INTEGER NOT NULL,
			success_count INTEGER NOT NULL DEFAULT 0,
			fail_count INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'completed',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS batch_items (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			batch_id INTEGER REFERENCES batches(id) ON DELETE CASCADE,
			task_id INTEGER REFERENCES tasks(id),
			task_no TEXT,
			status TEXT NOT NULL,
			error_reason TEXT,
			retry_count INTEGER NOT NULL DEFAULT 0,
			processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS audit_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			batch_id INTEGER REFERENCES batches(id),
			task_id INTEGER REFERENCES tasks(id),
			task_no TEXT,
			action TEXT NOT NULL,
			operator_id INTEGER REFERENCES users(id),
			operator_role TEXT NOT NULL,
			from_status TEXT,
			to_status TEXT,
			detail TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			log.Fatalf("迁移失败: %v\nSQL: %s", err, s)
		}
	}
}

func MustSeed(db *sql.DB) {
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n); err != nil {
		log.Fatalf("检查种子失败: %v", err)
	}
	if n > 0 {
		return
	}

	users := []struct {
		username, password, role, name string
	}{
		{"cm_demo", "cm123", RoleCustomerManager, "陈经理"},
		{"us_demo", "us123", RoleUnderwritingSpecialist, "林专员"},
		{"bo_demo", "bo123", RoleBusinessOwner, "周负责人"},
	}
	uidByName := map[string]int{}
	for _, u := range users {
		res, err := db.Exec(`INSERT INTO users(username, password_hash, role, display_name) VALUES(?,?,?,?)`,
			u.username, hashPassword(u.password), u.role, u.name)
		if err != nil {
			log.Fatalf("插入用户失败: %v", err)
		}
		id, _ := res.LastInsertId()
		uidByName[u.username] = int(id)
	}

	regEv := func(content, op string, opID int, ts string) sql.NullString {
		ns, _ := marshalEvidence(content, op, opID, ts)
		return ns
	}

	cmID := uidByName["cm_demo"]
	usID := uidByName["us_demo"]
	boID := uidByName["bo_demo"]

	type seedTask struct {
		no, policy, cust, product, rtype string
		orig, nw                         float64
		status                           string
		version                          int
		submitter                        int
		handler                          string
		reg, verify, archive             sql.NullString
	}

	tasks := []seedTask{
		// T1 草稿 + 登记证据齐备：可被客户经理提交（成功）
		{"RT-2026-0001", "PA202600011", "上海明远贸易", "企业财产综合险", "标准续保", 12800, 13500,
			StatusDraft, 1, cmID, RoleCustomerManager,
			regEv("保单到期前30天续保，客户确认保额无变化，上传近三年赔付记录。", "陈经理", cmID, "2026-06-15 09:12:00"), sql.NullString{}, sql.NullString{}},
		// T2 草稿 + 登记证据缺失（缺证据）
		{"RT-2026-0002", "PA202600027", "杭州临安物流", "货物运输险", "标准续保", 8600, 9200,
			StatusDraft, 1, cmID, RoleCustomerManager,
			sql.NullString{}, sql.NullString{}, sql.NullString{}},
		// T3 已提交 + 版本被推进到3（旧版本：客户端用旧版本号会被拦）
		{"RT-2026-0003", "PA202600044", "深圳科创达电子", "产品责任险", "扩项续保", 22000, 25800,
			StatusSubmitted, 3, cmID, RoleUnderwritingSpecialist,
			regEv("新增产品线责任，客户提交扩项申请及质检报告。", "陈经理", cmID, "2026-06-14 14:30:00"), sql.NullString{}, sql.NullString{}},
		// T4 已提交：可被核保专员复核（成功）
		{"RT-2026-0004", "PA202600058", "北京华章教育", "公众责任险", "标准续保", 15600, 15600,
			StatusSubmitted, 1, cmID, RoleUnderwritingSpecialist,
			regEv("续保无变化，客户营业场所年检通过。", "陈经理", cmID, "2026-06-16 10:05:00"), sql.NullString{}, sql.NullString{}},
		// T5 已复核：可被业务负责人确认（成功）
		{"RT-2026-0005", "PA202600063", "成都绿源农业", "种植险", "标准续保", 42000, 42000,
			StatusReviewed, 1, cmID, RoleBusinessOwner,
			regEv("续保保额与上年度一致，提供种植面积核验材料。", "陈经理", cmID, "2026-06-13 08:40:00"),
			regEv("核验承保区域与种植面积一致，费率合规，同意复核。", "林专员", usID, "2026-06-16 11:20:00"), sql.NullString{}},
		// T6 已确认：若再复核/再确认会触发错状态
		{"RT-2026-0006", "PA202600071", "广州南沙港务", "港口工程险", "标准续保", 88000, 86500,
			StatusConfirmed, 1, cmID, RoleBusinessOwner,
			regEv("续保保额下调，客户提交最新工程估值。", "陈经理", cmID, "2026-06-12 09:00:00"),
			regEv("核验估值材料，保额调整合理，同意复核。", "林专员", usID, "2026-06-15 16:10:00"),
			regEv("复核通过，归档归入续保卷宗第071号。", "周负责人", boID, "2026-06-17 09:30:00")},
		// T7 草稿 + 登记证据齐备：批量提交成功样例
		{"RT-2026-0007", "PA202600088", "武汉中天制造", "机器损坏险", "标准续保", 31000, 33500,
			StatusDraft, 1, cmID, RoleCustomerManager,
			regEv("设备新增2台，保额相应上调，附设备清单。", "陈经理", cmID, "2026-06-17 13:25:00"), sql.NullString{}, sql.NullString{}},
		// T8 已提交：批量复核成功样例
		{"RT-2026-0008", "PA202600092", "南京云岭科技", "雇主责任险", "标准续保", 19500, 19500,
			StatusSubmitted, 1, cmID, RoleUnderwritingSpecialist,
			regEv("员工人数微调，提供最新工资表。", "陈经理", cmID, "2026-06-16 15:50:00"), sql.NullString{}, sql.NullString{}},
	}

	for _, t := range tasks {
		if _, err := db.Exec(`INSERT INTO tasks(task_no, policy_no, customer_name, product, renewal_type, original_premium, new_premium, status, version, submitter_id, current_handler_role, reg_evidence, verify_evidence, archive_evidence)
			VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			t.no, t.policy, t.cust, t.product, t.rtype, t.orig, t.nw, t.status, t.version, t.submitter, t.handler, t.reg, t.verify, t.archive); err != nil {
			log.Fatalf("插入任务失败: %v", err)
		}
	}
	log.Printf("种子数据已写入：%d 用户，%d 任务", len(users), len(tasks))
}
