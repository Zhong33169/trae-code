package util

import (
	"encoding/json"
	"net/http"
	"strconv"
)

type Pagination struct {
	Page      int `json:"page"`
	PageSize  int `json:"page_size"`
	Total     int `json:"total"`
	TotalPage int `json:"total_page"`
}

type ListResponse struct {
	List       interface{} `json:"list"`
	Pagination Pagination  `json:"pagination"`
}

func RespondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func RespondError(w http.ResponseWriter, code int, message string) {
	RespondJSON(w, code, map[string]string{"error": message})
}

func GetQueryInt(r *http.Request, key string, defaultValue int) int {
	val := r.URL.Query().Get(key)
	if val == "" {
		return defaultValue
	}
	n, err := strconv.Atoi(val)
	if err != nil || n <= 0 {
		return defaultValue
	}
	return n
}

func GetPageAndSize(r *http.Request) (int, int) {
	page := GetQueryInt(r, "page", 1)
	pageSize := GetQueryInt(r, "page_size", 10)
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

func CalcPagination(total, page, pageSize int) Pagination {
	totalPage := 0
	if pageSize > 0 {
		totalPage = (total + pageSize - 1) / pageSize
	}
	return Pagination{
		Page:      page,
		PageSize:  pageSize,
		Total:     total,
		TotalPage: totalPage,
	}
}

func GetClientIP(r *http.Request) string {
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		return xff
	}
	return r.RemoteAddr
}
