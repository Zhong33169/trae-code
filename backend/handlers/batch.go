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
		return string(status)
	}
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

	s.CheckAndUpdateOverdue()

	for i, orderID := range req.OrderIDs {
		order := s.GetOrder(orderID)
		item := models.BatchResultItem{OrderID: orderID}
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
			item.BlockReasons = order.BlockReasons
			result.Items = append(result.Items, item)
			result.Failed++
			continue
		}
		if i < len(req.Versions) && order.Version != req.Versions[i] {
			item.Success = false
			item.Reason = "订单已被修改，版本冲突"
			item.NextStep = "请刷新页面后重新操作；两个页面同时操作会导致版本冲突"
			item.BlockReasons = order.BlockReasons
			result.Items = append(result.Items, item)
			result.Failed++
			continue
		}
		if order.Status != models.StatusDraft && order.Status != models.StatusReturned {
			item.Success = false
			item.Reason = "订单当前状态无法提交，当前状态：" + statusText(order.Status)
			item.NextStep = "请检查订单状态，仅草稿或已退回状态可提交"
			item.BlockReasons = order.BlockReasons
			result.Items = append(result.Items, item)
			result.Failed++
			continue
		}

		blockReasons := store.ComputeBlockReasons(order)
		hasHardBlocks := store.HasHardBlockReasons(blockReasons)

		if hasHardBlocks {
			item.Success = false
			item.Reason = "存在阻断项，无法提交：" + summarizeBlockReasons(blockReasons)
			item.NextStep = "请先解除阻断（补全材料/修复刊登/补库存/等非逾期状态）后再提交；如为逾期订单，请由复核负责人执行人工处置"
			item.BlockReasons = blockReasons
			result.Items = append(result.Items, item)
			result.Failed++
			continue
		}

		oldStatus := order.Status
		order.Status = models.StatusPending
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

		item.Success = true
		item.BlockReasons = order.BlockReasons
		result.Items = append(result.Items, item)
		result.Success++
	}

	return c.JSON(result)
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
	if !req.Pass && req.Opinion == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":    "退回必须填写处理意见",
			"nextStep": "请填写退回原因和补正要求后再提交",
		})
	}

	result := &models.BatchResult{
		Total: len(req.OrderIDs),
		Items: make([]models.BatchResultItem, 0, len(req.OrderIDs)),
	}
	s := store.GetStore()

	s.CheckAndUpdateOverdue()

	for i, orderID := range req.OrderIDs {
		order := s.GetOrder(orderID)
		item := models.BatchResultItem{OrderID: orderID}
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
			item.NextStep = "请刷新页面后重新操作；两个页面同时操作会导致版本冲突"
			item.BlockReasons = order.BlockReasons
			result.Items = append(result.Items, item)
			result.Failed++
			continue
		}
		if order.Status != models.StatusPending {
			item.Success = false
			item.Reason = "订单状态不是待审核，当前状态：" + statusText(order.Status)
			item.NextStep = "请检查订单状态，只有待审核的订单才能批量审核"
			item.BlockReasons = order.BlockReasons
			result.Items = append(result.Items, item)
			result.Failed++
			continue
		}

		if req.Pass {
			blockReasons := store.ComputeBlockReasons(order)

			if order.IsOverdue {
				item.Success = false
				item.Reason = "订单已逾期，主管不能直接审核通过"
				item.NextStep = "请退回登记员补正材料/刊登/库存；如属紧急订单，由复核负责人执行人工处置流程并记录审批文件"
				item.BlockReasons = blockReasons
				result.Items = append(result.Items, item)
				result.Failed++
				continue
			}
			if store.HasHardBlockReasons(blockReasons) {
				item.Success = false
				item.Reason = "存在阻断项，不能审核通过：" + summarizeBlockReasons(blockReasons)
				item.NextStep = "退回登记员补正或解除阻断后再审核通过；如属特殊情况，由复核负责人执行人工处置"
				item.BlockReasons = blockReasons
				result.Items = append(result.Items, item)
				result.Failed++
				continue
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
		item.BlockReasons = order.BlockReasons
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
	if !req.Pass && req.Opinion == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":    "退回必须填写处理意见",
			"nextStep": "请填写退回原因和补正要求后再提交",
		})
	}

	result := &models.BatchResult{
		Total: len(req.OrderIDs),
		Items: make([]models.BatchResultItem, 0, len(req.OrderIDs)),
	}
	s := store.GetStore()

	s.CheckAndUpdateOverdue()

	for i, orderID := range req.OrderIDs {
		order := s.GetOrder(orderID)
		item := models.BatchResultItem{OrderID: orderID}
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
			item.NextStep = "请刷新页面后重新操作；两个页面同时操作会导致版本冲突"
			item.BlockReasons = order.BlockReasons
			result.Items = append(result.Items, item)
			result.Failed++
			continue
		}
		if order.Status != models.StatusProcessing {
			item.Success = false
			item.Reason = "订单状态不是待复核，当前状态：" + statusText(order.Status)
			item.NextStep = "请检查订单状态，只有待复核的订单才能批量复核"
			item.BlockReasons = order.BlockReasons
			result.Items = append(result.Items, item)
			result.Failed++
			continue
		}

		if req.Pass {
			blockReasons := store.ComputeBlockReasons(order)

			if store.HasHardBlockReasons(blockReasons) {
				item.Success = false
				item.Reason = "存在阻断项，不能直接复核通过：" + summarizeBlockReasons(blockReasons)
				item.NextStep = "请退回登记员补正；如为逾期或特殊订单，请进入订单详情使用人工处置流程并记录审批文件后归档"
				item.BlockReasons = blockReasons
				result.Items = append(result.Items, item)
				result.Failed++
				continue
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
			Content:  req.Opinion + "（批量处理）",
			Time:     now,
			Pass:     req.Pass,
		})
		s.SaveOrder(order)

		action := "批量复核通过并归档"
		if !req.Pass {
			action = "批量复核退回"
		}
		addAuditLog(order.ID, order.OrderNo, user, action, req.Opinion, oldStatus, order.Status, c.IP())

		item.Success = true
		item.BlockReasons = order.BlockReasons
		result.Items = append(result.Items, item)
		result.Success++
	}

	return c.JSON(result)
}
