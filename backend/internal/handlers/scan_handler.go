package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"insurance-app/internal/models"
	"insurance-app/internal/services"
)

type ScanHandler struct {
	db       *gorm.DB
	appState *services.AppState
	workflow *services.WorkflowService
}

func NewScanHandler(db *gorm.DB, appState *services.AppState) *ScanHandler {
	return &ScanHandler{
		db:       db,
		appState: appState,
		workflow: services.NewWorkflowService(db),
	}
}

type ScanRequest struct {
	QRCode       string `json:"qr_code" binding:"required"`
	Evidence     string `json:"evidence"`
	DeviceInfo   string `json:"device_info"`
	LocationInfo string `json:"location_info"`
}

type ScanResponse struct {
	Success       bool   `json:"success"`
	Result        string `json:"result"`
	Message       string `json:"message"`
	RecordID      uint   `json:"record_id,omitempty"`
	ApplicationID uint   `json:"application_id,omitempty"`
	NextAction    string `json:"next_action,omitempty"`
	Evidence      string `json:"evidence,omitempty"`
	QRMatched     bool   `json:"qr_matched"`
	HandlerMatched bool  `json:"handler_matched"`
	IsDuplicate   bool   `json:"is_duplicate"`
	StayInPlace   bool   `json:"stay_in_place"`
	CurrentStatus string `json:"current_status,omitempty"`
	ExpectedHandler string `json:"expected_handler,omitempty"`
	ExpectedHandlerID *uint `json:"expected_handler_id,omitempty"`
}

func (h *ScanHandler) ScanQRCode(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req ScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误: " + err.Error()})
		return
	}

	userID := c.GetUint("user_id")
	username := c.GetString("username")
	userRole := models.Role(c.GetString("role"))
	userName := c.GetString("name")

	if userRole != models.RoleRegistrar {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有投保登记员可以执行扫码核验"})
		return
	}

	unlock, err := h.appState.TryLockScan(uint(id), userID)
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

	if app.Status != models.StatusPendingScan && app.Status != models.StatusScanFailed && app.Status != models.StatusRevisionRequired {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "当前状态不允许扫码核验",
			"status": app.Status,
		})
		return
	}

	originalStatus := app.Status
	scanTime := time.Now()
	result := "success"
	failureReason := ""
	qrMatched := true
	handlerMatched := true
	isDuplicate := false
	stayInPlace := false

	if req.QRCode != app.QRCode {
		result = "fail"
		qrMatched = false
		stayInPlace = true
		failureReason = "二维码不匹配：扫码内容与投保申请绑定的二维码不一致，请核对投保资料"
	}

	if qrMatched {
		var count int64
		h.db.Model(&models.ScanRecord{}).Where(
			"application_id = ? AND result = 'success' AND qr_code = ?",
			uint(id), req.QRCode,
		).Count(&count)

		if count > 0 {
			result = "duplicate"
			isDuplicate = true
			stayInPlace = true
			failureReason = "重复扫码：该二维码已成功核验过，同一申请只能通过扫码核验一次"
		}
	}

	if qrMatched && !isDuplicate {
		if app.CurrentHandlerID != nil && *app.CurrentHandlerID != userID {
			result = "handler_mismatch"
			handlerMatched = false
			stayInPlace = true
			failureReason = "扫码人与当前处理人不匹配，该申请的责任人是：" + app.CurrentHandlerName
		}
	}

	evidence := req.Evidence
	if evidence == "" {
		evidence = h.generateEvidence(req.QRCode, userID, scanTime)
	}

	scanRecord := &models.ScanRecord{
		ApplicationID: app.ID,
		QRCode:        req.QRCode,
		ScanTime:      scanTime,
		ScannerID:     userID,
		ScannerName:   userName,
		ScannerRole:   userRole,
		Result:        result,
		FailureReason: failureReason,
		Evidence:      evidence,
		DeviceInfo:    req.DeviceInfo,
		LocationInfo:  req.LocationInfo,
		CreatedAt:     time.Now(),
	}

	if err := h.db.Create(scanRecord).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存扫码记录失败"})
		return
	}

	response := ScanResponse{
		Success:           result == "success",
		Result:            result,
		Message:           h.getResultMessage(result, failureReason),
		RecordID:          scanRecord.ID,
		ApplicationID:     app.ID,
		Evidence:          evidence,
		QRMatched:         qrMatched,
		HandlerMatched:    handlerMatched,
		IsDuplicate:       isDuplicate,
		StayInPlace:       stayInPlace,
		CurrentStatus:     string(originalStatus),
		ExpectedHandler:   app.CurrentHandlerName,
		ExpectedHandlerID: app.CurrentHandlerID,
	}

	if result != "success" {
		_ = h.workflow.CreateAuditLog(
			h.db,
			userID,
			username,
			userRole,
			"scan_fail",
			"application",
			app.ID,
			c.ClientIP(),
			c.Request.UserAgent(),
			"扫码核验失败: "+app.ApplicationNo+", 结果: "+result+", 原因: "+failureReason,
		)

		tx := h.db.Begin()

		if stayInPlace {
			app.ExceptionReason = failureReason
			app.LastProcessResult = "扫码核验失败(" + result + "): " + failureReason
			app.LastProcessedAt = &scanTime
			app.LastProcessedByID = &userID
			app.LastProcessedByName = userName
			app.Version++
			app.UpdatedAt = scanTime
		} else {
			app.Status = models.StatusScanFailed
			app.ExceptionReason = failureReason
			app.LastProcessResult = "扫码核验失败: " + failureReason
			app.LastProcessedAt = &scanTime
			app.LastProcessedByID = &userID
			app.LastProcessedByName = userName
			app.Version++
			app.UpdatedAt = scanTime
		}

		if err := tx.Save(&app).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "更新申请状态失败"})
			return
		}

		processRecord := &models.ProcessRecord{
			ApplicationID: app.ID,
			Action:        "scan_fail",
			FromStatus:    originalStatus,
			ToStatus:      app.Status,
			HandlerRole:   userRole,
			HandlerID:     userID,
			HandlerName:   userName,
			Opinion:       "扫码核验失败: " + failureReason + " [扫码结果类型: " + result + "]",
			TimeLimitMet:  true,
			ProcessingTime: 0,
			CreatedAt:     scanTime,
		}

		if err := tx.Create(processRecord).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "保存处理记录失败"})
			return
		}

		tx.Commit()

		if stayInPlace {
			response.NextAction = "停在原队列：请核对信息后联系对应责任人或使用正确二维码重新核验"
		} else {
			response.NextAction = "留在原队列，需重新核验或联系管理员"
		}
		response.CurrentStatus = string(app.Status)

		c.JSON(http.StatusOK, response)
		return
	}

	materialsOK, materialsMsg, _ := h.workflow.ValidateMaterials(app.Materials, app.InsuranceType)
	if !materialsOK {
		_ = h.workflow.CreateAuditLog(
			h.db,
			userID,
			username,
			userRole,
			"scan_pass_but_materials_missing",
			"application",
			app.ID,
			c.ClientIP(),
			c.Request.UserAgent(),
			"扫码通过但材料不全: "+app.ApplicationNo+", 原因: "+materialsMsg,
		)

		tx := h.db.Begin()
		app.ExceptionReason = materialsMsg
		app.LastProcessResult = "扫码通过但" + materialsMsg
		app.LastProcessedAt = &scanTime
		app.LastProcessedByID = &userID
		app.LastProcessedByName = userName
		app.Version++
		app.UpdatedAt = scanTime

		if err := tx.Save(&app).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "更新申请状态失败"})
			return
		}

		processRecord := &models.ProcessRecord{
			ApplicationID: app.ID,
			Action:        "scan_materials_missing",
			FromStatus:    originalStatus,
			ToStatus:      app.Status,
			HandlerRole:   userRole,
			HandlerID:     userID,
			HandlerName:   userName,
			Opinion:       "扫码核验通过但材料不全: " + materialsMsg,
			TimeLimitMet:  true,
			ProcessingTime: 0,
			CreatedAt:     scanTime,
		}

		if err := tx.Create(processRecord).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "保存处理记录失败"})
			return
		}

		tx.Commit()

		response.Success = false
		response.Result = "materials_missing"
		response.Message = "扫码成功，但" + materialsMsg + "，请补正材料后再提交审核"
		response.NextAction = "补充材料后重新提交审核，当前仍停留在登记员队列"
		response.StayInPlace = true
		response.Evidence = evidence
		c.JSON(http.StatusOK, response)
		return
	}

	tx := h.db.Begin()

	app.Status = models.StatusPendingReview
	app.CurrentHandlerRole = models.RoleSupervisor
	app.CurrentHandlerID = nil
	app.CurrentHandlerName = ""
	app.ExceptionReason = ""
	app.LastProcessResult = "扫码核验通过，已提交主管审核"
	app.LastProcessedAt = &scanTime
	app.LastProcessedByID = &userID
	app.LastProcessedByName = userName
	app.Version++
	app.UpdatedAt = scanTime

	if err := tx.Save(&app).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新申请状态失败"})
		return
	}

	processRecord := &models.ProcessRecord{
		ApplicationID: app.ID,
		Action:        "scan_pass",
		FromStatus:    originalStatus,
		ToStatus:      models.StatusPendingReview,
		HandlerRole:   userRole,
		HandlerID:     userID,
		HandlerName:   userName,
		Opinion:       "扫码核验通过，材料齐全，提交主管审核",
		MaterialsChecked: app.Materials,
		TimeLimitMet:  true,
		ProcessingTime: 0,
		CreatedAt:     scanTime,
	}

	if err := tx.Create(processRecord).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存处理记录失败"})
		return
	}

	tx.Commit()

	_ = h.workflow.CreateAuditLog(
		h.db,
		userID,
		username,
		userRole,
		"scan_pass",
		"application",
		app.ID,
		c.ClientIP(),
		c.Request.UserAgent(),
		"扫码核验通过: "+app.ApplicationNo+", 凭证: "+evidence[:16]+"...",
	)

	response.Success = true
	response.Result = "success"
	response.Message = "扫码核验通过，已流转至主管审核队列"
	response.NextAction = "等待投保审核主管处理"
	response.CurrentStatus = string(models.StatusPendingReview)

	c.JSON(http.StatusOK, response)
}

func (h *ScanHandler) generateEvidence(qrCode string, userID uint, scanTime time.Time) string {
	data := map[string]interface{}{
		"qr_code":    qrCode,
		"user_id":    userID,
		"scan_time":  scanTime.Format(time.RFC3339Nano),
		"random_seed": time.Now().UnixNano(),
	}

	jsonData, _ := json.Marshal(data)
	hash := sha256.Sum256(jsonData)
	return hex.EncodeToString(hash[:])
}

func (h *ScanHandler) getResultMessage(result string, reason string) string {
	switch result {
	case "success":
		return "扫码核验成功"
	case "fail":
		return "扫码核验失败: " + reason
	case "duplicate":
		return "重复扫码: " + reason
	case "invalid":
		return "二维码无效: " + reason
	case "handler_mismatch":
		return "扫码人不匹配: " + reason
	case "materials_missing":
		return "材料缺失: " + reason
	default:
		return reason
	}
}
