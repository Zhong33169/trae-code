package main

import (
	"context"
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"water-office/db"
	hdl "water-office/handlers"
	mw "water-office/middleware"
	"water-office/utils"
)

func main() {
	port := flag.String("port", "8002", "服务监听端口")
	dbPath := flag.String("db", "./water_office.db", "SQLite 数据库文件路径")
	flag.Parse()

	if err := db.Init(*dbPath); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}
	defer db.Close()

	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3002", "http://127.0.0.1:3002"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Requested-With"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(utils.Success(map[string]interface{}{
			"status":  "ok",
			"time":    time.Now().Format(time.RFC3339),
			"version": "1.0.0",
		}))
	})

	r.Post("/api/auth/login", hdl.Login)

	r.Group(func(r chi.Router) {
		r.Use(mw.AuthRequired)

		r.Post("/api/auth/logout", hdl.Logout)
		r.Get("/api/auth/current", hdl.CurrentUser)

		r.Route("/api/users", func(r chi.Router) {
			r.Get("/", hdl.ListUsers)
		})

		r.Route("/api/applications", func(r chi.Router) {
			r.Get("/", hdl.ListApplications)
			r.Post("/", mw.RoleRequired(
				"register",
			)(http.HandlerFunc(hdl.CreateApplication)).ServeHTTP)
			r.Get("/batch", hdl.BatchResult)
			r.Get("/{id}", hdl.GetApplication)

			r.Put("/{id}", mw.RoleRequired(
				"register",
			)(http.HandlerFunc(hdl.UpdateApplication)).ServeHTTP)

			r.Post("/{id}/submit", mw.RoleRequired(
				"register",
			)(http.HandlerFunc(hdl.SubmitApplication)).ServeHTTP)

			r.Post("/{id}/audit", mw.RoleRequired(
				"auditor",
			)(http.HandlerFunc(hdl.AuditApplication)).ServeHTTP)

			r.Post("/{id}/review", mw.RoleRequired(
				"reviewer",
			)(http.HandlerFunc(hdl.ReviewApplication)).ServeHTTP)
		})

		r.Route("/api/handovers", func(r chi.Router) {
			r.Get("/", hdl.ListHandovers)
			r.Post("/", hdl.CreateHandover)
			r.Post("/{id}/confirm", hdl.ConfirmHandover)
		})

		r.Route("/api/logs", func(r chi.Router) {
			r.Get("/{appId}", hdl.ListOperationLogs)
		})

		r.Route("/api/statistics", func(r chi.Router) {
			r.Get("/", hdl.GetStatistics)
		})
	})

	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(utils.Fail(404, "请求的接口不存在: "+r.URL.Path))
	})

	srv := &http.Server{
		Addr:         ":" + *port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("水务营业厅后端服务启动于 http://localhost:%s", *port)
		log.Printf("SQLite 数据库: %s", *dbPath)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("服务启动失败: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("正在优雅关闭服务...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("服务强制关闭: %v", err)
	}
	log.Println("服务已退出")
}
