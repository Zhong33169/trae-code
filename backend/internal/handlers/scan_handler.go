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
	Success          bool   `json:"success"`
	Result           string `json:"result"`
	Message          string `json:"message"`
	RecordID         uint   `json:"record_id,omitempty"`
	ApplicationID    uint   `json:"application_id,omitempty"`
	NextAction       string `json:"next_action,omitempty"`
	Evidence         string `json:"evidence,omitempty"`
	QRMatched        bool   `json:"qr_matched"`
	HandlerMatched   bool   `json:"handler_matched"`
	IsDuplicate      bool   `json:"is_duplicate"`
	StayInPlace      bool   `json:"stay_in_place"`
	StatusBefore     string `json:"status_before"`
	StatusAfter      string `json:"status_after"`
	ExpectedHandler  string `json:"expected_handler,omitempty"`
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

	statusBefore := app.Status
	statusAfter := app.Status
	scanTime := time.Now()
	result := "success"
	failureReason := ""
	qrMatched := true
	handlerMatched := true
	isDuplicate := false
	stayInPlace := false
	nextAction := ""

	if req.QRCode != app.QRCode {
		result = "invalid_qr"
		qrMatched = false
		stayInPlace = true
		failureReason = "二维码无效：扫码内容与投保申请绑定的二维码不一致，请核对投保资料"
		nextAction = "停在原队列，请使用投保资料上正确的二维码重新核验"
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
			nextAction = "停在原队列，无需重复核验，请继续后续流程"
		}
	}

	if qrMatched && !isDuplicate {
		if app.CurrentHandlerID != nil && *app.CurrentHandlerID != userID {
			result = "handler_mismatch"
			handlerMatched = false
			stayInPlace = true
			failureReason = "扫码人与当前处理人不匹配，该申请的责任人是：" + app.CurrentHandlerName
			nextAction = "停在原队列，请由登记责任人 " + app.CurrentHandlerName + " 进行核验，或联系管理员变更责任人"
		}
	}

	materialsOK := true
	materialsMsg := ""
	if qrMatched && !isDuplicate && handlerMatched {
		var mMissing []models.MaterialItem
		materialsOK, materialsMsg, mMissing = h.workflow.ValidateMaterials(app.Materials, app.InsuranceType)
		_ = mMissing
		if !materialsOK {
			result = "materials_missing"
			stayInPlace = true
			failureReason = materialsMsg
			nextAction = "停在原队列，请补正材料后由" + app.CurrentHandlerName + "重新提交审核"
		}
	}

	evidence := req.Evidence
	if evidence == "" {
		evidence = h.generateEvidence(req.QRCode, userID, scanTime)
	}

	oldVersion := app.Version
	newVersion := app.Version + 1

	tx := h.db.Begin()

	if stayInPlace {
		app.ExceptionReason = failureReason
		if result == "materials_missing" {
			app.LastProcessResult = "扫码通过但" + materialsMsg
		} else {
			app.LastProcessResult = "扫码核验失败(" + result + "): " + failureReason
		}
		app.LastProcessedAt = &scanTime
		app.LastProcessedByID = &userID
		app.LastProcessedByName = userName
		app.Version = newVersion
		app.UpdatedAt = scanTime
		statusAfter = statusBefore
	} else {
		app.Status = models.StatusPendingReview
		app.CurrentHandlerRole = models.RoleSupervisor
		app.CurrentHandlerID = nil
		app.CurrentHandlerName = ""
		app.ExceptionReason = ""
		app.LastProcessResult = "扫码核验通过，已提交主管审核"
		app.LastProcessedAt = &scanTime
		app.LastProcessedByID = &userID
		app.LastProcessedByName = userName
		app.Version = newVersion
		app.UpdatedAt = scanTime
		statusAfter = models.StatusPendingReview
		nextAction = "等待投保审核主管处理"
	}

	scanRecord := &models.ScanRecord{
		ApplicationID:       app.ID,
		QRCode:              req.QRCode,
		ScanTime:            scanTime,
		ScannerID:           userID,
		ScannerName:         userName,
		ScannerRole:         userRole,
		Result:              result,
		FailureReason:       failureReason,
		Evidence:            evidence,
		DeviceInfo:          req.DeviceInfo,
		LocationInfo:        req.LocationInfo,
		StayInPlace:         stayInPlace,
		ExpectedHandlerID:   app.CurrentHandlerID,
		ExpectedHandlerName: app.CurrentHandlerName,
		StatusBefore:        statusBefore,
		StatusAfter:         statusAfter,
		CreatedAt:           scanTime,
	}
	if stayInPlace && result != "materials_missing" {
		scanRecord.ExpectedHandlerID = app.CurrentHandlerID
		scanRecord.ExpectedHandlerName = app.CurrentHandlerName
	}

	if err := tx.Create(scanRecord).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存扫码记录失败"})
		return
	}

	if err := tx.Save(&app).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新申请状态失败"})
		return
	}

	processRecord := &models.ProcessRecord{
		ApplicationID:   app.ID,
		Action:          result,
		FromStatus:      statusBefore,
		ToStatus:        statusAfter,
		HandlerRole:     userRole,
		HandlerID:       userID,
		HandlerName:     userName,
		Opinion:         h.buildOpinion(result, failureReason, materialsMsg),
		FailureReason:   failureReason,
		OldVersion:      oldVersion,
		NewVersion:      newVersion,
		MaterialsChecked: app.Materials,
		TimeLimitMet:    true,
		ProcessingTime:  0,
		CreatedAt:       scanTime,
	}

	if err := tx.Create(processRecord).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存处理记录失败"})
		return
	}

	auditAction := "scan_" + result
	auditDetail := h.buildAuditDetail(result, app.ApplicationNo, evidence, failureReason)
	auditLog, auditErr := h.workflow.CreateAuditLogReturn(
		tx,
		userID,
		username,
		userRole,
		auditAction,
		"application",
		app.ID,
		c.ClientIP(),
		c.Request.UserAgent(),
		auditDetail,
	)
	if auditErr == nil && auditLog != nil {
		processRecord.AuditID = &auditLog.ID
		_ = tx.Save(processRecord).Error
	}

	tx.Commit()

	response := ScanResponse{
		Success:           result == "success",
		Result:            result,
		Message:           h.getResultMessage(result, failureReason),
		RecordID:          scanRecord.ID,
		ApplicationID:     app.ID,
		NextAction:        nextAction,
		Evidence:          evidence,
		QRMatched:         qrMatched,
		HandlerMatched:    handlerMatched,
		IsDuplicate:       isDuplicate,
		StayInPlace:       stayInPlace,
		StatusBefore:      string(statusBefore),
		StatusAfter:       string(statusAfter),
		ExpectedHandler:   app.CurrentHandlerName,
		ExpectedHandlerID: app.CurrentHandlerID,
	}

	c.JSON(http.StatusOK, response)
}

func (h *ScanHandler) buildOpinion(result, failureReason, materialsMsg string) string {
	switch result {
	case "success":
		return "扫码核验通过，材料齐全，流转至主管审核"
	case "invalid_qr":
		return "扫码核验失败：" + failureReason
	case "duplicate":
		return "重复扫码：" + failureReason
	case "handler_mismatch":
		return "扫码人不匹配：" + failureReason
	case "materials_missing":
		return "扫码通过但材料不全：" + materialsMsg
	default:
		return failureReason
	}
}

func (h *ScanHandler) buildAuditDetail(result, appNo, evidence, failureReason string) string {
	shortEvidence := evidence
	if len(shortEvidence) > 16 {
		shortEvidence = shortEvidence[:16] + "..."
	}
	switch result {
	case "success":
		return "扫码核验通过: " + appNo + ", 凭证: " + shortEvidence
	case "invalid_qr":
		return "扫码无效二维码: " + appNo + ", 凭证: " + shortEvidence + ", 原因: " + failureReason
	case "duplicate":
		return "重复扫码: " + appNo + ", 凭证: " + shortEvidence + ", 原因: " + failureReason
	case "handler_mismatch":
		return "扫码人不匹配: " + appNo + ", 凭证: " + shortEvidence + ", 原因: " + failureReason
	case "materials_missing":
		return "扫码通过但材料缺失: " + appNo + ", 凭证: " + shortEvidence + ", 原因: " + failureReason
	default:
		return "扫码异常: " + appNo + ", 凭证: " + shortEvidence
	}
}

func (h *ScanHandler) generateEvidence(qrCode string, userID uint, scanTime time.Time) string {
	data := map[string]interface{}{
		"qr_code":     qrCode,
		"user_id":     userID,
		"scan_time":   scanTime.Format(time.RFC3339Nano),
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
	case "invalid_qr":
		return "二维码无效：" + reason
	case "duplicate":
		return "重复扫码：" + reason
	case "handler_mismatch":
		return "扫码人不匹配：" + reason
	case "materials_missing":
		return "材料缺失：" + reason
	default:
		return reason
	}
}
