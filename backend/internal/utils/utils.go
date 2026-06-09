package utils

import (
	"consultation-system/internal/models"
	"strings"
)

var statusNameMap = map[string]string{
	models.StatusDraft:           "草稿",
	models.StatusSubmitted:       "已提交",
	models.StatusUnderReview:     "审核中",
	models.StatusEvidenceMissing: "缺证据",
	models.StatusOverdue:         "逾期",
	models.StatusCorrectionReq:   "退回补正",
	models.StatusResubmitted:     "再次提交",
	models.StatusReviewPassed:    "审核通过",
	models.StatusUnderFinal:      "复核中",
	models.StatusConflict:        "状态冲突",
	models.StatusArchived:        "已归档",
	models.StatusRejected:        "已驳回",

	models.StatusAppealSubmitted: "申诉已提交",
	models.StatusAppealAccepted:  "申诉已受理",
	models.StatusAppealRejected:  "申诉已驳回",
	models.StatusAppealResolved:  "申诉已解决",
}

func StatusName(status string) string {
	if name, ok := statusNameMap[status]; ok {
		return name
	}
	return status
}

var actionNameMap = map[string]string{
	"create":           "创建申请单",
	"submit":           "提交申请",
	"review_pass":      "审核通过",
	"reject_correction": "退回补正",
	"evidence_missing": "证据不足",
	"resubmit":         "补正重提",
	"start_final":      "开始复核",
	"archive":          "复核归档",
	"final_reject":     "复核驳回",
	"conflict":         "状态冲突",
	"appeal_submit":    "提交申诉",
	"appeal_accept":    "受理申诉",
	"appeal_reject":    "驳回申诉",
	"appeal_resolve":   "申诉解决",
	"correct":          "补正资料",
	"update":           "更新信息",
}

func ActionName(action string) string {
	if name, ok := actionNameMap[action]; ok {
		return name
	}
	return action
}

func ParseEvidenceList(raw string) []string {
	if raw == "" {
		return []string{}
	}
	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

func JoinEvidenceList(list []string) string {
	return strings.Join(list, ",")
}

var RequiredEvidence = []string{
	"病历记录",
	"实验室检查",
}

func CheckRequiredEvidence(evidenceList string) []string {
	evidences := ParseEvidenceList(evidenceList)
	evidenceSet := make(map[string]bool)
	for _, e := range evidences {
		evidenceSet[e] = true
	}

	var missing []string
	for _, req := range RequiredEvidence {
		if !evidenceSet[req] {
			missing = append(missing, req)
		}
	}
	return missing
}
