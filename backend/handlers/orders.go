package handlers

import (
	"cross-border-order/middleware"
	"cross-border-order/models"
	"cross-border-order/store"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type CreateOrderRequest struct {
	ProductName       string           `json:"productName"`
	ProductSKU        string           `json:"productSku"`
	Quantity          int              `json:"quantity"`
	Amount            float64          `json:"amount"`
	Currency          string           `json:"currency"`
	Platform          string           `json:"platform"`
	BuyerCountry      string           `json:"buyerCountry"`
	ListingStatus     string           `json:"listingStatus"`
	InventoryStatus   string           `json:"inventoryStatus"`
	InventoryQuantity int              `json:"inventoryQuantity"`
	ListingURL        string           `json:"listingUrl"`
	Materials         []MaterialInput  `json:"materials"`
	DeadlineHours     int              `json:"deadlineHours"`
	Remark            string           `json:"remark"`
}

type MaterialInput struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Uploaded bool   `json:"uploaded"`
	Required bool   `json:"required"`
}

type ProcessOrderRequest struct {
	Opinion string `json:"opinion"`
	Pass    bool   `json:"pass"`
	Version int    `json:"version"`
}

type SubmitOrderRequest struct {
	Version int `json:"version"`
}

type ManualDispositionRequest struct {
	Action      string `json:"action"`
	Reason      string `json:"reason"`
	ApprovalDoc string `json:"approvalDoc"`
	Opinion     string `json:"opinion"`
	Version     int    `json:"version"`
}

type UpdateListingInventoryRequest struct {
	ListingStatus     string `json:"listingStatus"`
	InventoryStatus   string `json:"inventoryStatus"`
	InventoryQuantity int    `json:"inventoryQuantity"`
	ListingURL        string `json:"listingUrl"`
	Version           int    `json:"version"`
}

func generateOrderNo() string {
	now := time.Now()
	return "CB" + now.Format("20060102") + uuid.New().String()[:5]
}

func summarizeBlockReasons(reasons []models.BlockReason) string {
	if len(reasons) == 0 {
		return ""
	}
	msg := ""
	for i, r := range reasons {
		if i > 0 {
			msg += "；"
		}
		msg += r.Reason
	}
	return msg
}

func buildErrorResponse(order *models.CrossBorderOrder, errMsg string, nextStep string) fiber.Map {
	resp := fiber.Map{
		"error":    errMsg,
		"nextStep": nextStep,
	}
	if order != nil {
		resp["orderNo"] = order.OrderNo
		resp["orderId"] = order.ID
		resp["blockReasons"] = order.BlockReasons
		resp["version"] = order.Version
	}
	return resp
}

func ListOrders(c *fiber.Ctx) error {
	store.GetStore().CheckAndUpdateOverdue()
	user := middleware.GetCurrentUser(c)
	status := c.Query("status")
	isOverdue := c.Query("overdue")
	blocked := c.Query("blocked")

	orders := store.GetStore().ListOrders()
	result := make([]*models.CrossBorderOrder, 0)

	for _, order := range orders {
		if status != "" && string(order.Status) != status {
			continue
		}
		if isOverdue == "true" && !order.IsOverdue {
			continue
		}
		if isOverdue == "false" && order.IsOverdue {
			continue
		}
		if blocked == "true" && len(order.BlockReasons) == 0 {
			continue
		}
		if blocked == "false" && len(order.BlockReasons) > 0 {
			continue
		}

		visible := false
		switch user.Role {
		case models.RoleRegistrar:
			visible = order.RegistrarID == user.ID ||
				order.Status == models.StatusPending ||
				order.Status == models.StatusReturned ||
				order.Status == models.StatusDraft
		case models.RoleSupervisor:
			visible = order.Status == models.StatusPending ||
				order.Status == models.StatusProcessing ||
				order.Status == models.StatusReturned
		case models.RoleReviewer:
			visible = order.Status == models.StatusProcessing ||
				order.Status == models.StatusReviewed ||
				order.Status == models.StatusArchived
		}
		if visible {
			result = append(result, order)
		}
	}

	return c.JSON(result)
}

func GetOrder(c *fiber.Ctx) error {
	store.GetStore().CheckAndUpdateOverdue()
	id := c.Params("id")
	order := store.GetStore().GetOrder(id)
	if order == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "订单不存在",
		})
	}

	user := middleware.GetCurrentUser(c)
	visible := false
	switch user.Role {
	case models.RoleRegistrar:
		visible = true
	case models.RoleSupervisor:
		visible = order.Status != models.StatusDraft
	case models.RoleReviewer:
		visible = order.Status == models.StatusProcessing ||
			order.Status == models.StatusReviewed ||
			order.Status == models.StatusArchived
	}

	if !visible {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "无权查看此订单",
		})
	}

	return c.JSON(order)
}

func CreateOrder(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)

	var req CreateOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "请求格式错误",
		})
	}

	if req.ProductName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "商品名称不能为空",
		})
	}
	if req.Quantity <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "数量必须大于0",
		})
	}

	now := time.Now()
	deadlineHours := req.DeadlineHours
	if deadlineHours <= 0 {
		deadlineHours = 48
	}

	listingStatus := models.ListingStatus(req.ListingStatus)
	if listingStatus == "" {
		listingStatus = models.ListingNotDone
	}
	inventoryStatus := models.InventoryStatus(req.InventoryStatus)
	if inventoryStatus == "" {
		inventoryStatus = models.InventoryNotSynced
	}

	materials := make([]models.Material, 0, len(req.Materials))
	for _, m := range req.Materials {
		materials = append(materials, models.Material{
			ID:       uuid.New().String(),
			Name:     m.Name,
			Type:     m.Type,
			Uploaded: m.Uploaded,
			Required: m.Required,
		})
	}

	order := &models.CrossBorderOrder{
		ID:                uuid.New().String(),
		OrderNo:           generateOrderNo(),
		ProductName:       req.ProductName,
		ProductSKU:        req.ProductSKU,
		Quantity:          req.Quantity,
		Amount:            req.Amount,
		Currency:          req.Currency,
		Platform:          req.Platform,
		BuyerCountry:      req.BuyerCountry,
		Status:            models.StatusDraft,
		ListingStatus:     listingStatus,
		InventoryStatus:   inventoryStatus,
		InventoryQuantity: req.InventoryQuantity,
		ListingURL:        req.ListingURL,
		RegistrarID:       user.ID,
		RegistrarName:     user.Name,
		Materials:         materials,
		Opinions: []models.OrderOpinion{
			{
				UserID:   user.ID,
				UserName: user.Name,
				Role:     user.Role,
				Content:  "创建订单草稿",
				Time:     now,
				Pass:     true,
			},
		},
		CreatedAt:    now,
		UpdatedAt:    now,
		Deadline:     now.Add(time.Duration(deadlineHours) * time.Hour),
		WarningHours: 6,
		IsOverdue:    false,
		Version:      1,
		Remark:       req.Remark,
	}

	store.GetStore().AddOrder(order)

	addAuditLog(order.ID, order.OrderNo, user, "创建订单", "创建跨境订单草稿", "", order.Status, c.IP())
	return c.JSON(order)
}

func SubmitOrder(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	var req SubmitOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(buildErrorResponse(nil, "请求格式错误", "请检查提交的参数是否完整"))
	}

	store.GetStore().CheckAndUpdateOverdue()

	order := store.GetStore().GetOrder(id)
	if order == nil {
		return c.Status(fiber.StatusNotFound).JSON(buildErrorResponse(nil, "订单不存在", "请确认订单ID是否正确"))
	}

	if order.Version != req.Version {
		return c.Status(fiber.StatusConflict).JSON(buildErrorResponse(
			order,
			"订单已被修改，版本冲突",
			"刷新页面获取最新订单状态后再操作；两个页面同时操作同一订单会导致版本冲突",
		))
	}

	if order.RegistrarID != user.ID {
		return c.Status(fiber.StatusForbidden).JSON(buildErrorResponse(
			order,
			"无权限提交此订单",
			"只能提交自己登记的订单；如需操作请联系订单登记员",
		))
	}

	if order.Status != models.StatusDraft && order.Status != models.StatusReturned {
		return c.Status(fiber.StatusBadRequest).JSON(buildErrorResponse(
			order,
			"当前状态无法提交审核",
			"仅草稿或已退回状态可提交，请检查订单状态",
		))
	}

	if store.HasHardBlocks(order) {
		blockReasons := store.ComputeBlockReasons(order)
		return c.Status(fiber.StatusBadRequest).JSON(buildErrorResponse(
			order,
			"存在阻断项，无法提交："+summarizeBlockReasons(blockReasons),
			order.NextAction,
		))
	}

	oldStatus := order.Status
	order.Status = models.StatusPending

	now := time.Now()
	order.Opinions = append(order.Opinions, models.OrderOpinion{
		UserID:   user.ID,
		UserName: user.Name,
		Role:     user.Role,
		Content:  "提交审核",
		Time:     now,
		Pass:     true,
	})

	store.GetStore().SaveOrder(order)

	detail := "提交订单至审核【提交时无阻断项】"
	addAuditLog(order.ID, order.OrderNo, user, "提交审核", detail, oldStatus, order.Status, c.IP())

	return c.JSON(fiber.Map{
		"order":        order,
		"blockReasons": order.BlockReasons,
		"nextAction":   order.NextAction,
	})
}

func SupervisorProcess(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	var req ProcessOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "请求格式错误",
		})
	}

	store.GetStore().CheckAndUpdateOverdue()

	order := store.GetStore().GetOrder(id)
	if order == nil {
		return c.Status(fiber.StatusNotFound).JSON(buildErrorResponse(nil, "订单不存在", "请确认订单ID是否正确"))
	}

	if order.Version != req.Version {
		return c.Status(fiber.StatusConflict).JSON(buildErrorResponse(
			order,
			"订单已被修改，版本冲突",
			"刷新页面获取最新订单状态后再操作；两个页面同时操作同一订单会导致版本冲突",
		))
	}

	if order.Status != models.StatusPending {
		return c.Status(fiber.StatusBadRequest).JSON(buildErrorResponse(
			order,
			"当前状态无法进行审核",
			"仅待审核状态可执行审核操作，请检查订单状态",
		))
	}

	if !req.Pass && req.Opinion == "" {
		return c.Status(fiber.StatusBadRequest).JSON(buildErrorResponse(
			order,
			"退回必须填写处理意见",
			"请填写退回原因和补正要求后再提交",
		))
	}

	if req.Pass {
		if order.IsOverdue {
			return c.Status(fiber.StatusBadRequest).JSON(buildErrorResponse(
				order,
				"订单已逾期，主管无法直接通过",
				order.NextAction,
			))
		}
		if store.HasHardBlocks(order) {
			return c.Status(fiber.StatusBadRequest).JSON(buildErrorResponse(
				order,
				"存在阻断项，不能审核通过："+summarizeBlockReasons(store.ComputeBlockReasons(order)),
				order.NextAction,
			))
		}
	}

	oldStatus := order.Status
	order.SupervisorID = user.ID
	order.SupervisorName = user.Name

	if req.Pass {
		order.Status = models.StatusProcessing
	} else {
		order.Status = models.StatusReturned
		order.ReturnReason = req.Opinion
	}

	now := time.Now()
	order.Opinions = append(order.Opinions, models.OrderOpinion{
		UserID:   user.ID,
		UserName: user.Name,
		Role:     user.Role,
		Content:  req.Opinion,
		Time:     now,
		Pass:     req.Pass,
	})

	store.GetStore().SaveOrder(order)

	action := "审核通过"
	detail := req.Opinion
	if !req.Pass {
		action = "审核退回"
		if len(order.BlockReasons) > 0 {
			detail += "【阻断项：" + summarizeBlockReasons(order.BlockReasons) + "】"
		}
	} else {
		detail += "【提交时无阻断项，审核通过】"
	}
	addAuditLog(order.ID, order.OrderNo, user, action, detail, oldStatus, order.Status, c.IP())
	return c.JSON(fiber.Map{
		"order":        order,
		"blockReasons": order.BlockReasons,
		"nextAction":   order.NextAction,
	})
}

func ReviewerProcess(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	var req ProcessOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "请求格式错误",
		})
	}

	store.GetStore().CheckAndUpdateOverdue()

	order := store.GetStore().GetOrder(id)
	if order == nil {
		return c.Status(fiber.StatusNotFound).JSON(buildErrorResponse(nil, "订单不存在", "请确认订单ID是否正确"))
	}

	if order.Version != req.Version {
		return c.Status(fiber.StatusConflict).JSON(buildErrorResponse(
			order,
			"订单已被修改，版本冲突",
			"刷新页面获取最新订单状态后再操作；两个页面同时操作同一订单会导致版本冲突",
		))
	}

	if order.Status != models.StatusProcessing {
		return c.Status(fiber.StatusBadRequest).JSON(buildErrorResponse(
			order,
			"当前状态无法进行复核",
			"仅待复核状态可执行复核操作，请检查订单状态",
		))
	}

	if !req.Pass && req.Opinion == "" {
		return c.Status(fiber.StatusBadRequest).JSON(buildErrorResponse(
			order,
			"退回必须填写处理意见",
			"请填写退回原因和补正要求后再提交",
		))
	}

	if req.Pass && store.HasHardBlocks(order) {
		return c.Status(fiber.StatusBadRequest).JSON(buildErrorResponse(
			order,
			"存在阻断项，不能直接复核通过："+summarizeBlockReasons(store.ComputeBlockReasons(order)),
			order.NextAction,
		))
	}

	oldStatus := order.Status
	order.ReviewerID = user.ID
	order.ReviewerName = user.Name

	if req.Pass {
		order.Status = models.StatusArchived
		order.IsOverdue = false
		order.OverdueReason = ""
	} else {
		order.Status = models.StatusReturned
		order.ReturnReason = req.Opinion
	}

	now := time.Now()
	order.Opinions = append(order.Opinions, models.OrderOpinion{
		UserID:   user.ID,
		UserName: user.Name,
		Role:     user.Role,
		Content:  req.Opinion,
		Time:     now,
		Pass:     req.Pass,
	})

	store.GetStore().SaveOrder(order)

	action := "复核通过并归档"
	detail := req.Opinion
	if !req.Pass {
		action = "复核退回"
		if len(order.BlockReasons) > 0 {
			detail += "【阻断项：" + summarizeBlockReasons(order.BlockReasons) + "】"
		}
	} else {
		detail += "【复核时无阻断项，归档成功】"
	}
	addAuditLog(order.ID, order.OrderNo, user, action, detail, oldStatus, order.Status, c.IP())
	return c.JSON(fiber.Map{
		"order":        order,
		"blockReasons": order.BlockReasons,
		"nextAction":   order.NextAction,
	})
}

func ManualDisposition(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	if user.Role != models.RoleReviewer {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":    "只有跨境电商复核负责人可以执行人工处置",
			"nextStep": "请联系跨境电商复核负责人操作",
		})
	}

	id := c.Params("id")
	var req ManualDispositionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "请求格式错误",
		})
	}

	store.GetStore().CheckAndUpdateOverdue()

	order := store.GetStore().GetOrder(id)
	if order == nil {
		return c.Status(fiber.StatusNotFound).JSON(buildErrorResponse(nil, "订单不存在", "请确认订单ID是否正确"))
	}

	if order.Version != req.Version {
		return c.Status(fiber.StatusConflict).JSON(buildErrorResponse(
			order,
			"订单已被修改，版本冲突",
			"刷新页面获取最新订单状态后再操作；两个页面同时操作同一订单会导致版本冲突",
		))
	}

	if order.Status != models.StatusProcessing {
		return c.Status(fiber.StatusBadRequest).JSON(buildErrorResponse(
			order,
			"只有待复核的订单可以进行人工处置",
			"请检查订单状态，仅待复核状态可执行人工处置",
		))
	}

	if req.Action == "" {
		return c.Status(fiber.StatusBadRequest).JSON(buildErrorResponse(
			order,
			"请选择处置动作",
			"选择归档（需审批文件）或退回补正",
		))
	}

	if req.Reason == "" {
		return c.Status(fiber.StatusBadRequest).JSON(buildErrorResponse(
			order,
			"请填写处置原因",
			"详细说明人工处置的原因和背景",
		))
	}

	if req.Action == "archive" && req.ApprovalDoc == "" {
		return c.Status(fiber.StatusBadRequest).JSON(buildErrorResponse(
			order,
			"人工归档必须上传审批文件编号",
			"填写审批文件编号（如 CB-APPROVAL-2026-0610）后再提交",
		))
	}

	now := time.Now()
	oldStatus := order.Status

	disposition := models.ManualDisposition{
		UserID:      user.ID,
		UserName:    user.Name,
		Role:        user.Role,
		Action:      req.Action,
		Reason:      req.Reason,
		ApprovalDoc: req.ApprovalDoc,
		Time:        now,
	}

	if order.ManualDispositions == nil {
		order.ManualDispositions = make([]models.ManualDisposition, 0)
	}
	order.ManualDispositions = append(order.ManualDispositions, disposition)

	if req.Action == "archive" {
		order.ReviewerID = user.ID
		order.ReviewerName = user.Name
		order.Status = models.StatusArchived
		order.IsOverdue = false
		order.OverdueReason = ""

		opinionText := req.Reason
		if req.ApprovalDoc != "" {
			opinionText += "（审批文件：" + req.ApprovalDoc + "）"
		}
		if req.Opinion != "" {
			opinionText += " " + req.Opinion
		}
		order.Opinions = append(order.Opinions, models.OrderOpinion{
			UserID:   user.ID,
			UserName: user.Name,
			Role:     user.Role,
			Content:  "[人工处置-归档] " + opinionText,
			Time:     now,
			Pass:     true,
		})

		archiveDetail := "原因：" + req.Reason + "；审批文件：" + req.ApprovalDoc
		if len(order.BlockReasons) > 0 {
			archiveDetail += "【归档时阻断项：" + summarizeBlockReasons(order.BlockReasons) + "】"
		}
		store.GetStore().SaveOrder(order)
		addAuditLog(order.ID, order.OrderNo, user, "人工处置-归档",
			archiveDetail,
			oldStatus, order.Status, c.IP())
	} else {
		order.Status = models.StatusReturned
		order.ReturnReason = req.Reason + "（人工退回）"

		opinionText := req.Reason
		if req.Opinion != "" {
			opinionText += " " + req.Opinion
		}
		order.Opinions = append(order.Opinions, models.OrderOpinion{
			UserID:   user.ID,
			UserName: user.Name,
			Role:     user.Role,
			Content:  "[人工处置-退回] " + opinionText,
			Time:     now,
			Pass:     false,
		})

		returnDetail := "原因：" + req.Reason
		if len(order.BlockReasons) > 0 {
			returnDetail += "【退回时阻断项：" + summarizeBlockReasons(order.BlockReasons) + "】"
		}
		store.GetStore().SaveOrder(order)
		addAuditLog(order.ID, order.OrderNo, user, "人工处置-退回",
			returnDetail,
			oldStatus, order.Status, c.IP())
	}

	return c.JSON(fiber.Map{
		"order":        order,
		"blockReasons": order.BlockReasons,
		"nextAction":   order.NextAction,
	})
}

func UpdateListingInventory(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	var req UpdateListingInventoryRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "请求格式错误",
		})
	}

	store.GetStore().CheckAndUpdateOverdue()

	order := store.GetStore().GetOrder(id)
	if order == nil {
		return c.Status(fiber.StatusNotFound).JSON(buildErrorResponse(nil, "订单不存在", "请确认订单ID是否正确"))
	}

	if order.Version != req.Version {
		return c.Status(fiber.StatusConflict).JSON(buildErrorResponse(
			order,
			"订单已被修改，版本冲突",
			"刷新页面获取最新订单状态后再操作；两个页面同时操作同一订单会导致版本冲突",
		))
	}

	if order.RegistrarID != user.ID {
		return c.Status(fiber.StatusForbidden).JSON(buildErrorResponse(
			order,
			"无权限修改此订单",
			"只能修改自己登记的订单；如需操作请联系订单登记员",
		))
	}

	if order.Status != models.StatusDraft && order.Status != models.StatusReturned {
		return c.Status(fiber.StatusBadRequest).JSON(buildErrorResponse(
			order,
			"当前状态无法更新刊登或库存状态",
			"仅草稿或已退回状态可编辑，请检查订单状态",
		))
	}

	oldListing := order.ListingStatus
	oldInventory := order.InventoryStatus

	order.ListingStatus = models.ListingStatus(req.ListingStatus)
	order.InventoryStatus = models.InventoryStatus(req.InventoryStatus)
	order.InventoryQuantity = req.InventoryQuantity
	order.ListingURL = req.ListingURL

	detail := "更新刊登状态：" + string(oldListing) + "→" + string(order.ListingStatus) +
		"；库存状态：" + string(oldInventory) + "→" + string(order.InventoryStatus)

	now := time.Now()
	order.Opinions = append(order.Opinions, models.OrderOpinion{
		UserID:   user.ID,
		UserName: user.Name,
		Role:     user.Role,
		Content:  detail,
		Time:     now,
		Pass:     true,
	})

	store.GetStore().SaveOrder(order)
	addAuditLog(order.ID, order.OrderNo, user, "更新刊登/库存", detail, order.Status, order.Status, c.IP())

	result := fiber.Map{
		"order":        order,
		"blockReasons": order.BlockReasons,
		"nextAction":   order.NextAction,
	}
	if store.HasHardBlocks(order) {
		result["warning"] = "更新成功，但仍存在阻断项：" + summarizeBlockReasons(order.BlockReasons) + "。需要全部解除后才能提交。"
	}

	return c.JSON(result)
}

func UpdateMaterials(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	id := c.Params("id")

	var req struct {
		Materials []MaterialInput `json:"materials"`
		Version   int             `json:"version"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(buildErrorResponse(nil, "请求格式错误", "请检查提交的材料数据格式"))
	}

	store.GetStore().CheckAndUpdateOverdue()

	order := store.GetStore().GetOrder(id)
	if order == nil {
		return c.Status(fiber.StatusNotFound).JSON(buildErrorResponse(nil, "订单不存在", "请确认订单ID是否正确"))
	}

	if order.Version != req.Version {
		return c.Status(fiber.StatusConflict).JSON(buildErrorResponse(
			order,
			"订单已被修改，版本冲突",
			"刷新页面获取最新订单状态后再操作；两个页面同时操作同一订单会导致版本冲突",
		))
	}

	if order.RegistrarID != user.ID {
		return c.Status(fiber.StatusForbidden).JSON(buildErrorResponse(
			order,
			"无权限修改此订单材料",
			"只能修改自己登记的订单材料；如需操作请联系订单登记员",
		))
	}

	if order.Status != models.StatusDraft && order.Status != models.StatusReturned {
		return c.Status(fiber.StatusBadRequest).JSON(buildErrorResponse(
			order,
			"当前状态无法修改材料",
			"仅草稿或已退回状态可编辑材料，请检查订单状态",
		))
	}

	oldMaterials := order.Materials
	order.Materials = make([]models.Material, 0, len(req.Materials))
	for _, m := range req.Materials {
		mid := m.Name
		for _, om := range oldMaterials {
			if om.Name == m.Name || om.Type == m.Type {
				mid = om.ID
				break
			}
		}
		if mid == m.Name {
			mid = uuid.New().String()
		}
		order.Materials = append(order.Materials, models.Material{
			ID:       mid,
			Name:     m.Name,
			Type:     m.Type,
			Uploaded: m.Uploaded,
			Required: m.Required,
		})
	}

	store.GetStore().SaveOrder(order)
	addAuditLog(order.ID, order.OrderNo, user, "更新材料", "更新订单材料清单", order.Status, order.Status, c.IP())

	result := fiber.Map{
		"order":        order,
		"blockReasons": order.BlockReasons,
		"nextAction":   order.NextAction,
	}
	if store.HasHardBlocks(order) {
		result["warning"] = "材料更新成功，但仍存在阻断项：" + summarizeBlockReasons(order.BlockReasons) + "。需要全部解除后才能提交。"
	}

	return c.JSON(result)
}

func addAuditLog(orderID, orderNo string, user *models.User, action, detail string, oldStatus, newStatus models.OrderStatus, ip string) {
	log := &models.AuditLog{
		ID:        uuid.New().String(),
		OrderID:   orderID,
		OrderNo:   orderNo,
		UserID:    user.ID,
		UserName:  user.Name,
		Role:      user.Role,
		Action:    action,
		Detail:    detail,
		OldStatus: oldStatus,
		NewStatus: newStatus,
		Time:      time.Now(),
		IP:        ip,
	}
	store.GetStore().AddAuditLog(log)
}

func joinStrings(arr []string, sep string) string {
	result := ""
	for i, s := range arr {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}
