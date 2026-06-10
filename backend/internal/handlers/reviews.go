package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"repair-system/internal/database"
	"repair-system/internal/middleware"
	"repair-system/internal/models"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

type FailureSummary struct {
	Reason       string `json:"reason"`
	Count        int    `json:"count"`
	OperatorRole string `json:"operator_role"`
}

type ConflictSummary struct {
	ExpectedVersion int `json:"expected_version"`
	CurrentVersion  int `json:"current_version"`
	Count           int `json:"count"`
}

type HandlerSummary struct {
	Handler     string `json:"handler"`
	OrderCount  int    `json:"order_count"`
	FailCount   int    `json:"fail_count"`
}

type ReviewDetailResponse struct {
	Review           *models.RiskReview  `json:"review"`
	Orders           []models.RepairOrder `json:"orders"`
	Operations       []models.OrderOperation `json:"operations"`
	FailureReasons   []FailureSummary    `json:"failure_reasons"`
	VersionConflicts []ConflictSummary   `json:"version_conflicts"`
	Handlers         []HandlerSummary    `json:"handlers"`
}

func ListRiskReviews(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "未授权", http.StatusUnauthorized)
		return
	}

	var reviews []models.RiskReview
	query := database.DB.Order("created_at DESC")

	if user.Role == models.RoleRegistrar {
		query = query.Where("status IN ?", []string{models.ReviewReviewed, models.ReviewClosed})
	}

	if err := query.Find(&reviews).Error; err != nil {
		http.Error(w, "查询复盘列表失败: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reviews)
}

func GetRiskReview(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "未授权", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "无效的复盘ID", http.StatusBadRequest)
		return
	}

	var review models.RiskReview
	if err := database.DB.First(&review, id).Error; err != nil {
		http.Error(w, "复盘记录不存在", http.StatusNotFound)
		return
	}

	if user.Role == models.RoleRegistrar {
		if review.Status != models.ReviewReviewed && review.Status != models.ReviewClosed {
			http.Error(w, "无权查看该复盘详情", http.StatusForbidden)
			return
		}
	}

	var orders []models.RepairOrder
	if review.BatchNo != "" {
		database.DB.Where("review_batch = ?", review.BatchNo).Find(&orders)
	} else {
		database.DB.Where("created_at BETWEEN ? AND ?", review.StartDate, review.EndDate).Find(&orders)
	}

	orderIDs := make([]uint, 0, len(orders))
	for _, o := range orders {
		orderIDs = append(orderIDs, o.ID)
	}

	var operations []models.OrderOperation
	if len(orderIDs) > 0 {
		database.DB.Where("order_id IN ?", orderIDs).Order("created_at DESC").Find(&operations)
	}

	failureReasons := computeFailureReasons(operations)
	versionConflicts := computeVersionConflicts(operations)
	handlers := computeHandlerSummary(orders, operations)

	review.Orders = orders

	resp := ReviewDetailResponse{
		Review:           &review,
		Orders:           orders,
		Operations:       operations,
		FailureReasons:   failureReasons,
		VersionConflicts: versionConflicts,
		Handlers:         handlers,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func computeFailureReasons(ops []models.OrderOperation) []FailureSummary {
	counter := make(map[string]*FailureSummary)
	for _, op := range ops {
		if op.Result != "失败" || strings.TrimSpace(op.Opinion) == "" {
			continue
		}
		key := op.Opinion + "||" + op.OperatorRole
		if _, ok := counter[key]; !ok {
			counter[key] = &FailureSummary{
				Reason:       op.Opinion,
				Count:        0,
				OperatorRole: op.OperatorRole,
			}
		}
		counter[key].Count++
	}
	result := make([]FailureSummary, 0, len(counter))
	for _, v := range counter {
		result = append(result, *v)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Count > result[j].Count })
	if len(result) > 10 {
		result = result[:10]
	}
	return result
}

func computeVersionConflicts(ops []models.OrderOperation) []ConflictSummary {
	counter := make(map[string]*ConflictSummary)
	for _, op := range ops {
		if !strings.Contains(op.Opinion, "版本冲突") {
			continue
		}
		expected, current := parseVersionConflict(op.Opinion)
		key := fmt.Sprintf("%d-%d", expected, current)
		if _, ok := counter[key]; !ok {
			counter[key] = &ConflictSummary{
				ExpectedVersion: expected,
				CurrentVersion:  current,
				Count:           0,
			}
		}
		counter[key].Count++
	}
	result := make([]ConflictSummary, 0, len(counter))
	for _, v := range counter {
		result = append(result, *v)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Count > result[j].Count })
	return result
}

func parseVersionConflict(opinion string) (int, int) {
	parts := strings.Split(opinion, "：")
	if len(parts) < 2 {
		return 0, 0
	}
	nums := strings.Split(parts[1], "，")
	if len(nums) < 2 {
		return 0, 0
	}
	expected, _ := strconv.Atoi(strings.ReplaceAll(nums[0], "期望", ""))
	current, _ := strconv.Atoi(strings.ReplaceAll(nums[1], "当前", ""))
	return expected, current
}

func computeHandlerSummary(orders []models.RepairOrder, ops []models.OrderOperation) []HandlerSummary {
	handlerMap := make(map[string]*HandlerSummary)
	for _, o := range orders {
		h := o.CurrentHandler
		if h == "" {
			continue
		}
		if _, ok := handlerMap[h]; !ok {
			handlerMap[h] = &HandlerSummary{Handler: h}
		}
		handlerMap[h].OrderCount++
	}
	for _, op := range ops {
		if op.Result == "失败" {
			h := op.OperatorRole
			if _, ok := handlerMap[h]; !ok {
				handlerMap[h] = &HandlerSummary{Handler: h}
			}
			handlerMap[h].FailCount++
		}
	}
	result := make([]HandlerSummary, 0, len(handlerMap))
	for _, v := range handlerMap {
		result = append(result, *v)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].FailCount > result[j].FailCount })
	return result
}

var _ = time.Now
