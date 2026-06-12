package main

import (
	"fmt"
	"log"
	"os"
	"repair-platform/config"
	"repair-platform/database"
	"repair-platform/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	cfg := config.Load()

	if err := database.Init(cfg.DBPath); err != nil {
		return fmt.Errorf("初始化数据库失败: %w", err)
	}
	defer database.Close()

	if err := database.SeedData(); err != nil {
		return fmt.Errorf("初始化样例数据失败: %w", err)
	}

	app := fiber.New(fiber.Config{
		AppName:      "维修服务平台-风险分级处置系统",
		ServerHeader: "Repair-Platform",
	})

	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.FrontendURL,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
		AllowCredentials: true,
	}))

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"message": "维修服务平台后端服务运行正常",
			"port":    cfg.Port,
		})
	})

	routes.Setup(app)

	addr := fmt.Sprintf("0.0.0.0:%d", cfg.Port)
	log.Printf("端口配置: %d, 监听地址: '%s'", cfg.Port, addr)
	log.Printf("服务启动于 %s", addr)
	log.Printf("前端地址: %s", cfg.FrontendURL)
	log.Println("演示账号 (Authorization Bearer 用户ID):")
	log.Println("  1 - 张登记 (维修登记员)")
	log.Println("  2 - 李登记 (维修登记员)")
	log.Println("  3 - 王主管 (维修审核主管)")
	log.Println("  4 - 赵主管 (维修审核主管)")
	log.Println("  5 - 陈复核 (复核负责人)")
	log.Println("  6 - 刘复核 (复核负责人)")

	if err := app.Listen(addr); err != nil {
		return fmt.Errorf("启动服务失败: %w", err)
	}

	return nil
}

func init() {
	if _, err := os.Stat(".env"); err == nil {
		os.Setenv("GO_ENV", "development")
	}
	_ = godotenv.Load()
}
