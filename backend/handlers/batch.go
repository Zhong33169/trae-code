package handlers

import (
	"cross-border-order/middleware"
	"cross-border-order/models"
	"cross-border-order/store"
	"time"

	"github.com/gofiber/fiber/v2"
)

type BatchRequest struct {
	OrderIDs []string `json:"orderIds"`
	Opinion  string   `json:"opinion"`
	Pass     bool     `json:"pass"`
	Versions []int    `json:"versions"`
}

func BatchSupervisorProcess(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	
	var req BatchRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "请求格式错误",
		})
	}
	
	if len(req.OrderIDs) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "请选择要处理的订单",
		})
	}
	
	if req.Opinion == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "处理意见不能为空",
		})
	}
	
	result := &models.BatchResult{
		Total: len(req.OrderIDs),
		Items: make([]models.BatchResultItem, 0, len(req.OrderIDs)),
	}
	
	s := store.GetStore()
	
	for i, orderID := range req.OrderIDs {
		order := s.GetOrder(orderID)
		item := models.BatchResultItem{
			OrderID: orderID,
		}
		
		if order == nil {
			item.OrderNo = "未知"
			item.Success = false
			item.Reason = "订单不存在"
			item.NextStep = "请刷新列表后重试"
			result.Items = append(result.Items, item)
			result.Failed++
			continue
		}
		
		item.OrderNo = order.OrderNo
		
		if i < len(req.Versions) && order.Version != req.Versions[i] {
			item.Success = false
			item.Reason = "订单已被修改，版本冲突"
			item.NextStep = "请刷新页面后重新操作"
			result.Items = append(result.Items, item)
			result.Failed++
			continue
		}
		
		if order.Status != models.StatusPending {
			item.Success = false
			item.Reason = "订单状态不是待审核，当前状态：" + statusText(order.Status)
			item.NextStep = "请检查订单状态，只有待审核的订单才能批量审核"
			result.Items = append(result.Items, item)
			result.Failed++
			continue
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
			Content:  req.Opinion + "（批量处理）",
			Time:     now,
			Pass:     req.Pass,
		})
		
		s.SaveOrder(order)
		
		action := "批量审核通过"
		if !req.Pass {
			action = "批量审核退回"
		}
		addAuditLog(order.ID, order.OrderNo, user, action, req.Opinion, oldStatus, order.Status, c.IP())
		
		item.Success = true
		item.Reason = ""
		item.NextStep = ""
		result.Items = append(result.Items, item)
		result.Success++
	}
	
	return c.JSON(result)
}

func BatchReviewerProcess(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	
	var req BatchRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "请求格式错误",
		})
	}
	
	if len(req.OrderIDs) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "请选择要处理的订单",
		})
	}
	
	if req.Opinion == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "处理意见不能为空",
		})
	}
	
	result := &models.BatchResult{
		Total: len(req.OrderIDs),
		Items: make([]models.BatchResultItem, 0, len(req.OrderIDs)),
	}
	
	s := store.GetStore()
	
	for i, orderID := range req.OrderIDs {
		order := s.GetOrder(orderID)
		item := models.BatchResultItem{
			OrderID: orderID,
		}
		
		if order == nil {
			item.OrderNo = "未知"
			item.Success = false
			item.Reason = "订单不存在"
			item.NextStep = "请刷新列表后重试"
			result.Items = append(result.Items, item)
			result.Failed++
			continue
		}
		
		item.OrderNo = order.OrderNo
		
		if i < len(req.Versions) && order.Version != req.Versions[i] {
			item.Success = false
			item.Reason = "订单已被修改，版本冲突"
			item.NextStep = "请刷新页面后重新操作"
			result.Items = append(result.Items, item)
			result.Failed++
			continue
		}
		
		if order.Status != models.StatusProcessing {
			item.Success = false
			item.Reason = "订单状态不是待复核，当前状态：" + statusText(order.Status)
			item.NextStep = "请检查订单状态，只有待复核的订单才能批量复核"
			result.Items = append(result.Items, item)
			result.Failed++
			continue
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
			item.Success = false
			item.Reason = "存在未上传的必需材料：" + joinStrings(missingMaterials, "、")
			item.NextStep = "请先补齐材料后再复核通过"
			result.Items = append(result.Items, item)
			result.Failed++
			continue
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
			Content:  req.Opinion + "（批量处理）",
			Time:     now,
			Pass:     req.Pass,
		})
		
		s.SaveOrder(order)
		
		action := "批量复核通过"
		if !req.Pass {
			action = "批量复核退回"
		}
		addAuditLog(order.ID, order.OrderNo, user, action, req.Opinion, oldStatus, order.Status, c.IP())
		
		item.Success = true
		item.Reason = ""
		item.NextStep = ""
		result.Items = append(result.Items, item)
		result.Success++
	}
	
	return c.JSON(result)
}

func BatchSubmitOrders(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	
	var req BatchRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "请求格式错误",
		})
	}
	
	if len(req.OrderIDs) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "请选择要提交的订单",
		})
	}
	
	result := &models.BatchResult{
		Total: len(req.OrderIDs),
		Items: make([]models.BatchResultItem, 0, len(req.OrderIDs)),
	}
	
	s := store.GetStore()
	
	for i, orderID := range req.OrderIDs {
		order := s.GetOrder(orderID)
		item := models.BatchResultItem{
			OrderID: orderID,
		}
		
		if order == nil {
			item.OrderNo = "未知"
			item.Success = false
			item.Reason = "订单不存在"
			item.NextStep = "请刷新列表后重试"
			result.Items = append(result.Items, item)
			result.Failed++
			continue
		}
		
		item.OrderNo = order.OrderNo
		
		if order.RegistrarID != user.ID {
			item.Success = false
			item.Reason = "不是您登记的订单"
			item.NextStep = "只能提交自己登记的订单"
			result.Items = append(result.Items, item)
			result.Failed++
			continue
		}
		
		if i < len(req.Versions) && order.Version != req.Versions[i] {
			item.Success = false
			item.Reason = "订单已被修改，版本冲突"
			item.NextStep = "请刷新页面后重新操作"
			result.Items = append(result.Items, item)
			result.Failed++
			continue
		}
		
		if order.Status != models.StatusDraft && order.Status != models.StatusReturned {
			item.Success = false
			item.Reason = "订单当前状态无法提交，当前状态：" + statusText(order.Status)
			item.NextStep = "请检查订单状态"
			result.Items = append(result.Items, item)
			result.Failed++
			continue
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
			Content:  "批量提交审核",
			Time:     now,
			Pass:     true,
		})
		
		s.SaveOrder(order)
		
		addAuditLog(order.ID, order.OrderNo, user, "批量提交", "批量提交订单审核", oldStatus, order.Status, c.IP())
		
		hasWarning := false
		warningMaterials := make([]string, 0)
		for _, m := range order.Materials {
			if m.Required && !m.Uploaded {
				hasWarning = true
				warningMaterials = append(warningMaterials, m.Name)
			}
		}
		
		item.Success = true
		if hasWarning {
			item.Reason = "已提交，但存在未上传的必需材料：" + joinStrings(warningMaterials, "、")
			item.NextStep = "请尽快补充材料，以免影响审核进度"
		}
		result.Items = append(result.Items, item)
		result.Success++
	}
	
	return c.JSON(result)
}

func statusText(status models.OrderStatus) string {
	switch status {
	case models.StatusDraft:
		return "草稿"
	case models.StatusPending:
		return "待审核"
	case models.StatusReturned:
		return "已退回"
	case models.StatusProcessing:
		return "待复核"
	case models.StatusReviewed:
		return "已复核"
	case models.StatusArchived:
		return "已归档"
	default:
		return "未知"
	}
}
