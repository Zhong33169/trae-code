package main

import (
	"log"
	"member-service/internal/database"
	"member-service/internal/handlers"
	"member-service/internal/middleware"

	"github.com/gin-gonic/gin"
)

func main() {
	database.Init()

	r := gin.Default()
	r.Use(middleware.CORS())

	api := r.Group("/api")
	{
		users := api.Group("/users")
		{
			users.GET("", handlers.GetUsers)
			users.GET("/current", handlers.GetCurrentUserInfo)
		}

		orders := api.Group("/orders")
		{
			orders.GET("", handlers.GetOrders)
			orders.GET("/:id", handlers.GetOrder)
			orders.POST("", handlers.CreateOrder)
			orders.POST("/:id/process", handlers.ProcessOrder)
			orders.POST("/batch/process", handlers.BatchProcessOrders)
			orders.GET("/:id/attachment-status", handlers.GetAttachmentStatus)
			orders.GET("/required-materials", handlers.GetRequiredMaterials)
		}

		attachments := api.Group("/attachments")
		{
			attachments.GET("/order/:orderId", handlers.GetAttachments)
			attachments.POST("/order/:orderId/upload", handlers.UploadAttachment)
			attachments.POST("/:id/reject", handlers.RejectAttachment)
			attachments.POST("/:id/approve", handlers.ApproveAttachment)
			attachments.DELETE("/:id", handlers.DeleteAttachment)
		}
	}

	log.Println("Server starting on port 8005...")
	r.Run(":8005")
}
