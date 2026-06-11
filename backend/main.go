package main

import (
	"log"
	"os"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"subcontract-system/db"
	handlers "subcontract-system/handlers"
	authMw "subcontract-system/middleware"
)

func main() {
	db.InitDB()

	e := echo.New()
	e.HideBanner = true

	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     []string{"http://localhost:3001", "http://127.0.0.1:3001"},
		AllowMethods:     []string{echo.GET, echo.POST, echo.PUT, echo.DELETE, echo.OPTIONS, echo.PATCH},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
		AllowCredentials: true,
		ExposeHeaders:    []string{echo.HeaderContentLength},
		MaxAge:           86400,
	}))

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	api := e.Group("/api")
	api.POST("/login", handlers.Login)

	auth := api.Group("")
	auth.Use(authMw.JWTAuth())

	auth.GET("/me", handlers.GetCurrentUser)
	auth.GET("/users", handlers.ListUsers)
	auth.GET("/projects", handlers.ListProjects)

	forms := auth.Group("/forms")
	forms.GET("", handlers.ListForms)
	forms.GET("/:id", handlers.GetFormDetail)
	forms.POST("", handlers.CreateForm)
	forms.POST("/process", handlers.ProcessForm)
	forms.POST("/batch", handlers.BatchProcess)

	evidences := auth.Group("/evidences")
	evidences.POST("", handlers.UploadEvidence)
	evidences.DELETE("/:id", handlers.DeleteEvidence)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8001"
	}

	log.Printf("Server starting on port %s...", port)
	e.Logger.Fatal(e.Start(":" + port))
}
