package service

import "fmt"

type Transition struct {
	FromStatus   string
	ToStatus     string
	RequiredRole string
}

var ValidTransitions = []Transition{
	{"pending_review", "pending_final_review", "supervisor"},
	{"pending_review", "pending_correction", "supervisor"},
	{"pending_correction", "pending_review", "clerk"},
	{"pending_final_review", "archived", "reviewer"},
	{"pending_final_review", "pending_review", "reviewer"},
}

func ValidateTransition(fromStatus, toStatus, role string) error {
	for _, t := range ValidTransitions {
		if t.FromStatus == fromStatus && t.ToStatus == toStatus && t.RequiredRole == role {
			return nil
		}
	}

	for _, t := range ValidTransitions {
		if t.FromStatus == fromStatus && t.ToStatus == toStatus {
			return fmt.Errorf("角色 %s 无权执行从 %s 到 %s 的状态转换，需要角色 %s", role, fromStatus, toStatus, t.RequiredRole)
		}
	}

	return fmt.Errorf("无效的状态转换：从 %s 到 %s", fromStatus, toStatus)
}

func GetAllowedTransitions(status string, role string) []Transition {
	var allowed []Transition
	for _, t := range ValidTransitions {
		if t.FromStatus == status && t.RequiredRole == role {
			allowed = append(allowed, t)
		}
	}
	return allowed
}
