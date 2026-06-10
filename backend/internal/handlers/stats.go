package handlers

import (
	"encoding/json"
	"net/http"
	"repair-system/internal/database"
	"repair-system/internal/middleware"
	"repair-system/internal/models"
)

type TodoCount struct {
	Registrar  int64 `json:"registrar"`
	Supervisor int64 `json:"supervisor"`
	Reviewer   int64 `json:"reviewer"`
}

type StatusCount struct {
	Draft                 int64 `json:"draft"`
	Submitted             int64 `json:"submitted"`
	ReturnedToRegistrar   int64 `json:"returned_to_registrar"`
	Resubmitted           int64 `json:"resubmitted"`
	SupervisorApproved    int64 `json:"supervisor_approved"`
	SupervisorRejected    int64 `json:"supervisor_rejected"`
	HighRiskEscalated     int64 `json:"high_risk_escalated"`
	ReviewerApproved      int64 `json:"reviewer_approved"`
	ReviewerRejected      int64 `json:"reviewer_rejected"`
	Archived              int64 `json:"archived"`
	Overdue               int64 `json:"overdue"`
}

type RiskCount struct {
	Low    int64 `json:"low"`
	Medium int64 `json:"medium"`
	High   int64 `json:"high"`
}

type StageCount struct {
	Appointment int64 `json:"appointment"`
	Dispatch    int64 `json:"dispatch"`
	Delivery    int64 `json:"delivery"`
}

type OverviewStats struct {
	TodoByRole   TodoCount   `json:"todo_by_role"`
	ByStatus     StatusCount `json:"by_status"`
	ByRisk       RiskCount   `json:"by_risk"`
	ByStage      StageCount  `json:"by_stage"`
	MyTodo       int64       `json:"my_todo"`
	TotalOrders  int64       `json:"total_orders"`
}

func GetOverviewStats(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetCurrentUser(r.Context())
	if currentUser == nil {
		http.Error(w, `{"error": "未登录"}`, http.StatusUnauthorized)
		return
	}

	stats := OverviewStats{}

	db := database.DB.Model(&models.RepairOrder{})

	db.Count(&stats.TotalOrders)

	db.Where("status IN ?", []string{
		models.StatusDraft,
		models.StatusReturnedToRegistrar,
		models.StatusSupervisorRejected,
	}).Where("current_handler = ? OR created_by_id = ?", models.RoleRegistrar, currentUser.ID).
		Where("current_handler = ?", models.RoleRegistrar).
		Count(&stats.TodoByRole.Registrar)

	db.Where("status IN ?", []string{
		models.StatusSubmitted,
		models.StatusResubmitted,
		models.StatusHighRiskEscalated,
	}).Where("current_handler = ?", models.RoleSupervisor).
		Count(&stats.TodoByRole.Supervisor)

	db.Where("status = ?", models.StatusSupervisorApproved).
		Where("current_handler = ?", models.RoleReviewer).
		Count(&stats.TodoByRole.Reviewer)

	db.Where("status = ?", models.StatusDraft).Count(&stats.ByStatus.Draft)
	db.Where("status = ?", models.StatusSubmitted).Count(&stats.ByStatus.Submitted)
	db.Where("status = ?", models.StatusReturnedToRegistrar).Count(&stats.ByStatus.ReturnedToRegistrar)
	db.Where("status = ?", models.StatusResubmitted).Count(&stats.ByStatus.Resubmitted)
	db.Where("status = ?", models.StatusSupervisorApproved).Count(&stats.ByStatus.SupervisorApproved)
	db.Where("status = ?", models.StatusSupervisorRejected).Count(&stats.ByStatus.SupervisorRejected)
	db.Where("status = ?", models.StatusHighRiskEscalated).Count(&stats.ByStatus.HighRiskEscalated)
	db.Where("status = ?", models.StatusReviewerApproved).Count(&stats.ByStatus.ReviewerApproved)
	db.Where("status = ?", models.StatusReviewerRejected).Count(&stats.ByStatus.ReviewerRejected)
	db.Where("status = ?", models.StatusArchived).Count(&stats.ByStatus.Archived)
	db.Where("status = ?", models.StatusOverdue).Count(&stats.ByStatus.Overdue)

	db.Where("risk_level = ?", models.RiskLow).Count(&stats.ByRisk.Low)
	db.Where("risk_level = ?", models.RiskMedium).Count(&stats.ByRisk.Medium)
	db.Where("risk_level = ?", models.RiskHigh).Count(&stats.ByRisk.High)

	db.Where("stage = ?", models.StageAppointment).Count(&stats.ByStage.Appointment)
	db.Where("stage = ?", models.StageDispatch).Count(&stats.ByStage.Dispatch)
	db.Where("stage = ?", models.StageDelivery).Count(&stats.ByStage.Delivery)

	switch currentUser.Role {
	case models.RoleRegistrar:
		db.Where("status IN ?", []string{
			models.StatusDraft,
			models.StatusReturnedToRegistrar,
			models.StatusSupervisorRejected,
		}).Where("created_by_id = ?", currentUser.ID).Count(&stats.MyTodo)
	case models.RoleSupervisor:
		db.Where("status IN ?", []string{
			models.StatusSubmitted,
			models.StatusResubmitted,
			models.StatusHighRiskEscalated,
		}).Where("current_handler = ?", models.RoleSupervisor).Count(&stats.MyTodo)
	case models.RoleReviewer:
		db.Where("status = ?", models.StatusSupervisorApproved).
			Where("current_handler = ?", models.RoleReviewer).Count(&stats.MyTodo)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
