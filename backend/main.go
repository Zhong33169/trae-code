package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"inventory-adjust-system/data"
	"inventory-adjust-system/db"
	"inventory-adjust-system/handlers"
	"inventory-adjust-system/middleware"
	"inventory-adjust-system/models"
)

func main() {
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8003"
	}

	if err := db.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	if err := data.SeedData(); err != nil {
		log.Fatalf("Failed to seed data: %v", err)
	}

	r := gin.Default()

	r.Use(middleware.CORS())

	api := r.Group("/api")
	{
		api.POST("/login", handlers.Login)
		api.GET("/users", handlers.GetUsers)

		auth := api.Group("")
		auth.Use(middleware.Auth())
		{
			auth.GET("/role-info", handlers.GetRoleInfo)
			auth.GET("/statistics", handlers.GetStatistics)

			orders := auth.Group("/orders")
			{
				orders.GET("", handlers.GetOrderList)
				orders.GET("/:id", handlers.GetOrderDetail)
				orders.POST("/submit", middleware.RequireRoles(models.RoleWarehouseKeeper), handlers.SubmitOrder)
				orders.POST("/resubmit", middleware.RequireRoles(models.RoleWarehouseKeeper), handlers.ResubmitOrder)
				orders.POST("/verify", middleware.RequireRoles(models.RoleWarehouseSupervisor), handlers.VerifyOrder)
				orders.POST("/review", middleware.RequireRoles(models.RoleOperationManager), handlers.ReviewOrder)
				orders.POST("/archive", middleware.RequireRoles(models.RoleOperationManager), handlers.ArchiveOrder)
				orders.POST("/batch-submit", middleware.RequireRoles(models.RoleWarehouseKeeper), handlers.BatchSubmit)
				orders.POST("/supplement", handlers.AddSupplement)
			}
		}
	}

	log.Printf("Server starting on port %s...", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
