package main

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

func corsMiddleware() gin.HandlerFunc {
	allowed := "http://localhost:3005"
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == allowed {
			c.Header("Access-Control-Allow-Origin", allowed)
			c.Header("Access-Control-Allow-Credentials", "true")
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Header("Access-Control-Max-Age", "86400")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func NewRouter(db *sql.DB) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()
	r.Use(corsMiddleware())

	repo := NewRepository(db)
	svc := NewService(repo)
	h := NewHandler(svc, repo)

	api := r.Group("/api")
	api.POST("/login", h.Login)
	api.GET("/me", authMiddleware(), h.Me)
	api.GET("/tasks", authMiddleware(), h.ListTasks)
	api.GET("/tasks/:id", authMiddleware(), h.GetTask)
	api.POST("/tasks", authMiddleware(), h.CreateTask)
	api.PUT("/tasks/:id", authMiddleware(), h.UpdateTask)
	api.POST("/tasks/:id/transition", authMiddleware(), h.Transition)
	api.POST("/batches", authMiddleware(), h.CreateBatch)
	api.GET("/batches", authMiddleware(), h.ListBatches)
	api.GET("/batches/:id", authMiddleware(), h.GetBatch)
	api.POST("/batches/:id/retry", authMiddleware(), h.RetryBatch)
	api.GET("/audit", authMiddleware(), h.Audit)

	r.GET("/api/health", func(c *gin.Context) {
		ok(c, gin_H{"status": "ok"})
	})
	return r
}
