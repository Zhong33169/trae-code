package app

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func NewRouter(h *Handler, corsOrigin string) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	if corsOrigin != "" {
		origins := []string{"*"}
		if corsOrigin != "*" {
			origins = []string{corsOrigin}
		}
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins:   origins,
			AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Requested-With"},
			ExposedHeaders:   []string{"Set-Cookie"},
			AllowCredentials: false,
			MaxAge:           300,
		}))
	}

	r.Route("/api", func(r chi.Router) {
		r.Get("/users", h.ListUsers)
		r.Get("/orders", h.ListOrders)
		r.Get("/orders/{id}", h.GetOrder)
		r.Post("/orders", h.CreateOrder)
		r.Post("/orders/batch", h.BatchProcess)
		r.Post("/orders/{id}/stages/{stage}", h.ProcessStage)
		r.Get("/stats", h.GetStats)
		r.Get("/warnings", h.ListWarnings)
	})

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		writeOK(w, map[string]string{"status": "ok"})
	})

	return r
}
