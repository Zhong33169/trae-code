package main

import (
	"coldchain/database"
	"coldchain/handlers"
	"coldchain/seed"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	port := flag.Int("port", 8002, "后端服务端口")
	dbPath := flag.String("db", "./data/coldchain.db", "SQLite数据库文件路径")
	flag.Parse()

	if err := database.InitDB(*dbPath); err != nil {
		log.Fatalf("初始化数据库失败: %v", err)
	}
	defer database.DB.Close()

	if err := seed.SeedData(); err != nil {
		log.Printf("初始化样例数据警告: %v", err)
	}

	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3002", "http://127.0.0.1:3002"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	api := r.Group("/api")
	{
		api.GET("/users", handlers.GetUsers)
		api.GET("/stats", handlers.GetStats)
		api.GET("/orders", handlers.GetOrders)
		api.POST("/orders", handlers.CreateOrder)
		api.GET("/orders/:id", handlers.GetOrder)
		api.PUT("/orders/:id/process", handlers.ProcessOrder)
		api.POST("/orders/mark-overdue", handlers.MarkOverdue)
	}

	addr := fmt.Sprintf(":%d", *port)
	fmt.Printf("冷链入库单系统后端服务启动在 http://localhost%s\n", addr)
	fmt.Printf("API 文档: http://localhost%s/api/stats\n", addr)

	go func() {
		if err := r.Run(addr); err != nil {
			log.Fatalf("启动服务失败: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	fmt.Println("\n服务已停止")
}
