package db

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"
)

func hashPassword(password string) string {
	h := sha256.Sum256([]byte(password))
	return hex.EncodeToString(h[:])
}

func Seed(db *sql.DB) error {
	var userCount int
	db.QueryRow("SELECT COUNT(*) FROM users").Scan(&userCount)
	if userCount > 0 {
		return nil
	}

	users := []struct {
		username string
		password string
		role     string
		name     string
	}{
		{"reception", "123456", "reception_assistant", "张接诊"},
		{"physician", "123456", "attending_physician", "李医师"},
		{"pharmacy", "123456", "pharmacy_admin", "王药师"},
	}

	for _, u := range users {
		_, err := db.Exec(
			`INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)`,
			u.username, hashPassword(u.password), u.role, u.name,
		)
		if err != nil {
			return fmt.Errorf("seed user %s: %w", u.username, err)
		}
	}

	medicines := []string{
		`[{"name":"阿莫西林胶囊","spec":"0.5g*24粒","quantity":2,"price":25.50},{"name":"布洛芬缓释片","spec":"0.3g*20片","quantity":1,"price":18.80}]`,
		`[{"name":"头孢克肟分散片","spec":"0.1g*6片","quantity":3,"price":45.00},{"name":"复方甘草片","spec":"100片","quantity":1,"price":8.50}]`,
		`[{"name":"奥美拉唑肠溶胶囊","spec":"20mg*14粒","quantity":2,"price":32.00},{"name":"多潘立酮片","spec":"10mg*30片","quantity":1,"price":15.60}]`,
		`[{"name":"二甲双胍片","spec":"0.5g*60片","quantity":2,"price":28.90},{"name":"格列美脲片","spec":"2mg*30片","quantity":1,"price":22.40}]`,
		`[{"name":"硝苯地平控释片","spec":"30mg*7片","quantity":4,"price":55.00},{"name":"厄贝沙坦片","spec":"0.15g*7片","quantity":3,"price":42.00}]`,
		`[{"name":"阿司匹林肠溶片","spec":"100mg*30片","quantity":2,"price":16.80},{"name":"阿托伐他汀钙片","spec":"20mg*7片","quantity":2,"price":68.50}]`,
		`[{"name":"氯雷他定片","spec":"10mg*6片","quantity":2,"price":12.50},{"name":"维生素C片","spec":"0.1g*100片","quantity":1,"price":5.80}]`,
		`[{"name":"左氧氟沙星片","spec":"0.5g*4片","quantity":2,"price":58.00},{"name":"蒙脱石散","spec":"3g*10袋","quantity":1,"price":24.60}]`,
	}

	patients := []struct {
		name string
		id   string
		dept string
		doc  string
	}{
		{"张三", "110101199001011234", "内科", "陈医生"},
		{"李四", "110101198505055678", "外科", "刘医生"},
		{"王五", "110101199208089012", "儿科", "赵医生"},
		{"赵六", "110101197803153456", "心内科", "孙医生"},
		{"钱七", "110101199512207890", "消化科", "周医生"},
		{"孙八", "110101198807072345", "呼吸科", "吴医生"},
		{"周九", "110101199111116789", "内分泌科", "郑医生"},
		{"吴十", "110101198202280123", "神经内科", "王医生"},
		{"郑十一", "110101199709094567", "皮肤科", "冯医生"},
		{"冯十二", "110101199406068901", "骨科", "陈医生"},
	}

	statuses := []string{
		"draft",
		"pending_registration",
		"registered",
		"pending_verification",
		"verified",
		"pending_review",
		"archived",
		"draft",
		"registered",
		"pending_verification",
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for i, p := range patients {
		transferNo := fmt.Sprintf("RX%s%05d", time.Now().Format("20060102"), i+1)
		medIdx := i % len(medicines)
		total := 50.0 + float64(i)*15.5
		status := statuses[i]
		version := 1
		if i > 3 {
			version = 2
		}
		if i > 6 {
			version = 3
		}

		now := time.Now().Add(-time.Duration(10-i) * time.Hour)

		_, err = tx.Exec(
			`INSERT INTO prescription_transfers (transfer_no, patient_name, id_card, department, doctor_name, medicine_list, total_amount, status, version, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			transferNo, p.name, p.id, p.dept, p.doc, medicines[medIdx], total, status, version, now, now,
		)
		if err != nil {
			return fmt.Errorf("seed transfer %d: %w", i+1, err)
		}

		transferID := int64(i + 1)

		if status != "draft" && status != "pending_registration" {
			_, err = tx.Exec(
				`INSERT INTO transfer_evidences (transfer_id, evidence_type, operator_id, operator_name, operator_role, evidence_content, remark, created_at)
				 VALUES (?, 'registration', 1, '张接诊', 'reception_assistant', ?, '正常登记', ?)`,
				transferID, fmt.Sprintf("接诊登记凭证-%d", transferID), now.Add(30*time.Minute),
			)
			if err != nil {
				return fmt.Errorf("seed evidence registration %d: %w", i+1, err)
			}
		}

		if status == "pending_verification" || status == "verified" || status == "pending_review" || status == "archived" {
			_, err = tx.Exec(
				`INSERT INTO transfer_evidences (transfer_id, evidence_type, operator_id, operator_name, operator_role, evidence_content, remark, created_at)
				 VALUES (?, 'verification', 2, '李医师', 'attending_physician', ?, '核验通过', ?)`,
				transferID, fmt.Sprintf("医师核验凭证-%d", transferID), now.Add(2*time.Hour),
			)
			if err != nil {
				return fmt.Errorf("seed evidence verification %d: %w", i+1, err)
			}
		}

		if status == "pending_review" || status == "archived" {
			_, err = tx.Exec(
				`INSERT INTO transfer_evidences (transfer_id, evidence_type, operator_id, operator_name, operator_role, evidence_content, remark, created_at)
				 VALUES (?, 'review', 3, '王药师', 'pharmacy_admin', ?, '复核归档完成', ?)`,
				transferID, fmt.Sprintf("药房复核凭证-%d", transferID), now.Add(4*time.Hour),
			)
			if err != nil {
				return fmt.Errorf("seed evidence review %d: %w", i+1, err)
			}
		}
	}

	batchNo1 := fmt.Sprintf("BATCH-%s-001", time.Now().Format("20060102150405"))
	_, err = tx.Exec(
		`INSERT INTO batch_operations (batch_no, operation_type, operator_id, operator_name, total_count, success_count, fail_count, status, created_at)
		 VALUES (?, 'register', 1, '张接诊', 3, 2, 1, 'completed', ?)`,
		batchNo1, time.Now().Add(-8*time.Hour),
	)
	if err != nil {
		return fmt.Errorf("seed batch1: %w", err)
	}

	batchID1 := int64(1)
	batchItems1 := []struct {
		transferID int64
		status     string
		errMsg     string
	}{
		{1, "success", ""},
		{2, "success", ""},
		{3, "failed", "当前状态不允许此操作"},
	}
	for _, item := range batchItems1 {
		_, err = tx.Exec(
			`INSERT INTO batch_items (batch_id, transfer_id, status, error_message, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			batchID1, item.transferID, item.status, item.errMsg,
			time.Now().Add(-8*time.Hour), time.Now().Add(-8*time.Hour),
		)
		if err != nil {
			return fmt.Errorf("seed batch items: %w", err)
		}
	}

	for i := 1; i <= 10; i++ {
		action := "create"
		targetType := "transfer"
		if i%3 == 0 {
			action = "update"
		}
		if i%5 == 0 {
			action = "register"
		}

		userID := (i % 3) + 1
		userName := "张接诊"
		userRole := "reception_assistant"
		if userID == 2 {
			userName = "李医师"
			userRole = "attending_physician"
		} else if userID == 3 {
			userName = "王药师"
			userRole = "pharmacy_admin"
		}

		_, err = tx.Exec(
			`INSERT INTO audit_logs (user_id, user_name, role, action, target_type, target_id, old_value, new_value, ip_address, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			userID, userName, userRole, action, targetType, int64(i),
			fmt.Sprintf(`{"status":"old_%d"}`, i),
			fmt.Sprintf(`{"status":"new_%d"}`, i),
			"127.0.0.1",
			time.Now().Add(-time.Duration(i)*time.Hour),
		)
		if err != nil {
			return fmt.Errorf("seed audit log %d: %w", i, err)
		}
	}

	return tx.Commit()
}
