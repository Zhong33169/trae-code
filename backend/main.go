package main

import (
	"log"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"checkin-system/database"
	appmiddleware "checkin-system/middleware"
	"checkin-system/handlers"
)

func main() {
	if err := database.Init(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	e := echo.New()

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     []string{"http://localhost:3001"},
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
		AllowCredentials: true,
	}))

	e.POST("/api/auth/login", handlers.Login)

	api := e.Group("/api")
	api.Use(appmiddleware.JWTMiddleware())

	api.GET("/auth/me", handlers.GetCurrentUser)

	checkinHandler := handlers.NewCheckinHandler()
	checkin := api.Group("/checkin")
	{
		checkin.GET("", checkinHandler.List)
		checkin.POST("", checkinHandler.Create, appmiddleware.RoleMiddleware("initiator", "admin"))
		checkin.GET("/:id", checkinHandler.Get)
		checkin.POST("/:id/:action", checkinHandler.HandleAction)
		checkin.POST("/batch", checkinHandler.BatchHandle)
	}

	attachmentHandler := handlers.NewAttachmentHandler()
	attachments := api.Group("/checkin/:id/attachments")
	{
		attachments.GET("", attachmentHandler.List)
		attachments.POST("", attachmentHandler.Upload)
	}
	api.DELETE("/attachments/:id", attachmentHandler.Delete)

	auditHandler := handlers.NewAuditHandler()
	api.GET("/checkin/:id/audit", auditHandler.ListByRecord)
	api.GET("/audit/failures", auditHandler.ListFailures)

	log.Println("Server starting on :8001")
	log.Println("API docs:")
	log.Println("  POST /api/auth/login")
	log.Println("  GET  /api/auth/me")
	log.Println("  GET  /api/checkin")
	log.Println("  POST /api/checkin")
	log.Println("  GET  /api/checkin/:id")
	log.Println("  POST /api/checkin/:id/initiate")
	log.Println("  POST /api/checkin/:id/handle")
	log.Println("  POST /api/checkin/:id/verify")
	log.Println("  POST /api/checkin/:id/review")
	log.Println("  POST /api/checkin/:id/archive")
	log.Println("  POST /api/checkin/:id/return")
	log.Println("  POST /api/checkin/batch")
	log.Println("  GET  /api/checkin/:id/attachments")
	log.Println("  POST /api/checkin/:id/attachments")
	log.Println("  DELETE /api/attachments/:id")
	log.Println("  GET  /api/checkin/:id/audit")
	log.Println("  GET  /api/audit/failures")

	e.Logger.Fatal(e.Start(":8001"))
}
