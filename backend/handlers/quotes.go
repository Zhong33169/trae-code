package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"repair-platform/database"
	"repair-platform/middleware"
	"repair-platform/models"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
)

func addOperationLog(tx *sql.Tx, quoteID int64, operation, oldStatus, newStatus, remark string, user *middleware.UserInfo) error {
	_, err := tx.Exec(
		`INSERT INTO operation_logs (quote_id, operation, old_status, new_status, operator_id, operator_name, operator_role, remark)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		quoteID, operation, oldStatus, newStatus, user.ID, user.RealName, user.Role, remark,
	)
	return err
}

func checkRoleAllowed(userRole string, allowedRoles []string) bool {
	for _, r := range allowedRoles {
		if userRole == r {
			return true
		}
	}
	return false
}

type ListQuotesRequest struct {
	Status   string `query:"status"`
	Keyword  string `query:"keyword"`
	MyOnly   string `query:"my_only"`
	Shift    string `query:"shift"`
	Page     int    `query:"page"`
	PageSize int    `query:"page_size"`
}

func ListQuotes(c echo.Context) error {
	user := middleware.GetUser(c)
	req := ListQuotesRequest{}
	c.Bind(&req)

	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 || req.PageSize > 100 {
		req.PageSize = 20
	}

	query := `SELECT id, quote_no, customer_name, customer_phone, device_type, device_model,
		status, current_handler_id, current_handler, shift,
		estimate_amount, actual_amount, payment_status,
		assigned_technician, creator_name, handover_count, created_at, updated_at
		FROM repair_quotes WHERE 1=1`
	countQuery := "SELECT COUNT(*) FROM repair_quotes WHERE 1=1"

	var args []interface{}
	var countArgs []interface{}
	argIdx := 1

	addWhere := func(cond string, val interface{}) {
		query += fmt.Sprintf(" AND %s", cond)
		countQuery += fmt.Sprintf(" AND %s", cond)
		args = append(args, val)
		countArgs = append(countArgs, val)
	}

	if req.Status != "" && req.Status != "all" {
		addWhere(fmt.Sprintf("status = $%d", argIdx), req.Status)
		argIdx++
	}

	if req.Shift != "" && req.Shift != "all" {
		addWhere(fmt.Sprintf("shift = $%d", argIdx), req.Shift)
		argIdx++
	}

	if req.MyOnly == "true" || req.MyOnly == "1" {
		addWhere(fmt.Sprintf("current_handler_id = $%d", argIdx), user.ID)
		argIdx++
	}

	if req.Keyword != "" {
		kw := "%" + req.Keyword + "%"
		query += fmt.Sprintf(" AND (quote_no LIKE $%d OR customer_name LIKE $%d OR customer_phone LIKE $%d OR device_type LIKE $%d OR device_model LIKE $%d)", argIdx, argIdx, argIdx, argIdx, argIdx)
		countQuery += fmt.Sprintf(" AND (quote_no LIKE $%d OR customer_name LIKE $%d OR customer_phone LIKE $%d OR device_type LIKE $%d OR device_model LIKE $%d)", argIdx, argIdx, argIdx, argIdx, argIdx)
		args = append(args, kw, kw, kw, kw, kw)
		countArgs = append(countArgs, kw, kw, kw, kw, kw)
		argIdx += 5
	}

	var total int
	database.DB.QueryRow(countQuery, countArgs...).Scan(&total)

	query += " ORDER BY updated_at DESC LIMIT $%d OFFSET $%d"
	query = fmt.Sprintf(query, argIdx, argIdx+1)
	offset := (req.Page - 1) * req.PageSize
	args = append(args, req.PageSize, offset)

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "查询报价单列表失败: " + err.Error()})
	}
	defer rows.Close()

	list := make([]map[string]interface{}, 0)
	for rows.Next() {
		var q models.RepairQuote
		rows.Scan(&q.ID, &q.QuoteNo, &q.CustomerName, &q.CustomerPhone, &q.DeviceType, &q.DeviceModel,
			&q.Status, &q.CurrentHandlerID, &q.CurrentHandler, &q.Shift,
			&q.EstimateAmount, &q.ActualAmount, &q.PaymentStatus,
			&q.AssignedTechnician, &q.CreatorName, &q.HandoverCount, &q.CreatedAt, &q.UpdatedAt)

		statusDisplay, ok := models.StatusDisplayNames[q.Status]
		if !ok {
			statusDisplay = q.Status
		}
		shiftDisplay, ok := models.ShiftDisplayNames[q.Shift]
		if !ok {
			shiftDisplay = q.Shift
		}

		list = append(list, map[string]interface{}{
			"id":                  q.ID,
			"quote_no":            q.QuoteNo,
			"customer_name":       q.CustomerName,
			"customer_phone":      q.CustomerPhone,
			"device_type":         q.DeviceType,
			"device_model":        q.DeviceModel,
			"status":              q.Status,
			"status_display":      statusDisplay,
			"current_handler_id":  q.CurrentHandlerID,
			"current_handler":     q.CurrentHandler,
			"shift":               q.Shift,
			"shift_display":       shiftDisplay,
			"estimate_amount":     q.EstimateAmount,
			"actual_amount":       q.ActualAmount,
			"payment_status":      q.PaymentStatus,
			"assigned_technician": q.AssignedTechnician,
			"creator_name":        q.CreatorName,
			"handover_count":      q.HandoverCount,
			"created_at":          q.CreatedAt,
			"updated_at":          q.UpdatedAt,
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"list":      list,
		"total":     total,
		"page":      req.Page,
		"page_size": req.PageSize,
	})
}

func GetQuote(c echo.Context) error {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "报价单ID格式错误"})
	}

	var q models.RepairQuote
	var confAt, paidAt, compAt sql.NullTime
	err = database.DB.QueryRow(`SELECT id, quote_no, customer_name, customer_phone, device_type, device_model, fault_description,
		status, current_handler_id, current_handler, shift,
		estimate_amount, actual_amount, payment_status, payment_method, quote_detail,
		confirmed_at, paid_at, completed_at,
		assigned_technician_id, assigned_technician,
		creator_id, creator_name, handover_count, created_at, updated_at
		FROM repair_quotes WHERE id = ?`, id).Scan(
		&q.ID, &q.QuoteNo, &q.CustomerName, &q.CustomerPhone, &q.DeviceType, &q.DeviceModel, &q.FaultDescription,
		&q.Status, &q.CurrentHandlerID, &q.CurrentHandler, &q.Shift,
		&q.EstimateAmount, &q.ActualAmount, &q.PaymentStatus, &q.PaymentMethod, &q.QuoteDetail,
		&confAt, &paidAt, &compAt,
		&q.AssignedTechnicianID, &q.AssignedTechnician,
		&q.CreatorID, &q.CreatorName, &q.HandoverCount, &q.CreatedAt, &q.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "报价单不存在"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "查询报价单失败"})
	}
	if confAt.Valid {
		q.ConfirmedAt = &confAt.Time
	}
	if paidAt.Valid {
		q.PaidAt = &paidAt.Time
	}
	if compAt.Valid {
		q.CompletedAt = &compAt.Time
	}

	statusDisplay, _ := models.StatusDisplayNames[q.Status]
	shiftDisplay, _ := models.ShiftDisplayNames[q.Shift]

	logRows, _ := database.DB.Query(`SELECT id, operation, old_status, new_status, operator_id, operator_name, operator_role, remark, created_at
		FROM operation_logs WHERE quote_id = ? ORDER BY id ASC`, id)
	logs := make([]map[string]interface{}, 0)
	for logRows.Next() {
		var l models.OperationLog
		logRows.Scan(&l.ID, &l.Operation, &l.OldStatus, &l.NewStatus, &l.OperatorID, &l.OperatorName, &l.OperatorRole, &l.Remark, &l.CreatedAt)
		oldSt := l.OldStatus
		newSt := l.NewStatus
		if name, ok := models.StatusDisplayNames[l.OldStatus]; ok && l.OldStatus != "" {
			oldSt = name
		}
		if name, ok := models.StatusDisplayNames[l.NewStatus]; ok && l.NewStatus != "" {
			newSt = name
		}
		roleDisplay, _ := models.RoleDisplayNames[l.OperatorRole]
		logs = append(logs, map[string]interface{}{
			"id":            l.ID,
			"operation":     l.Operation,
			"old_status":    oldSt,
			"new_status":    newSt,
			"operator_id":   l.OperatorID,
			"operator_name": l.OperatorName,
			"operator_role": roleDisplay,
			"remark":        l.Remark,
			"created_at":    l.CreatedAt,
		})
	}
	logRows.Close()

	handoverRows, _ := database.DB.Query(`SELECT id, quote_id, from_user_id, from_user_name, from_user_role, from_shift,
		to_user_id, to_user_name, to_user_role, to_shift, handover_remark, confirmed_at, status, created_at
		FROM shift_handovers WHERE quote_id = ? ORDER BY id DESC`, id)
	handovers := make([]map[string]interface{}, 0)
	for handoverRows.Next() {
		var h models.ShiftHandover
		var cAt sql.NullTime
		handoverRows.Scan(&h.ID, &h.QuoteID, &h.FromUserID, &h.FromUserName, &h.FromUserRole, &h.FromShift,
			&h.ToUserID, &h.ToUserName, &h.ToUserRole, &h.ToShift, &h.HandoverRemark, &cAt, &h.Status, &h.CreatedAt)
		if cAt.Valid {
			h.ConfirmedAt = &cAt.Time
		}
		fromRole, _ := models.RoleDisplayNames[h.FromUserRole]
		toRole, _ := models.RoleDisplayNames[h.ToUserRole]
		fromShift, _ := models.ShiftDisplayNames[h.FromShift]
		toShift, _ := models.ShiftDisplayNames[h.ToShift]
		handovers = append(handovers, map[string]interface{}{
			"id":              h.ID,
			"from_user_id":    h.FromUserID,
			"from_user_name":  h.FromUserName,
			"from_user_role":  fromRole,
			"from_shift":      fromShift,
			"to_user_id":      h.ToUserID,
			"to_user_name":    h.ToUserName,
			"to_user_role":    toRole,
			"to_shift":        toShift,
			"handover_remark": h.HandoverRemark,
			"confirmed_at":    h.ConfirmedAt,
			"status":          h.Status,
			"status_display": map[string]string{
				"pending":   "待确认接收",
				"confirmed": "已确认接收",
				"rejected":  "已拒绝",
			}[h.Status],
			"created_at": h.CreatedAt,
		})
	}
	handoverRows.Close()

	pendingHandover := make([]map[string]interface{}, 0)
	user := middleware.GetUser(c)
	for _, h := range handovers {
		if h["status"] == "pending" && h["to_user_id"].(int64) == user.ID {
			pendingHandover = append(pendingHandover, h)
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"quote": map[string]interface{}{
			"id":                     q.ID,
			"quote_no":               q.QuoteNo,
			"customer_name":          q.CustomerName,
			"customer_phone":         q.CustomerPhone,
			"device_type":            q.DeviceType,
			"device_model":           q.DeviceModel,
			"fault_description":      q.FaultDescription,
			"status":                 q.Status,
			"status_display":         statusDisplay,
			"current_handler_id":     q.CurrentHandlerID,
			"current_handler":        q.CurrentHandler,
			"shift":                  q.Shift,
			"shift_display":          shiftDisplay,
			"estimate_amount":        q.EstimateAmount,
			"actual_amount":          q.ActualAmount,
			"payment_status":         q.PaymentStatus,
			"payment_status_display": map[string]string{"unpaid": "未支付", "paid": "已支付", "partial": "部分支付", "refunded": "已退款"}[q.PaymentStatus],
			"payment_method":         q.PaymentMethod,
			"quote_detail":           q.QuoteDetail,
			"confirmed_at":           q.ConfirmedAt,
			"paid_at":                q.PaidAt,
			"completed_at":           q.CompletedAt,
			"assigned_technician_id": q.AssignedTechnicianID,
			"assigned_technician":    q.AssignedTechnician,
			"creator_id":             q.CreatorID,
			"creator_name":           q.CreatorName,
			"handover_count":         q.HandoverCount,
			"created_at":             q.CreatedAt,
			"updated_at":             q.UpdatedAt,
		},
		"operation_logs":    logs,
		"shift_handovers":   handovers,
		"pending_handovers": pendingHandover,
	})
}

type CreateQuoteRequest struct {
	CustomerName     string  `json:"customer_name"`
	CustomerPhone    string  `json:"customer_phone"`
	DeviceType       string  `json:"device_type"`
	DeviceModel      string  `json:"device_model"`
	FaultDescription string  `json:"fault_description"`
	EstimateAmount   float64 `json:"estimate_amount"`
}

func CreateQuote(c echo.Context) error {
	user := middleware.GetUser(c)
	if !checkRoleAllowed(user.Role, []string{models.RoleCustomerService, models.RoleServiceManager}) {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "仅客服专员和服务经理可登记维修报价单"})
	}

	req := new(CreateQuoteRequest)
	if err := c.Bind(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求参数格式错误"})
	}
	if req.CustomerName == "" || req.CustomerPhone == "" || req.DeviceType == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "客户姓名、联系电话、设备类型为必填项"})
	}

	tx, err := database.DB.Begin()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "启动事务失败"})
	}
	defer tx.Rollback()

	quoteNo := "WX" + time.Now().Format("20060102150405") + fmt.Sprintf("%02d", user.ID%100)

	status := models.StatusDraft
	if req.EstimateAmount > 0 {
		status = models.StatusPendingQuote
	}

	res, err := tx.Exec(`INSERT INTO repair_quotes
		(quote_no, customer_name, customer_phone, device_type, device_model, fault_description,
		 status, current_handler_id, current_handler, shift,
		 estimate_amount, creator_id, creator_name)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		quoteNo, req.CustomerName, req.CustomerPhone, req.DeviceType, req.DeviceModel, req.FaultDescription,
		status, user.ID, user.RealName, user.Shift,
		req.EstimateAmount, user.ID, user.RealName,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "创建报价单失败: " + err.Error()})
	}
	qid, _ := res.LastInsertId()

	addOperationLog(tx, qid, "登记维修报价单", "", status, fmt.Sprintf("创建人: %s(%s)", user.RealName, models.RoleDisplayNames[user.Role]), user)
	if status == models.StatusPendingQuote {
		addOperationLog(tx, qid, "提交待报价", models.StatusDraft, models.StatusPendingQuote, fmt.Sprintf("预估金额: %.2f元", req.EstimateAmount), user)
	}

	tx.Commit()
	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "维修报价单登记成功",
		"id":      qid,
		"status":  status,
	})
}

type QuoteUpdateRequest struct {
	EstimateAmount float64 `json:"estimate_amount"`
	QuoteDetail    string  `json:"quote_detail"`
}

func SubmitForQuote(c echo.Context) error {
	user := middleware.GetUser(c)
	if !checkRoleAllowed(user.Role, []string{models.RoleCustomerService, models.RoleServiceManager}) {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "权限不足: 仅客服专员和服务经理可提交报价单待报价"})
	}

	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var curStatus, curHandler string
	var curHandlerID int64
	err := database.DB.QueryRow("SELECT status, current_handler_id, current_handler FROM repair_quotes WHERE id = ?", id).Scan(&curStatus, &curHandlerID, &curHandler)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "报价单不存在"})
	}

	if curStatus != models.StatusDraft {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error":        fmt.Sprintf("无法提交待报价: 当前状态为「%s」，仅「草稿」状态可提交", models.StatusDisplayNames[curStatus]),
			"current_code": curStatus,
		})
	}

	tx, _ := database.DB.Begin()
	defer tx.Rollback()

	tx.Exec("UPDATE repair_quotes SET status = ?, updated_at = ? WHERE id = ?", models.StatusPendingQuote, time.Now(), id)
	addOperationLog(tx, id, "提交待报价", curStatus, models.StatusPendingQuote, "客服确认资料完整，提交报价", user)
	tx.Commit()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "已提交待报价，等待调度专员处理",
		"new_status": map[string]interface{}{
			"code": models.StatusPendingQuote,
			"name": models.StatusDisplayNames[models.StatusPendingQuote],
		},
	})
}

func FillQuote(c echo.Context) error {
	user := middleware.GetUser(c)
	if !checkRoleAllowed(user.Role, []string{models.RoleDispatcher, models.RoleServiceManager}) {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "权限不足: 仅调度专员和服务经理可填写报价"})
	}

	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	req := new(QuoteUpdateRequest)
	c.Bind(req)

	if req.EstimateAmount <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "报价金额必须大于0"})
	}

	var curStatus string
	err := database.DB.QueryRow("SELECT status FROM repair_quotes WHERE id = ?", id).Scan(&curStatus)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "报价单不存在"})
	}

	if curStatus != models.StatusPendingQuote {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("无法填写报价: 当前状态为「%s」，仅「待报价」状态可填写", models.StatusDisplayNames[curStatus]),
		})
	}

	tx, _ := database.DB.Begin()
	defer tx.Rollback()

	tx.Exec(`UPDATE repair_quotes
		SET estimate_amount = ?, quote_detail = ?, actual_amount = ?,
		    status = ?, current_handler_id = ?, current_handler = ?, shift = ?, updated_at = ?
		WHERE id = ?`,
		req.EstimateAmount, req.QuoteDetail, req.EstimateAmount,
		models.StatusQuoted, user.ID, user.RealName, user.Shift, time.Now(), id)

	addOperationLog(tx, id, "完成报价填写", curStatus, models.StatusQuoted,
		fmt.Sprintf("报价金额: %.2f元, 明细: %s", req.EstimateAmount, req.QuoteDetail), user)
	tx.Commit()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "报价填写完成，已发送客户确认",
		"new_status": map[string]interface{}{
			"code": models.StatusQuoted,
			"name": models.StatusDisplayNames[models.StatusQuoted],
		},
		"amount": req.EstimateAmount,
	})
}

type ConfirmQuoteRequest struct {
	Remark string `json:"remark"`
}

func ConfirmQuote(c echo.Context) error {
	user := middleware.GetUser(c)
	if !checkRoleAllowed(user.Role, []string{models.RoleCustomerService, models.RoleServiceManager}) {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "权限不足: 仅客服专员和服务经理可操作客户报价确认"})
	}

	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	req := new(ConfirmQuoteRequest)
	c.Bind(req)

	var curStatus string
	var estimate float64
	err := database.DB.QueryRow("SELECT status, estimate_amount FROM repair_quotes WHERE id = ?", id).Scan(&curStatus, &estimate)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "报价单不存在"})
	}

	if curStatus != models.StatusQuoted {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("无法确认报价: 当前状态为「%s」，仅「已报价待确认」状态可确认", models.StatusDisplayNames[curStatus]),
		})
	}

	now := time.Now()
	tx, _ := database.DB.Begin()
	defer tx.Rollback()

	tx.Exec("UPDATE repair_quotes SET status = ?, confirmed_at = ?, updated_at = ? WHERE id = ?", models.StatusConfirmed, now, now, id)
	remark := fmt.Sprintf("客户确认报价金额: %.2f元", estimate)
	if req.Remark != "" {
		remark += "，备注: " + req.Remark
	}
	addOperationLog(tx, id, "客户确认报价", curStatus, models.StatusConfirmed, remark, user)
	tx.Commit()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "客户报价确认完成，请引导客户支付",
		"new_status": map[string]interface{}{
			"code": models.StatusConfirmed,
			"name": models.StatusDisplayNames[models.StatusConfirmed],
		},
	})
}

type PaymentRequest struct {
	Amount        float64 `json:"amount"`
	PaymentMethod string  `json:"payment_method"`
	Remark        string  `json:"remark"`
}

func RecordPayment(c echo.Context) error {
	user := middleware.GetUser(c)
	if !checkRoleAllowed(user.Role, []string{models.RoleCustomerService, models.RoleServiceManager}) {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "权限不足: 仅客服专员和服务经理可登记客户支付"})
	}

	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	req := new(PaymentRequest)
	c.Bind(req)

	var curStatus string
	var estimate, actual float64
	err := database.DB.QueryRow("SELECT status, estimate_amount, actual_amount FROM repair_quotes WHERE id = ?", id).Scan(&curStatus, &estimate, &actual)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "报价单不存在"})
	}

	if curStatus != models.StatusConfirmed && curStatus != models.StatusReturned {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("无法登记支付: 当前状态为「%s」，仅「客户已确认」或「已退回」状态可登记支付", models.StatusDisplayNames[curStatus]),
		})
	}

	if req.Amount <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "支付金额必须大于0"})
	}
	if req.PaymentMethod == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请选择支付方式"})
	}
	if req.Amount < actual && actual > 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("支付金额不足: 应收 %.2f元，实付 %.2f元，暂不支持部分支付", actual, req.Amount),
		})
	}

	now := time.Now()
	tx, _ := database.DB.Begin()
	defer tx.Rollback()

	tx.Exec(`UPDATE repair_quotes
		SET status = ?, payment_status = 'paid', payment_method = ?, paid_at = ?, updated_at = ?
		WHERE id = ?`,
		models.StatusCustomerPaid, req.PaymentMethod, now, now, id)

	remark := fmt.Sprintf("支付金额: %.2f元, 支付方式: %s", req.Amount, req.PaymentMethod)
	if req.Remark != "" {
		remark += "，备注: " + req.Remark
	}
	addOperationLog(tx, id, "客户支付登记", curStatus, models.StatusCustomerPaid, remark, user)
	tx.Commit()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "客户支付登记成功，请分配维修师傅",
		"new_status": map[string]interface{}{
			"code": models.StatusCustomerPaid,
			"name": models.StatusDisplayNames[models.StatusCustomerPaid],
		},
		"paid_amount": req.Amount,
	})
}

type AssignTechRequest struct {
	TechnicianID int64  `json:"technician_id"`
	Remark       string `json:"remark"`
}

func AssignTechnician(c echo.Context) error {
	user := middleware.GetUser(c)
	if !checkRoleAllowed(user.Role, []string{models.RoleDispatcher, models.RoleServiceManager}) {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "权限不足: 仅调度专员和服务经理可分配维修师傅 (客服专员不能替师傅调度推进)"})
	}

	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	req := new(AssignTechRequest)
	c.Bind(req)

	if req.TechnicianID <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请选择维修师傅"})
	}

	var curStatus string
	err := database.DB.QueryRow("SELECT status FROM repair_quotes WHERE id = ?", id).Scan(&curStatus)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "报价单不存在"})
	}

	allowedStatuses := []string{models.StatusConfirmed, models.StatusCustomerPaid, models.StatusRepairing, models.StatusReturned}
	canAssign := false
	for _, s := range allowedStatuses {
		if curStatus == s {
			canAssign = true
			break
		}
	}
	if !canAssign {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("无法分配师傅: 当前状态为「%s」，分配操作仅允许在客户确认后执行", models.StatusDisplayNames[curStatus]),
		})
	}

	var techName, techShift string
	err = database.DB.QueryRow("SELECT real_name, shift FROM users WHERE id = ? AND role = ?", req.TechnicianID, models.RoleTechnician).Scan(&techName, &techShift)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "所选维修师傅不存在或角色错误"})
	}

	tx, _ := database.DB.Begin()
	defer tx.Rollback()

	tx.Exec(`UPDATE repair_quotes
		SET assigned_technician_id = ?, assigned_technician = ?,
		    current_handler_id = ?, current_handler = ?, shift = ?, updated_at = ?
		WHERE id = ?`,
		req.TechnicianID, techName, user.ID, user.RealName, techShift, time.Now(), id)

	addOperationLog(tx, id, "分配维修师傅", curStatus, curStatus,
		fmt.Sprintf("调度指派维修师傅: %s，备注: %s", techName, req.Remark), user)
	tx.Commit()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message":       fmt.Sprintf("已分配维修师傅: %s", techName),
		"technician":    techName,
		"current_shift": techShift,
	})
}

func StartRepair(c echo.Context) error {
	user := middleware.GetUser(c)
	if !checkRoleAllowed(user.Role, []string{models.RoleTechnician, models.RoleDispatcher, models.RoleServiceManager}) {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "权限不足"})
	}

	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var curStatus string
	var techID int64
	var techName string
	err := database.DB.QueryRow("SELECT status, assigned_technician_id, assigned_technician FROM repair_quotes WHERE id = ?", id).Scan(&curStatus, &techID, &techName)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "报价单不存在"})
	}

	if curStatus != models.StatusCustomerPaid {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("无法开始维修: 当前状态为「%s」，仅「客户已支付」状态可开始维修", models.StatusDisplayNames[curStatus]),
		})
	}

	if user.Role == models.RoleTechnician && user.ID != techID {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": fmt.Sprintf("权限不足: 该报价单已指派维修师傅为「%s」，仅本人或调度/经理可开始", techName),
		})
	}

	tx, _ := database.DB.Begin()
	defer tx.Rollback()

	tx.Exec("UPDATE repair_quotes SET status = ?, updated_at = ? WHERE id = ?", models.StatusRepairing, time.Now(), id)
	addOperationLog(tx, id, "开始维修", curStatus, models.StatusRepairing, "维修师傅已开始现场维修作业", user)
	tx.Commit()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "维修开始，请注意施工安全",
		"new_status": map[string]interface{}{
			"code": models.StatusRepairing,
			"name": models.StatusDisplayNames[models.StatusRepairing],
		},
	})
}

type ReturnRequest struct {
	Remark string `json:"remark"`
}

func ReturnQuote(c echo.Context) error {
	user := middleware.GetUser(c)
	if !checkRoleAllowed(user.Role, []string{models.RoleTechnician, models.RoleDispatcher, models.RoleServiceManager}) {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "权限不足"})
	}

	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	req := new(ReturnRequest)
	c.Bind(req)

	var curStatus string
	err := database.DB.QueryRow("SELECT status FROM repair_quotes WHERE id = ?", id).Scan(&curStatus)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "报价单不存在"})
	}

	if curStatus != models.StatusRepairing && curStatus != models.StatusConfirmed && curStatus != models.StatusCustomerPaid {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("无法退回: 当前状态为「%s」", models.StatusDisplayNames[curStatus]),
		})
	}

	if req.Remark == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "退回原因必填"})
	}

	tx, _ := database.DB.Begin()
	defer tx.Rollback()

	tx.Exec("UPDATE repair_quotes SET status = ?, updated_at = ? WHERE id = ?", models.StatusReturned, time.Now(), id)
	addOperationLog(tx, id, "补充证据-退回", curStatus, models.StatusReturned, "退回原因: "+req.Remark, user)
	tx.Commit()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "已退回处理，等待客服协调",
		"new_status": map[string]interface{}{
			"code": models.StatusReturned,
			"name": models.StatusDisplayNames[models.StatusReturned],
		},
	})
}

type CompleteRequest struct {
	Remark string `json:"remark"`
}

func CompleteArchive(c echo.Context) error {
	user := middleware.GetUser(c)
	if !checkRoleAllowed(user.Role, []string{models.RoleServiceManager}) {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "权限不足: 仅服务经理可归档完成 (师傅调度不能替服务经理归档)"})
	}

	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	req := new(CompleteRequest)
	c.Bind(req)

	var curStatus string
	err := database.DB.QueryRow("SELECT status FROM repair_quotes WHERE id = ?", id).Scan(&curStatus)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "报价单不存在"})
	}

	if curStatus != models.StatusRepairing {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("无法归档: 当前状态为「%s」，仅「维修中」状态可完成归档 (需先确保维修完成且客户验收)", models.StatusDisplayNames[curStatus]),
		})
	}

	now := time.Now()
	tx, _ := database.DB.Begin()
	defer tx.Rollback()

	tx.Exec("UPDATE repair_quotes SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?", models.StatusCompleted, now, now, id)
	remark := "经理审查归档，客户验收无误"
	if req.Remark != "" {
		remark += "，备注: " + req.Remark
	}
	addOperationLog(tx, id, "服务经理归档完成", curStatus, models.StatusCompleted, remark, user)
	tx.Commit()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "报价单已完成归档",
		"new_status": map[string]interface{}{
			"code": models.StatusCompleted,
			"name": models.StatusDisplayNames[models.StatusCompleted],
		},
	})
}

func CancelQuote(c echo.Context) error {
	user := middleware.GetUser(c)
	if !checkRoleAllowed(user.Role, []string{models.RoleServiceManager}) {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "权限不足: 仅服务经理可取消报价单"})
	}

	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	req := new(ReturnRequest)
	c.Bind(req)

	var curStatus string
	err := database.DB.QueryRow("SELECT status FROM repair_quotes WHERE id = ?", id).Scan(&curStatus)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "报价单不存在"})
	}

	if curStatus == models.StatusCompleted {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "已完成归档的报价单无法取消"})
	}
	if req.Remark == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "取消原因必填"})
	}

	tx, _ := database.DB.Begin()
	defer tx.Rollback()

	tx.Exec("UPDATE repair_quotes SET status = ?, updated_at = ? WHERE id = ?", models.StatusCancelled, time.Now(), id)
	addOperationLog(tx, id, "取消报价单", curStatus, models.StatusCancelled, "取消原因: "+req.Remark, user)
	tx.Commit()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "报价单已取消",
		"new_status": map[string]interface{}{
			"code": models.StatusCancelled,
			"name": models.StatusDisplayNames[models.StatusCancelled],
		},
	})
}

type AddEvidenceRequest struct {
	Operation string `json:"operation"`
	Remark    string `json:"remark"`
}

func AddEvidence(c echo.Context) error {
	user := middleware.GetUser(c)
	if !checkRoleAllowed(user.Role, []string{models.RoleDispatcher, models.RoleServiceManager, models.RoleTechnician}) {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "权限不足"})
	}

	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	req := new(AddEvidenceRequest)
	c.Bind(req)

	var curStatus string
	err := database.DB.QueryRow("SELECT status FROM repair_quotes WHERE id = ?", id).Scan(&curStatus)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "报价单不存在"})
	}
	if req.Remark == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "证据/备注内容必填"})
	}

	tx, _ := database.DB.Begin()
	defer tx.Rollback()

	opName := "补充证据"
	if req.Operation != "" {
		opName = req.Operation
	}
	tx.Exec("UPDATE repair_quotes SET updated_at = ? WHERE id = ?", time.Now(), id)
	addOperationLog(tx, id, opName, curStatus, curStatus, req.Remark, user)
	tx.Commit()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "证据/备注已补充",
	})
}
