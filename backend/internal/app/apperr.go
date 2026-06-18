package app

import "fmt"

const (
	CodeOK         = 0
	CodeBadRequest = 4001
	CodeNotFound   = 4040
	CodeConflict   = 4091
	CodeInternal   = 5000
)

const (
	ReasonForbidden       = "forbidden"
	ReasonWrongOrder      = "wrong_order"
	ReasonMissingEvidence = "missing_evidence"
	ReasonStageTimeout    = "stage_timeout"
	ReasonConcurrency     = "concurrency_conflict"
	ReasonNotFound        = "not_found"
	ReasonInvalidInput    = "invalid_input"
	ReasonInternal        = "internal_error"
)

type AppError struct {
	Code   int    `json:"code"`
	Reason string `json:"reason"`
	Err    string `json:"error"`
}

func (e *AppError) Error() string {
	return fmt.Sprintf("%s: %s", e.Reason, e.Err)
}

func NewAppError(code int, reason, msg string) *AppError {
	return &AppError{Code: code, Reason: reason, Err: msg}
}

func ErrForbidden(msg string) *AppError {
	if msg == "" {
		msg = "当前岗位无权操作该阶段（越权）"
	}
	return NewAppError(CodeBadRequest, ReasonForbidden, msg)
}

func ErrWrongOrder(msg string) *AppError {
	if msg == "" {
		msg = "工单当前阶段与操作不匹配，顺序有误"
	}
	return NewAppError(CodeBadRequest, ReasonWrongOrder, msg)
}

func ErrMissingEvidence(msg string) *AppError {
	if msg == "" {
		msg = "证据缺失：必填材料未提供或处理意见为空"
	}
	return NewAppError(CodeBadRequest, ReasonMissingEvidence, msg)
}

func ErrStageTimeout(msg string) *AppError {
	if msg == "" {
		msg = "该阶段已超出时限，不能直接推进"
	}
	return NewAppError(CodeBadRequest, ReasonStageTimeout, msg)
}

func ErrConcurrency(msg string) *AppError {
	if msg == "" {
		msg = "并发冲突：该工单已被其他操作更新，请刷新后重试"
	}
	return NewAppError(CodeConflict, ReasonConcurrency, msg)
}

func ErrNotFound(msg string) *AppError {
	if msg == "" {
		msg = "资源不存在"
	}
	return NewAppError(CodeNotFound, ReasonNotFound, msg)
}

func ErrInvalidInput(msg string) *AppError {
	if msg == "" {
		msg = "参数有误"
	}
	return NewAppError(CodeBadRequest, ReasonInvalidInput, msg)
}
