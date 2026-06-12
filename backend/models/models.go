package models

import "time"

type Role string

const (
	RoleClerk          Role = "clerk"
	RoleSupervisor     Role = "supervisor"
	RoleStationChief   Role = "station_chief"
)

type HazardStatus string

const (
	StatusPending   HazardStatus = "pending"
	StatusAssigned  HazardStatus = "assigned"
	StatusRevisited HazardStatus = "revisited"
)

type NodeType string

const (
	NodeReport    NodeType = "report"
	NodeAssign    NodeType = "assign"
	NodeRectify   NodeType = "rectify"
	NodeRecheck   NodeType = "recheck"
	NodeConfirm   NodeType = "confirm"
)

type User struct {
	ID         int64     `json:"id"`
	Username   string    `json:"username"`
	Password   string    `json:"-"`
	Name       string    `json:"name"`
	Role       Role      `json:"role"`
	Station    string    `json:"station"`
	CreatedAt  time.Time `json:"created_at"`
}

type HazardOrder struct {
	ID               int64        `json:"id"`
	OrderNo          string       `json:"order_no"`
	Title            string       `json:"title"`
	Description      string       `json:"description"`
	Location         string       `json:"location"`
	HazardLevel      string       `json:"hazard_level"`
	Status           HazardStatus `json:"status"`
	CurrentNode      NodeType     `json:"current_node"`
	ReporterID       int64        `json:"reporter_id"`
	ReporterName     string       `json:"reporter_name"`
	SupervisorID     *int64       `json:"supervisor_id"`
	SupervisorName   string       `json:"supervisor_name"`
	StationChiefID   *int64       `json:"station_chief_id"`
	StationChiefName string       `json:"station_chief_name"`
	RectifyDeadline  *time.Time   `json:"rectify_deadline"`
	RecheckDeadline  *time.Time   `json:"recheck_deadline"`
	IsTimeout        bool         `json:"is_timeout"`
	CreatedAt        time.Time    `json:"created_at"`
	UpdatedAt        time.Time    `json:"updated_at"`
}

type HazardReport struct {
	ID          int64     `json:"id"`
	OrderID     int64     `json:"order_id"`
	ReporterID  int64     `json:"reporter_id"`
	Content     string    `json:"content"`
	Images      string    `json:"images"`
	NodeDeadline time.Time `json:"node_deadline"`
	CreatedAt   time.Time `json:"created_at"`
}

type RectificationNotice struct {
	ID            int64     `json:"id"`
	OrderID       int64     `json:"order_id"`
	IssuerID      int64     `json:"issuer_id"`
	Content       string    `json:"content"`
	Deadline      time.Time `json:"deadline"`
	NodeDeadline  time.Time `json:"node_deadline"`
	CreatedAt     time.Time `json:"created_at"`
}

type RectificationRecord struct {
	ID            int64     `json:"id"`
	OrderID       int64     `json:"order_id"`
	SubmitterID   int64     `json:"submitter_id"`
	Content       string    `json:"content"`
	Images        string    `json:"images"`
	SubmittedAt   time.Time `json:"submitted_at"`
}

type RecheckRecord struct {
	ID           int64     `json:"id"`
	OrderID      int64     `json:"order_id"`
	CheckerID    int64     `json:"checker_id"`
	Content      string    `json:"content"`
	Result       string    `json:"result"`
	Images       string    `json:"images"`
	NodeDeadline time.Time `json:"node_deadline"`
	CheckedAt    time.Time `json:"checked_at"`
}

type TimeoutRecord struct {
	ID              int64     `json:"id"`
	OrderID         int64     `json:"order_id"`
	NodeType        NodeType  `json:"node_type"`
	TimeoutReason   string    `json:"timeout_reason"`
	HandleAction    string    `json:"handle_action"`
	HandlerID       int64     `json:"handler_id"`
	HandlerName     string    `json:"handler_name"`
	OriginalDeadline time.Time `json:"original_deadline"`
	NewDeadline     *time.Time `json:"new_deadline"`
	CreatedAt       time.Time `json:"created_at"`
}

type OperationLog struct {
	ID          int64        `json:"id"`
	OrderID     int64        `json:"order_id"`
	UserID      int64        `json:"user_id"`
	UserName    string       `json:"user_name"`
	Action      string       `json:"action"`
	FromStatus  HazardStatus `json:"from_status"`
	ToStatus    HazardStatus `json:"to_status"`
	FromNode    NodeType     `json:"from_node"`
	ToNode      NodeType     `json:"to_node"`
	Remark      string       `json:"remark"`
	CreatedAt   time.Time    `json:"created_at"`
}

type Statistics struct {
	Total       int64 `json:"total"`
	Pending     int64 `json:"pending"`
	Assigned    int64 `json:"assigned"`
	Revisited   int64 `json:"revisited"`
	Timeout     int64 `json:"timeout"`
	ThisMonth   int64 `json:"this_month"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  *User  `json:"user"`
}
