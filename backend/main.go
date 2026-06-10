package main

import (
	"log"
	"os"
	"zqzl/backend/database"
	"zqzl/backend/handlers"
	"zqzl/backend/middleware"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()

	database.Init()

	r := gin.Default()

	r.Use(middleware.CORSMiddleware())

	api := r.Group("/api")
	{
		api.POST("/login", handlers.Login)

		auth := api.Group("")
		auth.Use(middleware.AuthMiddleware())
		{
			auth.GET("/me", handlers.GetCurrentUser)
			auth.GET("/stats", handlers.GetStats)

			enrollments := auth.Group("/enrollments")
			{
				enrollments.GET("", handlers.GetEnrollments)
				enrollments.GET("/:id", handlers.GetEnrollment)
				enrollments.POST("", middleware.RoleMiddleware("admission"), handlers.CreateEnrollment)
				enrollments.POST("/:id/submit", middleware.RoleMiddleware("admission"), handlers.SubmitEnrollment)
				enrollments.POST("/:id/verify", middleware.RoleMiddleware("academic"), handlers.VerifyEnrollment)
				enrollments.POST("/:id/review", middleware.RoleMiddleware("admin"), handlers.ReviewEnrollment)
				enrollments.POST("/batch-verify", middleware.RoleMiddleware("academic"), handlers.BatchVerify)
			}

			attachments := auth.Group("/attachments")
			{
				attachments.GET("/enrollment/:id", handlers.GetAttachments)
				attachments.POST("/enrollment/:id", middleware.RoleMiddleware("admission"), handlers.UploadAttachment)
				attachments.POST("/:id/approve", middleware.RoleMiddleware("academic", "admin"), handlers.ApproveAttachment)
				attachments.POST("/:id/reject", middleware.RoleMiddleware("academic", "admin"), handlers.RejectAttachment)
				attachments.DELETE("/:id", middleware.RoleMiddleware("admission"), handlers.DeleteAttachment)
				attachments.GET("/:id/download", handlers.DownloadAttachment)
			}

			audit := auth.Group("/audit")
			{
				audit.GET("/enrollment/:id", handlers.GetAuditLogs)
				audit.GET("", middleware.RoleMiddleware("admin"), handlers.GetAllAuditLogs)
			}
		}
	}

	port := os.Getenv("BACKEND_PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server running on port %s", port)
	r.Run(":" + port)
}
