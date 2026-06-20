package services

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"inventory-adjust-system/db"
	"inventory-adjust-system/models"
)

type OrderService struct{}

func NewOrderService() *OrderService {
	return &OrderService{}
}

type OrderQuery struct {
	Status    []models.OrderStatus `form:"status[]"`
	Warehouse string               `form:"warehouse"`
	Keyword   string               `form:"keyword"`
	Page      int                  `form:"page,default=1"`
	PageSize  int                  `form:"page_size,default=20"`
}

type OrderListResult struct {
	Total    int64                       `json:"total"`
	List     []*models.InventoryAdjustOrder `json:"list"`
	Page     int                         `json:"page"`
	PageSize int                         `json:"page_size"`
	Groups   map[string]int64            `json:"groups"`
}

type SubmitOrderRequest struct {
	OrderID    int64  `json:"order_id" binding:"required"`
	Version    int    `json:"version" binding:"required,min=1"`
	SubmitType string `json:"submit_type"`
}

type VerifyOrderRequest struct {
	OrderID int64  `json:"order_id" binding:"required"`
	Version int    `json:"version" binding:"required,min=1"`
	Pass    bool   `json:"pass"`
	Opinion string `json:"opinion"`
}

type ReviewOrderRequest struct {
	OrderID int64  `json:"order_id" binding:"required"`
	Version int    `json:"version" binding:"required,min=1"`
	Pass    bool   `json:"pass"`
	Opinion string `json:"opinion"`
}

type ArchiveOrderRequest struct {
	OrderID int64 `json:"order_id" binding:"required"`
	Version int   `json:"version" binding:"required,min=1"`
}

type SupplementRequest struct {
	OrderID   int64                 `json:"order_id" binding:"required"`
	Type      models.SupplementType `json:"type" binding:"required"`
	Content   string                `json:"content" binding:"required,min=1"`
	FieldName string                `json:"field_name"`
	OldValue  string                `json:"old_value"`
	NewValue  string                `json:"new_value"`
	Reason    string                `json:"reason" binding:"required,min=1"`
}

type BatchSubmitRequest struct {
	OrderIDs []int64 `json:"order_ids" binding:"required,min=1"`
}

func (s *OrderService) GetOrderList(query *OrderQuery, userCtx interface{}) (*OrderListResult, error) {
	database := db.GetDB()
	dbQuery := database.Model(&models.InventoryAdjustOrder{})

	if len(query.Status) > 0 {
		dbQuery = dbQuery.Where("status IN ?", query.Status)
	}
	if query.Warehouse != "" {
		dbQuery = dbQuery.Where("warehouse = ?", query.Warehouse)
	}
	if query.Keyword != "" {
		keyword := "%" + query.Keyword + "%"
		dbQuery = dbQuery.Where("order_no LIKE ? OR title LIKE ? OR sku LIKE ? OR product_name LIKE ?",
			keyword, keyword, keyword, keyword)
	}

	var total int64
	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("统计订单数量失败: %w", err)
	}

	groups := make(map[string]int64)
	groupStatuses := []models.OrderStatus{
		models.StatusPendingSubmit,
		models.StatusReturned,
		models.StatusResubmitted,
	}
	for _, status := range groupStatuses {
		var count int64
		groupQuery := database.Model(&models.InventoryAdjustOrder{}).Where("status = ?", status)
		if query.Warehouse != "" {
			groupQuery = groupQuery.Where("warehouse = ?", query.Warehouse)
		}
		if query.Keyword != "" {
			keyword := "%" + query.Keyword + "%"
			groupQuery = groupQuery.Where("order_no LIKE ? OR title LIKE ? OR sku LIKE ? OR product_name LIKE ?",
				keyword, keyword, keyword, keyword)
		}
		groupQuery.Count(&count)
		groups[string(status)] = count
	}

	var orders []*models.InventoryAdjustOrder
	offset := (query.Page - 1) * query.PageSize
	err := dbQuery.Order("create_at DESC").Offset(offset).Limit(query.PageSize).Find(&orders).Error
	if err != nil {
		return nil, fmt.Errorf("查询订单列表失败: %w", err)
	}

	return &OrderListResult{
		Total:    total,
		List:     orders,
		Page:     query.Page,
		PageSize: query.PageSize,
		Groups:   groups,
	}, nil
}

func (s *OrderService) GetOrderDetail(orderID int64) (map[string]interface{}, error) {
	database := db.GetDB()

	var order models.InventoryAdjustOrder
	if err := database.First(&order, orderID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("订单不存在")
		}
		return nil, fmt.Errorf("查询订单失败: %w", err)
	}

	var evidences []*models.OrderEvidence
	if err := database.Where("order_id = ?", orderID).Order("create_at DESC").Find(&evidences).Error; err != nil {
		return nil, fmt.Errorf("查询证据失败: %w", err)
	}

	var supplements []*models.SupplementRecord
	if err := database.Where("order_id = ?", orderID).Order("create_at DESC").Find(&supplements).Error; err != nil {
		return nil, fmt.Errorf("查询补录记录失败: %w", err)
	}

	var logs []*models.OperationLog
	if err := database.Where("order_id = ?", orderID).Order("create_at DESC").Find(&logs).Error; err != nil {
		return nil, fmt.Errorf("查询操作日志失败: %w", err)
	}

	return map[string]interface{}{
		"order":      order,
		"evidences":  evidences,
		"supplements": supplements,
		"logs":       logs,
	}, nil
}

func (s *OrderService) SubmitOrder(req *SubmitOrderRequest, userID int64, userName string, userRole models.Role) (*models.InventoryAdjustOrder, error) {
	if userRole != models.RoleWarehouseKeeper {
		return nil, errors.New("只有库管员可以提交库存调整单")
	}

	database := db.GetDB()
	tx := database.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var order models.InventoryAdjustOrder
	if err := tx.First(&order, req.OrderID).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("订单不存在")
		}
		return nil, fmt.Errorf("查询订单失败: %w", err)
	}

	if order.Version != req.Version {
		tx.Rollback()
		return nil, fmt.Errorf("版本冲突，当前版本: %d，您的版本: %d，请刷新后重试", order.Version, req.Version)
	}

	if order.Status != models.StatusPendingSubmit && order.Status != models.StatusReturned && order.Status != models.StatusResubmitted {
		tx.Rollback()
		return nil, fmt.Errorf("当前状态[%s]不允许提交操作，仅待提交、已退回、重新提交状态可以提交", order.Status)
	}

	if order.CreatedBy != userID {
		tx.Rollback()
		return nil, errors.New("只能提交自己创建的库存调整单")
	}

	var registerCount int64
	tx.Model(&models.OrderEvidence{}).Where("order_id = ? AND type = ?", req.OrderID, models.EvidenceTypeRegister).Count(&registerCount)
	if registerCount == 0 {
		tx.Rollback()
		return nil, errors.New("缺少登记阶段的证据材料，请上传至少1份证据后再提交")
	}

	oldStatus := order.Status
	order.Status = models.StatusPendingVerify
	order.Version++
	order.UpdateAt = time.Now()

	if err := tx.Save(&order).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("更新订单状态失败: %w", err)
	}

	log := &models.OperationLog{
		OrderID:      req.OrderID,
		Operation:    "提交核验",
		OldStatus:    oldStatus,
		NewStatus:    models.StatusPendingVerify,
		OperatorID:   userID,
		OperatorName: userName,
		OperatorRole: userRole,
		Remark:       "库管员提交库存调整单，等待仓储主管核验",
	}
	if err := tx.Create(log).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("创建操作日志失败: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("提交事务失败: %w", err)
	}

	return &order, nil
}

func (s *OrderService) VerifyOrder(req *VerifyOrderRequest, userID int64, userName string, userRole models.Role) (*models.InventoryAdjustOrder, error) {
	if userRole != models.RoleWarehouseSupervisor {
		return nil, errors.New("只有仓储主管可以进行核验操作")
	}

	database := db.GetDB()
	tx := database.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var order models.InventoryAdjustOrder
	if err := tx.First(&order, req.OrderID).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("订单不存在")
		}
		return nil, fmt.Errorf("查询订单失败: %w", err)
	}

	if order.Version != req.Version {
		tx.Rollback()
		return nil, fmt.Errorf("版本冲突，当前版本: %d，您的版本: %d，请刷新后重试", order.Version, req.Version)
	}

	if order.Status != models.StatusPendingVerify {
		tx.Rollback()
		return nil, fmt.Errorf("当前状态[%s]不允许核验操作，仅待核验状态可以核验", order.Status)
	}

	if req.Pass {
		var verifyCount int64
		tx.Model(&models.OrderEvidence{}).Where("order_id = ? AND type = ?", req.OrderID, models.EvidenceTypeVerify).Count(&verifyCount)
		if verifyCount == 0 {
			tx.Rollback()
			return nil, errors.New("缺少核验阶段的证据材料，请上传核验证据后再通过")
		}

		oldStatus := order.Status
		now := time.Now()
		order.Status = models.StatusPendingReview
		order.VerifiedBy = &userID
		order.VerifiedByName = &userName
		order.VerifiedAt = &now
		order.VerifyOpinion = &req.Opinion
		order.Version++
		order.UpdateAt = now

		if err := tx.Save(&order).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("更新订单状态失败: %w", err)
		}

		log := &models.OperationLog{
			OrderID:      req.OrderID,
			Operation:    "核验通过",
			OldStatus:    oldStatus,
			NewStatus:    models.StatusPendingReview,
			OperatorID:   userID,
			OperatorName: userName,
			OperatorRole: userRole,
			Remark:       req.Opinion,
		}
		if err := tx.Create(log).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("创建操作日志失败: %w", err)
		}
	} else {
		if req.Opinion == "" {
			tx.Rollback()
			return nil, errors.New("退回时必须填写退回意见")
		}

		oldStatus := order.Status
		now := time.Now()
		order.Status = models.StatusReturned
		order.ReturnReason = &req.Opinion
		order.ReturnedBy = &userID
		order.ReturnedByName = &userName
		order.ReturnedAt = &now
		order.Version++
		order.UpdateAt = now

		if err := tx.Save(&order).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("更新订单状态失败: %w", err)
		}

		log := &models.OperationLog{
			OrderID:      req.OrderID,
			Operation:    "核验退回",
			OldStatus:    oldStatus,
			NewStatus:    models.StatusReturned,
			OperatorID:   userID,
			OperatorName: userName,
			OperatorRole: userRole,
			Remark:       req.Opinion,
		}
		if err := tx.Create(log).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("创建操作日志失败: %w", err)
		}
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("提交事务失败: %w", err)
	}

	return &order, nil
}

func (s *OrderService) ReviewOrder(req *ReviewOrderRequest, userID int64, userName string, userRole models.Role) (*models.InventoryAdjustOrder, error) {
	if userRole != models.RoleOperationManager {
		return nil, errors.New("只有运营经理可以进行复核操作")
	}

	database := db.GetDB()
	tx := database.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var order models.InventoryAdjustOrder
	if err := tx.First(&order, req.OrderID).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("订单不存在")
		}
		return nil, fmt.Errorf("查询订单失败: %w", err)
	}

	if order.Version != req.Version {
		tx.Rollback()
		return nil, fmt.Errorf("版本冲突，当前版本: %d，您的版本: %d，请刷新后重试", order.Version, req.Version)
	}

	if order.Status != models.StatusPendingReview {
		tx.Rollback()
		return nil, fmt.Errorf("当前状态[%s]不允许复核操作，仅待复核状态可以复核", order.Status)
	}

	if req.Pass {
		var reviewCount int64
		tx.Model(&models.OrderEvidence{}).Where("order_id = ? AND type = ?", req.OrderID, models.EvidenceTypeReview).Count(&reviewCount)
		if reviewCount == 0 {
			tx.Rollback()
			return nil, errors.New("缺少复核阶段的证据材料，请上传复核证据后再通过")
		}

		oldStatus := order.Status
		now := time.Now()
		order.Status = models.StatusReviewPassed
		order.ReviewedBy = &userID
		order.ReviewedByName = &userName
		order.ReviewedAt = &now
		order.ReviewOpinion = &req.Opinion
		order.Version++
		order.UpdateAt = now

		if err := tx.Save(&order).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("更新订单状态失败: %w", err)
		}

		log := &models.OperationLog{
			OrderID:      req.OrderID,
			Operation:    "复核通过",
			OldStatus:    oldStatus,
			NewStatus:    models.StatusReviewPassed,
			OperatorID:   userID,
			OperatorName: userName,
			OperatorRole: userRole,
			Remark:       req.Opinion,
		}
		if err := tx.Create(log).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("创建操作日志失败: %w", err)
		}
	} else {
		if req.Opinion == "" {
			tx.Rollback()
			return nil, errors.New("退回时必须填写退回意见")
		}

		oldStatus := order.Status
		now := time.Now()
		order.Status = models.StatusReturned
		order.ReturnReason = &req.Opinion
		order.ReturnedBy = &userID
		order.ReturnedByName = &userName
		order.ReturnedAt = &now
		order.Version++
		order.UpdateAt = now

		if err := tx.Save(&order).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("更新订单状态失败: %w", err)
		}

		log := &models.OperationLog{
			OrderID:      req.OrderID,
			Operation:    "复核退回",
			OldStatus:    oldStatus,
			NewStatus:    models.StatusReturned,
			OperatorID:   userID,
			OperatorName: userName,
			OperatorRole: userRole,
			Remark:       req.Opinion,
		}
		if err := tx.Create(log).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("创建操作日志失败: %w", err)
		}
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("提交事务失败: %w", err)
	}

	return &order, nil
}

func (s *OrderService) ArchiveOrder(req *ArchiveOrderRequest, userID int64, userName string, userRole models.Role) (*models.InventoryAdjustOrder, error) {
	if userRole != models.RoleOperationManager {
		return nil, errors.New("只有运营经理可以进行归档操作")
	}

	database := db.GetDB()
	tx := database.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var order models.InventoryAdjustOrder
	if err := tx.First(&order, req.OrderID).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("订单不存在")
		}
		return nil, fmt.Errorf("查询订单失败: %w", err)
	}

	if order.Version != req.Version {
		tx.Rollback()
		return nil, fmt.Errorf("版本冲突，当前版本: %d，您的版本: %d，请刷新后重试", order.Version, req.Version)
	}

	if order.Status != models.StatusReviewPassed {
		tx.Rollback()
		return nil, fmt.Errorf("当前状态[%s]不允许归档操作，仅复核通过状态可以归档", order.Status)
	}

	oldStatus := order.Status
	now := time.Now()
	order.Status = models.StatusArchived
	order.ArchivedBy = &userID
	order.ArchivedByName = &userName
	order.ArchivedAt = &now
	order.Version++
	order.UpdateAt = now

	if err := tx.Save(&order).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("更新订单状态失败: %w", err)
	}

	log := &models.OperationLog{
		OrderID:      req.OrderID,
		Operation:    "归档",
		OldStatus:    oldStatus,
		NewStatus:    models.StatusArchived,
		OperatorID:   userID,
		OperatorName: userName,
		OperatorRole: userRole,
		Remark:       "运营经理完成归档",
	}
	if err := tx.Create(log).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("创建操作日志失败: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("提交事务失败: %w", err)
	}

	return &order, nil
}

func (s *OrderService) ResubmitOrder(req *SubmitOrderRequest, userID int64, userName string, userRole models.Role) (*models.InventoryAdjustOrder, error) {
	if userRole != models.RoleWarehouseKeeper {
		return nil, errors.New("只有库管员可以重新提交")
	}

	database := db.GetDB()
	tx := database.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var order models.InventoryAdjustOrder
	if err := tx.First(&order, req.OrderID).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("订单不存在")
		}
		return nil, fmt.Errorf("查询订单失败: %w", err)
	}

	if order.Version != req.Version {
		tx.Rollback()
		return nil, fmt.Errorf("版本冲突，当前版本: %d，您的版本: %d，请刷新后重试", order.Version, req.Version)
	}

	if order.Status != models.StatusReturned {
		tx.Rollback()
		return nil, fmt.Errorf("当前状态[%s]不允许重新提交操作，仅已退回状态可以重新提交", order.Status)
	}

	if order.CreatedBy != userID {
		tx.Rollback()
		return nil, errors.New("只能重新提交自己创建的库存调整单")
	}

	var supplementCount int64
	tx.Model(&models.SupplementRecord{}).Where("order_id = ?", req.OrderID).Count(&supplementCount)
	if supplementCount == 0 {
		tx.Rollback()
		return nil, errors.New("被退回的调整单必须先补录修正内容，然后才能重新提交")
	}

	oldStatus := order.Status
	order.Status = models.StatusResubmitted
	order.Version++
	order.UpdateAt = time.Now()

	if err := tx.Save(&order).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("更新订单状态失败: %w", err)
	}

	log := &models.OperationLog{
		OrderID:      req.OrderID,
		Operation:    "重新提交",
		OldStatus:    oldStatus,
		NewStatus:    models.StatusResubmitted,
		OperatorID:   userID,
		OperatorName: userName,
		OperatorRole: userRole,
		Remark:       "已按退回意见补录修正，重新提交核验",
	}
	if err := tx.Create(log).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("创建操作日志失败: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("提交事务失败: %w", err)
	}

	return s.SubmitOrder(&SubmitOrderRequest{OrderID: req.OrderID, Version: order.Version}, userID, userName, userRole)
}

func (s *OrderService) AddSupplement(req *SupplementRequest, userID int64, userName string, userRole models.Role) (*models.SupplementRecord, error) {
	database := db.GetDB()

	var order models.InventoryAdjustOrder
	if err := database.First(&order, req.OrderID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("订单不存在")
		}
		return nil, fmt.Errorf("查询订单失败: %w", err)
	}

	if order.Status == models.StatusArchived {
		return nil, errors.New("已归档的订单不能再补录")
	}

	if userRole == models.RoleWarehouseKeeper && order.CreatedBy != userID {
		return nil, errors.New("库管员只能补录自己创建的订单")
	}

	if userRole == models.RoleWarehouseSupervisor && req.Type != models.SupplementTypeException && req.Type != models.SupplementTypeReview {
		return nil, errors.New("仓储主管只能补录异常或复核类型的记录")
	}

	if req.Type == models.SupplementTypeCorrect && order.Status != models.StatusReturned {
		return nil, errors.New("只有已退回状态的订单才能进行补正类型的补录")
	}

	validTypes := map[models.SupplementType]bool{
		models.SupplementTypeException: true,
		models.SupplementTypeCorrect:   true,
		models.SupplementTypeReview:    true,
	}
	if !validTypes[req.Type] {
		return nil, errors.New("无效的补录类型")
	}

	supplement := &models.SupplementRecord{
		OrderID:            req.OrderID,
		Type:               req.Type,
		Content:            req.Content,
		FieldName:          req.FieldName,
		OldValue:           req.OldValue,
		NewValue:           req.NewValue,
		Reason:             req.Reason,
		SupplementedBy:     userID,
		SupplementedByName: userName,
	}

	if err := database.Create(supplement).Error; err != nil {
		return nil, fmt.Errorf("创建补录记录失败: %w", err)
	}

	log := &models.OperationLog{
		OrderID:      req.OrderID,
		Operation:    "移动补录-" + supplementTypeText(req.Type),
		OperatorID:   userID,
		OperatorName: userName,
		OperatorRole: userRole,
		Remark:       req.Reason + ": " + req.Content,
	}
	database.Create(log)

	return supplement, nil
}

func (s *OrderService) BatchSubmit(req *BatchSubmitRequest, userID int64, userName string, userRole models.Role) (map[string]interface{}, error) {
	if userRole != models.RoleWarehouseKeeper {
		return nil, errors.New("只有库管员可以批量提交")
	}

	successIDs := make([]int64, 0)
	failResults := make([]map[string]interface{}, 0)

	for _, orderID := range req.OrderIDs {
		result, err := s.SubmitOrder(&SubmitOrderRequest{OrderID: orderID, Version: 1}, userID, userName, userRole)
		if err != nil {
			failResults = append(failResults, map[string]interface{}{
				"order_id": orderID,
				"error":    err.Error(),
			})
		} else {
			successIDs = append(successIDs, result.ID)
		}
	}

	return map[string]interface{}{
		"success_count": len(successIDs),
		"fail_count":    len(failResults),
		"success_ids":   successIDs,
		"fail_details":  failResults,
	}, nil
}

func supplementTypeText(t models.SupplementType) string {
	switch t {
	case models.SupplementTypeException:
		return "异常"
	case models.SupplementTypeCorrect:
		return "补正"
	case models.SupplementTypeReview:
		return "复核"
	default:
		return "未知"
	}
}

func (s *OrderService) GetStatistics() (map[string]interface{}, error) {
	database := db.GetDB()

	var total int64
	database.Model(&models.InventoryAdjustOrder{}).Count(&total)

	statusStats := make(map[string]int64)
	statuses := []models.OrderStatus{
		models.StatusPendingSubmit,
		models.StatusReturned,
		models.StatusResubmitted,
		models.StatusPendingVerify,
		models.StatusVerifyPassed,
		models.StatusPendingReview,
		models.StatusReviewPassed,
		models.StatusArchived,
	}
	for _, status := range statuses {
		var count int64
		database.Model(&models.InventoryAdjustOrder{}).Where("status = ?", status).Count(&count)
		statusStats[string(status)] = count
	}

	warehouseStats := make([]map[string]interface{}, 0)
	rows, err := database.Model(&models.InventoryAdjustOrder{}).
		Select("warehouse, count(*) as count").
		Group("warehouse").Rows()
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var warehouse string
			var count int64
			rows.Scan(&warehouse, &count)
			warehouseStats = append(warehouseStats, map[string]interface{}{
				"warehouse": warehouse,
				"count":     count,
			})
		}
	}

	return map[string]interface{}{
		"total":          total,
		"status_stats":   statusStats,
		"warehouse_stats": warehouseStats,
	}, nil
}
