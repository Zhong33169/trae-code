package model

type User struct {
	ID   string `json:"id" db:"id"`
	Name string `json:"name" db:"name"`
	Role string `json:"role" db:"role"`
}

type KnowledgeItem struct {
	ID         string `json:"id" db:"id"`
	Title      string `json:"title" db:"title"`
	Category   string `json:"category" db:"category"`
	ExpiryDate string `json:"expiry_date" db:"expiry_date"`
	Status     string `json:"status" db:"status"`
}

type KnowledgeRevisionOrder struct {
	ID                 string              `json:"id" db:"id"`
	OrderNo            string              `json:"order_no" db:"order_no"`
	Title              string              `json:"title" db:"title"`
	KnowledgeItemID    string              `json:"knowledge_item_id" db:"knowledge_item_id"`
	KnowledgeItemTitle string              `json:"knowledge_item_title" db:"-"`
	Status             string              `json:"status" db:"status"`
	IsOverdue          bool                `json:"is_overdue" db:"is_overdue"`
	OverdueDays        int                 `json:"overdue_days" db:"overdue_days"`
	OverdueReason      string              `json:"overdue_reason" db:"overdue_reason"`
	OverdueAction      string              `json:"overdue_action" db:"overdue_action"`
	CreatorID          string              `json:"creator_id" db:"creator_id"`
	CreatorName        string              `json:"creator_name" db:"-"`
	CurrentHandlerID   string              `json:"current_handler_id" db:"current_handler_id"`
	CurrentHandlerName string              `json:"current_handler_name" db:"-"`
	CurrentHandlerRole string              `json:"current_handler_role" db:"current_handler_role"`
	TimeLimitHours     int                 `json:"time_limit_hours" db:"time_limit_hours"`
	Deadline           string              `json:"deadline" db:"deadline"`
	RevisionBefore     string              `json:"revision_before" db:"revision_before"`
	RevisionAfter      string              `json:"revision_after" db:"revision_after"`
	RevisionDesc       string              `json:"revision_description" db:"revision_description"`
	ProcessingOpinion  string              `json:"processing_opinion" db:"processing_opinion"`
	Version            int                 `json:"version" db:"version"`
	CreatedAt          string              `json:"created_at" db:"created_at"`
	UpdatedAt          string              `json:"updated_at" db:"updated_at"`
	Materials          []Material          `json:"materials"`
	Feedbacks          []KnowledgeFeedback `json:"feedbacks"`
}

type Material struct {
	ID         string `json:"id" db:"id"`
	OrderID    string `json:"order_id" db:"order_id"`
	Name       string `json:"name" db:"name"`
	FileType   string `json:"file_type" db:"file_type"`
	IsComplete bool   `json:"is_complete" db:"is_complete"`
	UploadedAt string `json:"uploaded_at" db:"uploaded_at"`
}

type KnowledgeFeedback struct {
	ID         string  `json:"id" db:"id"`
	OrderID    string  `json:"order_id" db:"order_id"`
	Content    string  `json:"content" db:"content"`
	IsResolved bool    `json:"is_resolved" db:"is_resolved"`
	ResolvedAt *string `json:"resolved_at" db:"resolved_at"`
}

type AuditLog struct {
	ID            string `json:"id" db:"id"`
	OrderID       string `json:"order_id" db:"order_id"`
	OrderNo       string `json:"order_no" db:"order_no"`
	Action        string `json:"action" db:"action"`
	ActorID       string `json:"actor_id" db:"actor_id"`
	ActorName     string `json:"actor_name" db:"actor_name"`
	ActorRole     string `json:"actor_role" db:"actor_role"`
	FromStatus    string `json:"from_status" db:"from_status"`
	ToStatus      string `json:"to_status" db:"to_status"`
	Opinion       string `json:"opinion" db:"opinion"`
	Reason        string `json:"reason" db:"reason"`
	FailureReason string `json:"failure_reason" db:"failure_reason"`
	CreatedAt     string `json:"created_at" db:"created_at"`
}

type MaterialInput struct {
	Name       string `json:"name"`
	FileType   string `json:"file_type"`
	IsComplete bool   `json:"is_complete"`
}

type FeedbackInput struct {
	Content    string `json:"content"`
	IsResolved bool   `json:"is_resolved"`
}

type CreateOrderRequest struct {
	Title           string          `json:"title"`
	KnowledgeItemID string          `json:"knowledge_item_id"`
	RevisionBefore  string          `json:"revision_before"`
	RevisionAfter   string          `json:"revision_after"`
	RevisionDesc    string          `json:"revision_description"`
	TimeLimitHours  int             `json:"time_limit_hours"`
	Materials       []MaterialInput `json:"materials"`
	Feedbacks       []FeedbackInput `json:"feedbacks"`
}

type AdvanceRequest struct {
	Opinion       string `json:"opinion"`
	OverdueReason string `json:"overdue_reason"`
	OverdueAction string `json:"overdue_action"`
	Version       int    `json:"version"`
}

type ReturnRequest struct {
	Reason  string `json:"reason"`
	Version int    `json:"version"`
}

type CorrectRequest struct {
	Materials      []MaterialInput `json:"materials"`
	RevisionBefore string          `json:"revision_before"`
	RevisionAfter  string          `json:"revision_after"`
	RevisionDesc   string          `json:"revision_description"`
	CorrectionNote string          `json:"correction_note"`
	Version        int             `json:"version"`
	Feedbacks      []FeedbackInput `json:"feedbacks"`
}

type BatchRequest struct {
	OrderIDs        []string `json:"order_ids"`
	OpinionOrReason string   `json:"opinion_or_reason"`
}

type OrderListQuery struct {
	Status    string `form:"status"`
	Role      string `form:"role"`
	IsOverdue string `form:"is_overdue"`
	Keyword   string `form:"keyword"`
	Page      int    `form:"page"`
	PageSize  int    `form:"page_size"`
}

type APIResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail"`
}

type StatsResponse struct {
	Total              int `json:"total"`
	PendingReview      int `json:"pending_review"`
	PendingCorrection  int `json:"pending_correction"`
	PendingFinalReview int `json:"pending_final_review"`
	Archived           int `json:"archived"`
	Overdue            int `json:"overdue"`
}
