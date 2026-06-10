package main

import (
	"fmt"
	"log"
	"net/http"
	"repair-system/config"
	"repair-system/internal/database"
	"repair-system/internal/handlers"
	"repair-system/internal/middleware"
	"repair-system/internal/seed"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	cfg := config.Load()

	db, err := database.Init(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}

	if err := seed.InitSeedData(db); err != nil {
		log.Fatalf("种子数据初始化失败: %v", err)
	}

	r := chi.NewRouter()

	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"*"},
		ExposedHeaders:   []string{"*"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status": "ok", "message": "维修管理系统 API 服务运行正常"}`)
	})

	r.Route("/api/auth", func(r chi.Router) {
		r.Post("/login", handlers.Login)
		r.Get("/users", handlers.GetAllUsers)
		r.With(middleware.AuthMiddleware).Group(func(r chi.Router) {
			r.Get("/current-user", handlers.GetCurrentUser)
		})
	})

	r.Route("/api/orders", func(r chi.Router) {
		r.Use(middleware.AuthMiddleware)
		r.Post("/", handlers.CreateOrder)
		r.Get("/", handlers.ListOrders)
		r.Get("/{id}", handlers.GetOrder)
		r.Delete("/{id}", handlers.DeleteOrder)
		r.Post("/{id}/submit", handlers.SubmitOrder)
		r.Post("/{id}/supervisor-review", handlers.SupervisorReview)
		r.Post("/{id}/reviewer-review", handlers.ReviewerReview)
		r.Post("/{id}/rectify", handlers.RectifyOrder)
		r.Post("/{id}/risk-change", handlers.RiskChange)
	})

	r.Route("/api/stats", func(r chi.Router) {
		r.Use(middleware.AuthMiddleware)
		r.Get("/overview", handlers.GetOverviewStats)
	})

	r.Route("/api/reviews", func(r chi.Router) {
		r.Use(middleware.AuthMiddleware)
		r.Get("/", handlers.ListRiskReviews)
		r.Get("/{id}", handlers.GetRiskReview)
	})

	addr := fmt.Sprintf("0.0.0.0:%d", cfg.Port)
	log.Printf("========================================")
	log.Printf("维修管理系统后端服务启动")
	log.Printf("监听地址: %s", addr)
	log.Printf("数据库文件: %s", cfg.DatabasePath)
	log.Printf("========================================")
	log.Println("默认用户:")
	log.Println("  登记员:   X-User-Id: 1 (张登记)")
	log.Println("  主  管:   X-User-Id: 2 (李主管)")
	log.Println("  复核员:   X-User-Id: 3 (王复核)")
	log.Printf("========================================")

	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("服务器启动失败: %v", err)
	}
}
