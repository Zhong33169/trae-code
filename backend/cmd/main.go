package main

import (
	"log"
	"news-clue-backend/internal/config"
	"news-clue-backend/internal/db"
	"news-clue-backend/internal/handlers"
	"news-clue-backend/internal/middleware"
	"news-clue-backend/internal/models"
	"news-clue-backend/internal/seed"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func main() {
	cfg := config.Load()

	if err := db.Init(cfg.DBPath); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}
	seed.Seed()

	app := fiber.New(fiber.Config{
		AppName: "新闻采编中心线索管理系统 API",
	})

	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOriginsFunc: func(origin string) bool {
			return true
		},
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: true,
	}))

	api := app.Group("/api")

	api.Post("/auth/login", handlers.LoginHandler(cfg.JWTSecret))

	auth := api.Group("", middleware.AuthMiddleware(cfg))
	auth.Get("/auth/me", handlers.CurrentUser)
	auth.Get("/users", handlers.ListUsers)

	auth.Get("/stats", handlers.GetStats)

	auth.Get("/clues", handlers.ListClues)
	auth.Post("/clues", handlers.CreateClue)
	auth.Get("/clues/:id", handlers.GetClue)
	auth.Get("/clues/:id/operations", handlers.ListOperations)

	auth.Post("/clues/:id/assign", middleware.RequireRole(string(models.RoleAuditor)), handlers.AssignClue)
	auth.Post("/clues/:id/process", handlers.ProcessClue)
	auth.Post("/clues/:id/appeal", handlers.SubmitAppeal)
	auth.Post("/clues/:id/appeal/review", middleware.RequireRole(string(models.RoleReviewer)), handlers.ReviewAppeal)
	auth.Post("/clues/:id/resubmit-appeal", middleware.RequireRole(string(models.RoleRegistrar)), handlers.ResubmitAfterAppeal)

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"service": "新闻采编中心线索管理系统",
			"port":    cfg.Port,
		})
	})

	log.Printf("服务启动，监听端口: %s", cfg.Port)
	log.Fatal(app.Listen(":" + cfg.Port))
}
