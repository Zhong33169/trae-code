package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"knowledge-revision-system/internal/config"
	"knowledge-revision-system/internal/controller"
	"knowledge-revision-system/internal/middleware"
	"knowledge-revision-system/internal/repository"
	"knowledge-revision-system/internal/service"

	"github.com/gin-gonic/gin"
	_ "github.com/mattn/go-sqlite3"
)

func main() {
	cfg := config.Load()

	db, err := repository.InitDB(cfg.DBPath)
	if err != nil {
		log.Fatalf("初始化数据库失败: %v", err)
	}
	defer repository.CloseDB(db)

	if err := service.CheckAndUpdateOverdue(db); err != nil {
		log.Printf("更新逾期状态失败: %v", err)
	}

	r := gin.Default()

	r.Use(middleware.CORS(cfg))
	r.Use(middleware.Auth(db))

	orderCtrl := controller.NewOrderController(db)
	auditCtrl := controller.NewAuditController(db)
	authCtrl := controller.NewAuthController(db)
	statsCtrl := controller.NewStatsController(db)

	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/switch-role", authCtrl.SwitchRole)
			auth.GET("/me", authCtrl.GetCurrentUser)
		}

		orders := api.Group("/orders")
		{
			orders.GET("", orderCtrl.ListOrders)
			orders.POST("", orderCtrl.CreateOrder)
			orders.POST("/batch-advance", orderCtrl.BatchAdvance)
			orders.POST("/batch-return", orderCtrl.BatchReturn)
			orders.GET("/:id", orderCtrl.GetOrder)
			orders.POST("/:id/advance", orderCtrl.AdvanceOrder)
			orders.POST("/:id/return", orderCtrl.ReturnOrder)
			orders.POST("/:id/correct", orderCtrl.CorrectOrder)
			orders.GET("/:id/audit-logs", auditCtrl.GetAuditLogsByOrder)
		}

		api.GET("/audit-logs", auditCtrl.ListAuditLogs)
		api.GET("/stats", statsCtrl.GetStats)
		api.GET("/knowledge-items", statsCtrl.GetKnowledgeItems)
	}

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.ServerPort),
		Handler: r,
	}

	go func() {
		log.Printf("服务器启动，监听端口 %s", cfg.ServerPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("服务器启动失败: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("正在关闭服务器...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("服务器关闭失败: %v", err)
	}

	log.Println("服务器已关闭")
}
