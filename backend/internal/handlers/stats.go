package handlers

import (
	"consultation-system/internal/middleware"
	"consultation-system/internal/models"

	"github.com/gofiber/fiber/v2"
)

type StatsResponse struct {
	Total        int `json:"total"`
	Draft        int `json:"draft"`
	Submitted    int `json:"submitted"`
	UnderReview  int `json:"under_review"`
	ReviewPassed int `json:"review_passed"`
	UnderFinal   int `json:"under_final"`
	Archived     int `json:"archived"`
	Rejected     int `json:"rejected"`
	Correction   int `json:"correction_requested"`
	EvidenceMiss int `json:"evidence_missing"`
	Conflict     int `json:"status_conflict"`
	Appeal       int `json:"appeal_total"`
	Overdue      int `json:"overdue"`
	Resubmitted  int `json:"resubmitted"`
}

func GetStats(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)

	var stats StatsResponse
	var err error

	if user.Role == models.RoleRegistrar {
		stats, err = getRegistrarStats(user.UserID)
	} else if user.Role == models.RoleReviewer {
		stats, err = getReviewerStats(user.UserID)
	} else if user.Role == models.RoleDirector {
		stats, err = getDirectorStats(user.UserID)
	} else {
		stats, err = getAllStats()
	}

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(stats)
}

func getRegistrarStats(userID string) (StatsResponse, error) {
	var stats StatsResponse

	rows, err := models.DB.Query(`
		SELECT status, COUNT(*) as cnt
		FROM consultations
		WHERE registrar_id = ?
		GROUP BY status
	`, userID)
	if err != nil {
		return stats, err
	}
	defer rows.Close()

	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return stats, err
		}
		addToStats(&stats, status, count)
	}

	var total int
	err = models.DB.QueryRow("SELECT COUNT(*) FROM consultations WHERE registrar_id = ?", userID).Scan(&total)
	stats.Total = total

	var appeal int
	err = models.DB.QueryRow("SELECT COUNT(*) FROM consultations WHERE registrar_id = ? AND has_appeal = 1", userID).Scan(&appeal)
	stats.Appeal = appeal

	var overdue int
	err = models.DB.QueryRow("SELECT COUNT(*) FROM consultations WHERE registrar_id = ? AND is_overdue = 1", userID).Scan(&overdue)
	stats.Overdue = overdue

	return stats, err
}

func getReviewerStats(userID string) (StatsResponse, error) {
	var stats StatsResponse

	rows, err := models.DB.Query(`
		SELECT status, COUNT(*) as cnt
		FROM consultations
		WHERE reviewer_id = ?
		   OR status IN (?, ?, ?, ?)
		GROUP BY status
	`, userID,
		models.StatusSubmitted, models.StatusResubmitted,
		models.StatusUnderReview, models.StatusEvidenceMissing)
	if err != nil {
		return stats, err
	}
	defer rows.Close()

	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return stats, err
		}
		addToStats(&stats, status, count)
	}

	var total int
	err = models.DB.QueryRow(`
		SELECT COUNT(*) FROM consultations
		WHERE reviewer_id = ? OR status IN (?, ?, ?, ?)
	`, userID,
		models.StatusSubmitted, models.StatusResubmitted,
		models.StatusUnderReview, models.StatusEvidenceMissing).Scan(&total)
	stats.Total = total

	var appeal int
	err = models.DB.QueryRow("SELECT COUNT(*) FROM consultations WHERE has_appeal = 1").Scan(&appeal)
	stats.Appeal = appeal

	var overdue int
	err = models.DB.QueryRow("SELECT COUNT(*) FROM consultations WHERE is_overdue = 1").Scan(&overdue)
	stats.Overdue = overdue

	return stats, err
}

func getDirectorStats(userID string) (StatsResponse, error) {
	var stats StatsResponse

	rows, err := models.DB.Query(`
		SELECT status, COUNT(*) as cnt
		FROM consultations
		WHERE director_id = ?
		   OR status IN (?, ?, ?, ?, ?, ?, ?, ?)
		GROUP BY status
	`, userID,
		models.StatusReviewPassed, models.StatusUnderFinal,
		models.StatusConflict, models.StatusAppealSubmitted,
		models.StatusAppealAccepted, models.StatusAppealRejected,
		models.StatusEvidenceMissing, models.StatusCorrectionReq)
	if err != nil {
		return stats, err
	}
	defer rows.Close()

	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return stats, err
		}
		addToStats(&stats, status, count)
	}

	var total int
	err = models.DB.QueryRow("SELECT COUNT(*) FROM consultations").Scan(&total)
	stats.Total = total

	var appeal int
	err = models.DB.QueryRow("SELECT COUNT(*) FROM consultations WHERE has_appeal = 1").Scan(&appeal)
	stats.Appeal = appeal

	var overdue int
	err = models.DB.QueryRow("SELECT COUNT(*) FROM consultations WHERE is_overdue = 1").Scan(&overdue)
	stats.Overdue = overdue

	return stats, err
}

func getAllStats() (StatsResponse, error) {
	var stats StatsResponse

	rows, err := models.DB.Query(`
		SELECT status, COUNT(*) as cnt
		FROM consultations
		GROUP BY status
	`)
	if err != nil {
		return stats, err
	}
	defer rows.Close()

	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return stats, err
		}
		addToStats(&stats, status, count)
	}

	var total int
	err = models.DB.QueryRow("SELECT COUNT(*) FROM consultations").Scan(&total)
	stats.Total = total

	var appeal int
	err = models.DB.QueryRow("SELECT COUNT(*) FROM consultations WHERE has_appeal = 1").Scan(&appeal)
	stats.Appeal = appeal

	var overdue int
	err = models.DB.QueryRow("SELECT COUNT(*) FROM consultations WHERE is_overdue = 1").Scan(&overdue)
	stats.Overdue = overdue

	return stats, err
}

func addToStats(stats *StatsResponse, status string, count int) {
	switch status {
	case models.StatusDraft:
		stats.Draft = count
	case models.StatusSubmitted:
		stats.Submitted = count
	case models.StatusUnderReview:
		stats.UnderReview = count
	case models.StatusCorrectionReq:
		stats.Correction = count
	case models.StatusEvidenceMissing:
		stats.EvidenceMiss = count
	case models.StatusResubmitted:
		stats.Resubmitted = count
	case models.StatusReviewPassed:
		stats.ReviewPassed = count
	case models.StatusUnderFinal:
		stats.UnderFinal = count
	case models.StatusConflict:
		stats.Conflict = count
	case models.StatusArchived:
		stats.Archived = count
	case models.StatusRejected:
		stats.Rejected = count
	case models.StatusAppealSubmitted, models.StatusAppealAccepted, models.StatusAppealRejected:
		stats.Appeal += count
	}
}
