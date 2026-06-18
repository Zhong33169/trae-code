package app

import "time"

type Role string

const (
	RoleWindowStaff     Role = "window_staff"
	RoleMeterSupervisor Role = "meter_supervisor"
	RoleBusinessManager Role = "business_manager"
)

type Stage string

const (
	StageRegistration Stage = "registration"
	StageVerification Stage = "verification"
	StageArchiving    Stage = "archiving"
)

type OrderStatus string

const (
	StatusPendingReview OrderStatus = "pending_review"
	StatusApproved      OrderStatus = "approved"
	StatusSynced        OrderStatus = "synced"
)

type StageStatus string

const (
	StageStatusPending   StageStatus = "pending"
	StageStatusSubmitted StageStatus = "submitted"
	StageStatusApproved  StageStatus = "approved"
	StageStatusRejected  StageStatus = "rejected"
)

type WarningLevel string

const (
	WarningNormal  WarningLevel = "normal"
	WarningNotice  WarningLevel = "notice"
	WarningNearDue WarningLevel = "near_due"
	WarningOverdue WarningLevel = "overdue"
)

type User struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Role Role   `json:"role"`
}

type Material struct {
	Name     string `json:"name"`
	Required bool   `json:"required"`
	Provided bool   `json:"provided"`
}

type WorkOrder struct {
	ID            int         `json:"id"`
	OrderNo       string      `json:"orderNo"`
	Title         string      `json:"title"`
	CustomerName  string      `json:"customerName"`
	CustomerPhone string      `json:"customerPhone"`
	Address       string      `json:"address"`
	RepairType    string      `json:"repairType"`
	Priority      string      `json:"priority"`
	Status        OrderStatus `json:"status"`
	CurrentStage  Stage       `json:"currentStage"`
	Deadline      time.Time   `json:"deadline"`
	SlaHours      int         `json:"slaHours"`
	CreatedBy     int         `json:"createdBy"`
	CreatedByName string      `json:"createdByName"`
	Version       int         `json:"version"`
	CreatedAt     time.Time   `json:"createdAt"`
	UpdatedAt     time.Time   `json:"updatedAt"`
}

type StageRecord struct {
	ID                int         `json:"id"`
	OrderID           int         `json:"orderId"`
	Stage             Stage       `json:"stage"`
	HandlerRole       Role        `json:"handlerRole"`
	HandlerID         *int        `json:"handlerId"`
	HandlerName       string      `json:"handlerName"`
	Materials         []Material  `json:"materials"`
	ProcessingOpinion string      `json:"processingOpinion"`
	Status            StageStatus `json:"status"`
	StartedAt         time.Time   `json:"startedAt"`
	TimeLimitHours    int         `json:"timeLimitHours"`
	SubmittedAt       *time.Time  `json:"submittedAt"`
	ReviewedAt        *time.Time  `json:"reviewedAt"`
	ReviewerID        *int        `json:"reviewerId"`
	ReviewComment     string      `json:"reviewComment"`
}

type AuditLog struct {
	ID            int          `json:"id"`
	OrderID       int          `json:"orderId"`
	Action        string       `json:"action"`
	ActorID       *int         `json:"actorId"`
	ActorName     string       `json:"actorName"`
	ActorRole     Role         `json:"actorRole"`
	FromStatus    *OrderStatus `json:"fromStatus"`
	ToStatus      *OrderStatus `json:"toStatus"`
	FromStage     *Stage       `json:"fromStage"`
	ToStage       *Stage       `json:"toStage"`
	Detail        string       `json:"detail"`
	VersionBefore *int         `json:"versionBefore"`
	VersionAfter  *int         `json:"versionAfter"`
	CreatedAt     time.Time    `json:"createdAt"`
}

type WarningInfo struct {
	Level         WarningLevel `json:"level"`
	Deadline      time.Time    `json:"deadline"`
	RemainSeconds int64        `json:"remainSeconds"`
	RemainText    string       `json:"remainText"`
}

type OrderDetail struct {
	Order              WorkOrder     `json:"order"`
	Stages             []StageRecord `json:"stages"`
	AuditLogs          []AuditLog    `json:"auditLogs"`
	Warning            WarningInfo   `json:"warning"`
	CurrentStageRecord *StageRecord  `json:"currentStageRecord"`
}

type OrderListItem struct {
	WorkOrder
	Warning     WarningInfo `json:"warning"`
	StageStatus StageStatus `json:"stageStatus"`
	CanAct      bool        `json:"canAct"`
	ActionLabel string      `json:"actionLabel"`
}

type Stats struct {
	PendingReview int `json:"pendingReview"`
	Approved      int `json:"approved"`
	Synced        int `json:"synced"`
	NearDue       int `json:"nearDue"`
	Overdue       int `json:"overdue"`
}

func StageRole(s Stage) Role {
	switch s {
	case StageRegistration:
		return RoleWindowStaff
	case StageVerification:
		return RoleMeterSupervisor
	case StageArchiving:
		return RoleBusinessManager
	}
	return ""
}

func StageLabel(s Stage) string {
	switch s {
	case StageRegistration:
		return "抢修工单登记"
	case StageVerification:
		return "过程核验"
	case StageArchiving:
		return "复核归档"
	}
	return ""
}

func StatusLabel(s OrderStatus) string {
	switch s {
	case StatusPendingReview:
		return "待审核"
	case StatusApproved:
		return "审核通过"
	case StatusSynced:
		return "已同步"
	}
	return ""
}

func WarningLabel(w WarningLevel) string {
	switch w {
	case WarningNormal:
		return "正常"
	case WarningNotice:
		return "提醒"
	case WarningNearDue:
		return "临期"
	case WarningOverdue:
		return "逾期"
	}
	return ""
}

func ComputeWarning(deadline time.Time, now time.Time) WarningInfo {
	remain := deadline.Sub(now)
	secs := int64(remain.Seconds())
	var level WarningLevel
	switch {
	case secs <= 0:
		level = WarningOverdue
	case secs <= 24*3600:
		level = WarningNearDue
	case secs <= 48*3600:
		level = WarningNotice
	default:
		level = WarningNormal
	}
	return WarningInfo{
		Level:         level,
		Deadline:      deadline,
		RemainSeconds: secs,
		RemainText:    formatDuration(remain),
	}
}

func formatDuration(d time.Duration) string {
	if d < 0 {
		d = -d
		h := int(d.Hours())
		m := int(d.Minutes()) % 60
		return "逾期 " + itoaPad(h) + "时" + itoaPad(m) + "分"
	}
	h := int(d.Hours())
	m := int(d.Minutes()) % 60
	if h > 24 {
		days := h / 24
		h = h % 24
		return itoaPad(days) + "天 " + itoaPad(h) + "时"
	}
	return itoaPad(h) + "时 " + itoaPad(m) + "分"
}

func itoaPad(n int) string {
	if n < 10 {
		return "0" + intToStr(n)
	}
	return intToStr(n)
}

func intToStr(n int) string {
	if n == 0 {
		return "0"
	}
	neg := false
	if n < 0 {
		neg = true
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
