package utils

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

const (
	CodeSuccess = 0

	CodeAuthUnauthorized = 1001
	CodeAuthForbidden    = 1002

	CodeAppStatusError     = 2001
	CodeAppIncompleteData  = 2002
	CodeAppNotFound        = 2003

	CodeHandoverStatusError   = 3001
	CodeHandoverSelfForbidden = 3002
	CodeHandoverRoleMismatch  = 3003

	CodeRecordNotFound       = 4001
	CodeRecordStatusError    = 4002
	CodeRecordPermissionDeny = 4003
)

func Success(data interface{}) Response {
	return Response{
		Code:    CodeSuccess,
		Message: "操作成功",
		Data:    data,
	}
}

func SuccessMsg(message string, data interface{}) Response {
	return Response{
		Code:    CodeSuccess,
		Message: message,
		Data:    data,
	}
}

func Fail(code int, message string) Response {
	return Response{
		Code:    code,
		Message: message,
	}
}

func FailWithData(code int, message string, data interface{}) Response {
	return Response{
		Code:    code,
		Message: message,
		Data:    data,
	}
}
