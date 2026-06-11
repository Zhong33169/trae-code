package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"insurance-app/internal/config"
	"insurance-app/internal/handlers"
	"insurance-app/internal/middleware"
	"insurance-app/internal/models"
	"insurance-app/internal/services"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found: %v", err)
	}

	db := config.InitDB()
	if err := models.AutoMigrate(db); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	if err := models.SeedInitialData(db); err != nil {
		log.Fatalf("Failed to seed initial data: %v", err)
	}

	appState := services.NewAppState()

	r := gin.Default()

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3004"
	}
	r.Use(middleware.CORS(frontendURL))

	authHandler := handlers.NewAuthHandler(db)
	applicationHandler := handlers.NewApplicationHandler(db, appState)
	scanHandler := handlers.NewScanHandler(db, appState)
	auditHandler := handlers.NewAuditHandler(db)

	api := r.Group("/api")
	{
		api.POST("/auth/login", authHandler.Login)
		api.GET("/auth/me", middleware.AuthMiddleware(), authHandler.Me)

		authorized := api.Group("/")
		authorized.Use(middleware.AuthMiddleware())
		{
			authorized.GET("/applications", applicationHandler.List)
			authorized.GET("/applications/:id", applicationHandler.Get)
			authorized.POST("/applications", applicationHandler.Create)
			authorized.PUT("/applications/:id", applicationHandler.Update)
			authorized.POST("/applications/:id/scan", scanHandler.ScanQRCode)
			authorized.POST("/applications/:id/process", applicationHandler.Process)
			authorized.POST("/applications/batch-process", applicationHandler.BatchProcess)
			authorized.GET("/applications/:id/history", applicationHandler.GetHistory)
			authorized.GET("/statistics", applicationHandler.GetStatistics)
			authorized.GET("/audit-logs", auditHandler.List)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8004"
	}

	log.Printf("Server starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
