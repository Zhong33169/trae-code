package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/internal/database"
	"backend/internal/middleware"
	"backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CreateApplicationRequest struct {
	TenantName     string  `json:"tenantName" binding:"required"`
	TenantIDCard   string  `json:"tenantIdCard" binding:"required"`
	TenantPhone    string  `json:"tenantPhone" binding:"required"`
	ApartmentName  string  `json:"apartmentName" binding:"required"`
	RoomNo         string  `json:"roomNo" binding:"required"`
	RoomArea       float64 `json:"roomArea"`
	MonthlyRent    float64 `json:"monthlyRent" binding:"required"`
	LeaseStartDate string  `json:"leaseStartDate" binding:"required"`
	LeaseEndDate   string  `json:"leaseEndDate" binding:"required"`
	DepositAmount  float64 `json:"depositAmount"`
	PaymentMethod  string  `json:"paymentMethod"`
	Remark         string  `json:"remark"`
}

type SubmitReviewRequest struct {
	Remark         string `json:"remark"`
	OverdueReason  string `json:"overdueReason"`
	FollowUpAction string `json:"followUpAction"`
}

type ReviewRequest struct {
	Action         string `json:"action" binding:"required,oneof=approve return reject"`
	ReviewResult   string `json:"reviewResult"`
	ReturnReason   string `json:"returnReason"`
	RejectReason   string `json:"rejectReason"`
	OverdueReason  string `json:"overdueReason"`
	FollowUpAction string `json:"followUpAction"`
}

type RoomConfirmRequest struct {
	Action         string `json:"action" binding:"required,oneof=confirm problem"`
	ConfirmResult  string `json:"confirmResult" binding:"required"`
	OverdueReason  string `json:"overdueReason"`
	FollowUpAction string `json:"followUpAction"`
}

type HandoverRequest struct {
	Action         string `json:"action" binding:"required,oneof=complete problem"`
	HandoverResult string `json:"handoverResult" binding:"required"`
	OverdueReason  string `json:"overdueReason"`
	FollowUpAction string `json:"followUpAction"`
}

type ArchiveRequest struct {
	Action         string `json:"action" binding:"required,oneof=archive"`
	Remark         string `json:"remark"`
	OverdueReason  string `json:"overdueReason"`
	FollowUpAction string `json:"followUpAction"`
}

type OverdueRecordRequest struct {
	OverdueReason  string `json:"overdueReason" binding:"required"`
	FollowUpAction string `json:"followUpAction" binding:"required"`
	NodeType       string `json:"nodeType"`
}

func generateApplicationNo() string {
	now := time.Now()
	prefix := fmt.Sprintf("ZY%s", now.Format("20060102"))
	random := strings.ToUpper(strings.ReplaceAll(uuid.New().String()[:8], "-", ""))
	return fmt.Sprintf("%s-%s", prefix, random)
}

func checkApplicationOwnership(app *models.LeaseApplication, userID uint, role models.Role) bool {
	switch role {
	case models.RoleRegistrar:
		return app.CreatedBy == userID
	case models.RoleAuditor:
		return true
	case models.RoleReviewer:
		return true
	default:
		return false
	}
}

func checkNodeOverdueBeforeProceed(
	c *gin.Context,
	app *models.LeaseApplication,
	nodeType models.NodeType,
	userID uint,
	realName string,
	role models.Role,
	reqOverdueReason string,
	reqFollowUpAction string,
	actionName string,
	targetStatus models.ApplicationStatus,
) (bool, string) {
	var timeline models.NodeTimeline
	result := database.DB.Where("application_id = ? AND node_type = ?", app.ID, nodeType).First(&timeline)
	if result.Error != nil {
		return true, ""
	}

	if !timeline.IsOverdue && !app.IsOverdue {
		return true, ""
	}

	hasExisting := (timeline.OverdueReason != "" && timeline.FollowUpAction != "") ||
		(app.OverdueReason != "" && app.FollowUpAction != "")

	hasReqFields := reqOverdueReason != "" && reqFollowUpAction != ""

	if !hasExisting && !hasReqFields {
		blockedReason := fmt.Sprintf(
			"当前节点【%s】已超时，必须先记录【超时原因】和【后续处理措施】才能推进%s。可通过详情页【⏰ 记录超时处理】按钮补录，或在本次请求中同步提交。",
			models.GetNodeName(nodeType), actionName,
		)

		database.CreateOperationLog(
			app.ID, userID, realName, string(role),
			"overdue_blocked", "超时拦截",
			string(app.Status), string(app.Status),
			fmt.Sprintf("尝试推进%s被拦截：%s", actionName, blockedReason),
		)

		database.DB.Model(&models.NodeTimeline{}).
			Where("application_id = ? AND node_type = ?", app.ID, nodeType).
			UpdateColumn("remark", gorm.Expr(
				"COALESCE(remark, '') || ?",
				fmt.Sprintf("\n🚫 [超时拦截 %s] 操作人:%s 角色:%s 动作:%s 原因:%s",
					time.Now().Format("2006-01-02 15:04:05"),
					realName, role, actionName, blockedReason,
				),
			))

		database.CreateOverdueAudit(
			app, &timeline, nodeType,
			models.AuditTypeBlocked,
			blockedReason,
			"", "",
			userID, realName, string(role),
			actionName,
			string(app.Status),
		)

		return false, blockedReason
	}

	if hasReqFields && !hasExisting {
		database.SetNodeOverdueRecord(app.ID, nodeType, reqOverdueReason, reqFollowUpAction)
		database.DB.Model(&models.LeaseApplication{}).Where("id = ?", app.ID).Updates(map[string]interface{}{
			"overdue_reason":   reqOverdueReason,
			"follow_up_action": reqFollowUpAction,
		})
		database.CreateOperationLog(
			app.ID, userID, realName, string(role),
			"overdue_record_sync", "超时记录(推进时补录)",
			string(app.Status), string(targetStatus),
			fmt.Sprintf("推进%s前补录超时记录：原因=%s，后续措施=%s", actionName, reqOverdueReason, reqFollowUpAction),
		)
		database.CreateOverdueAudit(
			app, &timeline, nodeType,
			models.AuditTypeSupplemented,
			"",
			reqOverdueReason, reqFollowUpAction,
			userID, realName, string(role),
			actionName,
			string(targetStatus),
		)
	}

	return true, ""
}

func GetApplicationList(c *gin.Context) {
	userID, _, _, role := middleware.GetCurrentUser(c)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	status := c.Query("status")
	keyword := c.Query("keyword")
	isOverdue := c.Query("isOverdue")
	currentNode := c.Query("currentNode")
	hasOverdueBlocked := c.Query("hasOverdueBlocked")

	query := database.DB.Model(&models.LeaseApplication{})

	switch role {
	case models.RoleRegistrar:
		query = query.Where("created_by = ?", userID)
	}

	if hasOverdueBlocked == "true" || hasOverdueBlocked == "false" {
		subQuery := database.DB.Table("overdue_audits").
			Select("DISTINCT application_id").
			Where("audit_type = ?", string(models.AuditTypeBlocked))
		if hasOverdueBlocked == "true" {
			query = query.Where("id IN (?)", subQuery)
		} else {
			query = query.Where("id NOT IN (?)", subQuery)
		}
	}

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if isOverdue != "" {
		query = query.Where("is_overdue = ?", isOverdue == "true")
	}
	if currentNode != "" {
		query = query.Where("current_node = ?", currentNode)
	}
	if keyword != "" {
		query = query.Where("application_no LIKE ? OR tenant_name LIKE ? OR room_no LIKE ?",
			"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	var total int64
	query.Count(&total)

	var applications []models.LeaseApplication
	offset := (page - 1) * pageSize
	query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&applications)

	for i := range applications {
		applications[i].NodeTimelines = nil
		applications[i].Attachments = nil
		applications[i].OperationLogs = nil
	}

	appIDs := make([]uint, 0, len(applications))
	for _, app := range applications {
		appIDs = append(appIDs, app.ID)
	}

	type auditCount struct {
		ApplicationID uint  `gorm:"column:application_id"`
		Blocked       int64 `gorm:"column:blocked"`
		Supplemented  int64 `gorm:"column:supplemented"`
	}
	var auditCounts []auditCount
	if len(appIDs) > 0 {
		database.DB.Table("overdue_audits").
			Select("application_id, " +
				"SUM(CASE WHEN audit_type = ? THEN 1 ELSE 0 END) as blocked, "+
				"SUM(CASE WHEN audit_type = ? THEN 1 ELSE 0 END) as supplemented",
				string(models.AuditTypeBlocked), string(models.AuditTypeSupplemented)).
			Where("application_id IN (?)", appIDs).
			Group("application_id").
			Scan(&auditCounts)
	}
	auditMap := make(map[uint]auditCount)
	for _, ac := range auditCounts {
		auditMap[ac.ApplicationID] = ac
	}

	items := make([]map[string]interface{}, 0)
	for _, app := range applications {
		ac := auditMap[app.ID]
		item := map[string]interface{}{
			"id":                       app.ID,
			"applicationNo":            app.ApplicationNo,
			"tenantName":               app.TenantName,
			"tenantPhone":              app.TenantPhone,
			"apartmentName":            app.ApartmentName,
			"roomNo":                   app.RoomNo,
			"monthlyRent":              app.MonthlyRent,
			"leaseStartDate":           app.LeaseStartDate,
			"leaseEndDate":             app.LeaseEndDate,
			"status":                   app.Status,
			"statusName":               models.GetStatusName(app.Status),
			"currentNode":              app.CurrentNode,
			"currentNodeName":          models.GetNodeName(app.CurrentNode),
			"isOverdue":                app.IsOverdue,
			"overdueReason":            app.OverdueReason,
			"followUpAction":           app.FollowUpAction,
			"hasOverdueBlocked":        ac.Blocked > 0,
			"overdueBlockedCount":      ac.Blocked,
			"overdueSupplementedCount": ac.Supplemented,
			"createdByName":            app.CreatedByName,
			"createdBy":                app.CreatedBy,
			"createdAt":                app.CreatedAt,
			"updatedAt":                app.UpdatedAt,
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"message": "获取列表成功",
		"data": gin.H{
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
			"items":    items,
		},
	})
}

func GetApplicationDetail(c *gin.Context) {
	userID, _, _, role := middleware.GetCurrentUser(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "申请ID格式错误"})
		return
	}

	var app models.LeaseApplication
	result := database.DB.Preload("Attachments").Preload("NodeTimelines").Preload("OperationLogs").First(&app, uint(id))
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "租约申请不存在"})
		return
	}

	if !checkApplicationOwnership(&app, userID, role) {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "您没有权限查看此申请"})
		return
	}

	database.DB.Order("created_at DESC").Where("application_id = ?", app.ID).Find(&app.OperationLogs)
	database.DB.Order("id ASC").Where("application_id = ?", app.ID).Find(&app.NodeTimelines)
	database.DB.Order("created_at DESC").Where("application_id = ?", app.ID).Find(&app.Attachments)

	var overdueAudits []models.OverdueAudit
	database.DB.Order("created_at DESC").Where("application_id = ?", app.ID).Find(&overdueAudits)

	var hasOverdueBlocked bool
	var overdueBlockedCount int64
	var overdueSupplementedCount int64
	database.DB.Model(&models.OverdueAudit{}).Where("application_id = ? AND audit_type = ?", app.ID, models.AuditTypeBlocked).Count(&overdueBlockedCount)
	database.DB.Model(&models.OverdueAudit{}).Where("application_id = ? AND audit_type = ?", app.ID, models.AuditTypeSupplemented).Count(&overdueSupplementedCount)
	if overdueBlockedCount > 0 {
		hasOverdueBlocked = true
	}

	response := map[string]interface{}{
		"id":                    app.ID,
		"applicationNo":         app.ApplicationNo,
		"tenantName":            app.TenantName,
		"tenantIdCard":          app.TenantIDCard,
		"tenantPhone":           app.TenantPhone,
		"apartmentName":         app.ApartmentName,
		"roomNo":                app.RoomNo,
		"roomArea":              app.RoomArea,
		"monthlyRent":           app.MonthlyRent,
		"leaseStartDate":        app.LeaseStartDate,
		"leaseEndDate":          app.LeaseEndDate,
		"depositAmount":         app.DepositAmount,
		"paymentMethod":         app.PaymentMethod,
		"status":                app.Status,
		"statusName":            models.GetStatusName(app.Status),
		"currentNode":           app.CurrentNode,
		"currentNodeName":       models.GetNodeName(app.CurrentNode),
		"isOverdue":             app.IsOverdue,
		"overdueReason":         app.OverdueReason,
		"followUpAction":        app.FollowUpAction,
		"hasOverdueBlocked":     hasOverdueBlocked,
		"overdueBlockedCount":   overdueBlockedCount,
		"overdueSupplementedCount": overdueSupplementedCount,
		"overdueAudits":         overdueAudits,
		"remark":                app.Remark,
		"returnReason":          app.ReturnReason,
		"rejectReason":          app.RejectReason,
		"reviewResult":          app.ReviewResult,
		"confirmResult":         app.ConfirmResult,
		"handoverResult":        app.HandoverResult,
		"createdBy":             app.CreatedBy,
		"createdByName":         app.CreatedByName,
		"reviewedBy":            app.ReviewedBy,
		"reviewedByName":        app.ReviewedByName,
		"confirmedBy":           app.ConfirmedBy,
		"confirmedByName":       app.ConfirmedByName,
		"handedOverBy":          app.HandedOverBy,
		"handedOverByName":      app.HandedOverByName,
		"archivedBy":            app.ArchivedBy,
		"archivedByName":        app.ArchivedByName,
		"createdAt":             app.CreatedAt,
		"updatedAt":             app.UpdatedAt,
		"submittedAt":           app.SubmittedAt,
		"reviewedAt":            app.ReviewedAt,
		"confirmedAt":           app.ConfirmedAt,
		"handedOverAt":          app.HandedOverAt,
		"completedAt":           app.CompletedAt,
		"attachments":           app.Attachments,
		"nodeTimelines":         app.NodeTimelines,
		"operationLogs":         app.OperationLogs,
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取详情成功",
		"data":    response,
	})
}

func CreateApplication(c *gin.Context) {
	userID, _, realName, role := middleware.GetCurrentUser(c)
	if role != models.RoleRegistrar {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "只有租约登记员可以创建租约申请"})
		return
	}

	var req CreateApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误：" + err.Error()})
		return
	}

	app := models.LeaseApplication{
		ApplicationNo:   generateApplicationNo(),
		TenantName:      req.TenantName,
		TenantIDCard:    req.TenantIDCard,
		TenantPhone:     req.TenantPhone,
		ApartmentName:   req.ApartmentName,
		RoomNo:          req.RoomNo,
		RoomArea:        req.RoomArea,
		MonthlyRent:     req.MonthlyRent,
		LeaseStartDate:  req.LeaseStartDate,
		LeaseEndDate:    req.LeaseEndDate,
		DepositAmount:   req.DepositAmount,
		PaymentMethod:   req.PaymentMethod,
		Status:          models.StatusDraft,
		CurrentNode:     models.NodeContractSigning,
		IsOverdue:       false,
		Remark:          req.Remark,
		CreatedBy:       userID,
		CreatedByName:   realName,
	}

	result := database.DB.Create(&app)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "创建租约申请失败：" + result.Error.Error()})
		return
	}

	now := time.Now()
	for _, nodeLimit := range models.NodeTimeLimits {
		startTime := now
		dueTime := startTime.Add(time.Duration(nodeLimit.TimeLimitHours) * time.Hour)
		status := "pending"
		if nodeLimit.NodeType == app.CurrentNode {
			status = "processing"
		}
		database.DB.Create(&models.NodeTimeline{
			ApplicationID:  app.ID,
			NodeType:       nodeLimit.NodeType,
			NodeName:       nodeLimit.NodeName,
			StartTime:      startTime,
			DueTime:        &dueTime,
			TimeLimitHours: nodeLimit.TimeLimitHours,
			Status:         status,
		})
	}

	database.CreateOperationLog(app.ID, userID, realName, string(role), "create", "创建租约申请", "", string(models.StatusDraft),
		fmt.Sprintf("创建租约申请，申请编号：%s，租客：%s", app.ApplicationNo, app.TenantName))

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "租约申请创建成功",
		"data":    gin.H{"id": app.ID, "applicationNo": app.ApplicationNo, "status": app.Status},
	})
}

func UpdateApplication(c *gin.Context) {
	userID, _, realName, role := middleware.GetCurrentUser(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "申请ID格式错误"})
		return
	}

	var app models.LeaseApplication
	result := database.DB.First(&app, uint(id))
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "租约申请不存在"})
		return
	}

	if app.Status != models.StatusDraft && app.Status != models.StatusReturned {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "当前状态不允许修改，只有草稿和已退回状态可编辑"})
		return
	}

	if !checkApplicationOwnership(&app, userID, role) {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "您没有权限修改此申请"})
		return
	}

	var req CreateApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误"})
		return
	}

	oldStatus := app.Status
	updates := map[string]interface{}{
		"tenant_name":     req.TenantName,
		"tenant_id_card":  req.TenantIDCard,
		"tenant_phone":    req.TenantPhone,
		"apartment_name":  req.ApartmentName,
		"room_no":         req.RoomNo,
		"room_area":       req.RoomArea,
		"monthly_rent":    req.MonthlyRent,
		"lease_start_date": req.LeaseStartDate,
		"lease_end_date":  req.LeaseEndDate,
		"deposit_amount":  req.DepositAmount,
		"payment_method":  req.PaymentMethod,
		"remark":          req.Remark,
	}
	if app.Status == models.StatusReturned {
		updates["return_reason"] = ""
		updates["status"] = models.StatusDraft
	}

	database.DB.Model(&app).Updates(updates)

	newStatus := app.Status
	if app.Status == models.StatusReturned {
		newStatus = models.StatusDraft
	}

	database.CreateOperationLog(app.ID, userID, realName, string(role), "update", "修改租约申请", string(oldStatus), string(newStatus),
		fmt.Sprintf("修改租约申请信息，申请编号：%s", app.ApplicationNo))

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "租约申请修改成功",
		"data":    gin.H{"id": app.ID},
	})
}

func SubmitForReview(c *gin.Context) {
	userID, _, realName, role := middleware.GetCurrentUser(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "申请ID格式错误"})
		return
	}

	var app models.LeaseApplication
	result := database.DB.First(&app, uint(id))
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "租约申请不存在"})
		return
	}

	if !checkApplicationOwnership(&app, userID, role) {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "您没有权限提交此申请"})
		return
	}

	if app.Status != models.StatusDraft && app.Status != models.StatusReturned {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": fmt.Sprintf("当前状态为【%s】，只有草稿或已退回状态可以提交审核", models.GetStatusName(app.Status)),
		})
		return
	}

	var req SubmitReviewRequest
	c.ShouldBindJSON(&req)

	if allowed, errMsg := checkNodeOverdueBeforeProceed(c, &app, models.NodeContractSigning, userID, realName, role, req.OverdueReason, req.FollowUpAction, "至审核环节", models.StatusPendingReview); !allowed {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": errMsg})
		return
	}

	now := time.Now()
	oldStatus := app.Status

	database.DB.Model(&app).Updates(map[string]interface{}{
		"status":       models.StatusPendingReview,
		"current_node": models.NodeReview,
		"submitted_at": now,
		"remark":       req.Remark,
		"return_reason": "",
	})

	database.UpdateNodeTimeline(app.ID, models.NodeContractSigning, "completed", userID, realName, &now)
	database.UpdateNodeTimeline(app.ID, models.NodeReview, "processing", 0, "", nil)

	database.CreateOperationLog(app.ID, userID, realName, string(role), "submit", "提交审核", string(oldStatus), string(models.StatusPendingReview),
		fmt.Sprintf("提交租约申请至审核环节，备注：%s", req.Remark))

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "提交审核成功，等待租约审核主管处理",
		"data":    gin.H{"id": app.ID, "status": models.StatusPendingReview, "statusName": models.GetStatusName(models.StatusPendingReview)},
	})
}

func ReviewApplication(c *gin.Context) {
	userID, _, realName, role := middleware.GetCurrentUser(c)
	if role != models.RoleAuditor {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "只有租约审核主管可以执行审核操作"})
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "申请ID格式错误"})
		return
	}

	var app models.LeaseApplication
	result := database.DB.First(&app, uint(id))
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "租约申请不存在"})
		return
	}

	if app.Status != models.StatusPendingReview {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": fmt.Sprintf("当前状态为【%s】，只有待审核状态可以执行审核操作", models.GetStatusName(app.Status)),
		})
		return
	}

	var req ReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误：action 必须为 approve/return/reject"})
		return
	}

	var targetStatus models.ApplicationStatus
	switch req.Action {
	case "approve":
		targetStatus = models.StatusPendingConfirm
	case "return", "reject":
		targetStatus = models.StatusReturned
	}

	if allowed, errMsg := checkNodeOverdueBeforeProceed(c, &app, models.NodeReview, userID, realName, role, req.OverdueReason, req.FollowUpAction, "审核操作", targetStatus); !allowed {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": errMsg})
		return
	}

	now := time.Now()
	oldStatus := app.Status

	switch req.Action {
	case "approve":
		database.DB.Model(&app).Updates(map[string]interface{}{
			"status":          models.StatusReviewed,
			"current_node":    models.NodeRoomConfirm,
			"review_result":   req.ReviewResult,
			"reviewed_by":     userID,
			"reviewed_by_name": realName,
			"reviewed_at":     now,
		})

		database.DB.Model(&models.LeaseApplication{}).Where("id = ?", app.ID).Update("status", models.StatusPendingConfirm)

		database.UpdateNodeTimeline(app.ID, models.NodeReview, "completed", userID, realName, &now)
		database.UpdateNodeTimeline(app.ID, models.NodeRoomConfirm, "processing", 0, "", nil)

		database.CreateOperationLog(app.ID, userID, realName, string(role), "review_approve", "审核通过", string(oldStatus), string(models.StatusPendingConfirm),
			fmt.Sprintf("租约审核通过，审核意见：%s", req.ReviewResult))

		c.JSON(http.StatusOK, gin.H{
			"code":    200,
			"message": "审核通过，已流转至房态确认环节",
			"data":    gin.H{"id": app.ID, "status": models.StatusPendingConfirm, "statusName": models.GetStatusName(models.StatusPendingConfirm)},
		})

	case "return":
		if req.ReturnReason == "" {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "退回操作必须填写退回原因"})
			return
		}
		database.DB.Model(&app).Updates(map[string]interface{}{
			"status":          models.StatusReturned,
			"current_node":    models.NodeContractSigning,
			"return_reason":   req.ReturnReason,
			"reviewed_by":     userID,
			"reviewed_by_name": realName,
			"reviewed_at":     now,
		})

		database.UpdateNodeTimeline(app.ID, models.NodeReview, "returned", userID, realName, &now)
		database.UpdateNodeTimeline(app.ID, models.NodeContractSigning, "processing", 0, "", nil)

		database.CreateOperationLog(app.ID, userID, realName, string(role), "review_return", "审核退回", string(oldStatus), string(models.StatusReturned),
			fmt.Sprintf("租约审核退回，退回原因：%s", req.ReturnReason))

		c.JSON(http.StatusOK, gin.H{
			"code":    200,
			"message": "已退回租约登记员补正材料",
			"data":    gin.H{"id": app.ID, "status": models.StatusReturned, "statusName": models.GetStatusName(models.StatusReturned)},
		})

	case "reject":
		if req.RejectReason == "" {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "拒绝操作必须填写拒绝原因"})
			return
		}
		database.DB.Model(&app).Updates(map[string]interface{}{
			"status":          models.StatusRejected,
			"reject_reason":   req.RejectReason,
			"reviewed_by":     userID,
			"reviewed_by_name": realName,
			"reviewed_at":     now,
			"completed_at":    now,
		})

		database.UpdateNodeTimeline(app.ID, models.NodeReview, "rejected", userID, realName, &now)

		database.CreateOperationLog(app.ID, userID, realName, string(role), "review_reject", "审核拒绝", string(oldStatus), string(models.StatusRejected),
			fmt.Sprintf("租约审核拒绝，拒绝原因：%s", req.RejectReason))

		c.JSON(http.StatusOK, gin.H{
			"code":    200,
			"message": "租约申请已拒绝，流程终止",
			"data":    gin.H{"id": app.ID, "status": models.StatusRejected, "statusName": models.GetStatusName(models.StatusRejected)},
		})
	}
}

func ConfirmRoomStatus(c *gin.Context) {
	userID, _, realName, role := middleware.GetCurrentUser(c)
	if role != models.RoleAuditor {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "只有租约审核主管可以执行房态确认操作"})
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "申请ID格式错误"})
		return
	}

	var app models.LeaseApplication
	result := database.DB.First(&app, uint(id))
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "租约申请不存在"})
		return
	}

	if app.Status != models.StatusPendingConfirm {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": fmt.Sprintf("当前状态为【%s】，只有待房态确认状态可以执行此操作", models.GetStatusName(app.Status)),
		})
		return
	}

	var req RoomConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误"})
		return
	}

	if allowed, errMsg := checkNodeOverdueBeforeProceed(c, &app, models.NodeRoomConfirm, userID, realName, role, req.OverdueReason, req.FollowUpAction, "房态确认操作", models.StatusPendingHandover); !allowed {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": errMsg})
		return
	}

	now := time.Now()
	oldStatus := app.Status

	database.DB.Model(&app).Updates(map[string]interface{}{
		"status":           models.StatusPendingHandover,
		"current_node":     models.NodeHandover,
		"confirm_result":   req.ConfirmResult,
		"confirmed_by":     userID,
		"confirmed_by_name": realName,
		"confirmed_at":     now,
	})

	database.UpdateNodeTimeline(app.ID, models.NodeRoomConfirm, "completed", userID, realName, &now)
	database.UpdateNodeTimeline(app.ID, models.NodeHandover, "processing", 0, "", nil)

	database.CreateOperationLog(app.ID, userID, realName, string(role), "room_confirm", "房态确认", string(oldStatus), string(models.StatusPendingHandover),
		fmt.Sprintf("房态确认完成，确认结果：%s", req.ConfirmResult))

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "房态确认成功，已流转至入住交接环节",
		"data":    gin.H{"id": app.ID, "status": models.StatusPendingHandover, "statusName": models.GetStatusName(models.StatusPendingHandover)},
	})
}

func CompleteHandover(c *gin.Context) {
	userID, _, realName, role := middleware.GetCurrentUser(c)
	if role != models.RoleAuditor && role != models.RoleReviewer {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "只有租约审核主管或长租公寓复核负责人可以执行入住交接操作"})
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "申请ID格式错误"})
		return
	}

	var app models.LeaseApplication
	result := database.DB.First(&app, uint(id))
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "租约申请不存在"})
		return
	}

	if app.Status != models.StatusPendingHandover {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": fmt.Sprintf("当前状态为【%s】，只有待入住交接状态可以执行此操作", models.GetStatusName(app.Status)),
		})
		return
	}

	var req HandoverRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误：必须填写交接说明"})
		return
	}

	if req.HandoverResult == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "交接说明不能为空，请详细记录钥匙、门禁卡及水电表读数等交接内容"})
		return
	}

	if allowed, errMsg := checkNodeOverdueBeforeProceed(c, &app, models.NodeHandover, userID, realName, role, req.OverdueReason, req.FollowUpAction, "入住交接操作", models.StatusRoomConfirmed); !allowed {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": errMsg})
		return
	}

	now := time.Now()

	database.DB.Model(&app).Updates(map[string]interface{}{
		"status":              models.StatusRoomConfirmed,
		"current_node":        models.NodeArchive,
		"handover_result":     req.HandoverResult,
		"handed_over_by":      userID,
		"handed_over_by_name": realName,
		"handed_over_at":      now,
	})

	database.UpdateNodeTimeline(app.ID, models.NodeHandover, "completed", userID, realName, &now)
	database.UpdateNodeTimeline(app.ID, models.NodeArchive, "processing", 0, "", nil)

	database.CreateOperationLog(app.ID, userID, realName, string(role), "handover", "入住交接完成", string(models.StatusPendingHandover), string(models.StatusRoomConfirmed),
		fmt.Sprintf("入住交接完成，交接说明：%s", req.HandoverResult))

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"message": "入住交接完成，已流转至复核归档环节",
		"data": gin.H{
			"id":              app.ID,
			"status":          models.StatusRoomConfirmed,
			"statusName":      models.GetStatusName(models.StatusRoomConfirmed),
			"currentNode":     models.NodeArchive,
			"currentNodeName": models.GetNodeName(models.NodeArchive),
		},
	})
}

func ArchiveApplication(c *gin.Context) {
	userID, _, realName, role := middleware.GetCurrentUser(c)
	if role != models.RoleReviewer {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "只有长租公寓复核负责人可以执行复核归档操作，当前角色无权限"})
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "申请ID格式错误"})
		return
	}

	var app models.LeaseApplication
	result := database.DB.First(&app, uint(id))
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "租约申请不存在"})
		return
	}

	if app.Status != models.StatusRoomConfirmed {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": fmt.Sprintf("当前状态为【%s】，只有【待复核归档】状态（即入住交接完成后）才能执行归档操作", models.GetStatusName(app.Status)),
		})
		return
	}

	var req ArchiveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误"})
		return
	}

	if req.Action != "archive" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "归档操作 action 必须为 'archive'"})
		return
	}

	if allowed, errMsg := checkNodeOverdueBeforeProceed(c, &app, models.NodeArchive, userID, realName, role, req.OverdueReason, req.FollowUpAction, "复核归档操作", models.StatusCompleted); !allowed {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": errMsg})
		return
	}

	now := time.Now()
	oldStatus := app.Status

	database.DB.Model(&app).Updates(map[string]interface{}{
		"status":           models.StatusCompleted,
		"current_node":     models.NodeArchive,
		"archived_by":      userID,
		"archived_by_name": realName,
		"completed_at":     now,
		"remark":           req.Remark,
	})

	database.UpdateNodeTimeline(app.ID, models.NodeArchive, "completed", userID, realName, &now)

	database.CreateOperationLog(app.ID, userID, realName, string(role), "archive", "复核归档完成", string(oldStatus), string(models.StatusCompleted),
		fmt.Sprintf("租约申请复核归档完成，归档人：%s，备注：%s", realName, req.Remark))

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "复核归档成功，租约申请流程全部完成",
		"data":    gin.H{"id": app.ID, "status": models.StatusCompleted, "statusName": models.GetStatusName(models.StatusCompleted), "currentNode": models.NodeArchive, "currentNodeName": models.GetNodeName(models.NodeArchive)},
	})
}

func RecordOverdue(c *gin.Context) {
	userID, _, realName, role := middleware.GetCurrentUser(c)

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "申请ID格式错误"})
		return
	}

	var app models.LeaseApplication
	result := database.DB.First(&app, uint(id))
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "租约申请不存在"})
		return
	}

	var req OverdueRecordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误：必须填写超时原因和后续处理措施"})
		return
	}

	nodeType := app.CurrentNode
	if req.NodeType != "" {
		nodeType = models.NodeType(req.NodeType)
	}

	database.SetNodeOverdueRecord(app.ID, nodeType, req.OverdueReason, req.FollowUpAction)

	database.DB.Model(&models.LeaseApplication{}).Where("id = ?", app.ID).Updates(map[string]interface{}{
		"overdue_reason":   req.OverdueReason,
		"follow_up_action": req.FollowUpAction,
	})

	database.CreateOperationLog(app.ID, userID, realName, string(role), "overdue_record", "记录超时处理", string(app.Status), string(app.Status),
		fmt.Sprintf("记录节点【%s】超时原因：%s；后续处理措施：%s", models.GetNodeName(nodeType), req.OverdueReason, req.FollowUpAction))

	database.CreateOverdueAudit(
		&app, nil, nodeType,
		models.AuditTypeSupplemented,
		"",
		req.OverdueReason, req.FollowUpAction,
		userID, realName, string(role),
		"单独记录",
		string(app.Status),
	)

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "超时记录已保存",
	})
}

func BatchGetStatuses(c *gin.Context) {
	userID, _, _, role := middleware.GetCurrentUser(c)

	var req struct {
		IDs []uint `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误"})
		return
	}

	query := database.DB.Model(&models.LeaseApplication{}).Where("id IN ?", req.IDs)
	if role == models.RoleRegistrar {
		query = query.Where("created_by = ?", userID)
	}

	var results []map[string]interface{}
	rows, err := query.Select("id, status, current_node, is_overdue").Rows()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "查询失败"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id uint
		var status, currentNode string
		var isOverdue bool
		rows.Scan(&id, &status, &currentNode, &isOverdue)
		results = append(results, map[string]interface{}{
			"id":             id,
			"status":         status,
			"statusName":     models.GetStatusName(models.ApplicationStatus(status)),
			"currentNode":    currentNode,
			"currentNodeName": models.GetNodeName(models.NodeType(currentNode)),
			"isOverdue":      isOverdue,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "批量查询成功",
		"data":    results,
	})
}

func GetNodeLimits(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取节点时限成功",
		"data":    models.NodeTimeLimits,
	})
}
