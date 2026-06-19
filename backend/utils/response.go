package utils

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type APIResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func Success(c echo.Context, data interface{}) error {
	return c.JSON(http.StatusOK, APIResponse{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func Fail(c echo.Context, httpCode int, message string) error {
	return c.JSON(httpCode, APIResponse{
		Code:    httpCode,
		Message: message,
	})
}

func ErrorMsg(c echo.Context, message string) error {
	return c.JSON(http.StatusBadRequest, APIResponse{
		Code:    http.StatusBadRequest,
		Message: message,
	})
}
