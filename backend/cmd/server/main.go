package main

import (
	"log"
	"net/http"

	"live-selection-backend/internal/db"
	"live-selection-backend/internal/handler"
	"live-selection-backend/internal/middleware"
	"live-selection-backend/internal/model"

	echomw "github.com/labstack/echo/v4/middleware"
	"github.com/labstack/echo/v4"
)

func main() {
	if err := db.Init("./data/live_selection.db"); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}
	defer db.Close()

	e := echo.New()
	e.HideBanner = true

	e.Use(echomw.CORSWithConfig(echomw.CORSConfig{
		AllowOrigins:     []string{"http://localhost:3009", "http://0.0.0.0:3009", "http://127.0.0.1:3009"},
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions, http.MethodPatch},
		AllowHeaders:     []string{"*"},
		ExposeHeaders:    []string{"*"},
		AllowCredentials: true,
	}))
	e.Use(echomw.Logger())
	e.Use(echomw.Recover())

	e.GET("/api/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok", "service": "直播选品单附件缺失补正系统"})
	})

	api := e.Group("/api")
	auth := api.Group("", middleware.AuthMiddleware)

	api.GET("/users", handler.ListUsers)
	auth.GET("/me", handler.CurrentUser)

	selections := auth.Group("/selections")
	{
		selections.GET("", handler.ListSelections)
		selections.GET("/stats", handler.GetStats)
		selections.GET("/:id", handler.GetSelection)
		selections.POST("", handler.CreateSelection, middleware.RequireRole(model.RoleRegistrar))
		selections.POST("/:id/submit", handler.SubmitForReview, middleware.RequireRole(model.RoleRegistrar))
		selections.POST("/:id/review", handler.ReviewSelection, middleware.RequireRole(model.RoleSupervisor))
		selections.POST("/:id/result", handler.SetProcessResult, middleware.RequireRole(model.RoleSupervisor, model.RoleReviewer))
		selections.POST("/:id/archive", handler.ArchiveSelection, middleware.RequireRole(model.RoleReviewer))
		selections.POST("/:id/return", handler.ReturnSelection, middleware.RequireRole(model.RoleReviewer))
		selections.POST("/:id/attachments", handler.AddAttachment, middleware.RequireRole(model.RoleRegistrar))
		selections.POST("/batch", handler.BatchProcess)
	}

	log.Println("直播选品单后端服务启动: http://0.0.0.0:8009")
	if err := e.Start("0.0.0.0:8009"); err != nil {
		log.Fatal(err)
	}
}
