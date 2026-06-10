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
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "请求格式错误",
		})
	}

	store.GetStore().CheckAndUpdateOverdue()

	order := store.GetStore().GetOrder(id)
	if order == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "订单不存在",
		})
	}

	if order.Version != req.Version {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":        "订单已被修改，请刷新后重试",
			"blockReasons": order.BlockReasons,
			"nextStep":     "刷新页面获取最新订单状态后再提交",
		})
	}

	if order.RegistrarID != user.ID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":    "只能提交自己登记的订单",
			"nextStep": "请联系订单登记员操作",
		})
	}

	if order.Status != models.StatusDraft && order.Status != models.StatusReturned {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":        "当前状态无法提交审核",
			"blockReasons": order.BlockReasons,
			"nextStep":     "请检查订单状态，仅草稿或已退回状态可提交",
		})
	}

	blockReasons := store.ComputeBlockReasons(order)
	hasHardBlocks := store.HasHardBlocks(order)

	if hasHardBlocks {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":        "存在阻断项，无法提交：" + summarizeBlockReasons(blockReasons),
			"blockReasons": blockReasons,
			"nextStep":     "请先解除阻断（补全材料/修复刊登/补库存/等非逾期状态）后再提交；如为逾期订单，请由复核负责人执行人工处置",
		})
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

	detail := "提交订单至审核"
	addAuditLog(order.ID, order.OrderNo, user, "提交审核", detail, oldStatus, order.Status, c.IP())

	return c.JSON(fiber.Map{
		"order":        order,
		"blockReasons": order.BlockReasons,
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
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "订单不存在",
		})
	}

	if order.Version != req.Version {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":        "订单已被修改，请刷新后重试",
			"blockReasons": order.BlockReasons,
			"nextStep":     "刷新页面获取最新订单状态后再操作；两个页面同时操作会导致版本冲突",
		})
	}

	if order.Status != models.StatusPending {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":        "当前状态无法进行审核",
			"blockReasons": order.BlockReasons,
			"nextStep":     "请检查订单状态，仅待审核状态可执行此操作",
		})
	}

	if !req.Pass && req.Opinion == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":    "退回必须填写处理意见",
			"nextStep": "请在下方填写退回原因和补正要求后再提交",
		})
	}

	blockReasons := store.ComputeBlockReasons(order)
	hasHardBlocks := store.HasHardBlockReasons(blockReasons)

	if req.Pass {
		if order.IsOverdue {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":        "订单已逾期，主管无法直接通过，请退回登记员补正或联系复核负责人人工处置",
				"blockReasons": blockReasons,
				"nextStep":     "退回登记员补正材料/刊登/库存；如属紧急订单，由复核负责人执行人工处置流程并记录审批文件",
			})
		}
		if hasHardBlocks {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":        "存在阻断项，不能审核通过：" + summarizeBlockReasons(blockReasons),
				"blockReasons": blockReasons,
				"nextStep":     "退回登记员补正或解除阻断后再审核通过；如属特殊情况，由复核负责人执行人工处置",
			})
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
	if !req.Pass {
		action = "审核退回"
	}
	addAuditLog(order.ID, order.OrderNo, user, action, req.Opinion, oldStatus, order.Status, c.IP())
	return c.JSON(fiber.Map{
		"order":        order,
		"blockReasons": order.BlockReasons,
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
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "订单不存在",
		})
	}

	if order.Version != req.Version {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":        "订单已被修改，请刷新后重试",
			"blockReasons": order.BlockReasons,
			"nextStep":     "刷新页面获取最新订单状态后再操作；两个页面同时操作会导致版本冲突",
		})
	}

	if order.Status != models.StatusProcessing {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":        "当前状态无法进行复核",
			"blockReasons": order.BlockReasons,
			"nextStep":     "请检查订单状态，仅待复核状态可执行此操作",
		})
	}

	if !req.Pass && req.Opinion == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":    "退回必须填写处理意见",
			"nextStep": "请在下方填写退回原因和补正要求后再提交",
		})
	}

	blockReasons := store.ComputeBlockReasons(order)
	hasHardBlocks := store.HasHardBlockReasons(blockReasons)

	if req.Pass {
		if hasHardBlocks {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":        "存在阻断项，不能直接复核通过：" + summarizeBlockReasons(blockReasons),
				"blockReasons": blockReasons,
				"nextStep":     "退回登记员补正；如为逾期或特殊订单，请使用人工处置流程并记录审批文件后归档",
			})
		}
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
	if !req.Pass {
		action = "复核退回"
	}
	addAuditLog(order.ID, order.OrderNo, user, action, req.Opinion, oldStatus, order.Status, c.IP())
	return c.JSON(fiber.Map{
		"order":        order,
		"blockReasons": order.BlockReasons,
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
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "订单不存在",
		})
	}

	if order.Version != req.Version {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":        "订单已被修改，请刷新后重试",
			"blockReasons": order.BlockReasons,
			"nextStep":     "刷新页面获取最新订单状态后再操作；两个页面同时操作会导致版本冲突",
		})
	}

	if order.Status != models.StatusProcessing {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":        "只有待复核的订单可以进行人工处置",
			"blockReasons": order.BlockReasons,
			"nextStep":     "请检查订单状态，仅待复核状态可执行人工处置",
		})
	}

	blockReasons := store.ComputeBlockReasons(order)

	if req.Action == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":        "请选择处置动作（归档或退回）",
			"blockReasons": blockReasons,
			"nextStep":     "选择归档（需审批文件）或退回补正",
		})
	}

	if req.Reason == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":        "请填写处置原因",
			"blockReasons": blockReasons,
			"nextStep":     "详细说明人工处置的原因和背景",
		})
	}

	if req.Action == "archive" && req.ApprovalDoc == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":        "人工归档必须上传审批文件编号",
			"blockReasons": blockReasons,
			"nextStep":     "填写审批文件编号（如 CB-APPROVAL-2026-0610）后再提交",
		})
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

		store.GetStore().SaveOrder(order)
		addAuditLog(order.ID, order.OrderNo, user, "人工处置-归档",
			"原因："+req.Reason+"；审批文件："+req.ApprovalDoc,
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

		store.GetStore().SaveOrder(order)
		addAuditLog(order.ID, order.OrderNo, user, "人工处置-退回",
			"原因："+req.Reason,
			oldStatus, order.Status, c.IP())
	}

	return c.JSON(fiber.Map{
		"order":        order,
		"blockReasons": order.BlockReasons,
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
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "订单不存在",
		})
	}

	if order.Version != req.Version {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":        "订单已被修改，请刷新后重试",
			"blockReasons": order.BlockReasons,
			"nextStep":     "刷新页面获取最新订单状态后再操作；两个页面同时操作会导致版本冲突",
		})
	}

	if order.RegistrarID != user.ID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":    "只能修改自己登记的订单",
			"nextStep": "请联系订单登记员操作",
		})
	}

	if order.Status != models.StatusDraft && order.Status != models.StatusReturned {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":        "当前状态无法更新刊登或库存状态",
			"blockReasons": order.BlockReasons,
			"nextStep":     "请检查订单状态，仅草稿或已退回状态可编辑",
		})
	}

	oldListing := order.ListingStatus
	oldInventory := order.InventoryStatus

	order.ListingStatus = models.ListingStatus(req.ListingStatus)
	order.InventoryStatus = models.InventoryStatus(req.InventoryStatus)
	order.InventoryQuantity = req.InventoryQuantity
	order.ListingURL = req.ListingURL

	blockReasons := store.ComputeBlockReasons(order)
	hasHardBlocks := store.HasHardBlockReasons(blockReasons)

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
	}
	if hasHardBlocks {
		result["warning"] = "更新成功，但仍存在阻断项：" + summarizeBlockReasons(blockReasons) + "。需要全部解除后才能提交。"
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
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "请求格式错误",
		})
	}

	store.GetStore().CheckAndUpdateOverdue()

	order := store.GetStore().GetOrder(id)
	if order == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "订单不存在",
		})
	}

	if order.Version != req.Version {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":        "订单已被修改，请刷新后重试",
			"blockReasons": order.BlockReasons,
			"nextStep":     "刷新页面获取最新订单状态后再操作；两个页面同时操作会导致版本冲突",
		})
	}

	if order.RegistrarID != user.ID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":    "只能修改自己登记的订单材料",
			"nextStep": "请联系订单登记员操作",
		})
	}

	if order.Status != models.StatusDraft && order.Status != models.StatusReturned {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":        "当前状态无法修改材料",
			"blockReasons": order.BlockReasons,
			"nextStep":     "请检查订单状态，仅草稿或已退回状态可编辑",
		})
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

	blockReasons := store.ComputeBlockReasons(order)
	hasHardBlocks := store.HasHardBlockReasons(blockReasons)

	store.GetStore().SaveOrder(order)
	addAuditLog(order.ID, order.OrderNo, user, "更新材料", "更新订单材料清单", order.Status, order.Status, c.IP())

	result := fiber.Map{
		"order":        order,
		"blockReasons": order.BlockReasons,
	}
	if hasHardBlocks {
		result["warning"] = "材料更新成功，但仍存在阻断项：" + summarizeBlockReasons(blockReasons) + "。需要全部解除后才能提交。"
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
