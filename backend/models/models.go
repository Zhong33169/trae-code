package models

import (
	"time"
)

type Role string

const (
	RoleWarehouseKeeper    Role = "warehouse_keeper"
	RoleWarehouseSupervisor Role = "warehouse_supervisor"
	RoleOperationManager   Role = "operation_manager"
)

type OrderStatus string

const (
	StatusPendingSubmit   OrderStatus = "pending_submit"
	StatusReturned        OrderStatus = "returned"
	StatusResubmitted     OrderStatus = "resubmitted"
	StatusPendingVerify   OrderStatus = "pending_verify"
	StatusVerifyPassed    OrderStatus = "verify_passed"
	StatusPendingReview   OrderStatus = "pending_review"
	StatusReviewPassed    OrderStatus = "review_passed"
	StatusArchived        OrderStatus = "archived"
)

type User struct {
	ID       int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	Username string `gorm:"size:50;uniqueIndex;not null" json:"username"`
	Password string `gorm:"size:100;not null" json:"-"`
	RealName string `gorm:"size:50;not null" json:"real_name"`
	Role     Role   `gorm:"size:30;not null;index" json:"role"`
	CreateAt time.Time `gorm:"autoCreateTime" json:"create_at"`
	UpdateAt time.Time `gorm:"autoUpdateTime" json:"update_at"`
}

type InventoryAdjustOrder struct {
	ID             int64       `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderNo        string      `gorm:"size:32;uniqueIndex;not null" json:"order_no"`
	Title          string      `gorm:"size:200;not null" json:"title"`
	AdjustType     string      `gorm:"size:50;not null" json:"adjust_type"`
	Warehouse      string      `gorm:"size:100;not null" json:"warehouse"`
	SKU            string      `gorm:"size:100;not null" json:"sku"`
	ProductName    string      `gorm:"size:200;not null" json:"product_name"`
	BatchNo        string      `gorm:"size:50" json:"batch_no"`
	SystemStock    int         `gorm:"not null" json:"system_stock"`
	ActualStock    int         `gorm:"not null" json:"actual_stock"`
	AdjustQuantity int         `gorm:"not null" json:"adjust_quantity"`
	AdjustReason   string      `gorm:"type:text;not null" json:"adjust_reason"`
	Status         OrderStatus `gorm:"size:30;not null;index" json:"status"`
	Version        int         `gorm:"not null;default:1" json:"version"`
	CreatedBy      int64       `gorm:"not null" json:"created_by"`
	CreatedByName  string      `gorm:"size:50;not null" json:"created_by_name"`
	VerifiedBy     *int64      `json:"verified_by"`
	VerifiedByName *string     `gorm:"size:50" json:"verified_by_name"`
	VerifiedAt     *time.Time  `json:"verified_at"`
	VerifyOpinion  *string     `gorm:"type:text" json:"verify_opinion"`
	ReviewedBy     *int64      `json:"reviewed_by"`
	ReviewedByName *string     `gorm:"size:50" json:"reviewed_by_name"`
	ReviewedAt     *time.Time  `json:"reviewed_at"`
	ReviewOpinion  *string     `gorm:"type:text" json:"review_opinion"`
	ArchivedBy     *int64      `json:"archived_by"`
	ArchivedByName *string     `gorm:"size:50" json:"archived_by_name"`
	ArchivedAt     *time.Time  `json:"archived_at"`
	ReturnReason   *string     `gorm:"type:text" json:"return_reason"`
	ReturnedBy     *int64      `json:"returned_by"`
	ReturnedByName *string     `gorm:"size:50" json:"returned_by_name"`
	ReturnedAt     *time.Time  `json:"returned_at"`
	CreateAt       time.Time   `gorm:"autoCreateTime;index" json:"create_at"`
	UpdateAt       time.Time   `gorm:"autoUpdateTime" json:"update_at"`
	Creator        *User       `gorm:"foreignKey:CreatedBy" json:"-"`
}

type EvidenceType string

const (
	EvidenceTypeRegister EvidenceType = "register"
	EvidenceTypeVerify   EvidenceType = "verify"
	EvidenceTypeReview   EvidenceType = "review"
	EvidenceTypeSupplement EvidenceType = "supplement"
)

type OrderEvidence struct {
	ID         int64        `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID    int64        `gorm:"not null;index" json:"order_id"`
	Type       EvidenceType `gorm:"size:30;not null" json:"type"`
	FileName   string       `gorm:"size:200;not null" json:"file_name"`
	FileType   string       `gorm:"size:50" json:"file_type"`
	FileSize   int64        `json:"file_size"`
	Remark     string       `gorm:"type:text" json:"remark"`
	UploadedBy int64        `gorm:"not null" json:"uploaded_by"`
	UploadByName string     `gorm:"size:50;not null" json:"upload_by_name"`
	CreateAt   time.Time    `gorm:"autoCreateTime" json:"create_at"`
	Order      *InventoryAdjustOrder `gorm:"foreignKey:OrderID" json:"-"`
}

type SupplementType string

const (
	SupplementTypeException SupplementType = "exception"
	SupplementTypeCorrect   SupplementType = "correct"
	SupplementTypeReview    SupplementType = "review"
)

type SupplementRecord struct {
	ID           int64           `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID      int64           `gorm:"not null;index" json:"order_id"`
	Type         SupplementType  `gorm:"size:30;not null" json:"type"`
	Content      string          `gorm:"type:text;not null" json:"content"`
	FieldName    string          `gorm:"size:100" json:"field_name"`
	OldValue     string          `gorm:"type:text" json:"old_value"`
	NewValue     string          `gorm:"type:text" json:"new_value"`
	Reason       string          `gorm:"type:text;not null" json:"reason"`
	SupplementedBy int64         `gorm:"not null" json:"supplemented_by"`
	SupplementedByName string    `gorm:"size:50;not null" json:"supplemented_by_name"`
	CreateAt     time.Time       `gorm:"autoCreateTime" json:"create_at"`
	Order        *InventoryAdjustOrder `gorm:"foreignKey:OrderID" json:"-"`
}

type OperationLog struct {
	ID          int64       `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID     int64       `gorm:"index" json:"order_id"`
	Operation   string      `gorm:"size:100;not null" json:"operation"`
	OldStatus   OrderStatus `gorm:"size:30" json:"old_status"`
	NewStatus   OrderStatus `gorm:"size:30" json:"new_status"`
	OperatorID  int64       `gorm:"not null" json:"operator_id"`
	OperatorName string     `gorm:"size:50;not null" json:"operator_name"`
	OperatorRole Role       `gorm:"size:30;not null" json:"operator_role"`
	Remark      string      `gorm:"type:text" json:"remark"`
	CreateAt    time.Time   `gorm:"autoCreateTime" json:"create_at"`
}
