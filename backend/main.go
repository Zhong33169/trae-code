package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"fire-hazard-tracker/db"
	"fire-hazard-tracker/handlers"
	"fire-hazard-tracker/middleware"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	port := flag.String("port", "18010", "服务端口")
	dbPath := flag.String("db", "./data/fire_hazard.db", "SQLite数据库路径")
	flag.Parse()

	dbDir := filepath.Dir(*dbPath)
	if _, err := os.Stat(dbDir); os.IsNotExist(err) {
		if err := os.MkdirAll(dbDir, 0755); err != nil {
			log.Fatalf("创建数据库目录失败: %v", err)
		}
	}

	if err := db.InitDB(*dbPath); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}

	r := chi.NewRouter()

	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Route("/api", func(r chi.Router) {
		r.Post("/login", handlers.Login)

		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth)

			r.Get("/me", handlers.GetCurrentUser)
			r.Get("/users", handlers.GetAllUsers)
			r.Get("/statistics", handlers.GetStatistics)

			r.Route("/orders", func(r chi.Router) {
				r.Get("/", handlers.ListHazardOrders)
				r.Post("/", handlers.CreateHazardOrder)
				r.Post("/batch-status", handlers.BatchGetStatus)

				r.Route("/{id}", func(r chi.Router) {
					r.Get("/", handlers.GetHazardOrder)
					r.Post("/assign", handlers.AssignHazardOrder)
					r.Post("/rectify", handlers.SubmitRectification)
					r.Post("/recheck", handlers.SubmitRecheck)
					r.Post("/confirm", handlers.ConfirmComplete)
					r.Post("/handle-timeout", handlers.HandleTimeout)
				})
			})
		})
	})

	addr := fmt.Sprintf(":%s", *port)
	log.Printf("消防隐患单节点超时追踪系统后端启动成功")
	log.Printf("监听地址: http://localhost%s", addr)
	log.Printf("数据库路径: %s", *dbPath)
	log.Printf("测试账号: clerk01/123456  supervisor01/123456  chief01/123456")

	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("服务启动失败: %v", err)
	}
}
