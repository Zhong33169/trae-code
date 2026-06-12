package utils

import (
	"backend/config"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:    config.CodeSuccess,
		Message: "success",
		Data:    data,
	})
}

func Error(c *gin.Context, code int, message string) {
	c.JSON(http.StatusOK, Response{
		Code:    code,
		Message: message,
		Data:    nil,
	})
}

func ParamError(c *gin.Context, message string) {
	Error(c, config.CodeParamError, message)
}

func UnauthorizedError(c *gin.Context, message string) {
	Error(c, config.CodeUnauthorized, message)
}

func ForbiddenError(c *gin.Context, message string) {
	Error(c, config.CodeForbidden, message)
}

func StatusError(c *gin.Context, message string) {
	Error(c, config.CodeStatusInvalid, message)
}

func VersionConflictError(c *gin.Context) {
	Error(c, config.CodeVersionConflict, "版本冲突，请刷新后重试")
}

func MissingEvidenceError(c *gin.Context, message string) {
	Error(c, config.CodeMissingEvidence, message)
}

func NotFoundError(c *gin.Context, message string) {
	Error(c, config.CodeNotFound, message)
}

func ServerError(c *gin.Context, message string) {
	Error(c, config.CodeServerError, message)
}
