package models

import (
	"time"
)

type Role string

const (
	RoleRegistrar Role = "registrar"
	RoleAuditor   Role = "auditor"
	RoleReviewer  Role = "reviewer"
)

func (r Role) String() string { return string(r) }

func (r Role) Label() string {
	switch r {
	case RoleRegistrar:
		return "新闻线索登记员"
	case RoleAuditor:
		return "新闻线索审核主管"
	case RoleReviewer:
		return "新闻采编中心复核负责人"
	default:
		return "未知"
	}
}

type ClueStatus string

const (
	StatusDraft         ClueStatus = "draft"
	StatusSubmitted     ClueStatus = "submitted"
	StatusAssigned      ClueStatus = "assigned"
	StatusVerifying     ClueStatus = "verifying"
	StatusLackEvidence  ClueStatus = "lack_evidence"
	StatusReturned      ClueStatus = "returned"
	StatusReSubmit      ClueStatus = "resubmitted"
	StatusOverdue       ClueStatus = "overdue"
	StatusArchived      ClueStatus = "archived"
	StatusAppealed      ClueStatus = "appealed"
	StatusAppealAccept  ClueStatus = "appeal_accepted"
	StatusAppealReject  ClueStatus = "appeal_rejected"
	StatusConflict      ClueStatus = "status_conflict"
)

func (s ClueStatus) String() string { return string(s) }
func (s ClueStatus) Label() string {
	switch s {
	case StatusDraft:
		return "草稿"
	case StatusSubmitted:
		return "待核实分派"
	case StatusAssigned:
		return "已分派"
	case StatusVerifying:
		return "核实中"
	case StatusLackEvidence:
		return "缺证据"
	case StatusReturned:
		return "退回补正"
	case StatusReSubmit:
		return "补正重提"
	case StatusOverdue:
		return "逾期"
	case StatusArchived:
		return "已归档"
	case StatusAppealed:
		return "异常申诉中"
	case StatusAppealAccept:
		return "申诉已受理"
	case StatusAppealReject:
		return "申诉已驳回"
	case StatusConflict:
		return "状态冲突"
	default:
		return "未知"
	}
}

type User struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"uniqueIndex;size:64;not null" json:"username"`
	Password  string    `gorm:"size:128;not null" json:"-"`
	RealName  string    `gorm:"size:64" json:"realName"`
	Role      Role      `gorm:"size:32;not null" json:"role"`
	RoleLabel string    `gorm:"-" json:"roleLabel"`
	CreatedAt time.Time `json:"createdAt"`
}

type Evidence struct {
	ID         string    `gorm:"primaryKey" json:"id"`
	ClueID     string    `gorm:"index;not null" json:"clueId"`
	Type       string    `gorm:"size:32;not null" json:"type"`
	Name       string    `gorm:"size:255;not null" json:"name"`
	Desc       string    `gorm:"size:512" json:"desc"`
	UploaderID string    `json:"uploaderId"`
	CreatedAt  time.Time `json:"createdAt"`
}

type OperationLog struct {
	ID            string     `gorm:"primaryKey" json:"id"`
	ClueID        string     `gorm:"index;not null" json:"clueId"`
	OperatorID    string     `gorm:"index;not null" json:"operatorId"`
	OperatorName  string     `gorm:"size:64" json:"operatorName"`
	OperatorRole  string     `gorm:"size:32" json:"operatorRole"`
	Action        string     `gorm:"size:64;not null" json:"action"`
	FromStatus    string     `gorm:"size:32" json:"fromStatus"`
	ToStatus      string     `gorm:"size:32" json:"toStatus"`
	Comment       string     `gorm:"size:2048" json:"comment"`
	RejectReason  string     `gorm:"size:512" json:"rejectReason"`
	ReviewOpinion string     `gorm:"size:2048" json:"reviewOpinion"`
	VersionBefore int        `json:"versionBefore"`
	VersionAfter  int        `json:"versionAfter"`
	CreatedAt     time.Time  `json:"createdAt"`
}

type AppealRecord struct {
	ID              string    `gorm:"primaryKey" json:"id"`
	ClueID          string    `gorm:"index;not null" json:"clueId"`
	AppellantID     string    `gorm:"index;not null" json:"appellantId"`
	AppellantName   string    `gorm:"size:64" json:"appellantName"`
	Reason          string    `gorm:"size:2048;not null" json:"reason"`
	Status          string    `gorm:"size:32;not null" json:"status"`
	ReviewerID      string    `json:"reviewerId"`
	ReviewerName    string    `gorm:"size:64" json:"reviewerName"`
	ReviewOpinion   string    `gorm:"size:2048" json:"reviewOpinion"`
	RejectReason    string    `gorm:"size:512" json:"rejectReason"`
	OriginalStatus  string    `gorm:"size:32" json:"originalStatus"`
	ResubmittedAt   *time.Time `json:"resubmittedAt"`
	CreatedAt       time.Time `json:"createdAt"`
	ReviewedAt      *time.Time `json:"reviewedAt"`
}

type NewsClue struct {
	ID            string     `gorm:"primaryKey" json:"id"`
	Title         string     `gorm:"size:255;not null" json:"title"`
	Content       string     `gorm:"type:text;not null" json:"content"`
	Source        string     `gorm:"size:128" json:"source"`
	ContactPerson string     `gorm:"size:64" json:"contactPerson"`
	ContactPhone  string     `gorm:"size:32" json:"contactPhone"`
	Priority      string     `gorm:"size:16;default:normal" json:"priority"`
	Location      string     `gorm:"size:255" json:"location"`
	Tags          string     `gorm:"size:512" json:"tags"`

	RegistrarID   string     `gorm:"index;not null" json:"registrarId"`
	RegistrarName string     `gorm:"size:64" json:"registrarName"`

	AuditorID     string     `gorm:"index" json:"auditorId"`
	AuditorName   string     `gorm:"size:64" json:"auditorName"`
	VerifyComment string     `gorm:"type:text" json:"verifyComment"`

	ReviewerID    string     `gorm:"index" json:"reviewerId"`
	ReviewerName  string     `gorm:"size:64" json:"reviewerName"`
	ArchiveResult string     `gorm:"type:text" json:"archiveResult"`

	LastHandlerID   string `gorm:"size:64" json:"lastHandlerId"`
	LastHandlerName string `gorm:"size:64" json:"lastHandlerName"`
	LastOpinion     string `gorm:"type:text" json:"lastOpinion"`
	LastResult      string `gorm:"size:255" json:"lastResult"`

	Status        ClueStatus `gorm:"size:32;not null;default:draft;index" json:"status"`
	StatusLabel   string     `gorm:"-" json:"statusLabel"`
	Version       int        `gorm:"default:1" json:"version"`
	DueAt         *time.Time `json:"dueAt"`
	SubmittedAt   *time.Time `json:"submittedAt"`
	AssignedAt    *time.Time `json:"assignedAt"`
	VerifiedAt    *time.Time `json:"verifiedAt"`
	ArchivedAt    *time.Time `json:"archivedAt"`

	Evidences    []Evidence    `gorm:"foreignKey:ClueID" json:"evidences,omitempty"`
	Operations   []OperationLog `gorm:"foreignKey:ClueID" json:"operations,omitempty"`
	Appeals      []AppealRecord `gorm:"foreignKey:ClueID" json:"appeals,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (c *NewsClue) CanView(userID string, userRole Role) bool {
	switch userRole {
	case RoleReviewer:
		return true
	case RoleAuditor:
		return c.AuditorID == "" || c.AuditorID == userID ||
			c.Status == StatusSubmitted || c.Status == StatusReSubmit
	case RoleRegistrar:
		return c.RegistrarID == userID
	default:
		return false
	}
}

func (c *NewsClue) IsHandler(userID string, userRole Role) bool {
	switch userRole {
	case RoleReviewer:
		return true
	case RoleAuditor:
		return c.AuditorID == userID
	case RoleRegistrar:
		return c.RegistrarID == userID
	default:
		return false
	}
}
