package config

const (
	Port        = ":8006"
	DBPath      = "./data/app.db"
	FrontendURL = "http://localhost:3006"
)

const (
	RoleRegistrar  = "registrar"
	RoleSupervisor = "supervisor"
	RoleReviewer   = "reviewer"
)

const (
	StatusDraft         = "draft"
	StatusPendingReview = "pending_review"
	StatusReviewPassed  = "review_passed"
	StatusReviewRejected = "review_rejected"
	StatusReviewApproved = "review_approved"
	StatusReviewReturned = "review_returned"
)

const (
	EvidenceTypeRegistration = "registration"
	EvidenceTypeProcess      = "process"
	EvidenceTypeReview       = "review"
)

const (
	CodeParamError     = 40001
	CodeUnauthorized   = 40101
	CodeForbidden      = 40301
	CodeStatusInvalid  = 40302
	CodeVersionConflict = 40303
	CodeMissingEvidence = 40304
	CodeNotFound       = 40401
	CodeServerError    = 50000
	CodeSuccess        = 0
)

const (
	ActionCreate         = "create"
	ActionSubmit         = "submit"
	ActionUpdate         = "update"
	ActionSupervisorPass = "supervisor_pass"
	ActionSupervisorReject = "supervisor_reject"
	ActionReviewerApprove = "reviewer_approve"
	ActionReviewerReturn  = "reviewer_return"
)
