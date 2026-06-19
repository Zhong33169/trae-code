package main

import (
	"log"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"transfer-system/db"
	"transfer-system/handlers"
	mw "transfer-system/middleware"
)

func main() {
	if err := db.InitDB("./data/transfer.db"); err != nil {
		log.Fatalf("初始化数据库失败: %v", err)
	}

	e := echo.New()
	e.HideBanner = true

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"http://localhost:3001", "http://127.0.0.1:3001"},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
	}))

	api := e.Group("/api")

	api.POST("/login", handlers.Login)

	auth := api.Group("")
	auth.Use(mw.AuthMiddleware)

	auth.GET("/me", handlers.GetCurrentUser)

	auth.GET("/employees", handlers.ListEmployees)
	auth.GET("/employees/:id", handlers.GetEmployee)

	auth.GET("/applications", handlers.ListApplications)
	auth.GET("/applications/:id", handlers.GetApplication)

	hrSpecialist := auth.Group("")
	hrSpecialist.Use(mw.RoleMiddleware("hr_specialist"))
	hrSpecialist.POST("/applications", handlers.CreateApplication)

	auth.POST("/applications/:id/process", handlers.ProcessApplication)
	auth.POST("/applications/batch", handlers.BatchProcess)

	auth.GET("/statistics", handlers.GetStatistics)
	auth.GET("/operation-logs", handlers.ListOperationLogs)

	log.Println("异动申请系统后端启动于 :8001")
	log.Println("示例账号: hr01/123456 (人事专员), salary01/123456 (薪酬主管), hrbp01/123456 (HRBP负责人)")
	if err := e.Start(":8001"); err != nil {
		log.Fatal(err)
	}
}
