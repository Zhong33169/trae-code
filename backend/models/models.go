package models

import "time"

type Role string

const (
	RoleHRSpecialist     Role = "hr_specialist"
	RoleSalarySupervisor Role = "salary_supervisor"
	RoleHRBPLeader       Role = "hrbp_leader"
)

type User struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	Password  string    `json:"-"`
	RealName  string    `json:"real_name"`
	Role      Role      `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type Employee struct {
	ID            int64     `json:"id"`
	EmployeeNo    string    `json:"employee_no"`
	Name          string    `json:"name"`
	Department    string    `json:"department"`
	Position      string    `json:"position"`
	CurrentSalary float64   `json:"current_salary"`
	CreatedAt     time.Time `json:"created_at"`
}

type ApplicationStatus string

const (
	StatusPendingReview   ApplicationStatus = "pending_review"
	StatusBudgetChecking  ApplicationStatus = "budget_checking"
	StatusPendingConfirm  ApplicationStatus = "pending_confirm"
	StatusApproved        ApplicationStatus = "approved"
	StatusSynced          ApplicationStatus = "synced"
	StatusRejected        ApplicationStatus = "rejected"
)

type ApplicationType string

const (
	TypeTransfer         ApplicationType = "transfer"
	TypeSalaryAdjustment ApplicationType = "salary_adjustment"
	TypeBoth             ApplicationType = "both"
)

type TransferApplication struct {
	ID              int64             `json:"id"`
	ApplicationNo   string            `json:"application_no"`
	EmployeeID      int64             `json:"employee_id"`
	Employee        *Employee         `json:"employee,omitempty"`
	Type            ApplicationType   `json:"type"`
	FromDepartment  string            `json:"from_department"`
	ToDepartment    string            `json:"to_department"`
	FromPosition    string            `json:"from_position"`
	ToPosition      string            `json:"to_position"`
	FromSalary      float64           `json:"from_salary"`
	ToSalary        float64           `json:"to_salary"`
	Reason          string            `json:"reason"`
	Status          ApplicationStatus `json:"status"`
	CurrentNode     string            `json:"current_node"`
	BudgetVerified  bool              `json:"budget_verified"`
	SalaryProcessed bool              `json:"salary_processed"`
	Registered      bool              `json:"registered"`
	CreatedBy       int64             `json:"created_by"`
	Creator         *User             `json:"creator,omitempty"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
	NodeDeadline    *time.Time        `json:"node_deadline,omitempty"`
	IsTimeout       bool              `json:"is_timeout"`
	TimeoutReason   string            `json:"timeout_reason,omitempty"`
	Trails          []ProcessingTrail `json:"trails,omitempty"`
}

type ProcessingTrail struct {
	ID          int64     `json:"id"`
	ApplicationID int64   `json:"application_id"`
	Node        string    `json:"node"`
	HandlerID   *int64    `json:"handler_id,omitempty"`
	Handler     *User     `json:"handler,omitempty"`
	Action      string    `json:"action"`
	Remark      string    `json:"remark,omitempty"`
	Status      string    `json:"status"`
	IsTimeout   bool      `json:"is_timeout"`
	CreatedAt   time.Time `json:"created_at"`
}

type OperationLog struct {
	ID         int64     `json:"id"`
	UserID     int64     `json:"user_id"`
	User       *User     `json:"user,omitempty"`
	Action     string    `json:"action"`
	TargetType string    `json:"target_type,omitempty"`
	TargetID   int64     `json:"target_id,omitempty"`
	Detail     string    `json:"detail,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  *User  `json:"user"`
}

type CreateApplicationRequest struct {
	EmployeeID     int64           `json:"employee_id"`
	Type           ApplicationType `json:"type"`
	FromDepartment string          `json:"from_department"`
	ToDepartment   string          `json:"to_department"`
	FromPosition   string          `json:"from_position"`
	ToPosition     string          `json:"to_position"`
	FromSalary     float64         `json:"from_salary"`
	ToSalary       float64         `json:"to_salary"`
	Reason         string          `json:"reason"`
}

type ProcessApplicationRequest struct {
	Action        string `json:"action"`
	Remark        string `json:"remark"`
	TimeoutReason string `json:"timeout_reason"`
}

type Statistics struct {
	Total          int64 `json:"total"`
	PendingReview  int64 `json:"pending_review"`
	BudgetChecking int64 `json:"budget_checking"`
	PendingConfirm int64 `json:"pending_confirm"`
	Approved       int64 `json:"approved"`
	Synced         int64 `json:"synced"`
	Rejected       int64 `json:"rejected"`
	TimeoutCount   int64 `json:"timeout_count"`
}

type BatchOperationRequest struct {
	IDs    []int64 `json:"ids"`
	Action string  `json:"action"`
	Remark string  `json:"remark"`
}
