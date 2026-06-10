package main

import (
	"log"
	"os"
	"strconv"

	"backend/internal/database"
	"backend/internal/handlers"
	"backend/internal/middleware"
	"backend/internal/models"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	backendPort := os.Getenv("BACKEND_PORT")
	if backendPort == "" {
		backendPort = "8000"
	}
	frontendPort := os.Getenv("FRONTEND_PORT")
	if frontendPort == "" {
		frontendPort = "4321"
	}

	database.InitDB()

	r := gin.Default()

	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"}
	config.AllowCredentials = true
	config.ExposeHeaders = []string{"Content-Length", "Content-Disposition"}
	r.Use(cors.New(config))

	api := r.Group("/api")
	{
		auth := api.Group("")
		{
			auth.POST("/login", handlers.Login)
			auth.GET("/node-limits", handlers.GetNodeLimits)
		}

		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware())
		{
			protected.GET("/me", handlers.GetCurrentUserInfo)
			protected.POST("/logout", handlers.Logout)
			protected.POST("/change-password", handlers.ChangePassword)

			apps := protected.Group("/applications")
			{
				apps.GET("", handlers.GetApplicationList)
				apps.GET("/:id", handlers.GetApplicationDetail)

				registrar := apps.Group("")
				registrar.Use(middleware.RoleMiddleware(models.RoleRegistrar))
				{
					registrar.POST("", handlers.CreateApplication)
					registrar.PUT("/:id", handlers.UpdateApplication)
					registrar.POST("/:id/submit", handlers.SubmitForReview)
				}

				auditor := apps.Group("")
				auditor.Use(middleware.RoleMiddleware(models.RoleAuditor))
				{
					auditor.POST("/:id/review", handlers.ReviewApplication)
					auditor.POST("/:id/room-confirm", handlers.ConfirmRoomStatus)
				}

				auditorReviewer := apps.Group("")
				auditorReviewer.Use(middleware.RoleMiddleware(models.RoleAuditor, models.RoleReviewer))
				{
					auditorReviewer.POST("/:id/handover", handlers.CompleteHandover)
				}

				reviewer := apps.Group("")
				reviewer.Use(middleware.RoleMiddleware(models.RoleReviewer))
				{
					reviewer.POST("/:id/archive", handlers.ArchiveApplication)
				}

				allRoles := apps.Group("")
				allRoles.Use(middleware.RoleMiddleware(models.RoleRegistrar, models.RoleAuditor, models.RoleReviewer))
				{
					allRoles.POST("/:id/overdue-record", handlers.RecordOverdue)
				}
			}

			api.POST("/applications/batch-status", handlers.BatchGetStatuses)

			attachments := protected.Group("/attachments")
			{
				attachments.POST("/upload", handlers.UploadAttachment)
				attachments.GET("/download/:fileName", handlers.DownloadAttachment)
				attachments.DELETE("/:id", handlers.DeleteAttachment)
			}

			stats := protected.Group("/stats")
			{
				stats.GET("/overview", handlers.GetStatistics)
				stats.GET("/logs", handlers.GetOperationLogs)
			}
		}
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "长租公寓租约申请系统后端",
			"version": "1.0.0",
		})
	})

	log.Printf("========================================")
	log.Printf("长租公寓租约申请系统")
	log.Printf("后端服务启动成功")
	log.Printf("后端端口: %s", backendPort)
	log.Printf("前端端口: %s", frontendPort)
	log.Printf("健康检查: http://localhost:%s/health", backendPort)
	log.Printf("API 基础路径: http://localhost:%s/api", backendPort)
	log.Printf("========================================")

	portNum, _ := strconv.Atoi(backendPort)
	if portNum <= 0 {
		portNum = 8000
	}

	r.Run(":" + strconv.Itoa(portNum))
}
