package models

import (
	"time"
)

type Role string

const (
	RoleRegistrar  Role = "registrar"
	RoleAuditor    Role = "auditor"
	RoleReviewer   Role = "reviewer"
)

type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"uniqueIndex;size:50;not null" json:"username"`
	Password  string    `gorm:"size:255;not null" json:"-"`
	RealName  string    `gorm:"size:50;not null" json:"realName"`
	Role      Role      `gorm:"size:20;not null" json:"role"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type ApplicationStatus string

const (
	StatusDraft            ApplicationStatus = "draft"
	StatusPendingReview    ApplicationStatus = "pending_review"
	StatusReturned         ApplicationStatus = "returned"
	StatusReviewed         ApplicationStatus = "reviewed"
	StatusPendingConfirm   ApplicationStatus = "pending_confirm"
	StatusRoomConfirmed    ApplicationStatus = "room_confirmed"
	StatusPendingHandover  ApplicationStatus = "pending_handover"
	StatusCompleted        ApplicationStatus = "completed"
	StatusRejected         ApplicationStatus = "rejected"
)

type NodeType string

const (
	NodeContractSigning  NodeType = "contract_signing"
	NodeReview           NodeType = "review"
	NodeRoomConfirm      NodeType = "room_confirm"
	NodeHandover         NodeType = "handover"
	NodeArchive          NodeType = "archive"
)

type LeaseApplication struct {
	ID               uint              `gorm:"primaryKey" json:"id"`
	ApplicationNo    string            `gorm:"uniqueIndex;size:50;not null" json:"applicationNo"`
	TenantName       string            `gorm:"size:50;not null" json:"tenantName"`
	TenantIDCard     string            `gorm:"size:20;not null" json:"tenantIdCard"`
	TenantPhone      string            `gorm:"size:20;not null" json:"tenantPhone"`
	ApartmentName    string            `gorm:"size:100;not null" json:"apartmentName"`
	RoomNo           string            `gorm:"size:20;not null" json:"roomNo"`
	RoomArea         float64           `gorm:"not null;default:0" json:"roomArea"`
	MonthlyRent      float64           `gorm:"not null;default:0" json:"monthlyRent"`
	LeaseStartDate   string            `gorm:"size:20;not null" json:"leaseStartDate"`
	LeaseEndDate     string            `gorm:"size:20;not null" json:"leaseEndDate"`
	DepositAmount    float64           `gorm:"not null;default:0" json:"depositAmount"`
	PaymentMethod    string            `gorm:"size:50;not null" json:"paymentMethod"`
	Status           ApplicationStatus `gorm:"size:30;not null;default:draft" json:"status"`
	CurrentNode      NodeType          `gorm:"size:30;not null" json:"currentNode"`
	IsOverdue        bool              `gorm:"default:false" json:"isOverdue"`
	OverdueReason    string            `gorm:"size:500" json:"overdueReason"`
	FollowUpAction   string            `gorm:"size:500" json:"followUpAction"`
	Remark           string            `gorm:"size:1000" json:"remark"`
	ReturnReason     string            `gorm:"size:500" json:"returnReason"`
	RejectReason     string            `gorm:"size:500" json:"rejectReason"`
	ReviewResult     string            `gorm:"size:500" json:"reviewResult"`
	ConfirmResult    string            `gorm:"size:500" json:"confirmResult"`
	HandoverResult   string            `gorm:"size:500" json:"handoverResult"`
	CreatedBy        uint              `gorm:"not null" json:"createdBy"`
	CreatedByName    string            `gorm:"size:50" json:"createdByName"`
	ReviewedBy       uint              `json:"reviewedBy"`
	ReviewedByName   string            `gorm:"size:50" json:"reviewedByName"`
	ConfirmedBy      uint              `json:"confirmedBy"`
	ConfirmedByName  string            `gorm:"size:50" json:"confirmedByName"`
	HandedOverBy     uint              `json:"handedOverBy"`
	HandedOverByName string            `gorm:"size:50" json:"handedOverByName"`
	ArchivedBy       uint              `json:"archivedBy"`
	ArchivedByName   string            `gorm:"size:50" json:"archivedByName"`
	CreatedAt        time.Time         `json:"createdAt"`
	UpdatedAt        time.Time         `json:"updatedAt"`
	SubmittedAt      *time.Time        `json:"submittedAt"`
	ReviewedAt       *time.Time        `json:"reviewedAt"`
	ConfirmedAt      *time.Time        `json:"confirmedAt"`
	HandedOverAt     *time.Time        `json:"handedOverAt"`
	CompletedAt      *time.Time        `json:"completedAt"`
	Attachments      []Attachment      `gorm:"foreignKey:ApplicationID;constraint:OnDelete:CASCADE" json:"attachments,omitempty"`
	NodeTimelines    []NodeTimeline    `gorm:"foreignKey:ApplicationID;constraint:OnDelete:CASCADE" json:"nodeTimelines,omitempty"`
	OperationLogs    []OperationLog    `gorm:"foreignKey:ApplicationID;constraint:OnDelete:CASCADE" json:"operationLogs,omitempty"`
}

type Attachment struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	ApplicationID uint      `gorm:"not null;index" json:"applicationId"`
	FileName      string    `gorm:"size:255;not null" json:"fileName"`
	FileType      string    `gorm:"size:50" json:"fileType"`
	FileSize      int64     `gorm:"default:0" json:"fileSize"`
	FileURL       string    `gorm:"size:500" json:"fileUrl"`
	Category      string    `gorm:"size:50" json:"category"`
	UploadedBy    uint      `gorm:"not null" json:"uploadedBy"`
	UploadedByName string   `gorm:"size:50" json:"uploadedByName"`
	CreatedAt     time.Time `json:"createdAt"`
}

type NodeTimeline struct {
	ID             uint       `gorm:"primaryKey" json:"id"`
	ApplicationID  uint       `gorm:"not null;index" json:"applicationId"`
	NodeType       NodeType   `gorm:"size:30;not null" json:"nodeType"`
	NodeName       string     `gorm:"size:50;not null" json:"nodeName"`
	StartTime      time.Time  `gorm:"not null" json:"startTime"`
	DueTime        *time.Time `json:"dueTime"`
	EndTime        *time.Time `json:"endTime"`
	TimeLimitHours int        `gorm:"default:0" json:"timeLimitHours"`
	IsOverdue      bool       `gorm:"default:false" json:"isOverdue"`
	OverdueReason  string     `gorm:"size:500" json:"overdueReason"`
	FollowUpAction string     `gorm:"size:500" json:"followUpAction"`
	HandlerUserID  uint       `json:"handlerUserId"`
	HandlerName    string     `gorm:"size:50" json:"handlerName"`
	Status         string     `gorm:"size:20;default:pending" json:"status"`
	Remark         string     `gorm:"size:1000" json:"remark"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

type OperationLog struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	ApplicationID uint      `gorm:"not null;index" json:"applicationId"`
	UserID        uint      `gorm:"not null" json:"userId"`
	UserName      string    `gorm:"size:50;not null" json:"userName"`
	UserRole      string    `gorm:"size:20;not null" json:"userRole"`
	OperationType string    `gorm:"size:50;not null" json:"operationType"`
	OperationName string    `gorm:"size:100;not null" json:"operationName"`
	OldStatus     string    `gorm:"size:30" json:"oldStatus"`
	NewStatus     string    `gorm:"size:30" json:"newStatus"`
	Detail        string    `gorm:"size:2000" json:"detail"`
	IPAddress     string    `gorm:"size:50" json:"ipAddress"`
	CreatedAt     time.Time `json:"createdAt"`
}

type NodeTimeLimit struct {
	NodeType       NodeType `json:"nodeType"`
	NodeName       string   `json:"nodeName"`
	TimeLimitHours int      `json:"timeLimitHours"`
}

var NodeTimeLimits = []NodeTimeLimit{
	{NodeType: NodeContractSigning, NodeName: "租客签约", TimeLimitHours: 24},
	{NodeType: NodeReview, NodeName: "租约审核", TimeLimitHours: 48},
	{NodeType: NodeRoomConfirm, NodeName: "房态确认", TimeLimitHours: 24},
	{NodeType: NodeHandover, NodeName: "入住交接", TimeLimitHours: 48},
	{NodeType: NodeArchive, NodeName: "复核归档", TimeLimitHours: 72},
}

func GetNodeTimeLimit(nodeType NodeType) (NodeTimeLimit, bool) {
	for _, n := range NodeTimeLimits {
		if n.NodeType == nodeType {
			return n, true
		}
	}
	return NodeTimeLimit{}, false
}

func GetNodeName(nodeType NodeType) string {
	switch nodeType {
	case NodeContractSigning:
		return "租客签约"
	case NodeReview:
		return "租约审核"
	case NodeRoomConfirm:
		return "房态确认"
	case NodeHandover:
		return "入住交接"
	case NodeArchive:
		return "复核归档"
	default:
		return "未知节点"
	}
}

func GetStatusName(status ApplicationStatus) string {
	switch status {
	case StatusDraft:
		return "草稿"
	case StatusPendingReview:
		return "待审核"
	case StatusReturned:
		return "已退回"
	case StatusReviewed:
		return "审核通过"
	case StatusPendingConfirm:
		return "待房态确认"
	case StatusRoomConfirmed:
		return "房态已确认"
	case StatusPendingHandover:
		return "待入住交接"
	case StatusCompleted:
		return "已完成归档"
	case StatusRejected:
		return "已拒绝"
	default:
		return "未知状态"
	}
}

func (r Role) GetRoleName() string {
	switch r {
	case RoleRegistrar:
		return "租约登记员"
	case RoleAuditor:
		return "租约审核主管"
	case RoleReviewer:
		return "长租公寓复核负责人"
	default:
		return "未知角色"
	}
}
