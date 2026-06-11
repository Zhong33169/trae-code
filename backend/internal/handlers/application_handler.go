package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"insurance-app/internal/models"
	"insurance-app/internal/services"
)

type ApplicationHandler struct {
	db       *gorm.DB
	appState *services.AppState
	workflow *services.WorkflowService
}

func NewApplicationHandler(db *gorm.DB, appState *services.AppState) *ApplicationHandler {
	return &ApplicationHandler{
		db:       db,
		appState: appState,
		workflow: services.NewWorkflowService(db),
	}
}

type CreateApplicationRequest struct {
	ApplicantName   string  `json:"applicant_name" binding:"required"`
	ApplicantIDCard string  `json:"applicant_id_card" binding:"required"`
	ApplicantPhone  string  `json:"applicant_phone" binding:"required"`
	InsuranceType   string  `json:"insurance_type" binding:"required"`
	InsuranceAmount float64 `json:"insurance_amount" binding:"required"`
	Premium         float64 `json:"premium" binding:"required"`
	Materials       string  `json:"materials"`
	Notes           string  `json:"notes"`
}

type ProcessRequest struct {
	Action           string `json:"action" binding:"required"`
	Opinion          string `json:"opinion" binding:"required"`
	MaterialsChecked string `json:"materials_checked"`
	Version          int    `json:"version" binding:"required"`
}

type BatchProcessRequest struct {
	IDs              []uint `json:"ids" binding:"required"`
	Action           string `json:"action" binding:"required"`
	Opinion          string `json:"opinion" binding:"required"`
	MaterialsChecked string `json:"materials_checked"`
}

func (h *ApplicationHandler) List(c *gin.Context) {
	userRole := models.Role(c.GetString("role"))
	userID := c.GetUint("user_id")

	status := c.Query("status")
	roleFilter := c.Query("role_filter")
	search := c.Query("search")
	onlyMine := c.Query("only_mine") == "true"

	query := h.db.Model(&models.Application{})

	if status != "" {
		query = query.Where("status = ?", status)
	}

	if roleFilter != "" {
		query = query.Where("current_handler_role = ?", roleFilter)
	}

	if onlyMine {
		query = query.Where(
			"current_handler_role = ? AND (current_handler_id IS NULL OR current_handler_id = ?)",
			userRole, userID,
		)
	}

	if search != "" {
		query = query.Where(
			"application_no LIKE ? OR applicant_name LIKE ? OR applicant_id_card LIKE ?",
			"%"+search+"%", "%"+search+"%", "%"+search+"%",
		)
	}

	var applications []models.Application
	if err := query.Order("created_at DESC").Find(&applications).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}

	result := make([]gin.H, 0, len(applications))
	for _, app := range applications {
		timeLimitMet, hoursLeft := h.workflow.CheckDeadline(app.Deadline)
		isLocked := h.appState.IsApplicationLocked(app.ID)

		result = append(result, gin.H{
			"id":                    app.ID,
			"application_no":        app.ApplicationNo,
			"applicant_name":        app.ApplicantName,
			"insurance_type":        app.InsuranceType,
			"insurance_amount":      app.InsuranceAmount,
			"status":                app.Status,
			"current_handler_role":  app.CurrentHandlerRole,
			"current_handler_name":  app.CurrentHandlerName,
			"deadline":              app.Deadline,
			"exception_reason":      app.ExceptionReason,
			"last_process_result":   app.LastProcessResult,
			"last_processed_at":     app.LastProcessedAt,
			"last_processed_by_name": app.LastProcessedByName,
			"time_limit_met":        timeLimitMet,
			"hours_left":            hoursLeft,
			"is_locked":             isLocked,
			"created_at":            app.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

func (h *ApplicationHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var app models.Application
	if err := h.db.First(&app, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "投保申请不存在"})
		return
	}

	userRole := models.Role(c.GetString("role"))
	availableActions := h.workflow.GetAvailableActions(&app, userRole)
	timeLimitMet, hoursLeft := h.workflow.CheckDeadline(app.Deadline)
	isLocked := h.appState.IsApplicationLocked(app.ID)

	c.JSON(http.StatusOK, gin.H{
		"data":             app,
		"available_actions": availableActions,
		"time_limit_met":   timeLimitMet,
		"hours_left":       hoursLeft,
		"is_locked":        isLocked,
	})
}

func (h *ApplicationHandler) Create(c *gin.Context) {
	var req CreateApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误: " + err.Error()})
		return
	}

	userID := c.GetUint("user_id")
	username := c.GetString("username")
	userRole := models.Role(c.GetString("role"))
	userName := c.GetString("name")

	if userRole != models.RoleRegistrar {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有投保登记员可以创建投保申请"})
		return
	}

	materialsOK, materialsMsg, _ := h.workflow.ValidateMaterials(req.Materials, req.InsuranceType)
	if !materialsOK {
		c.JSON(http.StatusBadRequest, gin.H{"error": materialsMsg})
		return
	}

	appNo := "INS" + time.Now().Format("200601") + uuid.New().String()[:6]
	qrCode := "QR-INS-" + time.Now().Format("2006") + "-" + uuid.New().String()[:5]

	app := &models.Application{
		ApplicationNo:      appNo,
		ApplicantName:      req.ApplicantName,
		ApplicantIDCard:    req.ApplicantIDCard,
		ApplicantPhone:     req.ApplicantPhone,
		InsuranceType:      req.InsuranceType,
		InsuranceAmount:    req.InsuranceAmount,
		Premium:            req.Premium,
		QRCode:             qrCode,
		Status:             models.StatusPendingScan,
		CurrentHandlerRole: models.RoleRegistrar,
		CurrentHandlerID:   &userID,
		CurrentHandlerName: userName,
		Deadline:           time.Now().AddDate(0, 0, 3),
		LastProcessResult:  "已提交投保资料，待扫码核验",
		Materials:          req.Materials,
		Notes:              req.Notes,
		Version:            1,
	}

	if err := h.db.Create(app).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建失败: " + err.Error()})
		return
	}

	_ = h.workflow.CreateAuditLog(
		h.db,
		userID,
		username,
		userRole,
		"create",
		"application",
		app.ID,
		c.ClientIP(),
		c.Request.UserAgent(),
		"创建投保申请: "+appNo,
	)

	c.JSON(http.StatusCreated, gin.H{"data": app})
}

func (h *ApplicationHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req CreateApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	userRole := models.Role(c.GetString("role"))
	if userRole != models.RoleRegistrar {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有投保登记员可以修改投保申请"})
		return
	}

	var app models.Application
	if err := h.db.First(&app, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "投保申请不存在"})
		return
	}

	if app.Status != models.StatusPendingScan && app.Status != models.StatusRevisionRequired && app.Status != models.StatusScanFailed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "当前状态不允许修改"})
		return
	}

	materialsOK, materialsMsg, _ := h.workflow.ValidateMaterials(req.Materials, req.InsuranceType)
	if !materialsOK {
		c.JSON(http.StatusBadRequest, gin.H{"error": materialsMsg})
		return
	}

	app.ApplicantName = req.ApplicantName
	app.ApplicantIDCard = req.ApplicantIDCard
	app.ApplicantPhone = req.ApplicantPhone
	app.InsuranceType = req.InsuranceType
	app.InsuranceAmount = req.InsuranceAmount
	app.Premium = req.Premium
	app.Materials = req.Materials
	app.Notes = req.Notes
	app.Version++
	app.UpdatedAt = time.Now()

	if err := h.db.Save(&app).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
		return
	}

	_ = h.workflow.CreateAuditLog(
		h.db,
		c.GetUint("user_id"),
		c.GetString("username"),
		userRole,
		"update",
		"application",
		app.ID,
		c.ClientIP(),
		c.Request.UserAgent(),
		"修改投保申请: "+app.ApplicationNo,
	)

	c.JSON(http.StatusOK, gin.H{"data": app})
}

func (h *ApplicationHandler) Process(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req ProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误: " + err.Error()})
		return
	}

	userID := c.GetUint("user_id")
	username := c.GetString("username")
	userRole := models.Role(c.GetString("role"))
	userName := c.GetString("name")

	unlock, err := h.appState.TryLockApplication(uint(id), userID)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}
	defer unlock()

	var app models.Application
	if err := h.db.First(&app, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "投保申请不存在"})
		return
	}

	if app.Version != req.Version {
		c.JSON(http.StatusConflict, gin.H{
			"error":      "数据版本不匹配，请刷新页面后重试",
			"your_version": req.Version,
			"current_version": app.Version,
		})
		return
	}

	action := services.ProcessAction(req.Action)
	rule, err := h.workflow.ValidateTransition(&app, action, userRole)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if action == services.ActionApprove || action == services.ActionSubmitRevise {
		materials := app.Materials
		if req.MaterialsChecked != "" {
			materials = req.MaterialsChecked
		}
		materialsOK, materialsMsg, materialList := h.workflow.ValidateMaterials(materials, app.InsuranceType)
		if !materialsOK {
			c.JSON(http.StatusBadRequest, gin.H{"error": materialsMsg})
			return
		}
		materialsJSON, _ := json.Marshal(materialList)
		req.MaterialsChecked = string(materialsJSON)
	}

	startTime := time.Now()

	tx := h.db.Begin()

	processRecord, err := h.workflow.TransitionApplication(
		&app,
		rule,
		action,
		userID,
		userName,
		userRole,
		req.Opinion,
		req.MaterialsChecked,
		startTime,
	)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "流转失败: " + err.Error()})
		return
	}

	if err := tx.Save(&app).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存申请失败"})
		return
	}

	if err := tx.Create(processRecord).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存处理记录失败"})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "提交事务失败"})
		return
	}

	_ = h.workflow.CreateAuditLog(
		h.db,
		userID,
		username,
		userRole,
		"process",
		"application",
		app.ID,
		c.ClientIP(),
		c.Request.UserAgent(),
		"处理投保申请: "+app.ApplicationNo+", 动作: "+req.Action+", 结果: "+req.Opinion,
	)

	c.JSON(http.StatusOK, gin.H{
		"data":     app,
		"record":   processRecord,
		"message":  "处理成功",
	})
}

func (h *ApplicationHandler) BatchProcess(c *gin.Context) {
	var req BatchProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	userID := c.GetUint("user_id")
	username := c.GetString("username")
	userRole := models.Role(c.GetString("role"))
	userName := c.GetString("name")

	results := make([]gin.H, 0)
	successCount := 0
	failCount := 0

	for _, appID := range req.IDs {
		unlock, err := h.appState.TryLockApplication(appID, userID)
		if err != nil {
			results = append(results, gin.H{
				"id":    appID,
				"success": false,
				"error":  err.Error(),
			})
			failCount++
			continue
		}

		var app models.Application
		if err := h.db.First(&app, appID).Error; err != nil {
			unlock()
			results = append(results, gin.H{
				"id":    appID,
				"success": false,
				"error":  "投保申请不存在",
			})
			failCount++
			continue
		}

		action := services.ProcessAction(req.Action)
		rule, err := h.workflow.ValidateTransition(&app, action, userRole)
		if err != nil {
			unlock()
			results = append(results, gin.H{
				"id":    appID,
				"application_no": app.ApplicationNo,
				"success": false,
				"error":  err.Error(),
			})
			failCount++
			continue
		}

		startTime := time.Now()

		tx := h.db.Begin()

		processRecord, err := h.workflow.TransitionApplication(
			&app,
			rule,
			action,
			userID,
			userName,
			userRole,
			req.Opinion,
			req.MaterialsChecked,
			startTime,
		)
		if err != nil {
			tx.Rollback()
			unlock()
			results = append(results, gin.H{
				"id":    appID,
				"application_no": app.ApplicationNo,
				"success": false,
				"error":  "流转失败: " + err.Error(),
			})
			failCount++
			continue
		}

		if err := tx.Save(&app).Error; err != nil {
			tx.Rollback()
			unlock()
			results = append(results, gin.H{
				"id":    appID,
				"application_no": app.ApplicationNo,
				"success": false,
				"error":  "保存失败",
			})
			failCount++
			continue
		}

		if err := tx.Create(processRecord).Error; err != nil {
			tx.Rollback()
			unlock()
			results = append(results, gin.H{
				"id":    appID,
				"application_no": app.ApplicationNo,
				"success": false,
				"error":  "保存处理记录失败",
			})
			failCount++
			continue
		}

		tx.Commit()
		unlock()

		successCount++
		results = append(results, gin.H{
			"id":    appID,
			"application_no": app.ApplicationNo,
			"success": true,
			"new_status": app.Status,
		})

		_ = h.workflow.CreateAuditLog(
			h.db,
			userID,
			username,
			userRole,
			"batch_process",
			"application",
			app.ID,
			c.ClientIP(),
			c.Request.UserAgent(),
			"批量处理投保申请: "+app.ApplicationNo+", 动作: "+req.Action,
		)
	}

	c.JSON(http.StatusOK, gin.H{
		"results":       results,
		"success_count": successCount,
		"fail_count":    failCount,
	})
}

func (h *ApplicationHandler) GetHistory(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var scanRecords []models.ScanRecord
	if err := h.db.Where("application_id = ?", uint(id)).Order("scan_time DESC").Find(&scanRecords).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询扫码记录失败"})
		return
	}

	var processRecords []models.ProcessRecord
	if err := h.db.Where("application_id = ?", uint(id)).Order("created_at DESC").Find(&processRecords).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询处理记录失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"scan_records":    scanRecords,
		"process_records": processRecords,
	})
}

func (h *ApplicationHandler) GetStatistics(c *gin.Context) {
	userRole := models.Role(c.GetString("role"))
	userID := c.GetUint("user_id")

	stats, err := h.workflow.GetStatistics(h.db, userRole, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取统计数据失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": stats})
}
