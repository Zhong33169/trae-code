package models

import (
	"database/sql"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

type User struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Role     string `json:"role"`
	RoleName string `json:"role_name"`
	Dept     string `json:"dept"`
}

const (
	StatusDraft           = "draft"
	StatusSubmitted       = "submitted"
	StatusUnderReview     = "under_review"
	StatusEvidenceMissing = "evidence_missing"
	StatusOverdue         = "overdue"
	StatusCorrectionReq   = "correction_requested"
	StatusResubmitted     = "resubmitted"
	StatusReviewPassed    = "review_passed"
	StatusUnderFinal      = "under_final_review"
	StatusConflict        = "status_conflict"
	StatusArchived        = "archived"
	StatusRejected        = "rejected"

	StatusAppealSubmitted = "appeal_submitted"
	StatusAppealAccepted  = "appeal_accepted"
	StatusAppealRejected  = "appeal_rejected"
	StatusAppealResolved  = "appeal_resolved"

	RoleRegistrar = "registrar"
	RoleReviewer  = "reviewer"
	RoleDirector  = "director"
)

type Consultation struct {
	ID              string    `json:"id"`
	Title           string    `json:"title"`
	PatientName     string    `json:"patient_name"`
	PatientID       string    `json:"patient_id"`
	Dept            string    `json:"dept"`
	ChiefComplaint  string    `json:"chief_complaint"`
	ConsultType     string    `json:"consult_type"`
	ConsultDept     string    `json:"consult_dept"`
	Status          string    `json:"status"`
	StatusName      string    `json:"status_name"`
	Version         int       `json:"version"`
	RegistrarID     string    `json:"registrar_id"`
	RegistrarName   string    `json:"registrar_name"`
	ReviewerID      string    `json:"reviewer_id"`
	ReviewerName    string    `json:"reviewer_name"`
	DirectorID      string    `json:"director_id"`
	DirectorName    string    `json:"director_name"`
	LatestOpinion   string    `json:"latest_opinion"`
	LatestRejectReason string `json:"latest_reject_reason"`
	EvidenceList    string    `json:"evidence_list"`
	IsOverdue       bool      `json:"is_overdue"`
	HasAppeal       bool      `json:"has_appeal"`
	AppealStatus    string    `json:"appeal_status"`
	AppealStatusName string   `json:"appeal_status_name"`
	AppealReason    string    `json:"appeal_reason"`
	Deadline        time.Time `json:"deadline"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type HistoryRecord struct {
	ID            string    `json:"id"`
	ConsultationID string   `json:"consultation_id"`
	OperatorID    string    `json:"operator_id"`
	OperatorName  string    `json:"operator_name"`
	OperatorRole  string    `json:"operator_role"`
	OperatorRoleName string   `json:"operator_role_name"`
	Action        string    `json:"action"`
	ActionName    string    `json:"action_name"`
	FromStatus    string    `json:"from_status"`
	FromStatusName string   `json:"from_status_name"`
	ToStatus      string    `json:"to_status"`
	ToStatusName  string    `json:"to_status_name"`
	Opinion       string    `json:"opinion"`
	RejectReason  string    `json:"reject_reason"`
	Version       int       `json:"version"`
	CreatedAt     time.Time `json:"created_at"`
}

func InitDB(path string) error {
	var err error
	DB, err = sql.Open("sqlite3", path+"?_foreign_keys=on&_journal_mode=WAL")
	if err != nil {
		return err
	}
	return migrate()
}

func CloseDB() {
	if DB != nil {
		DB.Close()
	}
}

func migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		role TEXT NOT NULL,
		role_name TEXT NOT NULL,
		dept TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS consultations (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		patient_name TEXT NOT NULL,
		patient_id TEXT NOT NULL,
		dept TEXT NOT NULL,
		chief_complaint TEXT,
		consult_type TEXT NOT NULL,
		consult_dept TEXT NOT NULL,
		status TEXT NOT NULL,
		status_name TEXT NOT NULL,
		version INTEGER DEFAULT 1,
		registrar_id TEXT NOT NULL,
		registrar_name TEXT NOT NULL,
		reviewer_id TEXT,
		reviewer_name TEXT,
		director_id TEXT,
		director_name TEXT,
		latest_opinion TEXT,
		latest_reject_reason TEXT,
		evidence_list TEXT,
		is_overdue INTEGER DEFAULT 0,
		has_appeal INTEGER DEFAULT 0,
		appeal_status TEXT,
		appeal_status_name TEXT,
		appeal_reason TEXT,
		deadline DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS history_records (
		id TEXT PRIMARY KEY,
		consultation_id TEXT NOT NULL,
		operator_id TEXT NOT NULL,
		operator_name TEXT NOT NULL,
		operator_role TEXT NOT NULL,
		operator_role_name TEXT NOT NULL,
		action TEXT NOT NULL,
		action_name TEXT NOT NULL,
		from_status TEXT,
		from_status_name TEXT,
		to_status TEXT NOT NULL,
		to_status_name TEXT NOT NULL,
		opinion TEXT,
		reject_reason TEXT,
		version INTEGER DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (consultation_id) REFERENCES consultations(id)
	);

	CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
	CREATE INDEX IF NOT EXISTS idx_consultations_registrar ON consultations(registrar_id);
	CREATE INDEX IF NOT EXISTS idx_consultations_reviewer ON consultations(reviewer_id);
	CREATE INDEX IF NOT EXISTS idx_consultations_director ON consultations(director_id);
	CREATE INDEX IF NOT EXISTS idx_history_consultation ON history_records(consultation_id);
	`
	_, err := DB.Exec(schema)
	return err
}
