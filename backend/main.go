package main

import (
	"backend/config"
	"backend/database"
	"backend/handlers"
	"backend/middleware"
	"backend/seed"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	database.InitDB()
	seed.SeedData()

	r := gin.Default()

	r.Use(middleware.CORS())

	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/login", handlers.Login)
			auth.GET("/me", middleware.AuthMiddleware(), handlers.GetCurrentUser)
		}

		tasks := api.Group("/tasks")
		tasks.Use(middleware.AuthMiddleware())
		{
			tasks.GET("", handlers.GetTaskList)
			tasks.GET("/:id", handlers.GetTaskDetail)
			tasks.POST("", middleware.RoleMiddleware(config.RoleRegistrar), handlers.CreateTask)
			tasks.PUT("/:id", middleware.RoleMiddleware(config.RoleRegistrar), handlers.UpdateTask)
			tasks.POST("/:id/submit", middleware.RoleMiddleware(config.RoleRegistrar), handlers.SubmitTask)
			tasks.POST("/:id/supervisor-review", middleware.RoleMiddleware(config.RoleSupervisor), handlers.SupervisorReview)
			tasks.POST("/:id/reviewer-review", middleware.RoleMiddleware(config.RoleReviewer), handlers.ReviewerReview)

			tasks.GET("/:id/evidences", handlers.GetEvidences)
			tasks.POST("/:id/evidences", handlers.CreateEvidence)
		}

		batch := api.Group("/batch")
		batch.Use(middleware.AuthMiddleware())
		{
			batch.POST("/supervisor-review", middleware.RoleMiddleware(config.RoleSupervisor), handlers.BatchSupervisorReview)
			batch.POST("/reviewer-review", middleware.RoleMiddleware(config.RoleReviewer), handlers.BatchReviewerReview)
		}
	}

	log.Printf("Server starting on port %s", config.Port)
	if err := r.Run(config.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
