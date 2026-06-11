package models

import "time"

type Role string

const (
	RoleRegister Role = "register"
	RoleAuditor  Role = "auditor"
	RoleReviewer Role = "reviewer"
)

func (r Role) DisplayName() string {
	switch r {
	case RoleRegister:
		return "开户登记员"
	case RoleAuditor:
		return "开户审核主管"
	case RoleReviewer:
		return "水务营业厅复核负责人"
	default:
		return string(r)
	}
}

type ApplicationStatus string

const (
	StatusDraft            ApplicationStatus = "DRAFT"
	StatusPendingAudit     ApplicationStatus = "PENDING_AUDIT"
	StatusNeedCorrection   ApplicationStatus = "NEED_CORRECTION"
	StatusPendingReview    ApplicationStatus = "PENDING_REVIEW"
	StatusArchived         ApplicationStatus = "ARCHIVED"
)

func (s ApplicationStatus) DisplayName() string {
	switch s {
	case StatusDraft:
		return "草稿"
	case StatusPendingAudit:
		return "待审核"
	case StatusNeedCorrection:
		return "需补正"
	case StatusPendingReview:
		return "待复核"
	case StatusArchived:
		return "已归档"
	default:
		return string(s)
	}
}

type HandoverStatus string

const (
	HandoverPending  HandoverStatus = "PENDING"
	HandoverAccepted HandoverStatus = "ACCEPTED"
	HandoverRejected HandoverStatus = "REJECTED"
)

func (s HandoverStatus) DisplayName() string {
	switch s {
	case HandoverPending:
		return "待接收"
	case HandoverAccepted:
		return "已接收"
	case HandoverRejected:
		return "已拒绝"
	default:
		return string(s)
	}
}

type User struct {
	ID         int64     `json:"id"`
	Username   string    `json:"username"`
	Password   string    `json:"-"`
	RealName   string    `json:"realName"`
	Role       Role      `json:"role"`
	RoleDisplay string   `json:"roleDisplay"`
	Shift      string    `json:"shift"`
	CreatedAt  time.Time `json:"createdAt"`
}

type Application struct {
	ID                  int64             `json:"id"`
	ApplicationNo       string            `json:"applicationNo"`
	ApplicantName       string            `json:"applicantName"`
	ApplicantIDCard     string            `json:"applicantIdCard"`
	ApplicantPhone      string            `json:"applicantPhone"`
	ApplicantAddress    string            `json:"applicantAddress"`
	WaterUsageType      string            `json:"waterUsageType"`
	PropertyType        string            `json:"propertyType"`
	IDCardFrontImg      string            `json:"idCardFrontImg"`
	IDCardBackImg       string            `json:"idCardBackImg"`
	PropertyCertificate string            `json:"propertyCertificate"`
	Status              ApplicationStatus `json:"status"`
	StatusDisplay       string            `json:"statusDisplay"`
	CurrentHandlerID    int64             `json:"currentHandlerId"`
	CurrentHandlerName  string            `json:"currentHandlerName"`
	CurrentHandlerRole  string            `json:"currentHandlerRole"`
	RegisterID          int64             `json:"registerId"`
	RegisterName        string            `json:"registerName"`
	AuditorID           *int64            `json:"auditorId,omitempty"`
	AuditorName         string            `json:"auditorName,omitempty"`
	ReviewerID          *int64            `json:"reviewerId,omitempty"`
	ReviewerName        string            `json:"reviewerName,omitempty"`
	RejectReason        string            `json:"rejectReason,omitempty"`
	LastRemark          string            `json:"lastRemark,omitempty"`
	SubmittedAt         *time.Time        `json:"submittedAt,omitempty"`
	AuditedAt           *time.Time        `json:"auditedAt,omitempty"`
	ReviewedAt          *time.Time        `json:"reviewedAt,omitempty"`
	CreatedAt           time.Time         `json:"createdAt"`
	UpdatedAt           time.Time         `json:"updatedAt"`
}

type Handover struct {
	ID               int64          `json:"id"`
	ApplicationID    int64          `json:"applicationId"`
	ApplicationNo    string         `json:"applicationNo"`
	ApplicantName    string         `json:"applicantName"`
	AppStatus        string         `json:"appStatus"`
	AppStatusDisplay string         `json:"appStatusDisplay"`
	CurrentHandlerID int64          `json:"currentHandlerId"`
	CurrentHandlerName string        `json:"currentHandlerName"`
	CurrentHandlerRole string        `json:"currentHandlerRole"`
	FromUserID       int64          `json:"fromUserId"`
	FromUserName     string         `json:"fromUserName"`
	FromUserRole     string         `json:"fromUserRole"`
	FromShift        string         `json:"fromShift"`
	ToUserID         int64          `json:"toUserId"`
	ToUserName       string         `json:"toUserName"`
	ToUserRole       string         `json:"toUserRole"`
	ToShift          string         `json:"toShift"`
	Status           HandoverStatus `json:"status"`
	StatusDisplay    string         `json:"statusDisplay"`
	HandoverRemark   string         `json:"handoverRemark"`
	AcceptRemark     string         `json:"acceptRemark,omitempty"`
	CreatedAt        time.Time      `json:"createdAt"`
	ConfirmedAt      *time.Time     `json:"confirmedAt,omitempty"`
}

type OperationLog struct {
	ID              int64     `json:"id"`
	ApplicationID   int64     `json:"applicationId"`
	ApplicationNo   string    `json:"applicationNo"`
	UserID          int64     `json:"userId"`
	UserName        string    `json:"userName"`
	UserRole        string    `json:"userRole"`
	Operation       string    `json:"operation"`
	OperationDetail string    `json:"operationDetail"`
	FromStatus      string    `json:"fromStatus,omitempty"`
	ToStatus        string    `json:"toStatus,omitempty"`
	IPAddress       string    `json:"ipAddress"`
	CreatedAt       time.Time `json:"createdAt"`
}

type Statistics struct {
	Total          int64            `json:"total"`
	Draft          int64            `json:"draft"`
	PendingAudit   int64            `json:"pendingAudit"`
	NeedCorrection int64            `json:"needCorrection"`
	PendingReview  int64            `json:"pendingReview"`
	Archived       int64            `json:"archived"`
	TodayCreated   int64            `json:"todayCreated"`
	TodayDone      int64            `json:"todayDone"`
	Handovers      HandoverStats    `json:"handovers"`
	ByRole         map[string]int64 `json:"byRole"`
}

type HandoverStats struct {
	Pending  int64 `json:"pending"`
	Accepted int64 `json:"accepted"`
	Rejected int64 `json:"rejected"`
	Total    int64 `json:"total"`
}
