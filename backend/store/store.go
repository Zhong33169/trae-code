package store

import (
	"cross-border-order/models"
	"sync"
	"time"

	"github.com/google/uuid"
)

type Store struct {
	mu         sync.RWMutex
	users      map[string]*models.User
	orders     map[string]*models.CrossBorderOrder
	auditLogs  []*models.AuditLog
	tokens     map[string]string
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
	
	demoOrders := []*models.CrossBorderOrder{
		{
			ID:            uuid.New().String(),
			OrderNo:       "CB20260610001",
			ProductName:   "无线蓝牙耳机 Pro",
			ProductSKU:    "SKU-WHP-001",
			Quantity:      50,
			Amount:        2999.50,
			Currency:      "USD",
			Platform:      "Amazon",
			BuyerCountry:  "US",
			Status:        models.StatusPending,
			RegistrarID:   "u1",
			RegistrarName: "张伟-跨境登记员",
			Materials: []models.Material{
				{ID: uuid.New().String(), Name: "商业发票", Type: "invoice", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "装箱单", Type: "packing", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "报关委托书", Type: "customs", Uploaded: false, Required: true},
			},
			Opinions: []models.OrderOpinion{
				{UserID: "u1", UserName: "张伟-跨境登记员", Role: models.RoleRegistrar, Content: "首次登记，资料基本齐全，缺少报关委托书后续补正", Time: now.Add(-2 * time.Hour), Pass: true},
			},
			CreatedAt:     now.Add(-2 * time.Hour),
			UpdatedAt:     now.Add(-2 * time.Hour),
			Deadline:      now.Add(24 * time.Hour),
			WarningHours:  6,
			IsOverdue:     false,
			Version:       1,
		},
		{
			ID:            uuid.New().String(),
			OrderNo:       "CB20260610002",
			ProductName:   "智能手表 Series 5",
			ProductSKU:    "SKU-SM5-002",
			Quantity:      30,
			Amount:        8997.00,
			Currency:      "EUR",
			Platform:      "AliExpress",
			BuyerCountry:  "DE",
			Status:        models.StatusProcessing,
			RegistrarID:   "u1",
			RegistrarName: "张伟-跨境登记员",
			SupervisorID:  "u2",
			SupervisorName: "李娜-跨境审核主管",
			Materials: []models.Material{
				{ID: uuid.New().String(), Name: "商业发票", Type: "invoice", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "装箱单", Type: "packing", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "报关委托书", Type: "customs", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "产品质检报告", Type: "quality", Uploaded: true, Required: false},
			},
			Opinions: []models.OrderOpinion{
				{UserID: "u1", UserName: "张伟-跨境登记员", Role: models.RoleRegistrar, Content: "登记完成，所有材料齐全", Time: now.Add(-48 * time.Hour), Pass: true},
				{UserID: "u2", UserName: "李娜-跨境审核主管", Role: models.RoleSupervisor, Content: "初审通过，建议复核后安排发货", Time: now.Add(-24 * time.Hour), Pass: true},
			},
			CreatedAt:     now.Add(-48 * time.Hour),
			UpdatedAt:     now.Add(-24 * time.Hour),
			Deadline:      now.Add(-2 * time.Hour),
			WarningHours:  12,
			IsOverdue:     true,
			OverdueReason: "初审通过后超过24小时未完成复核归档",
			NextAction:    "请跨境电商复核负责人尽快完成复核，如仍有问题请回退至登记员补充材料",
			Version:       2,
		},
		{
			ID:            uuid.New().String(),
			OrderNo:       "CB20260610003",
			ProductName:   "便携充电宝 20000mAh",
			ProductSKU:    "SKU-PB20-003",
			Quantity:      100,
			Amount:        3500.00,
			Currency:      "USD",
			Platform:      "Shopee",
			BuyerCountry:  "SG",
			Status:        models.StatusReturned,
			RegistrarID:   "u1",
			RegistrarName: "张伟-跨境登记员",
			SupervisorID:  "u2",
			SupervisorName: "李娜-跨境审核主管",
			Materials: []models.Material{
				{ID: uuid.New().String(), Name: "商业发票", Type: "invoice", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "装箱单", Type: "packing", Uploaded: false, Required: true},
				{ID: uuid.New().String(), Name: "MSDS报告", Type: "msds", Uploaded: false, Required: true},
			},
			Opinions: []models.OrderOpinion{
				{UserID: "u1", UserName: "张伟-跨境登记员", Role: models.RoleRegistrar, Content: "初次提交", Time: now.Add(-72 * time.Hour), Pass: true},
				{UserID: "u2", UserName: "李娜-跨境审核主管", Role: models.RoleSupervisor, Content: "缺少装箱单和MSDS报告，充电宝属危险品必须提供MSDS", Time: now.Add(-60 * time.Hour), Pass: false},
			},
			CreatedAt:     now.Add(-72 * time.Hour),
			UpdatedAt:     now.Add(-60 * time.Hour),
			Deadline:      now.Add(12 * time.Hour),
			WarningHours:  6,
			IsOverdue:     false,
			ReturnReason:  "缺少装箱单和MSDS报告",
			Version:       2,
		},
		{
			ID:            uuid.New().String(),
			OrderNo:       "CB20260610004",
			ProductName:   "真无线运动耳机",
			ProductSKU:    "SKU-SPE-004",
			Quantity:      200,
			Amount:        5980.00,
			Currency:      "GBP",
			Platform:      "eBay",
			BuyerCountry:  "UK",
			Status:        models.StatusArchived,
			RegistrarID:   "u1",
			RegistrarName: "张伟-跨境登记员",
			SupervisorID:  "u2",
			SupervisorName: "李娜-跨境审核主管",
			ReviewerID:    "u3",
			ReviewerName:  "王强-跨境电商复核负责人",
			Materials: []models.Material{
				{ID: uuid.New().String(), Name: "商业发票", Type: "invoice", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "装箱单", Type: "packing", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "报关委托书", Type: "customs", Uploaded: true, Required: true},
			},
			Opinions: []models.OrderOpinion{
				{UserID: "u1", UserName: "张伟-跨境登记员", Role: models.RoleRegistrar, Content: "登记完成", Time: now.Add(-120 * time.Hour), Pass: true},
				{UserID: "u2", UserName: "李娜-跨境审核主管", Role: models.RoleSupervisor, Content: "初审通过", Time: now.Add(-100 * time.Hour), Pass: true},
				{UserID: "u3", UserName: "王强-跨境电商复核负责人", Role: models.RoleReviewer, Content: "复核通过，已归档", Time: now.Add(-80 * time.Hour), Pass: true},
			},
			CreatedAt:     now.Add(-120 * time.Hour),
			UpdatedAt:     now.Add(-80 * time.Hour),
			Deadline:      now.Add(-60 * time.Hour),
			WarningHours:  24,
			IsOverdue:     false,
			Version:       3,
		},
		{
			ID:            uuid.New().String(),
			OrderNo:       "CB20260610005",
			ProductName:   "智能门锁 Pro",
			ProductSKU:    "SKU-SLP-005",
			Quantity:      20,
			Amount:        4598.00,
			Currency:      "USD",
			Platform:      "Amazon",
			BuyerCountry:  "CA",
			Status:        models.StatusPending,
			RegistrarID:   "u1",
			RegistrarName: "张伟-跨境登记员",
			Materials: []models.Material{
				{ID: uuid.New().String(), Name: "商业发票", Type: "invoice", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "装箱单", Type: "packing", Uploaded: true, Required: true},
				{ID: uuid.New().String(), Name: "产品认证证书", Type: "cert", Uploaded: true, Required: false},
			},
			Opinions: []models.OrderOpinion{
				{UserID: "u1", UserName: "张伟-跨境登记员", Role: models.RoleRegistrar, Content: "刚提交的订单，请审核", Time: now.Add(-30 * time.Minute), Pass: true},
			},
			CreatedAt:     now.Add(-30 * time.Minute),
			UpdatedAt:     now.Add(-30 * time.Minute),
			Deadline:      now.Add(3 * time.Hour),
			WarningHours:  2,
			IsOverdue:     false,
			Version:       1,
		},
	}
	
	for _, order := range demoOrders {
		s.orders[order.ID] = order
	}
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
	s.orders[order.ID] = order
}

func (s *Store) AddOrder(order *models.CrossBorderOrder) {
	s.mu.Lock()
	defer s.mu.Unlock()
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
		}
	}
}

func generateOverdueReason(order *models.CrossBorderOrder) string {
	switch order.Status {
	case models.StatusPending, models.StatusReturned:
		return "登记/补正后超过时限未提交审核"
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
		return "请跨境登记员尽快提交审核，如材料不齐请补正后重新提交"
	case models.StatusReturned:
		return "请跨境登记员按照退回意见补充材料后重新提交"
	case models.StatusProcessing:
		return "请跨境电商复核负责人尽快完成复核归档"
	case models.StatusReviewed:
		return "请尽快完成归档操作"
	default:
		return "请相关人员尽快处理"
	}
}
