package db

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func Init(dataSource string) error {
	var err error
	DB, err = sql.Open("sqlite", dataSource)
	if err != nil {
		return err
	}

	DB.SetMaxOpenConns(1)

	if err = createTables(); err != nil {
		return err
	}

	if err = seedData(); err != nil {
		return err
	}

	log.Println("Database initialized successfully")
	return nil
}

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		role TEXT NOT NULL,
		name TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS selections (
		id TEXT PRIMARY KEY,
		product_name TEXT NOT NULL,
		product_category TEXT NOT NULL,
		brand TEXT NOT NULL,
		supplier TEXT NOT NULL,
		estimated_price REAL NOT NULL DEFAULT 0,
		commission_rate REAL NOT NULL DEFAULT 0,
		planned_live_date TEXT,
		description TEXT,
		status TEXT NOT NULL,
		created_by TEXT NOT NULL,
		created_by_name TEXT NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		deadline TEXT,
		reject_reason TEXT,
		audit_note TEXT,
		process_result TEXT
	);

	CREATE TABLE IF NOT EXISTS attachments (
		id TEXT PRIMARY KEY,
		selection_id TEXT NOT NULL,
		name TEXT NOT NULL,
		type TEXT NOT NULL,
		url TEXT NOT NULL,
		uploaded_by TEXT NOT NULL,
		uploaded_at TEXT NOT NULL,
		rejected INTEGER NOT NULL DEFAULT 0,
		reject_reason TEXT,
		rejected_by TEXT,
		rejected_at TEXT,
		FOREIGN KEY (selection_id) REFERENCES selections(id)
	);

	CREATE TABLE IF NOT EXISTS audit_logs (
		id TEXT PRIMARY KEY,
		selection_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		user_name TEXT NOT NULL,
		action TEXT NOT NULL,
		detail TEXT,
		created_at TEXT NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_selections_status ON selections(status);
	CREATE INDEX IF NOT EXISTS idx_selections_created_by ON selections(created_by);
	CREATE INDEX IF NOT EXISTS idx_attachments_selection ON attachments(selection_id);
	CREATE INDEX IF NOT EXISTS idx_audit_selection ON audit_logs(selection_id);
	`
	_, err := DB.Exec(schema)
	return err
}

func seedData() error {
	if err := seedUsers(); err != nil {
		return err
	}
	if err := seedDemoSelections(); err != nil {
		return err
	}
	return nil
}

func seedUsers() error {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	_, err = DB.Exec(`
		INSERT INTO users (id, username, role, name) VALUES
		('u_registrar_1', 'registrar1', 'registrar', '直播选品登记员-小李'),
		('u_supervisor_1', 'supervisor1', 'supervisor', '直播选品审核主管-王主管'),
		('u_reviewer_1', 'reviewer1', 'reviewer', '复核负责人-张总');
	`)
	return err
}

func existsSelection(id string) (bool, error) {
	var n int
	err := DB.QueryRow("SELECT 1 FROM selections WHERE id = ? LIMIT 1", id).Scan(&n)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func existsAttachment(id string) (bool, error) {
	var n int
	err := DB.QueryRow("SELECT 1 FROM attachments WHERE id = ? LIMIT 1", id).Scan(&n)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func existsAudit(id string) (bool, error) {
	var n int
	err := DB.QueryRow("SELECT 1 FROM audit_logs WHERE id = ? LIMIT 1", id).Scan(&n)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func seedDemoSelections() error {
	now := time.Now()
	yesterday := now.Add(-24 * time.Hour)
	twoDaysAgo := now.Add(-48 * time.Hour)
	tomorrow := now.Add(24 * time.Hour)
	pastDeadline := now.Add(-2 * time.Hour)

	baseSelections := []struct {
		ID, ProductName, Category, Brand, Supplier string
		Price, Commission                          float64
		PlannedDate                                *time.Time
		Description                                string
		Status                                     string
		CreatedBy, CreatedByName                   string
		CreatedAt, UpdatedAt                       time.Time
		Deadline                                   *time.Time
		RejectReason, ProcessResult                string
	}{
		{
			ID: "sel_normal", ProductName: "高端护肤精华液", Category: "美妆护肤",
			Brand: "雅诗兰黛", Supplier: "雅诗兰黛官方旗舰店",
			Price: 680.0, Commission: 0.25,
			PlannedDate: &tomorrow, Description: "大牌精华，直播主推款，供货稳定",
			Status: "pending",
			CreatedBy: "u_registrar_1", CreatedByName: "直播选品登记员-小李",
			CreatedAt: yesterday, UpdatedAt: yesterday,
			Deadline: &tomorrow,
		},
		{
			ID: "sel_missing", ProductName: "网红零食大礼包", Category: "食品生鲜",
			Brand: "三只松鼠", Supplier: "三只松鼠渠道商",
			Price: 128.0, Commission: 0.30,
			Description: "零食组合装，需要补充质检报告和授权书",
			Status: "missing_attachment",
			CreatedBy: "u_registrar_1", CreatedByName: "直播选品登记员-小李",
			CreatedAt: twoDaysAgo, UpdatedAt: yesterday,
			Deadline: &tomorrow,
		},
		{
			ID: "sel_timeout", ProductName: "夏季防晒衣", Category: "服饰鞋包",
			Brand: "优衣库", Supplier: "优衣库经销商",
			Price: 199.0, Commission: 0.15,
			Description: "防晒服选品，已超时未处理",
			Status: "timeout",
			CreatedBy: "u_registrar_1", CreatedByName: "直播选品登记员-小李",
			CreatedAt: twoDaysAgo, UpdatedAt: twoDaysAgo,
			Deadline: &pastDeadline,
			ProcessResult: "超时未处理，自动标记异常",
		},
		{
			ID: "sel_rejected", ProductName: "杂牌蓝牙耳机", Category: "数码家电",
			Brand: "XX牌", Supplier: "深圳某电子厂",
			Price: 89.0, Commission: 0.40,
			Description: "低价耳机，品质存疑",
			Status: "rejected",
			CreatedBy: "u_registrar_1", CreatedByName: "直播选品登记员-小李",
			CreatedAt: twoDaysAgo, UpdatedAt: yesterday,
			Deadline: &tomorrow,
			RejectReason: "品牌授权存疑，质检报告不完整，无法保证售后",
		},
		{
			ID: "sel_approved", ProductName: "家用空气炸锅", Category: "家居生活",
			Brand: "九阳", Supplier: "九阳官方旗舰店",
			Price: 399.0, Commission: 0.18,
			Description: "热门厨房小家电，品牌授权齐全",
			Status: "approved",
			CreatedBy: "u_registrar_1", CreatedByName: "直播选品登记员-小李",
			CreatedAt: twoDaysAgo, UpdatedAt: yesterday,
			ProcessResult: "审核通过，可安排排期",
		},
		{
			ID: "sel_draft", ProductName: "儿童益智玩具套装", Category: "母婴玩具",
			Brand: "费雪", Supplier: "费雪中国总代理",
			Price: 258.0, Commission: 0.22,
			Description: "草稿，待补充信息",
			Status: "draft",
			CreatedBy: "u_registrar_1", CreatedByName: "直播选品登记员-小李",
			CreatedAt: now, UpdatedAt: now,
		},
		{
			ID: "sel_batch_ok", ProductName: "电动牙刷套装", Category: "数码家电",
			Brand: "飞利浦", Supplier: "飞利浦官方授权店",
			Price: 399.0, Commission: 0.20,
			Description: "爆款个人护理，附件齐全，用于批量通过成功样例",
			Status: "pending",
			CreatedBy: "u_registrar_1", CreatedByName: "直播选品登记员-小李",
			CreatedAt: twoDaysAgo, UpdatedAt: twoDaysAgo,
			Deadline: &tomorrow,
		},
		{
			ID: "sel_allrej", ProductName: "无品牌数据线", Category: "数码家电",
			Brand: "白牌", Supplier: "华强北某档口",
			Price: 19.9, Commission: 0.50,
			Description: "低价数据线，附件全部被驳回，禁止全驳回附件通过审核",
			Status: "missing_attachment",
			CreatedBy: "u_registrar_1", CreatedByName: "直播选品登记员-小李",
			CreatedAt: twoDaysAgo, UpdatedAt: yesterday,
			Deadline: &tomorrow,
			RejectReason: "所有附件均被驳回，请重新上传有效的品牌授权和质检报告",
		},
		{
			ID: "sel_reviewer_return", ProductName: "高端红酒礼盒", Category: "食品生鲜",
			Brand: "拉菲", Supplier: "某进口贸易公司",
			Price: 1280.0, Commission: 0.28,
			Description: "复核退回后等待补正样例：审核通过后被复核负责人退回，需要重新补正材料",
			Status: "rejected",
			CreatedBy: "u_registrar_1", CreatedByName: "直播选品登记员-小李",
			CreatedAt: twoDaysAgo, UpdatedAt: now.Add(-2 * time.Hour),
			RejectReason: "复核退回：进口食品检疫证明已过期，需重新提供最新的检验检疫文件；同时品牌授权链条不完整，需要补充从酒庄到国内供应商的完整授权链",
			ProcessResult: "初审通过，拟安排下周排期",
		},
	}

	existingSel := map[string]bool{}
	for _, s := range baseSelections {
		ex, err := existsSelection(s.ID)
		if err != nil {
			return err
		}
		existingSel[s.ID] = ex
	}

	yesterdayStr := yesterday.Format(time.RFC3339)
	rejectedAt := yesterday.Add(2 * time.Hour)
	rejectedAtStr := rejectedAt.Format(time.RFC3339)

	baseAttachments := []struct {
		ID, SelID, Name, Type, URL, Uploader, UploadedAt string
		Rejected                                         int
		RejectReason, RejectedBy, RejectedAt             string
	}{
		{"att_normal_1", "sel_normal", "品牌授权书.pdf", "授权文件", "https://example.com/att/normal_auth.pdf", "u_registrar_1", yesterdayStr, 0, "", "", ""},
		{"att_normal_2", "sel_normal", "质检报告.pdf", "质检文件", "https://example.com/att/normal_qc.pdf", "u_registrar_1", yesterdayStr, 0, "", "", ""},
		{"att_missing_1", "sel_missing", "产品图片.zip", "图片资料", "https://example.com/att/missing_img.zip", "u_registrar_1", yesterdayStr, 0, "", "", ""},
		{"att_rejected_1", "sel_rejected", "品牌授权书.pdf", "授权文件", "https://example.com/att/rej_auth.pdf", "u_registrar_1", twoDaysAgo.Format(time.RFC3339), 1, "授权方印章模糊，无法验证真伪", "u_supervisor_1", rejectedAtStr},
		{"att_rejected_2", "sel_rejected", "质检报告.pdf", "质检文件", "https://example.com/att/rej_qc.pdf", "u_registrar_1", twoDaysAgo.Format(time.RFC3339), 1, "检测项不完整，缺少关键安全指标", "u_supervisor_1", rejectedAtStr},
		{"att_approved_1", "sel_approved", "品牌授权书.pdf", "授权文件", "https://example.com/att/app_auth.pdf", "u_registrar_1", twoDaysAgo.Format(time.RFC3339), 0, "", "", ""},
		{"att_approved_2", "sel_approved", "质检报告.pdf", "质检文件", "https://example.com/att/app_qc.pdf", "u_registrar_1", twoDaysAgo.Format(time.RFC3339), 0, "", "", ""},
		{"att_timeout_1", "sel_timeout", "产品图片.png", "图片资料", "https://example.com/att/timeout_img.png", "u_registrar_1", twoDaysAgo.Format(time.RFC3339), 0, "", "", ""},
		{"att_batchok_1", "sel_batch_ok", "品牌授权书.pdf", "授权文件", "https://example.com/att/batchok_auth.pdf", "u_registrar_1", twoDaysAgo.Format(time.RFC3339), 0, "", "", ""},
		{"att_batchok_2", "sel_batch_ok", "质检报告.pdf", "质检文件", "https://example.com/att/batchok_qc.pdf", "u_registrar_1", twoDaysAgo.Format(time.RFC3339), 0, "", "", ""},
		{"att_allrej_1", "sel_allrej", "模糊的授权书.jpg", "授权文件", "https://example.com/att/allrej_auth.jpg", "u_registrar_1", twoDaysAgo.Format(time.RFC3339), 1, "图片严重模糊，无法辨认授权方名称和印章", "u_supervisor_1", rejectedAtStr},
		{"att_allrej_2", "sel_allrej", "无效质检扫描件.pdf", "质检文件", "https://example.com/att/allrej_qc.pdf", "u_registrar_1", twoDaysAgo.Format(time.RFC3339), 1, "质检报告已过有效期，且缺少 CMA 认证章", "u_supervisor_1", rejectedAtStr},
		{"att_return_1", "sel_reviewer_return", "原品牌授权书.pdf", "授权文件", "https://example.com/att/return_auth.pdf", "u_registrar_1", twoDaysAgo.Format(time.RFC3339), 1, "复核发现：授权链不完整，缺少酒庄到贸易商环节", "u_reviewer_1", now.Add(-2 * time.Hour).Format(time.RFC3339)},
		{"att_return_2", "sel_reviewer_return", "商检证明.pdf", "质检文件", "https://example.com/att/return_ciq.pdf", "u_registrar_1", twoDaysAgo.Format(time.RFC3339), 1, "复核发现：进口食品检疫证明已过期 3 个月", "u_reviewer_1", now.Add(-2 * time.Hour).Format(time.RFC3339)},
	}

	existingAttach := map[string]bool{}
	for _, a := range baseAttachments {
		ex, err := existsAttachment(a.ID)
		if err != nil {
			return err
		}
		existingAttach[a.ID] = ex
	}

	baseAudits := []struct {
		ID, SelID, UID, UName, Action, Detail, CreatedAt string
	}{
		{"audit_1", "sel_normal", "u_registrar_1", "直播选品登记员-小李", "创建选品单", "填写完整选品信息并上传2份附件", yesterdayStr},
		{"audit_2", "sel_normal", "u_registrar_1", "直播选品登记员-小李", "提交审核", "提交至审核主管处理", yesterday.Add(time.Hour).Format(time.RFC3339)},
		{"audit_3", "sel_missing", "u_registrar_1", "直播选品登记员-小李", "创建选品单", "创建零食礼包选品，仅上传图片", twoDaysAgo.Format(time.RFC3339)},
		{"audit_4", "sel_missing", "u_registrar_1", "直播选品登记员-小李", "提交审核", "提交审核", twoDaysAgo.Add(2 * time.Hour).Format(time.RFC3339)},
		{"audit_5", "sel_missing", "u_supervisor_1", "直播选品审核主管-王主管", "标记缺材料", "缺少品牌授权书和质检报告，要求补正", yesterdayStr},
		{"audit_6", "sel_rejected", "u_registrar_1", "直播选品登记员-小李", "创建选品单", "创建杂牌耳机选品", twoDaysAgo.Format(time.RFC3339)},
		{"audit_7", "sel_rejected", "u_registrar_1", "直播选品登记员-小李", "提交审核", "提交审核", twoDaysAgo.Add(time.Hour).Format(time.RFC3339)},
		{"audit_8", "sel_rejected", "u_supervisor_1", "直播选品审核主管-王主管", "驳回附件", "附件1:授权方印章模糊;附件2:质检项缺失", rejectedAtStr},
		{"audit_9", "sel_rejected", "u_supervisor_1", "直播选品审核主管-王主管", "退回选品单", "品牌授权存疑，质检报告不完整，无法保证售后", rejectedAt.Add(15 * time.Minute).Format(time.RFC3339)},
		{"audit_10", "sel_approved", "u_registrar_1", "直播选品登记员-小李", "创建选品单", "创建空气炸锅选品", twoDaysAgo.Format(time.RFC3339)},
		{"audit_11", "sel_approved", "u_registrar_1", "直播选品登记员-小李", "提交审核", "提交审核", twoDaysAgo.Add(time.Hour).Format(time.RFC3339)},
		{"audit_12", "sel_approved", "u_supervisor_1", "直播选品审核主管-王主管", "审核通过", "材料齐全，品牌授权有效，质检通过", yesterdayStr},
		{"audit_13", "sel_timeout", "u_registrar_1", "直播选品登记员-小李", "创建选品单", "创建防晒衣选品", twoDaysAgo.Format(time.RFC3339)},
		{"audit_14", "sel_timeout", "u_registrar_1", "直播选品登记员-小李", "提交审核", "提交审核", twoDaysAgo.Add(time.Hour).Format(time.RFC3339)},

		{"audit_15", "sel_batch_ok", "u_registrar_1", "直播选品登记员-小李", "创建选品单", "创建电动牙刷选品，用于批量通过成功样例", twoDaysAgo.Format(time.RFC3339)},
		{"audit_16", "sel_batch_ok", "u_registrar_1", "直播选品登记员-小李", "上传附件", "附件: 品牌授权书.pdf (授权文件)", twoDaysAgo.Add(30 * time.Minute).Format(time.RFC3339)},
		{"audit_17", "sel_batch_ok", "u_registrar_1", "直播选品登记员-小李", "上传附件", "附件: 质检报告.pdf (质检文件)", twoDaysAgo.Add(45 * time.Minute).Format(time.RFC3339)},
		{"audit_18", "sel_batch_ok", "u_registrar_1", "直播选品登记员-小李", "提交审核", "提交至审核主管", twoDaysAgo.Add(time.Hour).Format(time.RFC3339)},

		{"audit_19", "sel_allrej", "u_registrar_1", "直播选品登记员-小李", "创建选品单", "创建无品牌数据线选品", twoDaysAgo.Format(time.RFC3339)},
		{"audit_20", "sel_allrej", "u_registrar_1", "直播选品登记员-小李", "上传附件", "附件: 模糊的授权书.jpg (授权文件)", twoDaysAgo.Add(30 * time.Minute).Format(time.RFC3339)},
		{"audit_21", "sel_allrej", "u_registrar_1", "直播选品登记员-小李", "上传附件", "附件: 无效质检扫描件.pdf (质检文件)", twoDaysAgo.Add(45 * time.Minute).Format(time.RFC3339)},
		{"audit_22", "sel_allrej", "u_registrar_1", "直播选品登记员-小李", "提交审核", "提交至审核主管", twoDaysAgo.Add(time.Hour).Format(time.RFC3339)},
		{"audit_23", "sel_allrej", "u_supervisor_1", "直播选品审核主管-王主管", "驳回附件", "模糊的授权书.jpg: 图片严重模糊，无法辨认授权方名称和印章; 无效质检扫描件.pdf: 质检报告已过有效期，且缺少 CMA 认证章", rejectedAtStr},
		{"audit_24", "sel_allrej", "u_supervisor_1", "直播选品审核主管-王主管", "标记缺材料", "所有附件均被驳回，请重新上传有效的品牌授权和质检报告", rejectedAt.Add(10 * time.Minute).Format(time.RFC3339)},
		{"audit_25", "sel_allrej", "u_registrar_1", "直播选品登记员-小李", "补正提交失败", "有效附件=0，不足2份 | 原因: 全部 2 份附件均已被驳回，请重新上传未被驳回的品牌授权书、质检报告等至少 2 份", rejectedAt.Add(30 * time.Minute).Format(time.RFC3339)},

		{"audit_26", "sel_reviewer_return", "u_registrar_1", "直播选品登记员-小李", "创建选品单", "创建高端红酒礼盒选品", twoDaysAgo.Format(time.RFC3339)},
		{"audit_27", "sel_reviewer_return", "u_registrar_1", "直播选品登记员-小李", "上传附件", "附件: 原品牌授权书.pdf (授权文件)", twoDaysAgo.Add(30 * time.Minute).Format(time.RFC3339)},
		{"audit_28", "sel_reviewer_return", "u_registrar_1", "直播选品登记员-小李", "上传附件", "附件: 商检证明.pdf (质检文件)", twoDaysAgo.Add(45 * time.Minute).Format(time.RFC3339)},
		{"audit_29", "sel_reviewer_return", "u_registrar_1", "直播选品登记员-小李", "提交审核", "提交至审核主管", twoDaysAgo.Add(time.Hour).Format(time.RFC3339)},
		{"audit_30", "sel_reviewer_return", "u_supervisor_1", "直播选品审核主管-王主管", "更新处理结果/备注", "结果: 初审通过，拟安排下周排期; 备注: 材料表面齐全，建议复核时重点核查进口资质", yesterdayStr},
		{"audit_31", "sel_reviewer_return", "u_supervisor_1", "直播选品审核主管-王主管", "审核通过", "审核通过 - 材料齐全，授权有效，建议复核重点检查进口资质", yesterday.Add(time.Hour).Format(time.RFC3339)},
		{"audit_32", "sel_reviewer_return", "u_reviewer_1", "复核负责人-张总", "复核退回", "退回原因: 复核退回：进口食品检疫证明已过期，需重新提供最新的检验检疫文件；同时品牌授权链条不完整，需要补充从酒庄到国内供应商的完整授权链 | 退回前处理结果: 初审通过，拟安排下周排期", now.Add(-2 * time.Hour).Format(time.RFC3339)},
	}

	existingAudit := map[string]bool{}
	for _, a := range baseAudits {
		ex, err := existsAudit(a.ID)
		if err != nil {
			return err
		}
		existingAudit[a.ID] = ex
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	selStmt, err := tx.Prepare(`INSERT INTO selections (
		id, product_name, product_category, brand, supplier,
		estimated_price, commission_rate, planned_live_date, description,
		status, created_by, created_by_name, created_at, updated_at,
		deadline, reject_reason, process_result
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer selStmt.Close()

	selCreatedCount := 0
	for _, s := range baseSelections {
		if existingSel[s.ID] {
			continue
		}
		var plannedStr, deadlineStr sql.NullString
		if s.PlannedDate != nil {
			plannedStr = sql.NullString{String: s.PlannedDate.Format(time.RFC3339), Valid: true}
		}
		if s.Deadline != nil {
			deadlineStr = sql.NullString{String: s.Deadline.Format(time.RFC3339), Valid: true}
		}
		_, err = selStmt.Exec(
			s.ID, s.ProductName, s.Category, s.Brand, s.Supplier,
			s.Price, s.Commission, plannedStr, s.Description,
			s.Status, s.CreatedBy, s.CreatedByName,
			s.CreatedAt.Format(time.RFC3339), s.UpdatedAt.Format(time.RFC3339),
			deadlineStr, s.RejectReason, s.ProcessResult,
		)
		if err != nil {
			return fmt.Errorf("insert selection %s: %w", s.ID, err)
		}
		selCreatedCount++
	}

	attachStmt, err := tx.Prepare(`INSERT INTO attachments (
		id, selection_id, name, type, url, uploaded_by, uploaded_at,
		rejected, reject_reason, rejected_by, rejected_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer attachStmt.Close()

	for _, a := range baseAttachments {
		if existingAttach[a.ID] {
			continue
		}
		var rr, rb, rat sql.NullString
		if a.Rejected == 1 {
			rr = sql.NullString{String: a.RejectReason, Valid: true}
			rb = sql.NullString{String: a.RejectedBy, Valid: true}
			rat = sql.NullString{String: a.RejectedAt, Valid: true}
		}
		_, err = attachStmt.Exec(a.ID, a.SelID, a.Name, a.Type, a.URL, a.Uploader, a.UploadedAt, a.Rejected, rr, rb, rat)
		if err != nil {
			return fmt.Errorf("insert attachment %s: %w", a.ID, err)
		}
	}

	auditStmt, err := tx.Prepare(`INSERT INTO audit_logs (
		id, selection_id, user_id, user_name, action, detail, created_at
	) VALUES (?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer auditStmt.Close()

	for _, a := range baseAudits {
		if existingAudit[a.ID] {
			continue
		}
		_, err = auditStmt.Exec(a.ID, a.SelID, a.UID, a.UName, a.Action, a.Detail, a.CreatedAt)
		if err != nil {
			return fmt.Errorf("insert audit %s: %w", a.ID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	if selCreatedCount > 0 {
		log.Printf("已补齐 %d 张样例选品单（含附件与审计日志），使用存在判断避免覆盖已有办理数据", selCreatedCount)
	}
	return nil
}

func Close() {
	if DB != nil {
		DB.Close()
	}
}
