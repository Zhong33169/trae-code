package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"prescription-transfer/internal/db"
	"prescription-transfer/internal/handler"
	"prescription-transfer/internal/middleware"
)

func main() {
	workDir, _ := os.Getwd()
	dbPath := filepath.Join(workDir, "data", "app.db")

	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		log.Fatalf("failed to create data dir: %v", err)
	}

	database, err := db.Init(dbPath)
	if err != nil {
		log.Fatalf("failed to init db: %v", err)
	}
	defer database.Close()

	if err := db.Seed(database); err != nil {
		log.Fatalf("failed to seed db: %v", err)
	}

	r := chi.NewRouter()

	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(middleware.CORS("http://localhost:3004"))

	authHandler := handler.NewAuthHandler(database)
	transferHandler := handler.NewTransferHandler(database)
	batchHandler := handler.NewBatchHandler(database)
	auditHandler := handler.NewAuditHandler(database)

	r.Route("/api", func(r chi.Router) {
		r.Post("/auth/login", authHandler.Login)

		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(database))

			r.Get("/auth/me", authHandler.Me)

			r.Get("/transfers", transferHandler.List)
			r.Get("/transfers/{id}", transferHandler.Get)
			r.Post("/transfers", transferHandler.Create)
			r.Put("/transfers/{id}/register", transferHandler.Register)
			r.Put("/transfers/{id}/verify", transferHandler.Verify)
			r.Put("/transfers/{id}/review", transferHandler.Review)
			r.Get("/transfers/{id}/evidences", transferHandler.ListEvidences)

			r.Post("/batch/register", batchHandler.BatchRegister)
			r.Post("/batch/verify", batchHandler.BatchVerify)
			r.Post("/batch/review", batchHandler.BatchReview)
			r.Get("/batch/{batch_no}", batchHandler.GetBatch)
			r.Post("/batch/{batch_no}/retry", batchHandler.RetryBatch)
			r.Get("/batch", batchHandler.ListBatches)

			r.Get("/audit", auditHandler.List)
		})
	})

	port := "8004"
	fmt.Printf("Server running on port %s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
