package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"water-office/db"
	"water-office/models"
	"water-office/utils"
)

func GetStatistics(w http.ResponseWriter, r *http.Request) {
	var stats models.Statistics

	db.DB.QueryRow("SELECT COUNT(*) FROM applications").Scan(&stats.Total)
	db.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE status='DRAFT'").Scan(&stats.Draft)
	db.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE status='PENDING_AUDIT'").Scan(&stats.PendingAudit)
	db.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE status='NEED_CORRECTION'").Scan(&stats.NeedCorrection)
	db.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE status='PENDING_REVIEW'").Scan(&stats.PendingReview)
	db.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE status='ARCHIVED'").Scan(&stats.Archived)

	today := time.Now().Format("2006-01-02")
	db.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE DATE(created_at)=?", today).Scan(&stats.TodayCreated)
	db.DB.QueryRow(`
		SELECT COUNT(*) FROM applications 
		WHERE status='ARCHIVED' AND DATE(reviewed_at)=?`, today).Scan(&stats.TodayDone)

	db.DB.QueryRow("SELECT COUNT(*) FROM handovers WHERE status='PENDING'").Scan(&stats.Handovers.Pending)
	db.DB.QueryRow("SELECT COUNT(*) FROM handovers WHERE status='ACCEPTED'").Scan(&stats.Handovers.Accepted)
	db.DB.QueryRow("SELECT COUNT(*) FROM handovers WHERE status='REJECTED'").Scan(&stats.Handovers.Rejected)
	stats.Handovers.Total = stats.Handovers.Pending + stats.Handovers.Accepted + stats.Handovers.Rejected

	byRole := make(map[string]int64)
	var roleName string
	var roleCnt int64
	rows, _ := db.DB.Query(`
		SELECT u.role, COUNT(*) FROM applications a
		JOIN users u ON a.current_handler_id = u.id
		WHERE a.status != 'ARCHIVED'
		GROUP BY u.role
	`)
	for rows.Next() {
		rows.Scan(&roleName, &roleCnt)
		byRole[models.Role(roleName).DisplayName()] = roleCnt
	}
	rows.Close()
	stats.ByRole = byRole

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.Success(stats))
}

func ListOperationLogs(w http.ResponseWriter, r *http.Request) {
	appIDStr := chi.URLParam(r, "appId")
	appID, err := strconv.ParseInt(appIDStr, 10, 64)
	if err != nil || appID <= 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(utils.Fail(400, "申请ID格式错误"))
		return
	}

	rows, err := db.DB.Query(`
		SELECT id, application_id, application_no, user_id, user_name, user_role,
			operation, operation_detail, from_status, to_status, ip_address, created_at
		FROM operation_logs
		WHERE application_id = ?
		ORDER BY id DESC
		LIMIT 100
	`, appID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "查询操作日志失败: "+err.Error()))
		return
	}
	defer rows.Close()

	list := []models.OperationLog{}
	for rows.Next() {
		var log models.OperationLog
		var fromStatus, toStatus []byte
		err := rows.Scan(
			&log.ID, &log.ApplicationID, &log.ApplicationNo,
			&log.UserID, &log.UserName, &log.UserRole,
			&log.Operation, &log.OperationDetail,
			&fromStatus, &toStatus, &log.IPAddress, &log.CreatedAt,
		)
		if err != nil {
			continue
		}
		log.FromStatus = string(fromStatus)
		log.ToStatus = string(toStatus)
		if log.FromStatus != "" {
			log.FromStatus = models.ApplicationStatus(log.FromStatus).DisplayName()
		}
		if log.ToStatus != "" {
			log.ToStatus = models.ApplicationStatus(log.ToStatus).DisplayName()
		}
		list = append(list, log)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.Success(list))
}

func BatchResult(w http.ResponseWriter, r *http.Request) {
	idsStr := r.URL.Query()["ids"]
	ids := []int64{}
	for _, s := range idsStr {
		id, _ := strconv.ParseInt(s, 10, 64)
		if id > 0 {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(utils.Success([]models.Application{}))
		return
	}

	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}

	sql := baseSelectSQL() + " WHERE id IN (" + joinStrings(placeholders, ",") + ") ORDER BY id DESC"
	rows, err := db.DB.Query(sql, args...)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(utils.Fail(500, "批量查询失败: "+err.Error()))
		return
	}
	defer rows.Close()

	apps, _ := scanApplicationRows(rows)
	if apps == nil {
		apps = []models.Application{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(utils.Success(apps))
}
