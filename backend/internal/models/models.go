package models

import (
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type Role string

const (
	RoleRegistrar    Role = "registrar"
	RoleSupervisor   Role = "supervisor"
	RoleReviewer     Role = "reviewer"
)

type ApplicationStatus string

const (
	StatusDraft             ApplicationStatus = "draft"
	StatusPendingScan       ApplicationStatus = "pending_scan"
	StatusScanFailed        ApplicationStatus = "scan_failed"
	StatusPendingReview     ApplicationStatus = "pending_review"
	StatusRevisionRequired  ApplicationStatus = "revision_required"
	StatusPendingApproval   ApplicationStatus = "pending_approval"
	StatusApproved          ApplicationStatus = "approved"
	StatusRejected          ApplicationStatus = "rejected"
	StatusArchived          ApplicationStatus = "archived"
)

type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"uniqueIndex;size:50;not null" json:"username"`
	Password  string    `gorm:"size:255;not null" json:"-"`
	Name      string    `gorm:"size:100;not null" json:"name"`
	Role      Role      `gorm:"size:20;not null;index" json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (u *User) HashPassword(password string) error {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.Password = string(hashed)
	return nil
}

func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	return err == nil
}

type Application struct {
	ID                    uint              `gorm:"primaryKey" json:"id"`
	ApplicationNo         string            `gorm:"uniqueIndex;size:50;not null" json:"application_no"`
	ApplicantName         string            `gorm:"size:100;not null" json:"applicant_name"`
	ApplicantIDCard       string            `gorm:"size:18;not null" json:"applicant_id_card"`
	ApplicantPhone        string            `gorm:"size:11;not null" json:"applicant_phone"`
	InsuranceType         string            `gorm:"size:50;not null" json:"insurance_type"`
	InsuranceAmount       float64           `gorm:"not null" json:"insurance_amount"`
	Premium               float64           `gorm:"not null" json:"premium"`
	QRCode                string            `gorm:"uniqueIndex;size:100;not null" json:"qr_code"`
	Status                ApplicationStatus `gorm:"size:30;not null;index" json:"status"`
	CurrentHandlerRole    Role              `gorm:"size:20;index" json:"current_handler_role"`
	CurrentHandlerID      *uint             `gorm:"index" json:"current_handler_id"`
	CurrentHandlerName    string            `gorm:"size:100" json:"current_handler_name"`
	Deadline              time.Time         `gorm:"index" json:"deadline"`
	ExceptionReason       string            `gorm:"size:500" json:"exception_reason"`
	LastProcessResult     string            `gorm:"size:500" json:"last_process_result"`
	LastProcessedAt       *time.Time        `json:"last_processed_at"`
	LastProcessedByID     *uint             `json:"last_processed_by_id"`
	LastProcessedByName   string            `gorm:"size:100" json:"last_processed_by_name"`
	Materials             string            `gorm:"type:text" json:"materials"`
	Notes                 string            `gorm:"type:text" json:"notes"`
	Version               int               `gorm:"default:1;not null" json:"version"`
	CreatedAt             time.Time         `json:"created_at"`
	UpdatedAt             time.Time         `json:"updated_at"`
	CurrentHandler        *User             `gorm:"foreignKey:CurrentHandlerID" json:"current_handler,omitempty"`
	ScanRecords           []ScanRecord      `json:"scan_records,omitempty"`
	ProcessRecords        []ProcessRecord   `json:"process_records,omitempty"`
}

type ScanRecord struct {
	ID                   uint              `gorm:"primaryKey" json:"id"`
	ApplicationID        uint              `gorm:"not null;index" json:"application_id"`
	QRCode               string            `gorm:"size:100;not null;index" json:"qr_code"`
	ScanTime             time.Time         `gorm:"not null;index" json:"scan_time"`
	ScannerID            uint              `gorm:"not null" json:"scanner_id"`
	ScannerName          string            `gorm:"size:100;not null" json:"scanner_name"`
	ScannerRole          Role              `gorm:"size:20;not null" json:"scanner_role"`
	Result               string            `gorm:"size:20;not null" json:"result"`
	FailureReason        string            `gorm:"size:500" json:"failure_reason"`
	Evidence             string            `gorm:"type:text" json:"evidence"`
	DeviceInfo           string            `gorm:"size:500" json:"device_info"`
	LocationInfo         string            `gorm:"size:500" json:"location_info"`
	StayInPlace          bool              `gorm:"default:false;not null" json:"stay_in_place"`
	ExpectedHandlerID    *uint             `gorm:"index" json:"expected_handler_id,omitempty"`
	ExpectedHandlerName  string            `gorm:"size:100" json:"expected_handler_name,omitempty"`
	StatusBefore         ApplicationStatus `gorm:"size:30;not null" json:"status_before"`
	StatusAfter          ApplicationStatus `gorm:"size:30;not null" json:"status_after"`
	CreatedAt            time.Time         `json:"created_at"`
	Application          Application       `gorm:"foreignKey:ApplicationID" json:"-"`
	Scanner              User              `gorm:"foreignKey:ScannerID" json:"-"`
}

type ProcessRecord struct {
	ID              uint              `gorm:"primaryKey" json:"id"`
	ApplicationID   uint              `gorm:"not null;index" json:"application_id"`
	Action          string            `gorm:"size:30;not null" json:"action"`
	FromStatus      ApplicationStatus `gorm:"size:30;not null" json:"from_status"`
	ToStatus        ApplicationStatus `gorm:"size:30;not null" json:"to_status"`
	HandlerRole     Role              `gorm:"size:20;not null" json:"handler_role"`
	HandlerID       uint              `gorm:"not null" json:"handler_id"`
	HandlerName     string            `gorm:"size:100;not null" json:"handler_name"`
	Opinion         string            `gorm:"type:text;not null" json:"opinion"`
	FailureReason   string            `gorm:"size:500" json:"failure_reason"`
	OldVersion      int               `gorm:"default:0" json:"old_version"`
	NewVersion      int               `gorm:"default:0" json:"new_version"`
	MaterialsChecked string           `gorm:"type:text" json:"materials_checked"`
	TimeLimitMet    bool              `gorm:"default:true" json:"time_limit_met"`
	ProcessingTime  int               `json:"processing_time_seconds"`
	AuditID         *uint             `gorm:"index" json:"audit_id,omitempty"`
	CreatedAt       time.Time         `json:"created_at"`
	Application     Application       `gorm:"foreignKey:ApplicationID" json:"-"`
	Handler         User              `gorm:"foreignKey:HandlerID" json:"-"`
}

type AuditLog struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	UserID        uint      `gorm:"not null;index" json:"user_id"`
	Username      string    `gorm:"size:50;not null" json:"username"`
	UserRole      Role      `gorm:"size:20;not null" json:"user_role"`
	Action        string    `gorm:"size:50;not null;index" json:"action"`
	ResourceType  string    `gorm:"size:30;not null" json:"resource_type"`
	ResourceID    uint      `json:"resource_id"`
	IPAddress     string    `gorm:"size:50" json:"ip_address"`
	UserAgent     string    `gorm:"size:500" json:"user_agent"`
	Details       string    `gorm:"type:text" json:"details"`
	CreatedAt     time.Time `gorm:"index" json:"created_at"`
}

type MaterialItem struct {
	Name     string `json:"name"`
	Required bool   `json:"required"`
	Provided bool   `json:"provided"`
	Verified bool   `json:"verified"`
	Notes    string `json:"notes,omitempty"`
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&User{},
		&Application{},
		&ScanRecord{},
		&ProcessRecord{},
		&AuditLog{},
	)
}

func SeedInitialData(db *gorm.DB) error {
	var count int64
	db.Model(&User{}).Count(&count)
	if count > 0 {
		return nil
	}

	users := []User{
		{Username: "registrar1", Name: "张登记员", Role: RoleRegistrar},
		{Username: "registrar2", Name: "李登记员", Role: RoleRegistrar},
		{Username: "supervisor1", Name: "王主管", Role: RoleSupervisor},
		{Username: "supervisor2", Name: "赵主管", Role: RoleSupervisor},
		{Username: "reviewer1", Name: "刘复核", Role: RoleReviewer},
		{Username: "reviewer2", Name: "陈复核", Role: RoleReviewer},
	}

	for i := range users {
		if err := users[i].HashPassword("123456"); err != nil {
			return err
		}
		if err := db.Create(&users[i]).Error; err != nil {
			return err
		}
	}

	return seedSampleApplications(db, users)
}

func seedSampleApplications(db *gorm.DB, users []User) error {
	now := time.Now()
	applications := []Application{
		{
			ApplicationNo: "INS20240600001",
			ApplicantName: "张三",
			ApplicantIDCard: "110101199001011234",
			ApplicantPhone: "13800138001",
			InsuranceType: "重疾险",
			InsuranceAmount: 500000,
			Premium: 8500,
			QRCode: "QR-INS-2024-00001",
			Status: StatusPendingScan,
			CurrentHandlerRole: RoleRegistrar,
			CurrentHandlerID: &users[0].ID,
			CurrentHandlerName: users[0].Name,
			Deadline: now.AddDate(0, 0, 3),
			LastProcessResult: "已提交投保资料，待扫码核验",
		},
		{
			ApplicationNo: "INS20240600002",
			ApplicantName: "李四",
			ApplicantIDCard: "110101199102022345",
			ApplicantPhone: "13800138002",
			InsuranceType: "寿险",
			InsuranceAmount: 1000000,
			Premium: 12000,
			QRCode: "QR-INS-2024-00002",
			Status: StatusPendingReview,
			CurrentHandlerRole: RoleSupervisor,
			CurrentHandlerID: &users[2].ID,
			CurrentHandlerName: users[2].Name,
			Deadline: now.AddDate(0, 0, 5),
			LastProcessResult: "扫码核验通过，待主管审核",
			LastProcessedAt: &now,
			LastProcessedByID: &users[0].ID,
			LastProcessedByName: users[0].Name,
		},
		{
			ApplicationNo: "INS20240600003",
			ApplicantName: "王五",
			ApplicantIDCard: "110101199203033456",
			ApplicantPhone: "13800138003",
			InsuranceType: "意外险",
			InsuranceAmount: 200000,
			Premium: 1200,
			QRCode: "QR-INS-2024-00003",
			Status: StatusRevisionRequired,
			CurrentHandlerRole: RoleRegistrar,
			CurrentHandlerID: &users[1].ID,
			CurrentHandlerName: users[1].Name,
			Deadline: now.AddDate(0, 0, 2),
			ExceptionReason: "缺少健康告知书，身份证照片模糊",
			LastProcessResult: "审核不通过，需补正材料",
			LastProcessedAt: &now,
			LastProcessedByID: &users[2].ID,
			LastProcessedByName: users[2].Name,
		},
		{
			ApplicationNo: "INS20240600004",
			ApplicantName: "赵六",
			ApplicantIDCard: "110101199304044567",
			ApplicantPhone: "13800138004",
			InsuranceType: "医疗险",
			InsuranceAmount: 300000,
			Premium: 3600,
			QRCode: "QR-INS-2024-00004",
			Status: StatusPendingApproval,
			CurrentHandlerRole: RoleReviewer,
			CurrentHandlerID: &users[4].ID,
			CurrentHandlerName: users[4].Name,
			Deadline: now.AddDate(0, 0, 7),
			LastProcessResult: "主管审核通过，待复核归档",
			LastProcessedAt: &now,
			LastProcessedByID: &users[2].ID,
			LastProcessedByName: users[2].Name,
		},
		{
			ApplicationNo: "INS20240600005",
			ApplicantName: "钱七",
			ApplicantIDCard: "110101199405055678",
			ApplicantPhone: "13800138005",
			InsuranceType: "重疾险",
			InsuranceAmount: 800000,
			Premium: 15000,
			QRCode: "QR-INS-2024-00005",
			Status: StatusScanFailed,
			CurrentHandlerRole: RoleRegistrar,
			CurrentHandlerID: &users[0].ID,
			CurrentHandlerName: users[0].Name,
			Deadline: now.AddDate(0, 0, 1),
			ExceptionReason: "二维码无效，可能已过期或被篡改",
			LastProcessResult: "扫码核验失败",
			LastProcessedAt: &now,
			LastProcessedByID: &users[0].ID,
			LastProcessedByName: users[0].Name,
		},
		{
			ApplicationNo: "INS20240600006",
			ApplicantName: "孙八",
			ApplicantIDCard: "110101199506066789",
			ApplicantPhone: "13800138006",
			InsuranceType: "寿险",
			InsuranceAmount: 1500000,
			Premium: 25000,
			QRCode: "QR-INS-2024-00006",
			Status: StatusArchived,
			CurrentHandlerRole: "",
			Deadline: now.AddDate(0, 0, -1),
			LastProcessResult: "已完成复核归档",
			LastProcessedAt: &now,
			LastProcessedByID: &users[4].ID,
			LastProcessedByName: users[4].Name,
		},
		{
			ApplicationNo: "INS20240600007",
			ApplicantName: "周九",
			ApplicantIDCard: "110101199607077890",
			ApplicantPhone: "13800138007",
			InsuranceType: "意外险",
			InsuranceAmount: 500000,
			Premium: 2500,
			QRCode: "QR-INS-2024-00007",
			Status: StatusRejected,
			CurrentHandlerRole: "",
			Deadline: now.AddDate(0, 0, -5),
			ExceptionReason: "投保信息不实，存在既往病史未告知",
			LastProcessResult: "复核不通过，予以拒保",
			LastProcessedAt: &now,
			LastProcessedByID: &users[5].ID,
			LastProcessedByName: users[5].Name,
		},
	}

	for i := range applications {
		if err := db.Create(&applications[i]).Error; err != nil {
			return err
		}
	}

	return nil
}
