package routes

import (
	"repair-platform/handlers"
	"repair-platform/middleware"

	"github.com/gofiber/fiber/v2"
)

func Setup(app *fiber.App) {
	api := app.Group("/api")
	api.Use(middleware.Auth())

	api.Get("/user/me", handlers.GetCurrentUser)
	api.Get("/users", handlers.GetAllUsers)

	api.Post("/orders", handlers.CreateOrder)
	api.Get("/orders", handlers.GetOrders)
	api.Get("/orders/:id", handlers.GetOrderDetail)
	api.Post("/orders/:id/process", handlers.ProcessOrder)

	api.Get("/statistics", handlers.GetStatistics)
}
