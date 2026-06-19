package middleware

import (
	"net/http"
	"strings"

	"knowledge-revision-system/internal/config"

	"github.com/gin-gonic/gin"
)

func CORS(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		allowOrigin := cfg.CORSAllowOrigin

		if origin == allowOrigin {
			c.Header("Access-Control-Allow-Origin", origin)
		} else {
			c.Header("Access-Control-Allow-Origin", allowOrigin)
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, X-Role, X-User-ID")
		c.Header("Access-Control-Expose-Headers", "Content-Length, Content-Type")
		c.Header("Access-Control-Max-Age", "43200")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		if !strings.HasPrefix(c.Request.URL.Path, "/api/auth/") {
			c.Header("Vary", "Origin")
		}

		c.Next()
	}
}
