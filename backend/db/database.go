package db

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"

	"subcontract-system/models"
	"subcontract-system/utils"
)

var DB *sql.DB

func InitDB() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./subcontract.db"
	}

	absPath, _ := filepath.Abs(dbPath)
	log.Printf("Database path: %s", absPath)

	var err error
	DB, err = sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)")
	if err != nil {
		log.Fatal(err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatal(err)
	}

	createTables()
	seedData()
}

func createTables() {
	schemas := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			name TEXT NOT NULL,
			role TEXT NOT NULL,
			created_at DATETIME NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS subcontract_forms (
			id TEXT PRIMARY KEY,
			code TEXT UNIQUE NOT NULL,
			subcontractor_name TEXT NOT NULL,
			project_name TEXT NOT NULL,
			entry_date DATETIME NOT NULL,
			workers_count INTEGER NOT NULL,
			work_content TEXT NOT NULL,
			status TEXT NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			created_by TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			current_handler TEXT NOT NULL,
			reject_reason TEXT DEFAULT '',
			FOREIGN KEY(created_by) REFERENCES users(id)
		)`,
		`CREATE TABLE IF NOT EXISTS evidences (
			id TEXT PRIMARY KEY,
			form_id TEXT NOT NULL,
			type TEXT NOT NULL,
			name TEXT NOT NULL,
			uploaded_by TEXT NOT NULL,
			uploaded_at DATETIME NOT NULL,
			is_supplemental INTEGER NOT NULL DEFAULT 0,
			supplement_note TEXT DEFAULT '',
			FOREIGN KEY(form_id) REFERENCES subcontract_forms(id),
			FOREIGN KEY(uploaded_by) REFERENCES users(id)
		)`,
		`CREATE TABLE IF NOT EXISTS supplement_records (
			id TEXT PRIMARY KEY,
			form_id TEXT NOT NULL,
			performed_by TEXT NOT NULL,
			performed_at DATETIME NOT NULL,
			action TEXT NOT NULL,
			details TEXT NOT NULL,
			reason TEXT DEFAULT '',
			FOREIGN KEY(form_id) REFERENCES subcontract_forms(id),
			FOREIGN KEY(performed_by) REFERENCES users(id)
		)`,
		`CREATE TABLE IF NOT EXISTS audit_logs (
			id TEXT PRIMARY KEY,
			form_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			action TEXT NOT NULL,
			from_status TEXT NOT NULL,
			to_status TEXT NOT NULL,
			timestamp DATETIME NOT NULL,
			details TEXT NOT NULL,
			FOREIGN KEY(form_id) REFERENCES subcontract_forms(id),
			FOREIGN KEY(user_id) REFERENCES users(id)
		)`,
	}

	for _, s := range schemas {
		if _, err := DB.Exec(s); err != nil {
			log.Fatalf("Failed to create table: %v", err)
		}
	}
}

func seedData() {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil || count > 0 {
		return
	}

	users := []models.User{
		{ID: utils.NewID(), Username: "clerk01", Password: utils.HashPassword("clerk123"), Name: "张资料", Role: models.RoleClerk},
		{ID: utils.NewID(), Username: "foreman01", Password: utils.HashPassword("foreman123"), Name: "李施工", Role: models.RoleForeman},
		{ID: utils.NewID(), Username: "manager01", Password: utils.HashPassword("manager123"), Name: "王经理", Role: models.RoleManager},
	}

	tx, _ := DB.Begin()
	for _, u := range users {
		_, err := tx.Exec("INSERT INTO users (id, username, password, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			u.ID, u.Username, u.Password, u.Name, u.Role, time.Now())
		if err != nil {
			log.Printf("Error inserting user %s: %v", u.Username, err)
		}
	}
	tx.Commit()

	var clerkID, foremanID, managerID string
	DB.QueryRow("SELECT id FROM users WHERE username='clerk01'").Scan(&clerkID)
	DB.QueryRow("SELECT id FROM users WHERE username='foreman01'").Scan(&foremanID)
	DB.QueryRow("SELECT id FROM users WHERE username='manager01'").Scan(&managerID)

	now := time.Now()

	seedForms := []struct {
		Form   models.SubcontractForm
		Evidences []models.Evidence
		Supplements []models.SupplementRecord
	}{
		{
			Form: models.SubcontractForm{
				ID: utils.NewID(), Code: "FB-2025-001", SubcontractorName: "安徽宏建劳务有限公司",
				ProjectName: "中央商务区A座", EntryDate: now.AddDate(0, 0, -5), WorkersCount: 35,
				WorkContent: "主体结构钢筋绑扎", Status: models.StatusPendingForeman,
				Version: 1, CreatedBy: clerkID, CurrentHandler: foremanID,
			},
			Evidences: []models.Evidence{
				{ID: utils.NewID(), Type: models.EvidenceRegistration, Name: "分包单位资质证书.pdf", UploadedBy: clerkID, UploadedAt: now.AddDate(0, 0, -5)},
				{ID: utils.NewID(), Type: models.EvidenceRegistration, Name: "进场人员花名册.xlsx", UploadedBy: clerkID, UploadedAt: now.AddDate(0, 0, -5)},
			},
		},
		{
			Form: models.SubcontractForm{
				ID: utils.NewID(), Code: "FB-2025-002", SubcontractorName: "江苏华宇装饰工程有限公司",
				ProjectName: "中央商务区A座", EntryDate: now.AddDate(0, 0, -3), WorkersCount: 20,
				WorkContent: "室内精装修工程", Status: models.StatusPendingClerk,
				Version: 2, CreatedBy: clerkID, CurrentHandler: clerkID,
				RejectReason: "缺少特种作业人员操作证，请补充后重新提交",
			},
			Evidences: []models.Evidence{
				{ID: utils.NewID(), Type: models.EvidenceRegistration, Name: "营业执照.pdf", UploadedBy: clerkID, UploadedAt: now.AddDate(0, 0, -3)},
				{ID: utils.NewID(), Type: models.EvidenceInspection, Name: "现场安全交底记录.jpg", UploadedBy: foremanID, UploadedAt: now.AddDate(0, 0, -2), IsSupplemental: true, SupplementNote: "补充施工负责人现场核验记录"},
			},
		},
		{
			Form: models.SubcontractForm{
				ID: utils.NewID(), Code: "FB-2025-003", SubcontractorName: "山东鲁建机电安装公司",
				ProjectName: "中央商务区B座", EntryDate: now.AddDate(0, 0, -10), WorkersCount: 15,
				WorkContent: "机电管线预埋", Status: models.StatusPendingManager,
				Version: 3, CreatedBy: clerkID, CurrentHandler: managerID,
			},
			Evidences: []models.Evidence{
				{ID: utils.NewID(), Type: models.EvidenceRegistration, Name: "资质证书.pdf", UploadedBy: clerkID, UploadedAt: now.AddDate(0, 0, -10)},
				{ID: utils.NewID(), Type: models.EvidenceInspection, Name: "现场核验照片.zip", UploadedBy: foremanID, UploadedAt: now.AddDate(0, 0, -8)},
				{ID: utils.NewID(), Type: models.EvidenceInspection, Name: "安全教育培训记录.pdf", UploadedBy: clerkID, UploadedAt: now.AddDate(0, 0, -6), IsSupplemental: true, SupplementNote: "补录三级安全教育记录"},
			},
		},
		{
			Form: models.SubcontractForm{
				ID: utils.NewID(), Code: "FB-2025-004", SubcontractorName: "浙江大地防水工程有限公司",
				ProjectName: "中央商务区A座", EntryDate: now.AddDate(0, 0, -20), WorkersCount: 8,
				WorkContent: "地下室防水施工", Status: models.StatusVerified,
				Version: 1, CreatedBy: clerkID, CurrentHandler: "",
			},
			Evidences: []models.Evidence{
				{ID: utils.NewID(), Type: models.EvidenceRegistration, Name: "分包资质.pdf", UploadedBy: clerkID, UploadedAt: now.AddDate(0, 0, -20)},
				{ID: utils.NewID(), Type: models.EvidenceInspection, Name: "现场核验.pdf", UploadedBy: foremanID, UploadedAt: now.AddDate(0, 0, -18)},
				{ID: utils.NewID(), Type: models.EvidenceArchive, Name: "归档资料包.zip", UploadedBy: clerkID, UploadedAt: now.AddDate(0, 0, -15)},
			},
		},
		{
			Form: models.SubcontractForm{
				ID: utils.NewID(), Code: "FB-2025-005", SubcontractorName: "四川川渝脚手架工程队",
				ProjectName: "中央商务区C座", EntryDate: now.AddDate(0, 0, -1), WorkersCount: 25,
				WorkContent: "外脚手架搭设", Status: models.StatusDraft,
				Version: 1, CreatedBy: clerkID, CurrentHandler: clerkID,
			},
			Evidences: []models.Evidence{},
		},
		{
			Form: models.SubcontractForm{
				ID: utils.NewID(), Code: "FB-2025-006", SubcontractorName: "河北冀东混凝土搅拌站",
				ProjectName: "中央商务区B座", EntryDate: now.AddDate(0, 0, -2), WorkersCount: 5,
				WorkContent: "商品混凝土供应", Status: models.StatusRejected,
				Version: 1, CreatedBy: clerkID, CurrentHandler: clerkID,
				RejectReason: "供应商资质已过期，不予通过",
			},
			Evidences: []models.Evidence{
				{ID: utils.NewID(), Type: models.EvidenceRegistration, Name: "过期资质证书.pdf", UploadedBy: clerkID, UploadedAt: now.AddDate(0, 0, -2)},
			},
		},
	}

	for _, sf := range seedForms {
		tx2, _ := DB.Begin()
		_, err := tx2.Exec(`INSERT INTO subcontract_forms 
			(id, code, subcontractor_name, project_name, entry_date, workers_count, work_content, 
			 status, version, created_by, created_at, updated_at, current_handler, reject_reason)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			sf.Form.ID, sf.Form.Code, sf.Form.SubcontractorName, sf.Form.ProjectName, sf.Form.EntryDate,
			sf.Form.WorkersCount, sf.Form.WorkContent, sf.Form.Status, sf.Form.Version, sf.Form.CreatedBy,
			sf.Form.CreatedAt, sf.Form.UpdatedAt, sf.Form.CurrentHandler, sf.Form.RejectReason)
		if err != nil {
			log.Printf("Error inserting form %s: %v", sf.Form.Code, err)
		}

		for _, e := range sf.Evidences {
			_, err := tx2.Exec(`INSERT INTO evidences (id, form_id, type, name, uploaded_by, uploaded_at, is_supplemental, supplement_note)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				e.ID, sf.Form.ID, e.Type, e.Name, e.UploadedBy, e.UploadedAt, e.IsSupplemental, e.SupplementNote)
			if err != nil {
				log.Printf("Error inserting evidence: %v", err)
			}
		}
		tx2.Commit()
	}
}
