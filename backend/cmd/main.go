package main

import (
	"log"
	"os"
	"strconv"

	"consultation-system/internal/config"
	"consultation-system/internal/handlers"
	"consultation-system/internal/middleware"
	"consultation-system/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func main() {
	cfg := config.Load()

	if err := models.InitDB(cfg.DBPath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer models.CloseDB()

	if err := models.SeedIfEmpty(); err != nil {
		log.Fatalf("Failed to seed database: %v", err)
	}

	app := fiber.New(fiber.Config{
		AppName:      "Consultation Review System API",
		ServerHeader: "Fiber",
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Accept,X-User-Role,X-User-ID",
	}))

	app.Use(logger.New())

	api := app.Group("/api")

	auth := api.Group("", middleware.AuthRequired)

	auth.Get("/stats", handlers.GetStats)

	auth.Get("/consultations", handlers.ListConsultations)
	auth.Get("/consultations/:id", handlers.GetConsultation)
	auth.Post("/consultations", handlers.CreateConsultation)
	auth.Put("/consultations/:id", handlers.UpdateConsultation)

	auth.Post("/consultations/:id/submit", handlers.SubmitConsultation)
	auth.Post("/consultations/:id/review", handlers.ReviewConsultation)
	auth.Post("/consultations/:id/correct", handlers.CorrectConsultation)
	auth.Post("/consultations/:id/final-review", handlers.FinalReviewConsultation)
	auth.Post("/consultations/:id/archive", handlers.ArchiveConsultation)

	auth.Post("/consultations/:id/appeal", handlers.SubmitAppeal)
	auth.Post("/consultations/:id/appeal/accept", handlers.AcceptAppeal)
	auth.Post("/consultations/:id/appeal/reject", handlers.RejectAppeal)

	auth.Get("/consultations/:id/history", handlers.GetConsultationHistory)

	auth.Get("/users", handlers.ListUsers)
	auth.Get("/users/me", handlers.GetCurrentUser)

	auth.Get("/dict/statuses", handlers.GetStatusDict)
	auth.Get("/dict/roles", handlers.GetRoleDict)

	port := cfg.Port
	if envPort := os.Getenv("PORT"); envPort != "" {
		if p, err := strconv.Atoi(envPort); err == nil {
			port = p
		}
	}

	log.Printf("Server starting on port %d...", port)
	log.Printf("API base: http://localhost:%d/api", port)
	log.Fatal(app.Listen(":" + strconv.Itoa(port)))
}
