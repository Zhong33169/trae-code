package main

import (
	"os"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"aftersales-backend/database"
	"aftersales-backend/handlers"
)

func main() {
	port := os.Getenv("BACKEND_PORT")
	if port == "" {
		port = "8004"
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./aftersales.db"
	}

	db := database.InitDB(dbPath)
	defer db.Close()

	database.SeedData(db)

	e := echo.New()

	frontendPort := os.Getenv("FRONTEND_PORT")
	if frontendPort == "" {
		frontendPort = "3004"
	}

	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"http://localhost:" + frontendPort},
		AllowMethods: []string{echo.GET, echo.POST, echo.PUT, echo.DELETE, echo.OPTIONS},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept},
	}))

	api := e.Group("/api")

	api.GET("/users", handlers.GetUsers(db))
	api.GET("/orders", handlers.GetOrders(db))
	api.GET("/orders/:id", handlers.GetOrderDetail(db))
	api.POST("/orders", handlers.CreateOrder(db))
	api.POST("/orders/:id/action", handlers.ActionOrder(db))
	api.POST("/orders/:id/risk", handlers.ChangeRiskLevel(db))
	api.GET("/stats", handlers.GetStats(db))
	api.PUT("/orders/:id/evidence", handlers.UpdateEvidence(db))

	e.Logger.Fatal(e.Start(":" + port))
}
