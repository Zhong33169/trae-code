package controller

import (
	"database/sql"
	"net/http"

	"knowledge-revision-system/internal/model"
	"knowledge-revision-system/internal/repository"
	"knowledge-revision-system/internal/service"

	"github.com/gin-gonic/gin"
)

type StatsController struct {
	DB *sql.DB
}

func NewStatsController(db *sql.DB) *StatsController {
	return &StatsController{DB: db}
}

func (sc *StatsController) GetStats(c *gin.Context) {
	stats, err := service.GetStats(sc.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.APIResponse{Code: 500, Message: "查询统计失败", Data: err.Error()})
		return
	}

	c.JSON(http.StatusOK, model.APIResponse{Code: 0, Message: "success", Data: stats})
}

func (sc *StatsController) GetKnowledgeItems(c *gin.Context) {
	items, err := repository.GetKnowledgeItems(sc.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.APIResponse{Code: 500, Message: "查询知识条目失败", Data: err.Error()})
		return
	}

	if items == nil {
		items = []model.KnowledgeItem{}
	}

	c.JSON(http.StatusOK, model.APIResponse{Code: 0, Message: "success", Data: items})
}
