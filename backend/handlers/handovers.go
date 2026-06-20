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

type CreateHandoverRequest struct {
	ToUserID       int64  `json:"to_user_id"`
	HandoverRemark string `json:"handover_remark"`
}

func CreateHandover(c echo.Context) error {
	user := middleware.GetUser(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	req := new(CreateHandoverRequest)
	c.Bind(req)

	var curStatus string
	var curHandlerID int64
	var curHandler, curShift string
	err := database.DB.QueryRow(
		"SELECT status, current_handler_id, current_handler, shift FROM repair_quotes WHERE id = ?", id,
	).Scan(&curStatus, &curHandlerID, &curHandler, &curShift)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "报价单不存在"})
	}

	if curStatus == models.StatusCompleted || curStatus == models.StatusCancelled {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "已完成或已取消的报价单无需交接"})
	}

	if curHandlerID != 0 && curHandlerID != user.ID &&
		!(user.Role == models.RoleServiceManager || user.Role == models.RoleDispatcher) {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "只能交接自己正在处理的报价单，或由经理/调度代为交接",
		})
	}

	if req.ToUserID == 0 || req.ToUserID == user.ID {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请选择有效交接对象"})
	}

	var toName, toRole, toShift string
	err = database.DB.QueryRow(
		"SELECT real_name, role, shift FROM users WHERE id = ?", req.ToUserID,
	).Scan(&toName, &toRole, &toShift)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "所选接收人员不存在"})
	}

	fromHandlerID := curHandlerID
	fromHandler := curHandler
	fromShift := curShift
	if fromHandlerID == 0 {
		fromHandlerID = user.ID
		fromHandler = user.RealName
		fromShift = getUserShift(user.ID)
	}
	var fromRole string
	database.DB.QueryRow("SELECT role FROM users WHERE id = ?", fromHandlerID).Scan(&fromRole)

	if req.HandoverRemark == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "交接备注必填，说明当前处理进度和待办事项"})
	}

	tx, _ := database.DB.Begin()
	defer tx.Rollback()

	_, err = tx.Exec(`INSERT INTO shift_handovers
		(quote_id, from_user_id, from_user_name, from_user_role, from_shift,
		 to_user_id, to_user_name, to_user_role, to_shift, handover_remark, status, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
		id,
		fromHandlerID, fromHandler, fromRole, fromShift,
		req.ToUserID, toName, toRole, toShift,
		req.HandoverRemark, time.Now(),
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "创建交接记录失败: " + err.Error()})
	}

	tx.Exec(`UPDATE repair_quotes SET handover_count = handover_count + 1, updated_at = ? WHERE id = ?`, time.Now(), id)

	addOperationLog(tx, id, "发起换班交接", curStatus, curStatus,
		"交出: "+fromHandler+"("+models.RoleDisplayNames[fromRole]+")"+models.ShiftDisplayNames[fromShift]+" → "+
			"接收: "+toName+"("+models.RoleDisplayNames[toRole]+")"+models.ShiftDisplayNames[toShift]+"，备注: "+req.HandoverRemark,
		user)

	tx.Commit()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "交接已发起，等待接收方确认",
		"handover": map[string]interface{}{
			"from_user_name":  fromHandler,
			"from_user_role":  models.RoleDisplayNames[fromRole],
			"from_shift":      models.ShiftDisplayNames[fromShift],
			"to_user_name":    toName,
			"to_user_role":    models.RoleDisplayNames[toRole],
			"to_shift":        models.ShiftDisplayNames[toShift],
			"handover_remark": req.HandoverRemark,
		},
	})
}

type ConfirmHandoverRequest struct {
	Remark string `json:"remark"`
	Action string `json:"action"`
}

func ConfirmHandover(c echo.Context) error {
	user := middleware.GetUser(c)
	handoverID, _ := strconv.ParseInt(c.Param("handover_id"), 10, 64)
	req := new(ConfirmHandoverRequest)
	c.Bind(req)

	var hid int64
	var quoteID int64
	var status string
	var toUserID int64
	var toUserName, toUserRole, toShift string
	var fromUserName, fromUserRole, fromShift, remark string
	err := database.DB.QueryRow(`SELECT h.id, h.quote_id, h.status, h.to_user_id, h.to_user_name, h.to_user_role, h.to_shift,
		h.from_user_name, h.from_user_role, h.from_shift, h.handover_remark
		FROM shift_handovers h WHERE h.id = ?`, handoverID).Scan(
		&hid, &quoteID, &status, &toUserID, &toUserName, &toUserRole, &toShift,
		&fromUserName, &fromUserRole, &fromShift, &remark)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "交接记录不存在"})
	}

	if toUserID != user.ID && user.Role != models.RoleServiceManager {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "仅交接接收人或服务经理可确认交接"})
	}
	if status != "pending" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "该交接记录已处理，无法重复确认"})
	}

	action := "confirm"
	if req.Action == "reject" {
		action = "reject"
	}

	var curStatus string
	database.DB.QueryRow("SELECT status FROM repair_quotes WHERE id = ?", quoteID).Scan(&curStatus)

	tx, _ := database.DB.Begin()
	defer tx.Rollback()

	now := time.Now()
	if action == "confirm" {
		currentToShift := getUserShift(toUserID)
		tx.Exec(`UPDATE shift_handovers SET status = 'confirmed', confirmed_at = ? WHERE id = ?`, now, handoverID)
		tx.Exec(`UPDATE repair_quotes
			SET current_handler_id = ?, current_handler = ?, shift = ?, updated_at = ?
			WHERE id = ?`, toUserID, toUserName, currentToShift, now, quoteID)

		opRemark := "接收方确认交接: " + toUserName + "(" + models.RoleDisplayNames[toUserRole] + ")" + models.ShiftDisplayNames[toShift]
		if req.Remark != "" {
			opRemark += "，确认备注: " + req.Remark
		}
		addOperationLog(tx, quoteID, "换班交接确认", curStatus, curStatus, opRemark, user)
	} else {
		tx.Exec(`UPDATE shift_handovers SET status = 'rejected', confirmed_at = ? WHERE id = ?`, now, handoverID)
		opRemark := "接收方拒绝交接: " + toUserName
		if req.Remark != "" {
			opRemark += "，拒绝原因: " + req.Remark
		}
		addOperationLog(tx, quoteID, "换班交接被拒绝", curStatus, curStatus, opRemark, user)
	}

	tx.Commit()

	if action == "confirm" {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"message": "交接已确认，处理人已更新为 " + toUserName,
			"new_handler": map[string]interface{}{
				"id":            toUserID,
				"name":          toUserName,
				"role":          toUserRole,
				"role_display":  models.RoleDisplayNames[toUserRole],
				"shift":         toShift,
				"shift_display": models.ShiftDisplayNames[toShift],
			},
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "已拒绝交接，请与交出人协调",
	})
}

func GetMyHandovers(c echo.Context) error {
	user := middleware.GetUser(c)
	status := c.QueryParam("status")

	query := `SELECT h.id, h.quote_id, h.from_user_id, h.from_user_name, h.from_user_role, h.from_shift,
		h.to_user_id, h.to_user_name, h.to_user_role, h.to_shift, h.handover_remark,
		h.confirmed_at, h.status, h.created_at,
		q.quote_no, q.customer_name, q.device_type, q.status as quote_status
		FROM shift_handovers h LEFT JOIN repair_quotes q ON h.quote_id = q.id
		WHERE (h.from_user_id = ? OR h.to_user_id = ?)`
	args := []interface{}{user.ID, user.ID}

	if status != "" && status != "all" {
		query += " AND h.status = ?"
		args = append(args, status)
	}
	query += " ORDER BY h.id DESC LIMIT 100"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "查询交接记录失败"})
	}
	defer rows.Close()

	list := make([]map[string]interface{}, 0)
	for rows.Next() {
		var h models.ShiftHandover
		var quoteNo, customerName, deviceType, quoteStatus string
		var cAt sql.NullTime
		rows.Scan(&h.ID, &h.QuoteID, &h.FromUserID, &h.FromUserName, &h.FromUserRole, &h.FromShift,
			&h.ToUserID, &h.ToUserName, &h.ToUserRole, &h.ToShift, &h.HandoverRemark,
			&cAt, &h.Status, &h.CreatedAt,
			&quoteNo, &customerName, &deviceType, &quoteStatus)
		if cAt.Valid {
			h.ConfirmedAt = &cAt.Time
		}
		isMine := h.ToUserID == user.ID
		fromRole, _ := models.RoleDisplayNames[h.FromUserRole]
		toRole, _ := models.RoleDisplayNames[h.ToUserRole]
		fromShift, _ := models.ShiftDisplayNames[h.FromShift]
		toShift, _ := models.ShiftDisplayNames[h.ToShift]
		qSt, _ := models.StatusDisplayNames[quoteStatus]

		list = append(list, map[string]interface{}{
			"id":                h.ID,
			"quote_id":          h.QuoteID,
			"quote_no":          quoteNo,
			"customer_name":     customerName,
			"device_type":       deviceType,
			"quote_status":      quoteStatus,
			"quote_status_name": qSt,
			"is_incoming":       isMine,
			"from": map[string]interface{}{
				"user_name": h.FromUserName,
				"role":      fromRole,
				"shift":     fromShift,
			},
			"to": map[string]interface{}{
				"user_name": h.ToUserName,
				"role":      toRole,
				"shift":     toShift,
			},
			"handover_remark": h.HandoverRemark,
			"status":          h.Status,
			"status_name":     map[string]string{"pending": "待确认", "confirmed": "已接收", "rejected": "已拒绝"}[h.Status],
			"confirmed_at":    h.ConfirmedAt,
			"created_at":      h.CreatedAt,
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"handovers": list})
}

type BatchConfirmRequest struct {
	Items []struct {
		HandoverID int64  `json:"handover_id"`
		Action     string `json:"action"`
		Remark     string `json:"remark"`
	} `json:"items"`
}

type BatchResultItem struct {
	HandoverID int64  `json:"handover_id"`
	QuoteID    int64  `json:"quote_id,omitempty"`
	QuoteNo    string `json:"quote_no,omitempty"`
	Success    bool   `json:"success"`
	Action     string `json:"action"`
	Message    string `json:"message"`
	NewHandler string `json:"new_handler,omitempty"`
	NewShift   string `json:"new_shift,omitempty"`
}

func BatchConfirmHandover(c echo.Context) error {
	user := middleware.GetUser(c)
	req := new(BatchConfirmRequest)
	if err := c.Bind(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "请求参数格式错误"})
	}
	if len(req.Items) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "批量处理列表不能为空"})
	}
	if len(req.Items) > 50 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "一次最多批量处理50条"})
	}

	results := make([]BatchResultItem, 0, len(req.Items))
	successCount := 0
	failCount := 0

	for _, item := range req.Items {
		result := BatchResultItem{
			HandoverID: item.HandoverID,
			Action:     item.Action,
		}

		action := "confirm"
		if item.Action == "reject" {
			action = "reject"
		}

		var hid, quoteID, toUserID int64
		var status, toUserName, toUserRole, toUserNameDb, toRoleDb, toShift string
		err := database.DB.QueryRow(`SELECT h.id, h.quote_id, h.status, h.to_user_id, h.to_user_name, h.to_user_role
			FROM shift_handovers h WHERE h.id = ?`, item.HandoverID).Scan(
			&hid, &quoteID, &status, &toUserID, &toUserName, &toUserRole)
		if err == sql.ErrNoRows {
			result.Success = false
			result.Message = "交接记录不存在"
			results = append(results, result)
			failCount++
			continue
		}
		if err != nil {
			result.Success = false
			result.Message = "查询交接记录失败: " + err.Error()
			results = append(results, result)
			failCount++
			continue
		}

		result.QuoteID = quoteID
		var quoteNo string
		database.DB.QueryRow("SELECT quote_no FROM repair_quotes WHERE id = ?", quoteID).Scan(&quoteNo)
		result.QuoteNo = quoteNo

		if toUserID != user.ID && user.Role != models.RoleServiceManager {
			result.Success = false
			result.Message = "权限不足：仅交接接收人或服务经理可确认"
			results = append(results, result)
			failCount++
			continue
		}
		if status != "pending" {
			result.Success = false
			result.Message = "该交接已处理过，状态为：" + map[string]string{
				"pending":   "待确认",
				"confirmed": "已接收",
				"rejected":  "已拒绝",
			}[status]
			results = append(results, result)
			failCount++
			continue
		}
		if action == "reject" && item.Remark == "" {
			result.Success = false
			result.Message = "拒绝原因必填"
			results = append(results, result)
			failCount++
			continue
		}

		database.DB.QueryRow("SELECT real_name, role, shift FROM users WHERE id = ?", toUserID).Scan(&toUserNameDb, &toRoleDb, &toShift)

		var curStatus string
		database.DB.QueryRow("SELECT status FROM repair_quotes WHERE id = ?", quoteID).Scan(&curStatus)

		tx, err := database.DB.Begin()
		if err != nil {
			result.Success = false
			result.Message = "启动事务失败"
			results = append(results, result)
			failCount++
			continue
		}

		now := time.Now()
		if action == "confirm" {
			currentToShift := getUserShift(toUserID)
			_, err = tx.Exec(`UPDATE shift_handovers SET status = 'confirmed', confirmed_at = ? WHERE id = ?`, now, hid)
			if err == nil {
				_, err = tx.Exec(`UPDATE repair_quotes
					SET current_handler_id = ?, current_handler = ?, shift = ?, updated_at = ?
					WHERE id = ?`, toUserID, toUserNameDb, currentToShift, now, quoteID)
			}
			if err == nil {
				opRemark := "批量交接确认: " + toUserNameDb + "(" + models.RoleDisplayNames[toRoleDb] + ")" + models.ShiftDisplayNames[currentToShift]
				if item.Remark != "" {
					opRemark += "，备注: " + item.Remark
				}
				err = addOperationLog(tx, quoteID, "批量交接确认", curStatus, curStatus, opRemark, user)
			}
			if err == nil {
				result.Success = true
				result.Message = "交接已确认"
				result.NewHandler = toUserNameDb
				result.NewShift = models.ShiftDisplayNames[currentToShift]
			} else {
				tx.Rollback()
				result.Success = false
				result.Message = "处理失败: " + err.Error()
			}
		} else {
			_, err = tx.Exec(`UPDATE shift_handovers SET status = 'rejected', confirmed_at = ? WHERE id = ?`, now, hid)
			if err == nil {
				opRemark := "批量拒绝交接: " + toUserNameDb
				if item.Remark != "" {
					opRemark += "，原因: " + item.Remark
				}
				err = addOperationLog(tx, quoteID, "批量交接被拒绝", curStatus, curStatus, opRemark, user)
			}
			if err == nil {
				result.Success = true
				result.Message = "已拒绝交接"
			} else {
				tx.Rollback()
				result.Success = false
				result.Message = "处理失败: " + err.Error()
			}
		}

		if result.Success {
			if err := tx.Commit(); err != nil {
				result.Success = false
				result.Message = "提交事务失败: " + err.Error()
			}
		}

		if result.Success {
			successCount++
		} else {
			failCount++
		}
		results = append(results, result)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message":       fmt.Sprintf("批量处理完成：成功 %d 条，失败 %d 条", successCount, failCount),
		"total":         len(req.Items),
		"success_count": successCount,
		"fail_count":    failCount,
		"results":       results,
	})
}
