package store

import (
	"cross-border-order/models"
	"sync"
	"time"

	"github.com/google/uuid"
)

type Store struct {
	mu        sync.RWMutex
	users     map[string]*models.User
	orders    map[string]*models.CrossBorderOrder
	auditLogs []*models.AuditLog
	tokens    map[string]string
}

var instance *Store
var once sync.Once

func GetStore() *Store {
	once.Do(func() {
		instance = &Store{
			users:     make(map[string]*models.User),
			orders:    make(map[string]*models.CrossBorderOrder),
			auditLogs: make([]*models.AuditLog, 0),
			tokens:    make(map[string]string),
		}
		instance.initUsers()
		instance.initOrders()
	})
	return instance
}

func (s *Store) initUsers() {
	s.users["u1"] = &models.User{
		ID:       "u1",
		Username: "registrar",
		Role:     models.RoleRegistrar,
		Name:     "张伟-跨境登记员",
	}
	s.users["u2"] = &models.User{
		ID:       "u2",
		Username: "supervisor",
		Role:     models.RoleSupervisor,
		Name:     "李娜-跨境审核主管",
	}
	s.users["u3"] = &models.User{
		ID:       "u3",
		Username: "reviewer",
		Role:     models.RoleReviewer,
		Name:     "王强-跨境电商复核负责人",
	}
}

func (s *Store) initOrders() {
	now := time.Now()
	mkMaterials := func(specs [][3]interface{}) []models.Material {
		out := make([]models.Material, 0, len(specs))
		for _, sp := range specs {
			out = append(out, models.Material{
				ID:       uuid.New().String(),
				Name:     sp[0].(string),
				Type:     sp[1].(string),
				Uploaded: sp[2].(bool),
				Required: true,
			})
		}
		return out
	}
	_ = mkMaterials

	demoOrders := []*models.CrossBorderOrder{
		// 1. 待审核 - 资料齐全、刊登OK、库存OK（正常推进场景）
		{
			ID:                uuid.New().String(),
			OrderNo:           "CB20260610001",
			ProductName:       "无线蓝牙耳机 Pro",
			ProductSKU:        "SKU-WHP-001",
			Quantity:          50,
			Amount:            2999.50,
			Currency:          "USD",
			Platform:          "Amazon",
			BuyerCountry:      "US",
			Status:            models.StatusPending,
			ListingStatus:     models.ListingActive,
			InventoryStatus:   models.InventorySynced,
			InventoryQuantity: 120,
			ListingURL:        "https://amazon.com/dp/B00001",
			RegistrarID:       "u1",
			RegistrarName:     "张伟-跨境登记员",
			Materials: []models.Material{
				{ID: uuid.New().String(), Name: "商业发票", Type: "invoice", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "装箱单", Type: "packing", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "报关委托书", Type: "customs", Uploaded: true, Required: true},
			},
			Opinions: []models.OrderOpinion{
				{UserID: "u1", UserName: "张伟-跨境登记员", Role: models.RoleRegistrar, Content: "首次登记，资料齐全、刊登正常、库存充足", Time: now.Add(-2 * time.Hour), Pass: true},
			},
			CreatedAt:  now.Add(-2 * time.Hour),
			UpdatedAt:  now.Add(-2 * time.Hour),
			Deadline:   now.Add(24 * time.Hour),
			WarningHours: 6,
			IsOverdue:  false,
			Version:    1,
		},

		// 2. 待复核 - 初审通过、逾期、但材料缺失+库存不足（逾期阻断场景，不能直接通过）
		{
			ID:                uuid.New().String(),
			OrderNo:           "CB20260610002",
			ProductName:       "智能手表 Series 5",
			ProductSKU:        "SKU-SM5-002",
			Quantity:          30,
			Amount:            8997.00,
			Currency:          "EUR",
			Platform:          "AliExpress",
			BuyerCountry:      "DE",
			Status:            models.StatusProcessing,
			ListingStatus:     models.ListingActive,
			InventoryStatus:   models.InventoryInsufficient,
			InventoryQuantity: 8,
			ListingURL:        "https://aliexpress.com/item/100002",
			RegistrarID:       "u1",
			RegistrarName:     "张伟-跨境登记员",
			SupervisorID:      "u2",
			SupervisorName:    "李娜-跨境审核主管",
			Materials: []models.Material{
				{ID: uuid.New().String(), Name: "商业发票", Type: "invoice", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "装箱单", Type: "packing", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "报关委托书", Type: "customs", Uploaded: false, Required: true},
				{ID: uuid.New().String(), Name: "CE认证证书", Type: "cert", Uploaded: false, Required: true},
			},
			Opinions: []models.OrderOpinion{
				{UserID: "u1", UserName: "张伟-跨境登记员", Role: models.RoleRegistrar, Content: "登记完成", Time: now.Add(-48 * time.Hour), Pass: true},
				{UserID: "u2", UserName: "李娜-跨境审核主管", Role: models.RoleSupervisor, Content: "初审通过，注意后续补齐CE证书", Time: now.Add(-24 * time.Hour), Pass: true},
			},
			BlockReasons: []models.BlockReason{
				{Field: "deadline", Reason: "订单已逾期，超过处理时限2小时", Level: "error"},
				{Field: "materials", Reason: "缺少必需材料：报关委托书、CE认证证书", Level: "error"},
				{Field: "inventory", Reason: "库存不足，订单数量30，当前库存8", Level: "error"},
			},
			CreatedAt:       now.Add(-48 * time.Hour),
			UpdatedAt:       now.Add(-24 * time.Hour),
			Deadline:        now.Add(-2 * time.Hour),
			WarningHours:    12,
			IsOverdue:       true,
			OverdueReason:   "初审通过后超过24小时未完成复核归档，且存在材料缺失和库存不足问题",
			NextAction:      "请退回登记员补充材料并协调库存；如属紧急订单，由复核负责人记录人工处置及审批文件",
			Version:         2,
		},

		// 3. 已退回 - 缺少材料+刊登失败（退回场景）
		{
			ID:                uuid.New().String(),
			OrderNo:           "CB20260610003",
			ProductName:       "便携充电宝 20000mAh",
			ProductSKU:        "SKU-PB20-003",
			Quantity:          100,
			Amount:            3500.00,
			Currency:          "USD",
			Platform:          "Shopee",
			BuyerCountry:      "SG",
			Status:            models.StatusReturned,
			ListingStatus:     models.ListingFailed,
			InventoryStatus:   models.InventorySynced,
			InventoryQuantity: 250,
			ListingURL:        "",
			RegistrarID:       "u1",
			RegistrarName:     "张伟-跨境登记员",
			SupervisorID:      "u2",
			SupervisorName:    "李娜-跨境审核主管",
			Materials: []models.Material{
				{ID: uuid.New().String(), Name: "商业发票", Type: "invoice", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "装箱单", Type: "packing", Uploaded: false, Required: true},
				{ID: uuid.New().String(), Name: "MSDS报告", Type: "msds", Uploaded: false, Required: true},
			},
			Opinions: []models.OrderOpinion{
				{UserID: "u1", UserName: "张伟-跨境登记员", Role: models.RoleRegistrar, Content: "初次提交", Time: now.Add(-72 * time.Hour), Pass: true},
				{UserID: "u2", UserName: "李娜-跨境审核主管", Role: models.RoleSupervisor, Content: "缺少装箱单和MSDS报告；商品刊登失败，需重新刊登后提交", Time: now.Add(-60 * time.Hour), Pass: false},
			},
			BlockReasons: []models.BlockReason{
				{Field: "materials", Reason: "缺少必需材料：装箱单、MSDS报告", Level: "error"},
				{Field: "listing", Reason: "商品刊登失败，请完成刊登后再提交", Level: "error"},
			},
			CreatedAt:    now.Add(-72 * time.Hour),
			UpdatedAt:    now.Add(-60 * time.Hour),
			Deadline:     now.Add(12 * time.Hour),
			WarningHours: 6,
			IsOverdue:    false,
			ReturnReason: "缺少装箱单和MSDS报告，商品刊登失败",
			NextAction:   "登记员需补齐材料、完成商品刊登后重新提交审核",
			Version:      2,
		},

		// 4. 已归档 - 完整流程成功（成功场景）
		{
			ID:                uuid.New().String(),
			OrderNo:           "CB20260610004",
			ProductName:       "真无线运动耳机",
			ProductSKU:        "SKU-SPE-004",
			Quantity:          200,
			Amount:            5980.00,
			Currency:          "GBP",
			Platform:          "eBay",
			BuyerCountry:      "UK",
			Status:            models.StatusArchived,
			ListingStatus:     models.ListingActive,
			InventoryStatus:   models.InventorySynced,
			InventoryQuantity: 500,
			ListingURL:        "https://ebay.co.uk/itm/100004",
			RegistrarID:       "u1",
			RegistrarName:     "张伟-跨境登记员",
			SupervisorID:      "u2",
			SupervisorName:    "李娜-跨境审核主管",
			ReviewerID:        "u3",
			ReviewerName:      "王强-跨境电商复核负责人",
			Materials: []models.Material{
				{ID: uuid.New().String(), Name: "商业发票", Type: "invoice", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "装箱单", Type: "packing", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "报关委托书", Type: "customs", Uploaded: true, Required: true},
			},
			Opinions: []models.OrderOpinion{
				{UserID: "u1", UserName: "张伟-跨境登记员", Role: models.RoleRegistrar, Content: "登记完成", Time: now.Add(-120 * time.Hour), Pass: true},
				{UserID: "u2", UserName: "李娜-跨境审核主管", Role: models.RoleSupervisor, Content: "初审通过，刊登正常、库存充足", Time: now.Add(-100 * time.Hour), Pass: true},
				{UserID: "u3", UserName: "王强-跨境电商复核负责人", Role: models.RoleReviewer, Content: "复核通过，材料齐全、刊登有效、库存匹配，已归档", Time: now.Add(-80 * time.Hour), Pass: true},
			},
			CreatedAt:    now.Add(-120 * time.Hour),
			UpdatedAt:    now.Add(-80 * time.Hour),
			Deadline:     now.Add(-60 * time.Hour),
			WarningHours: 24,
			IsOverdue:    false,
			Version:      3,
		},

		// 5. 待审核 - 库存同步失败（阻断项，审核不能通过）
		{
			ID:                uuid.New().String(),
			OrderNo:           "CB20260610005",
			ProductName:       "智能门锁 Pro",
			ProductSKU:        "SKU-SLP-005",
			Quantity:          20,
			Amount:            4598.00,
			Currency:          "USD",
			Platform:          "Amazon",
			BuyerCountry:      "CA",
			Status:            models.StatusPending,
			ListingStatus:     models.ListingActive,
			InventoryStatus:   models.InventorySyncFailed,
			InventoryQuantity: 0,
			ListingURL:        "https://amazon.ca/dp/B00005",
			RegistrarID:       "u1",
			RegistrarName:     "张伟-跨境登记员",
			Materials: []models.Material{
				{ID: uuid.New().String(), Name: "商业发票", Type: "invoice", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "装箱单", Type: "packing", Uploaded: true, Required: true},
			},
			Opinions: []models.OrderOpinion{
				{UserID: "u1", UserName: "张伟-跨境登记员", Role: models.RoleRegistrar, Content: "刚提交的订单，注意库存同步稍后会自动重试", Time: now.Add(-30 * time.Minute), Pass: true},
			},
			BlockReasons: []models.BlockReason{
				{Field: "inventory", Reason: "库存同步失败，请检查WMS系统连接", Level: "error"},
			},
			CreatedAt:    now.Add(-30 * time.Minute),
			UpdatedAt:    now.Add(-30 * time.Minute),
			Deadline:     now.Add(3 * time.Hour),
			WarningHours: 2,
			IsOverdue:    false,
			NextAction:   "请重新同步库存或联系IT排查WMS接口",
			Version:      1,
		},

		// 6. 草稿 - 登记员编辑中（批量部分失败场景的候选）
		{
			ID:                uuid.New().String(),
			OrderNo:           "CB20260610006",
			ProductName:       "儿童护眼台灯",
			ProductSKU:        "SKU-LED-006",
			Quantity:          80,
			Amount:            3200.00,
			Currency:          "USD",
			Platform:          "Amazon",
			BuyerCountry:      "US",
			Status:            models.StatusDraft,
			ListingStatus:     models.ListingNotDone,
			InventoryStatus:   models.InventoryNotSynced,
			InventoryQuantity: 0,
			ListingURL:        "",
			RegistrarID:       "u1",
			RegistrarName:     "张伟-跨境登记员",
			Materials: []models.Material{
				{ID: uuid.New().String(), Name: "商业发票", Type: "invoice", Uploaded: false, Required: true},
				{ID: uuid.New().String(), Name: "装箱单", Type: "packing", Uploaded: false, Required: true},
			},
			Opinions: []models.OrderOpinion{
				{UserID: "u1", UserName: "张伟-跨境登记员", Role: models.RoleRegistrar, Content: "创建草稿", Time: now.Add(-1 * time.Hour), Pass: true},
			},
			CreatedAt:    now.Add(-1 * time.Hour),
			UpdatedAt:    now.Add(-1 * time.Hour),
			Deadline:     now.Add(72 * time.Hour),
			WarningHours: 12,
			IsOverdue:    false,
			Version:      1,
		},

		// 7. 待审核 - 刊登被下架（阻断）+ 马上到期（预警）
		{
			ID:                uuid.New().String(),
			OrderNo:           "CB20260610007",
			ProductName:       "便携投影仪 4K",
			ProductSKU:        "SKU-PROJ-007",
			Quantity:          15,
			Amount:            11250.00,
			Currency:          "USD",
			Platform:          "Amazon",
			BuyerCountry:      "US",
			Status:            models.StatusPending,
			ListingStatus:     models.ListingDelisted,
			InventoryStatus:   models.InventorySynced,
			InventoryQuantity: 40,
			ListingURL:        "https://amazon.com/dp/B00007",
			RegistrarID:       "u1",
			RegistrarName:     "张伟-跨境登记员",
			Materials: []models.Material{
				{ID: uuid.New().String(), Name: "商业发票", Type: "invoice", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "装箱单", Type: "packing", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "报关委托书", Type: "customs", Uploaded: true, Required: true},
			},
			Opinions: []models.OrderOpinion{
				{UserID: "u1", UserName: "张伟-跨境登记员", Role: models.RoleRegistrar, Content: "提交审核，注意产品被平台下架需申诉", Time: now.Add(-4 * time.Hour), Pass: true},
			},
			BlockReasons: []models.BlockReason{
				{Field: "listing", Reason: "商品已被平台下架，请申诉或重新刊登", Level: "error"},
			},
			CreatedAt:    now.Add(-4 * time.Hour),
			UpdatedAt:    now.Add(-4 * time.Hour),
			Deadline:     now.Add(1 * time.Hour),
			WarningHours: 6,
			IsOverdue:    false,
			NextAction:   "联系平台申诉恢复刊登，或换SKU重新刊登",
			Version:      1,
		},

		// 8. 待复核 - 初审通过、刊登/库存/材料OK，但已逾期（逾期阻断：不能直接通过，只能退回或人工处置）
		{
			ID:                uuid.New().String(),
			OrderNo:           "CB20260610008",
			ProductName:       "Type-C 快充充电器 65W",
			ProductSKU:        "SKU-CHA-008",
			Quantity:          150,
			Amount:            4500.00,
			Currency:          "EUR",
			Platform:          "Amazon",
			BuyerCountry:      "FR",
			Status:            models.StatusProcessing,
			ListingStatus:     models.ListingActive,
			InventoryStatus:   models.InventorySynced,
			InventoryQuantity: 300,
			ListingURL:        "https://amazon.fr/dp/B00008",
			RegistrarID:       "u1",
			RegistrarName:     "张伟-跨境登记员",
			SupervisorID:      "u2",
			SupervisorName:    "李娜-跨境审核主管",
			Materials: []models.Material{
				{ID: uuid.New().String(), Name: "商业发票", Type: "invoice", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "装箱单", Type: "packing", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "报关委托书", Type: "customs", Uploaded: true, Required: true},
			},
			Opinions: []models.OrderOpinion{
				{UserID: "u1", UserName: "张伟-跨境登记员", Role: models.RoleRegistrar, Content: "登记完成", Time: now.Add(-72 * time.Hour), Pass: true},
				{UserID: "u2", UserName: "李娜-跨境审核主管", Role: models.RoleSupervisor, Content: "初审通过", Time: now.Add(-60 * time.Hour), Pass: true},
			},
			BlockReasons: []models.BlockReason{
				{Field: "deadline", Reason: "订单已逾期，超过处理时限48小时", Level: "error"},
			},
			CreatedAt:     now.Add(-72 * time.Hour),
			UpdatedAt:     now.Add(-60 * time.Hour),
			Deadline:      now.Add(-48 * time.Hour),
			WarningHours:  24,
			IsOverdue:     true,
			OverdueReason: "初审通过后超过48小时未完成复核归档",
			NextAction:    "仅允许：退回登记员补正，或记录人工处置并上传审批文件后归档",
			Version:       2,
		},
	}

	for _, order := range demoOrders {
		order.BlockReasons = ComputeBlockReasons(order)
		s.orders[order.ID] = order
	}
}

func ComputeBlockReasons(order *models.CrossBorderOrder) []models.BlockReason {
	reasons := make([]models.BlockReason, 0)
	if order.Status == models.StatusArchived {
		return order.BlockReasons
	}
	if order.IsOverdue {
		reasons = append(reasons, models.BlockReason{
			Field: "deadline",
			Reason: "订单已逾期，超过处理时限，不能直接通过，只能退回补正或人工处置",
			Level: "error",
		})
	}
	switch order.ListingStatus {
	case models.ListingNotDone:
		reasons = append(reasons, models.BlockReason{
			Field:  "listing",
			Reason: "商品尚未完成刊登",
			Level:  "error",
		})
	case models.ListingFailed:
		reasons = append(reasons, models.BlockReason{
			Field:  "listing",
			Reason: "商品刊登失败，请重新刊登",
			Level:  "error",
		})
	case models.ListingDelisted:
		reasons = append(reasons, models.BlockReason{
			Field:  "listing",
			Reason: "商品已被平台下架，请申诉恢复或换SKU重新刊登",
			Level:  "error",
		})
	}
	switch order.InventoryStatus {
	case models.InventoryNotSynced:
		reasons = append(reasons, models.BlockReason{
			Field:  "inventory",
			Reason: "库存尚未同步，请先完成库存同步",
			Level:  "error",
		})
	case models.InventorySyncFailed:
		reasons = append(reasons, models.BlockReason{
			Field:  "inventory",
			Reason: "库存同步失败，请检查WMS连接后重试",
			Level:  "error",
		})
	case models.InventoryInsufficient:
		reasons = append(reasons, models.BlockReason{
			Field:  "inventory",
			Reason: "库存不足，订单数量超出可用库存",
			Level:  "error",
		})
	}
	if order.InventoryStatus == models.InventorySynced && order.InventoryQuantity < order.Quantity {
		reasons = append(reasons, models.BlockReason{
			Field:  "inventory",
			Reason: "可用库存小于订单数量",
			Level:  "error",
		})
	}
	missing := make([]string, 0)
	for _, m := range order.Materials {
		if m.Required && !m.Uploaded {
			missing = append(missing, m.Name)
		}
	}
	if len(missing) > 0 {
		msg := "缺少必需材料："
		for i, m := range missing {
			if i > 0 {
				msg += "、"
			}
			msg += m
		}
		reasons = append(reasons, models.BlockReason{
			Field:  "materials",
			Reason: msg,
			Level:  "error",
		})
	}
	return reasons
}

func HasHardBlocks(order *models.CrossBorderOrder) bool {
	return HasHardBlockReasons(order.BlockReasons)
}

func HasHardBlockReasons(reasons []models.BlockReason) bool {
	for _, r := range reasons {
		if r.Level == "error" {
			return true
		}
	}
	return false
}

func (s *Store) GetUserByUsername(username string) *models.User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, u := range s.users {
		if u.Username == username {
			return u
		}
	}
	return nil
}

func (s *Store) GetUserByID(id string) *models.User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.users[id]
}

func (s *Store) CreateToken(userID string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	token := uuid.New().String()
	s.tokens[token] = userID
	return token
}

func (s *Store) GetUserByToken(token string) *models.User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	userID, ok := s.tokens[token]
	if !ok {
		return nil
	}
	return s.users[userID]
}

func (s *Store) RemoveToken(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.tokens, token)
}

func (s *Store) ListOrders() []*models.CrossBorderOrder {
	s.mu.RLock()
	defer s.mu.RUnlock()
	orders := make([]*models.CrossBorderOrder, 0, len(s.orders))
	for _, o := range s.orders {
		orders = append(orders, o)
	}
	return orders
}

func (s *Store) GetOrder(id string) *models.CrossBorderOrder {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.orders[id]
}

func (s *Store) SaveOrder(order *models.CrossBorderOrder) {
	s.mu.Lock()
	defer s.mu.Unlock()
	order.UpdatedAt = time.Now()
	order.Version++
	order.BlockReasons = ComputeBlockReasons(order)
	s.orders[order.ID] = order
}

func (s *Store) AddOrder(order *models.CrossBorderOrder) {
	s.mu.Lock()
	defer s.mu.Unlock()
	order.BlockReasons = ComputeBlockReasons(order)
	s.orders[order.ID] = order
}

func (s *Store) AddAuditLog(log *models.AuditLog) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.auditLogs = append(s.auditLogs, log)
}

func (s *Store) GetAuditLogs(orderID string) []*models.AuditLog {
	s.mu.RLock()
	defer s.mu.RUnlock()
	logs := make([]*models.AuditLog, 0)
	for _, log := range s.auditLogs {
		if orderID == "" || log.OrderID == orderID {
			logs = append(logs, log)
		}
	}
	return logs
}

func (s *Store) CheckAndUpdateOverdue() {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for _, order := range s.orders {
		if order.Status == models.StatusArchived {
			continue
		}
		if now.After(order.Deadline) && !order.IsOverdue {
			order.IsOverdue = true
			order.OverdueReason = generateOverdueReason(order)
			order.NextAction = generateNextAction(order)
			order.UpdatedAt = now
			order.BlockReasons = ComputeBlockReasons(order)
		} else if !now.After(order.Deadline) && order.IsOverdue {
			order.IsOverdue = false
			order.OverdueReason = ""
			order.BlockReasons = ComputeBlockReasons(order)
		}
	}
}

func generateOverdueReason(order *models.CrossBorderOrder) string {
	switch order.Status {
	case models.StatusPending, models.StatusReturned:
		return "登记/补正后超过时限未完成审核"
	case models.StatusProcessing:
		return "初审通过后超过时限未完成复核归档"
	case models.StatusReviewed:
		return "复核后超过时限未归档"
	default:
		return "订单处理超时"
	}
}

func generateNextAction(order *models.CrossBorderOrder) string {
	switch order.Status {
	case models.StatusPending:
		return "请跨境登记员尽快补正材料/刊登/库存后重新提交；逾期订单不可直接通过"
	case models.StatusReturned:
		return "请跨境登记员按照退回意见补充材料后重新提交"
	case models.StatusProcessing:
		return "仅允许：退回登记员补正，或由跨境电商复核负责人记录人工处置并附审批文件后归档"
	case models.StatusReviewed:
		return "请尽快完成归档操作"
	default:
		return "请相关人员尽快处理"
	}
}
