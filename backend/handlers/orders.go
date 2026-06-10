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
	ProductName  string           `json:"productName"`
	ProductSKU   string           `json:"productSku"`
	Quantity     int              `json:"quantity"`
	Amount       float64          `json:"amount"`
	Currency     string           `json:"currency"`
	Platform     string           `json:"platform"`
	BuyerCountry string           `json:"buyerCountry"`
	Materials    []MaterialInput  `json:"materials"`
	DeadlineHours int             `json:"deadlineHours"`
	Remark       string           `json:"remark"`
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

func generateOrderNo() string {
	now := time.Now()
	return "CB" + now.Format("20060102") + uuid.New().String()[:5]
}

func ListOrders(c *fiber.Ctx) error {
	store.GetStore().CheckAndUpdateOverdue()
	user := middleware.GetCurrentUser(c)
	status := c.Query("status")
	isOverdue := c.Query("overdue")
	
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
		
		visible := false
		switch user.Role {
		case models.RoleRegistrar:
			visible = order.RegistrarID == user.ID || order.Status == models.StatusPending || order.Status == models.StatusReturned || order.Status == models.StatusDraft
		case models.RoleSupervisor:
			visible = order.Status == models.StatusPending || order.Status == models.StatusProcessing || order.Status == models.StatusReturned
		case models.RoleReviewer:
			visible = order.Status == models.StatusProcessing || order.Status == models.StatusReviewed || order.Status == models.StatusArchived
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
		visible = order.Status == models.StatusProcessing || order.Status == models.StatusReviewed || order.Status == models.StatusArchived
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
		ID:            uuid.New().String(),
		OrderNo:       generateOrderNo(),
		ProductName:   req.ProductName,
		ProductSKU:    req.ProductSKU,
		Quantity:      req.Quantity,
		Amount:        req.Amount,
		Currency:      req.Currency,
		Platform:      req.Platform,
		BuyerCountry:  req.BuyerCountry,
		Status:        models.StatusDraft,
		RegistrarID:   user.ID,
		RegistrarName: user.Name,
		Materials:     materials,
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
	
	order := store.GetStore().GetOrder(id)
	if order == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "订单不存在",
		})
	}
	
	if order.Version != req.Version {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "订单已被修改，请刷新后重试",
		})
	}
	
	if order.RegistrarID != user.ID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "只能提交自己登记的订单",
		})
	}
	
	if order.Status != models.StatusDraft && order.Status != models.StatusReturned {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "当前状态无法提交审核",
		})
	}
	
	hasRequiredMissing := false
	missingMaterials := make([]string, 0)
	for _, m := range order.Materials {
		if m.Required && !m.Uploaded {
			hasRequiredMissing = true
			missingMaterials = append(missingMaterials, m.Name)
		}
	}
	
	oldStatus := order.Status
	order.Status = models.StatusPending
	if order.IsOverdue {
		order.IsOverdue = false
		order.OverdueReason = ""
		order.NextAction = ""
	}
	
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
	if hasRequiredMissing {
		detail += "（注意：存在未上传的必需材料）"
	}
	addAuditLog(order.ID, order.OrderNo, user, "提交审核", detail, oldStatus, order.Status, c.IP())
	
	result := fiber.Map{
		"order": order,
	}
	if hasRequiredMissing {
		result["warning"] = "存在未上传的必需材料：" + joinStrings(missingMaterials, "、")
	}
	
	return c.JSON(result)
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
	
	order := store.GetStore().GetOrder(id)
	if order == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "订单不存在",
		})
	}
	
	if order.Version != req.Version {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "订单已被修改，请刷新后重试",
		})
	}
	
	if order.Status != models.StatusPending {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "当前状态无法进行审核",
		})
	}
	
	if req.Opinion == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "审核意见不能为空",
		})
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
	
	return c.JSON(order)
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
	
	order := store.GetStore().GetOrder(id)
	if order == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "订单不存在",
		})
	}
	
	if order.Version != req.Version {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "订单已被修改，请刷新后重试",
		})
	}
	
	if order.Status != models.StatusProcessing {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "当前状态无法进行复核",
		})
	}
	
	if req.Opinion == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "复核意见不能为空",
		})
	}
	
	hasRequiredMissing := false
	missingMaterials := make([]string, 0)
	for _, m := range order.Materials {
		if m.Required && !m.Uploaded {
			hasRequiredMissing = true
			missingMaterials = append(missingMaterials, m.Name)
		}
	}
	
	if req.Pass && hasRequiredMissing {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "存在未上传的必需材料，无法通过复核：" + joinStrings(missingMaterials, "、"),
		})
	}
	
	oldStatus := order.Status
	order.ReviewerID = user.ID
	order.ReviewerName = user.Name
	
	if req.Pass {
		order.Status = models.StatusArchived
		order.IsOverdue = false
		order.OverdueReason = ""
		order.NextAction = ""
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
	
	return c.JSON(order)
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
	
	order := store.GetStore().GetOrder(id)
	if order == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "订单不存在",
		})
	}
	
	if order.Version != req.Version {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "订单已被修改，请刷新后重试",
		})
	}
	
	if order.RegistrarID != user.ID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "只能修改自己登记的订单材料",
		})
	}
	
	if order.Status != models.StatusDraft && order.Status != models.StatusReturned {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "当前状态无法修改材料",
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
	
	store.GetStore().SaveOrder(order)
	
	addAuditLog(order.ID, order.OrderNo, user, "更新材料", "更新订单材料清单", order.Status, order.Status, c.IP())
	
	return c.JSON(order)
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
