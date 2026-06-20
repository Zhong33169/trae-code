package main

import (
	"log"
	"net/http"
	"os"
	"repair-platform/data"
	"repair-platform/database"
	"repair-platform/handlers"
	"repair-platform/middleware"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	echomiddleware "github.com/labstack/echo/v4/middleware"
)

func main() {
	godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8003"
	}
	dbPath := os.Getenv("DB_PATH")

	db, err := database.InitDB(dbPath)
	if err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}
	defer db.Close()

	if err := database.CreateTables(db); err != nil {
		log.Fatalf("建表失败: %v", err)
	}

	if err := data.SeedData(db); err != nil {
		log.Fatalf("种子数据初始化失败: %v", err)
	}

	e := echo.New()
	e.HideBanner = true
	e.HidePort = false

	e.Use(echomiddleware.CORSWithConfig(echomiddleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
	}))
	e.Use(echomiddleware.Logger())
	e.Use(echomiddleware.Recover())

	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok", "service": "repair-platform-backend"})
	})
	e.POST("/api/login", handlers.Login)

	api := e.Group("/api", middleware.JWTAuth())

	api.GET("/me", handlers.GetCurrentUser)
	api.GET("/users", handlers.ListUsers)

	quotes := api.Group("/quotes")
	quotes.GET("", handlers.ListQuotes)
	quotes.GET("/:id", handlers.GetQuote)
	quotes.POST("", handlers.CreateQuote)
	quotes.POST("/:id/submit-quote", handlers.SubmitForQuote)
	quotes.POST("/:id/fill-quote", handlers.FillQuote)
	quotes.POST("/:id/confirm", handlers.ConfirmQuote)
	quotes.POST("/:id/payment", handlers.RecordPayment)
	quotes.POST("/:id/assign-tech", handlers.AssignTechnician)
	quotes.POST("/:id/start-repair", handlers.StartRepair)
	quotes.POST("/:id/return", handlers.ReturnQuote)
	quotes.POST("/:id/complete", handlers.CompleteArchive)
	quotes.POST("/:id/cancel", handlers.CancelQuote)
	quotes.POST("/:id/add-evidence", handlers.AddEvidence)

	quotes.POST("/:id/handovers", handlers.CreateHandover)
	api.POST("/handovers/:handover_id/confirm", handlers.ConfirmHandover)
	api.POST("/handovers/batch-confirm", handlers.BatchConfirmHandover)
	api.GET("/handovers/mine", handlers.GetMyHandovers)

	api.GET("/statistics", handlers.GetStatistics)

	log.Printf("==== 维修服务平台后端启动 ====")
	log.Printf("端口: %s", port)
	log.Printf("数据库: SQLite %s", dbPath)
	log.Printf("访问地址: http://localhost:%s", port)
	log.Println("登录账号密码详见 README.md")
	e.Logger.Fatal(e.Start(":" + port))
}
