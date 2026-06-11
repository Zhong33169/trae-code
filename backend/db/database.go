package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

var DB *sql.DB

func Init(dbPath string) error {
	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_fk=1&_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	if err = createTables(); err != nil {
		return fmt.Errorf("创建表失败: %w", err)
	}

	if err = seedData(); err != nil {
		return fmt.Errorf("初始化数据失败: %w", err)
	}

	log.Println("数据库初始化成功")
	return nil
}

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT NOT NULL UNIQUE,
		password TEXT NOT NULL,
		real_name TEXT NOT NULL,
		role TEXT NOT NULL CHECK(role IN ('register','auditor','reviewer')),
		shift TEXT NOT NULL DEFAULT '白班',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS applications (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		application_no TEXT NOT NULL UNIQUE,
		applicant_name TEXT NOT NULL,
		applicant_id_card TEXT NOT NULL,
		applicant_phone TEXT NOT NULL,
		applicant_address TEXT NOT NULL,
		water_usage_type TEXT NOT NULL,
		property_type TEXT NOT NULL,
		id_card_front_img TEXT,
		id_card_back_img TEXT,
		property_certificate TEXT,
		status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PENDING_AUDIT','NEED_CORRECTION','PENDING_REVIEW','ARCHIVED')),
		current_handler_id INTEGER NOT NULL REFERENCES users(id),
		register_id INTEGER NOT NULL REFERENCES users(id),
		auditor_id INTEGER REFERENCES users(id),
		reviewer_id INTEGER REFERENCES users(id),
		reject_reason TEXT,
		last_remark TEXT,
		submitted_at DATETIME,
		audited_at DATETIME,
		reviewed_at DATETIME,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
	CREATE INDEX IF NOT EXISTS idx_applications_handler ON applications(current_handler_id);
	CREATE INDEX IF NOT EXISTS idx_applications_created ON applications(created_at);

	CREATE TABLE IF NOT EXISTS handovers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		application_id INTEGER NOT NULL REFERENCES applications(id),
		from_user_id INTEGER NOT NULL REFERENCES users(id),
		from_shift TEXT NOT NULL,
		to_user_id INTEGER NOT NULL REFERENCES users(id),
		to_shift TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','REJECTED')),
		handover_remark TEXT NOT NULL,
		accept_remark TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		confirmed_at DATETIME
	);

	CREATE INDEX IF NOT EXISTS idx_handovers_status ON handovers(status);
	CREATE INDEX IF NOT EXISTS idx_handovers_to_user ON handovers(to_user_id);
	CREATE INDEX IF NOT EXISTS idx_handovers_from_user ON handovers(from_user_id);
	CREATE INDEX IF NOT EXISTS idx_handovers_app ON handovers(application_id);

	CREATE TABLE IF NOT EXISTS operation_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		application_id INTEGER NOT NULL REFERENCES applications(id),
		application_no TEXT NOT NULL,
		user_id INTEGER NOT NULL REFERENCES users(id),
		user_name TEXT NOT NULL,
		user_role TEXT NOT NULL,
		operation TEXT NOT NULL,
		operation_detail TEXT NOT NULL,
		from_status TEXT,
		to_status TEXT,
		ip_address TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_logs_app ON operation_logs(application_id);
	CREATE INDEX IF NOT EXISTS idx_logs_user ON operation_logs(user_id);
	CREATE INDEX IF NOT EXISTS idx_logs_created ON operation_logs(created_at);

	CREATE TABLE IF NOT EXISTS processing_records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		application_id INTEGER NOT NULL REFERENCES applications(id),
		handover_id INTEGER REFERENCES handovers(id),
		handler_id INTEGER NOT NULL REFERENCES users(id),
		handler_name TEXT NOT NULL,
		handler_role TEXT NOT NULL,
		handler_shift TEXT NOT NULL,
		record_type TEXT NOT NULL CHECK(record_type IN ('TODO','CORRECTION','REMARK')),
		status TEXT NOT NULL CHECK(status IN ('PENDING','PROCESSING','COMPLETED')),
		content TEXT NOT NULL,
		reject_reason TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		completed_at DATETIME
	);

	CREATE INDEX IF NOT EXISTS idx_records_app ON processing_records(application_id);
	CREATE INDEX IF NOT EXISTS idx_records_handler ON processing_records(handler_id);
	CREATE INDEX IF NOT EXISTS idx_records_status ON processing_records(status);
	CREATE INDEX IF NOT EXISTS idx_records_type ON processing_records(record_type);
	CREATE INDEX IF NOT EXISTS idx_records_created ON processing_records(created_at);
	`

	_, err := DB.Exec(schema)
	return err
}

func seedData() error {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	users := []struct {
		username string
		password string
		realName string
		role     string
		shift    string
	}{
		{"register01", "123456", "张登记", "register", "白班"},
		{"register02", "123456", "李登记", "register", "夜班"},
		{"auditor01", "123456", "王审核", "auditor", "白班"},
		{"auditor02", "123456", "赵审核", "auditor", "夜班"},
		{"reviewer01", "123456", "陈复核", "reviewer", "白班"},
	}

	for _, u := range users {
		hashed, err := bcrypt.GenerateFromPassword([]byte(u.password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		_, err = DB.Exec(
			"INSERT INTO users(username, password, real_name, role, shift) VALUES(?,?,?,?,?)",
			u.username, string(hashed), u.realName, u.role, u.shift,
		)
		if err != nil {
			return err
		}
	}

	log.Println("用户初始化数据已插入")

	now := time.Now()
	sampleApps := []struct {
		no, name, idCard, phone, address, waterType, propertyType string
		status                                                    string
		handlerID, registerID                                     int64
	}{
		{
			generateAppNo(now, 1), "张三", "110101199001011234", "13800138001",
			"北京市朝阳区XX街道XX小区1号楼101", "居民生活用水", "商品房",
			"DRAFT", 1, 1,
		},
		{
			generateAppNo(now, 2), "李四", "110101199203053456", "13800138002",
			"北京市海淀区XX路XX号院3号楼502", "居民生活用水", "经济适用房",
			"PENDING_AUDIT", 3, 1,
		},
		{
			generateAppNo(now, 3), "王五", "110101198807127890", "13800138003",
			"北京市丰台区XX商圈A座101", "商业用水", "商铺",
			"NEED_CORRECTION", 2, 2,
		},
		{
			generateAppNo(now, 4), "赵六", "110101199512205678", "13800138004",
			"北京市西城区XX胡同XX号", "居民生活用水", "公房",
			"PENDING_REVIEW", 5, 1,
		},
		{
			generateAppNo(now, 5), "孙七", "110101198006069012", "13800138005",
			"北京市东城区XX大街XX号", "工业用水", "厂房",
			"ARCHIVED", 5, 2,
		},
	}

	for i, app := range sampleApps {
		var submittedAt, auditedAt, reviewedAt interface{}
		if app.status != "DRAFT" {
			submittedAt = now.Add(time.Duration(i) * -30 * time.Minute)
		}
		if app.status == "PENDING_REVIEW" || app.status == "ARCHIVED" {
			auditedAt = now.Add(time.Duration(i) * -20 * time.Minute)
		}
		if app.status == "ARCHIVED" {
			reviewedAt = now.Add(time.Duration(i) * -10 * time.Minute)
		}

		rejectReason := ""
		if app.status == "NEED_CORRECTION" {
			rejectReason = "房产证明文件不清晰，请重新上传清晰版的产权证照片"
		}

		var auditorID interface{}
		if app.status != "DRAFT" && app.status != "PENDING_AUDIT" {
			auditorID = 3
		}
		var reviewerID interface{}
		if app.status == "ARCHIVED" {
			reviewerID = 5
		}

		_, err = DB.Exec(`
			INSERT INTO applications(
				application_no, applicant_name, applicant_id_card, applicant_phone,
				applicant_address, water_usage_type, property_type,
				id_card_front_img, id_card_back_img, property_certificate,
				status, current_handler_id, register_id, auditor_id, reviewer_id,
				reject_reason, submitted_at, audited_at, reviewed_at
			) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			app.no, app.name, app.idCard, app.phone, app.address,
			app.waterType, app.propertyType,
			"/mock/id_front.jpg", "/mock/id_back.jpg", "/mock/property.jpg",
			app.status, app.handlerID, app.registerID, auditorID, reviewerID,
			rejectReason, submittedAt, auditedAt, reviewedAt,
		)
		if err != nil {
			return fmt.Errorf("插入样例申请失败: %w", err)
		}
	}

	log.Println("开户申请样例数据已插入")

	sampleHandovers := []struct {
		appID, fromUserID, toUserID int64
		fromShift, toShift          string
		status                      string
		remark                      string
		acceptRemark                string
	}{
		{
			3, 2, 1, "夜班", "白班", "ACCEPTED",
			"该申请资料有问题已被退回，麻烦你补正资料后重新提交",
			"已收到，会尽快处理补正",
		},
		{
			2, 3, 4, "白班", "夜班", "PENDING",
			"该申请资料完整，请夜班同事继续审核办理",
			"",
		},
		{
			4, 5, 5, "白班", "白班", "ACCEPTED",
			"该申请已审核通过，请复核归档",
			"好的，我来复核",
		},
	}

	for i, h := range sampleHandovers {
		var confirmedAt interface{}
		if h.status != "PENDING" {
			confirmedAt = now.Add(time.Duration(i+1) * -5 * time.Minute)
		}
		_, err = DB.Exec(`
			INSERT INTO handovers(
				application_id, from_user_id, from_shift, to_user_id, to_shift,
				status, handover_remark, accept_remark, created_at, confirmed_at
			) VALUES(?,?,?,?,?,?,?,?,?,?)`,
			h.appID, h.fromUserID, h.fromShift, h.toUserID, h.toShift,
			h.status, h.remark, h.acceptRemark,
			now.Add(time.Duration(i+2)*-10*time.Minute), confirmedAt,
		)
		if err != nil {
			return fmt.Errorf("插入样例交接记录失败: %w", err)
		}
	}
	log.Println("交接样例数据已插入")

	sampleRecords := []struct {
		appID, handoverID, handlerID int64
		handlerName, handlerRole, handlerShift string
		recordType, status, content, rejectReason string
		completed bool
	}{
		{
			3, 1, 1, "张登记", "register", "白班",
			"CORRECTION", "PENDING",
			"根据交接接收，需处理资料补正：房产证明文件不清晰，请重新上传清晰版的产权证照片",
			"房产证明文件不清晰，请重新上传清晰版的产权证照片",
			false,
		},
		{
			3, 1, 1, "张登记", "register", "白班",
			"CORRECTION", "PROCESSING",
			"身份证正反面照片需要更清晰，已联系申请人重新拍摄",
			"身份证照片模糊",
			false,
		},
		{
			3, 1, 1, "张登记", "register", "白班",
			"CORRECTION", "COMPLETED",
			"已联系申请人重新拍摄身份证照片并上传，资料已补正",
			"身份证照片模糊",
			true,
		},
		{
			2, 2, 4, "赵审核", "auditor", "夜班",
			"TODO", "PENDING",
			"根据交接接收，需处理该申请，当前状态：【待审核】，请审核申请人资料是否齐全",
			"",
			false,
		},
		{
			4, 3, 5, "陈复核", "reviewer", "白班",
			"TODO", "PROCESSING",
			"根据交接接收，需处理该申请，当前状态：【待复核】，请复核申请资料并归档",
			"",
			false,
		},
	}

	for _, r := range sampleRecords {
		createdAt := now.Add(-2 * time.Hour)
		updatedAt := createdAt
		var completedAt interface{}
		if r.completed {
			completedAt = now.Add(-1 * time.Hour)
			updatedAt = now.Add(-1 * time.Hour)
		}
		var handoverID interface{}
		if r.handoverID > 0 {
			handoverID = r.handoverID
		}
		_, err = DB.Exec(`
			INSERT INTO processing_records(
				application_id, handover_id, handler_id, handler_name,
				handler_role, handler_shift, record_type, status,
				content, reject_reason, created_at, updated_at, completed_at
			) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			r.appID, handoverID, r.handlerID, r.handlerName,
			r.handlerRole, r.handlerShift, r.recordType, r.status,
			r.content, r.rejectReason, createdAt, updatedAt, completedAt,
		)
		if err != nil {
			return fmt.Errorf("插入样例处理记录失败: %w", err)
		}
	}
	log.Println("处理记录样例数据已插入")

	sampleLogs := []struct {
		appID   int64
		userID  int64
		appNo   string
		userName string
		userRole string
		operation string
		opDetail  string
		fromStatus string
		toStatus   string
	}{
		{
			3, 2, "", "李登记", "开户登记员",
			"创建申请", "创建开户申请草稿",
			"", "DRAFT",
		},
		{
			3, 2, "", "李登记", "开户登记员",
			"提交审核", "补正资料后提交审核",
			"DRAFT", "PENDING_AUDIT",
		},
		{
			3, 3, "", "王审核", "开户审核主管",
			"审核退回", "房产证明文件不清晰，身份证照片模糊，退回补正",
			"PENDING_AUDIT", "NEED_CORRECTION",
		},
		{
			3, 2, "", "李登记", "开户登记员",
			"发起交接", "发起交接：夜班李登记 → 白班张登记，说明：该申请资料有问题已被退回",
			"NEED_CORRECTION", "NEED_CORRECTION",
		},
		{
			3, 1, "", "张登记", "开户登记员",
			"接收交接", "接收交接，已自动创建补正待办",
			"NEED_CORRECTION", "NEED_CORRECTION",
		},
		{
			2, 1, "", "张登记", "开户登记员",
			"创建申请", "创建并提交开户申请进入审核流程",
			"", "PENDING_AUDIT",
		},
		{
			2, 3, "", "王审核", "开户审核主管",
			"发起交接", "发起交接：白班王审核 → 夜班赵审核，请夜班同事继续审核",
			"PENDING_AUDIT", "PENDING_AUDIT",
		},
	}

	for _, l := range sampleLogs {
		var appNo string
		DB.QueryRow("SELECT application_no FROM applications WHERE id=?", l.appID).Scan(&appNo)
		_, err = DB.Exec(`
			INSERT INTO operation_logs(
				application_id, application_no, user_id, user_name, user_role,
				operation, operation_detail, from_status, to_status, ip_address
			) VALUES(?,?,?,?,?,?,?,?,?,?)`,
			l.appID, appNo, l.userID, l.userName, l.userRole,
			l.operation, l.opDetail, l.fromStatus, l.toStatus, "127.0.0.1",
		)
		if err != nil {
			return fmt.Errorf("插入样例操作日志失败: %w", err)
		}
	}
	log.Println("操作日志样例数据已插入")

	return nil
}

func generateAppNo(t time.Time, seq int) string {
	return fmt.Sprintf("WS%s%04d", t.Format("20060102"), seq)
}

func Close() {
	if DB != nil {
		DB.Close()
	}
}

func GetEnvOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
