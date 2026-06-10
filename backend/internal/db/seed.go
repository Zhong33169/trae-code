package db

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"
)

func SeedData(db *sql.DB) error {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return fmt.Errorf("count users: %w", err)
	}
	if count > 0 {
		return nil
	}

	users := []struct {
		username string
		password string
		role     string
		name     string
	}{
		{"reception", "123456", "reception_assistant", "李接待"},
		{"physician", "123456", "attending_physician", "王医师"},
		{"pharmacy", "123456", "pharmacy_admin", "张药师"},
	}

	userIDs := make(map[string]int64)
	for _, u := range users {
		passwordHash := hashPassword(u.password)
		result, err := db.Exec(
			`INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)`,
			u.username, passwordHash, u.role, u.name,
		)
		if err != nil {
			return fmt.Errorf("insert user %s: %w", u.username, err)
		}
		id, _ := result.LastInsertId()
		userIDs[u.username] = id
	}

	receptionID := userIDs["reception"]
	physicianID := userIDs["physician"]
	pharmacyID := userIDs["pharmacy"]

	transfers := []struct {
		transferNo   string
		patientName  string
		idCard       string
		department   string
		doctorName   string
		medicineList string
		totalAmount  float64
		status       string
		version      int
	}{
		{"CF20260601001", "张三", "110101199001011234", "内科", "王医师", `{"items":[{"name":"感冒灵","spec":"10g*9袋","qty":2,"price":15.5}]}`, 31.00, "pending_verification", 2},
		{"CF20260601002", "李四", "110101199002022345", "外科", "王医师", `{"items":[{"name":"阿莫西林","spec":"0.5g*24粒","qty":1,"price":28.0}]}`, 28.00, "pending_verification", 2},
		{"CF20260601003", "王五", "110101199003033456", "内科", "赵医师", `{"items":[{"name":"布洛芬","spec":"0.3g*20片","qty":1,"price":12.8}]}`, 12.80, "pending_verification", 2},
		{"CF20260601004", "赵六", "110101199004044567", "儿科", "王医师", `{"items":[{"name":"小儿氨酚黄那敏","spec":"12袋","qty":2,"price":18.0}]}`, 36.00, "pending_review", 3},
		{"CF20260601005", "钱七", "110101199005055678", "内科", "王医师", `{"items":[{"name":"奥美拉唑","spec":"20mg*14粒","qty":1,"price":35.5}]}`, 35.50, "archived", 4},
		{"CF20260601006", "孙八", "110101199006066789", "外科", "李医师", `{"items":[{"name":"云南白药","spec":"4g*6瓶","qty":1,"price":42.0}]}`, 42.00, "archived", 4},
		{"CF20260601007", "周九", "110101199007077890", "内科", "王医师", `{"items":[{"name":"六味地黄丸","spec":"200丸","qty":2,"price":25.0}]}`, 50.00, "archived", 4},
		{"CF20260601008", "吴十", "110101199008088901", "皮肤科", "赵医师", `{"items":[{"name":"氯雷他定","spec":"10mg*6片","qty":1,"price":22.0}]}`, 22.00, "draft", 1},
		{"CF20260601009", "郑十一", "110101199009099012", "内科", "王医师", `{"items":[{"name":"蒙脱石散","spec":"3g*10袋","qty":1,"price":16.5}]}`, 16.50, "pending_verification", 2},
		{"CF20260601010", "冯十二", "110101199010100123", "外科", "李医师", `{"items":[{"name":"头孢克肟","spec":"0.1g*6粒","qty":2,"price":38.0}]}`, 76.00, "archived", 4},
	}

	transferIDs := make([]int64, 0, len(transfers))
	for _, t := range transfers {
		result, err := db.Exec(
			`INSERT INTO prescription_transfers
			 (transfer_no, patient_name, id_card, department, doctor_name, medicine_list, total_amount, status, version)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			t.transferNo, t.patientName, t.idCard, t.department, t.doctorName,
			t.medicineList, t.totalAmount, t.status, t.version,
		)
		if err != nil {
			return fmt.Errorf("insert transfer %s: %w", t.transferNo, err)
		}
		id, _ := result.LastInsertId()
		transferIDs = append(transferIDs, id)
	}

	now := time.Now()
	ts := func(offsetMinutes int) string {
		return now.Add(time.Duration(offsetMinutes) * time.Minute).Format("2006-01-02 15:04:05")
	}

	evidences := []struct {
		transferIdx   int
		evidenceType  string
		operatorID    int64
		operatorName  string
		operatorRole  string
		evidenceContent string
		remark        string
		offsetMinutes int
	}{
		{0, "registration", receptionID, "李接待", "reception_assistant", "已核对患者身份证与处方信息，患者签字确认", "批量登记-上午批次", -60},
		{1, "registration", receptionID, "李接待", "reception_assistant", "已核对患者就诊卡信息，处方信息完整", "批量登记-上午批次", -60},
		{2, "registration", receptionID, "李接待", "reception_assistant", "患者家属代办，已核验代办人身份证", "家属代办登记", -120},
		{3, "registration", receptionID, "李接待", "reception_assistant", "已核对处方与缴费凭证", "急诊登记", -115},
		{4, "registration", receptionID, "李接待", "reception_assistant", "已核验电子处方与患者信息", "内科登记", -110},
		{5, "registration", receptionID, "李接待", "reception_assistant", "已核对外科手术处方与患者信息", "术前登记", -105},
		{6, "registration", receptionID, "李接待", "reception_assistant", "已核验电子处方与患者身份", "门诊登记", -100},
		{8, "registration", receptionID, "李接待", "reception_assistant", "已核验线上预约处方信息", "线上预约登记", -95},
		{9, "registration", receptionID, "李接待", "reception_assistant", "已核对外科处方与患者信息", "外科登记", -90},

		{3, "verification", physicianID, "王医师", "attending_physician", "已核验处方用药合理性，与诊断一致", "批量核验-午间批次", -30},
		{4, "verification", physicianID, "王医师", "attending_physician", "处方核验通过，按疗程用药", "补录核验", -15},
		{5, "verification", physicianID, "王医师", "attending_physician", "处方核验通过，按疗程用药", "主治医生核验", -80},
		{6, "verification", physicianID, "王医师", "attending_physician", "已核验用药方案，无配伍禁忌", "内科核验", -75},
		{9, "verification", physicianID, "王医师", "attending_physician", "已核对术后用药方案，无药物相互作用", "外科核验", -70},

		{5, "review", pharmacyID, "张药师", "pharmacy_admin", "已完成药品调配与复核，发药确认", "批量复核-下午批次", -10},
		{4, "review", pharmacyID, "张药师", "pharmacy_admin", "已完成发药，患者已取药", "重试后复核成功", -8},
		{6, "review", pharmacyID, "张药师", "pharmacy_admin", "已完成发药并归档", "药房发药归档", -50},
		{9, "review", pharmacyID, "张药师", "pharmacy_admin", "药品调配完成，患者已取药", "外科发药归档", -45},
	}

	for _, e := range evidences {
		tid := transferIDs[e.transferIdx]
		_, err := db.Exec(
			`INSERT INTO transfer_evidences
			 (transfer_id, evidence_type, operator_id, operator_name, operator_role, evidence_content, remark, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			tid, e.evidenceType, e.operatorID, e.operatorName, e.operatorRole,
			e.evidenceContent, e.remark, ts(e.offsetMinutes),
		)
		if err != nil {
			return fmt.Errorf("insert evidence: %w", err)
		}
	}

	batchNo1 := "BATCH-20260609093000-001"
	batchNo2 := "BATCH-20260609101500-002"
	batchNo3 := "BATCH-20260609110000-003"

	batches := []struct {
		batchNo       string
		opType        string
		operatorID    int64
		operatorName  string
		totalCount    int
		successCount  int
		failCount     int
		status        string
		offsetMinutes int
	}{
		{batchNo1, "register", receptionID, "李接待", 3, 2, 1, "completed", -60},
		{batchNo2, "verify", physicianID, "王医师", 2, 1, 1, "completed", -30},
		{batchNo3, "review", pharmacyID, "张药师", 3, 2, 1, "completed", -10},
	}

	batchIDs := make(map[string]int64)
	for _, b := range batches {
		result, err := db.Exec(
			`INSERT INTO batch_operations
			 (batch_no, operation_type, operator_id, operator_name, total_count, success_count, fail_count, status, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			b.batchNo, b.opType, b.operatorID, b.operatorName,
			b.totalCount, b.successCount, b.failCount, b.status, ts(b.offsetMinutes),
		)
		if err != nil {
			return fmt.Errorf("insert batch %s: %w", b.batchNo, err)
		}
		id, _ := result.LastInsertId()
		batchIDs[b.batchNo] = id
	}

	batch1Items := []struct {
		transferIdx int
		status      string
		errorMsg    string
	}{
		{0, "success", ""},
		{1, "success", ""},
		{6, "failed", "当前状态不允许此操作：已归档状态不能登记"},
	}
	for _, item := range batch1Items {
		tid := transferIDs[item.transferIdx]
		resultData := ""
		if item.status == "success" {
			resultData = `{"status":"success","new_status":"pending_verification"}`
		}
		_, err := db.Exec(
			`INSERT INTO batch_items
			 (batch_id, transfer_id, status, error_message, result_data, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			batchIDs[batchNo1], tid, item.status, item.errorMsg, resultData,
			ts(-60), ts(-58),
		)
		if err != nil {
			return fmt.Errorf("insert batch1 item: %w", err)
		}
	}

	batch2Items := []struct {
		transferIdx int
		status      string
		errorMsg    string
	}{
		{3, "success", ""},
		{7, "failed", "当前状态不允许此操作：草稿状态不能核验"},
	}
	for _, item := range batch2Items {
		tid := transferIDs[item.transferIdx]
		resultData := ""
		if item.status == "success" {
			resultData = `{"status":"success","new_status":"pending_review"}`
		}
		_, err := db.Exec(
			`INSERT INTO batch_items
			 (batch_id, transfer_id, status, error_message, result_data, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			batchIDs[batchNo2], tid, item.status, item.errorMsg, resultData,
			ts(-30), ts(-28),
		)
		if err != nil {
			return fmt.Errorf("insert batch2 item: %w", err)
		}
	}

	batch3Items := []struct {
		transferIdx int
		status      string
		errorMsg    string
	}{
		{5, "success", ""},
		{4, "success", ""},
		{2, "failed", "当前状态不允许此操作：待核验状态不能复核归档"},
	}
	for _, item := range batch3Items {
		tid := transferIDs[item.transferIdx]
		resultData := ""
		if item.status == "success" {
			resultData = `{"status":"success","new_status":"archived"}`
		}
		_, err := db.Exec(
			`INSERT INTO batch_items
			 (batch_id, transfer_id, status, error_message, result_data, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			batchIDs[batchNo3], tid, item.status, item.errorMsg, resultData,
			ts(-10), ts(-8),
		)
		if err != nil {
			return fmt.Errorf("insert batch3 item: %w", err)
		}
	}

	auditLogs := []struct {
		userID       int64
		userName     string
		role         string
		action       string
		targetType   string
		targetID     int64
		oldValue     string
		newValue     string
		ipAddress    string
		offsetMinutes int
	}{
		{receptionID, "李接待", "reception_assistant", "login", "user", receptionID, "",
			`{"status":"success"}`, "192.168.1.100", -180},
		{physicianID, "王医师", "attending_physician", "login", "user", physicianID, "",
			`{"status":"success"}`, "192.168.1.101", -150},
		{pharmacyID, "张药师", "pharmacy_admin", "login", "user", pharmacyID, "",
			`{"status":"success"}`, "192.168.1.102", -140},

		{receptionID, "李接待", "reception_assistant", "create_transfer", "transfer", transferIDs[0], "",
			`{"patient_name":"张三","total_amount":31.00}`, "192.168.1.100", -130},

		{receptionID, "李接待", "reception_assistant", "register", "transfer", transferIDs[2],
			`{"old_status":"pending_registration","version":1}`,
			`{"new_status":"pending_verification","version":2}`, "192.168.1.100", -120},

		{receptionID, "李接待", "reception_assistant", "batch_create", "batch", batchIDs[batchNo1], "",
			mustJSON(map[string]interface{}{
				"batch_no":         batchNo1,
				"operation_type":   "register",
				"total_count":      3,
				"evidence_content": "批量登记当日门诊处方",
				"remark":           "上午批次",
				"transfer_ids":     []int64{transferIDs[0], transferIDs[1], transferIDs[6]},
			}), "192.168.1.100", -61},

		{receptionID, "李接待", "reception_assistant", "register", "transfer", transferIDs[0],
			`{"old_status":"pending_registration","version":1}`,
			`{"new_status":"pending_verification","version":2}`, "192.168.1.100", -60},
		{receptionID, "李接待", "reception_assistant", "register", "transfer", transferIDs[1],
			`{"old_status":"pending_registration","version":1}`,
			`{"new_status":"pending_verification","version":2}`, "192.168.1.100", -60},

		{receptionID, "李接待", "reception_assistant", "batch_complete", "batch", batchIDs[batchNo1],
			"",
			mustJSON(map[string]interface{}{
				"operation_type": "register",
				"total_count":    3,
				"success_count":  2,
				"fail_count":     1,
				"failed_items": []map[string]interface{}{
					{"transfer_id": transferIDs[6], "transfer_no": "CF20260601007", "error": "当前状态不允许此操作：已归档状态不能登记"},
				},
			}), "192.168.1.100", -59},

		{physicianID, "王医师", "attending_physician", "verify", "transfer", transferIDs[5],
			`{"old_status":"pending_verification","version":2}`,
			`{"new_status":"pending_review","version":3}`, "192.168.1.101", -70},

		{physicianID, "王医师", "attending_physician", "batch_create", "batch", batchIDs[batchNo2], "",
			mustJSON(map[string]interface{}{
				"batch_no":         batchNo2,
				"operation_type":   "verify",
				"total_count":      2,
				"evidence_content": "批量核验今日内科处方",
				"remark":           "午间批次",
				"transfer_ids":     []int64{transferIDs[3], transferIDs[7]},
			}), "192.168.1.101", -31},

		{physicianID, "王医师", "attending_physician", "verify", "transfer", transferIDs[3],
			`{"old_status":"pending_verification","version":2}`,
			`{"new_status":"pending_review","version":3}`, "192.168.1.101", -30},

		{physicianID, "王医师", "attending_physician", "batch_complete", "batch", batchIDs[batchNo2],
			"",
			mustJSON(map[string]interface{}{
				"operation_type": "verify",
				"total_count":    2,
				"success_count":  1,
				"fail_count":     1,
				"failed_items": []map[string]interface{}{
					{"transfer_id": transferIDs[7], "transfer_no": "CF20260601008", "error": "当前状态不允许此操作：草稿状态不能核验"},
				},
			}), "192.168.1.101", -29},

		{pharmacyID, "张药师", "pharmacy_admin", "review", "transfer", transferIDs[6],
			`{"old_status":"pending_review","version":3}`,
			`{"new_status":"archived","version":4}`, "192.168.1.102", -50},

		{pharmacyID, "张药师", "pharmacy_admin", "batch_create", "batch", batchIDs[batchNo3], "",
			mustJSON(map[string]interface{}{
				"batch_no":         batchNo3,
				"operation_type":   "review",
				"total_count":      3,
				"evidence_content": "批量复核今日处方并发药",
				"remark":           "下午归档批次",
				"transfer_ids":     []int64{transferIDs[5], transferIDs[4], transferIDs[2]},
			}), "192.168.1.102", -11},

		{pharmacyID, "张药师", "pharmacy_admin", "review", "transfer", transferIDs[5],
			`{"old_status":"pending_review","version":3}`,
			`{"new_status":"archived","version":4}`, "192.168.1.102", -10},

		{pharmacyID, "张药师", "pharmacy_admin", "batch_complete", "batch", batchIDs[batchNo3],
			"",
			mustJSON(map[string]interface{}{
				"operation_type": "review",
				"total_count":    3,
				"success_count":  1,
				"fail_count":     2,
				"failed_items": []map[string]interface{}{
					{"transfer_id": transferIDs[4], "transfer_no": "CF20260601005", "error": "当前状态不允许此操作：待核验状态不能复核归档"},
					{"transfer_id": transferIDs[2], "transfer_no": "CF20260601003", "error": "当前状态不允许此操作：待核验状态不能复核归档"},
				},
			}), "192.168.1.102", -9},

		{physicianID, "王医师", "attending_physician", "verify", "transfer", transferIDs[4],
			`{"old_status":"pending_verification","version":2}`,
			`{"new_status":"pending_review","version":3}`, "192.168.1.101", -7},

		{pharmacyID, "张药师", "pharmacy_admin", "batch_retry", "batch", batchIDs[batchNo3],
			mustJSON(map[string]interface{}{
				"batch_no":       batchNo3,
				"operation_type": "review",
				"retry_count":    2,
				"prev_success":   1,
				"prev_fail":      2,
			}),
			mustJSON(map[string]interface{}{
				"batch_no":       batchNo3,
				"operation_type": "review",
				"retry_count":    2,
				"failed_items": []map[string]interface{}{
					{"transfer_id": transferIDs[4], "transfer_no": "CF20260601005", "error": "当前状态不允许此操作：待核验状态不能复核归档"},
					{"transfer_id": transferIDs[2], "transfer_no": "CF20260601003", "error": "当前状态不允许此操作：待核验状态不能复核归档"},
				},
			}), "192.168.1.102", -5},

		{pharmacyID, "张药师", "pharmacy_admin", "review", "transfer", transferIDs[4],
			`{"old_status":"pending_review","version":3}`,
			`{"new_status":"archived","version":4}`, "192.168.1.102", -4},

		{pharmacyID, "张药师", "pharmacy_admin", "batch_retry_complete", "batch", batchIDs[batchNo3],
			"",
			mustJSON(map[string]interface{}{
				"operation_type": "review",
				"total_count":    3,
				"success_count":  2,
				"fail_count":     1,
				"failed_items": []map[string]interface{}{
					{"transfer_id": transferIDs[2], "transfer_no": "CF20260601003", "error": "当前状态不允许此操作：待核验状态不能复核归档"},
				},
				"retry": true,
			}), "192.168.1.102", -3},
	}

	for _, a := range auditLogs {
		_, err := db.Exec(
			`INSERT INTO audit_logs
			 (user_id, user_name, role, action, target_type, target_id, old_value, new_value, ip_address, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			a.userID, a.userName, a.role, a.action, a.targetType, a.targetID,
			a.oldValue, a.newValue, a.ipAddress, ts(a.offsetMinutes),
		)
		if err != nil {
			return fmt.Errorf("insert audit log %s: %w", a.action, err)
		}
	}

	return nil
}

func mustJSON(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(b)
}

func hashPassword(password string) string {
	h := sha256.New()
	h.Write([]byte(password))
	return hex.EncodeToString(h.Sum(nil))
}
