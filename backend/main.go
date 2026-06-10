package main

import (
	"cross-border-order/handlers"
	"cross-border-order/middleware"
	"cross-border-order/models"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": err.Error(),
			})
		},
	})

	app.Use(logger.New())

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:5173"
	}

	app.Use(cors.New(cors.Config{
		AllowOrigins: frontendURL,
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
		AllowCredentials: true,
	}))

	api := app.Group("/api")

	auth := api.Group("/auth")
	auth.Post("/login", handlers.Login)
	auth.Post("/logout", middleware.AuthRequired(), handlers.Logout)
	auth.Get("/me", middleware.AuthRequired(), handlers.GetCurrentUser)

	orders := api.Group("/orders")
	orders.Use(middleware.AuthRequired())
	orders.Get("/", handlers.ListOrders)
	orders.Post("/", middleware.RoleRequired(models.RoleRegistrar), handlers.CreateOrder)
	orders.Get("/:id", handlers.GetOrder)
	orders.Post("/:id/submit", middleware.RoleRequired(models.RoleRegistrar), handlers.SubmitOrder)
	orders.Put("/:id/materials", middleware.RoleRequired(models.RoleRegistrar), handlers.UpdateMaterials)
	orders.Post("/:id/supervisor-process", middleware.RoleRequired(models.RoleSupervisor), handlers.SupervisorProcess)
	orders.Post("/:id/reviewer-process", middleware.RoleRequired(models.RoleReviewer), handlers.ReviewerProcess)

	batch := api.Group("/batch")
	batch.Use(middleware.AuthRequired())
	batch.Post("/submit", middleware.RoleRequired(models.RoleRegistrar), handlers.BatchSubmitOrders)
	batch.Post("/supervisor-process", middleware.RoleRequired(models.RoleSupervisor), handlers.BatchSupervisorProcess)
	batch.Post("/reviewer-process", middleware.RoleRequired(models.RoleReviewer), handlers.BatchReviewerProcess)

	audit := api.Group("/audit")
	audit.Use(middleware.AuthRequired())
	audit.Get("/:orderId", handlers.GetAuditLogs)

	stats := api.Group("/stats")
	stats.Use(middleware.AuthRequired())
	stats.Get("/", handlers.GetStatistics)

	port := os.Getenv("BACKEND_PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("后端服务启动在端口 %s", port)
	log.Printf("前端允许来源: %s", frontendURL)
	log.Fatal(app.Listen(":" + port))
}
