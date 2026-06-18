package main

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const jwtSecret = "renewal-review-demo-secret-2026"

type Claims struct {
	UserID      int    `json:"uid"`
	Username    string `json:"usr"`
	Role        string `json:"rol"`
	DisplayName string `json:"dn"`
	jwt.RegisteredClaims
}

func issueToken(u User) (string, error) {
	claims := Claims{
		UserID:      u.ID,
		Username:    u.Username,
		Role:        u.Role,
		DisplayName: u.DisplayName,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString([]byte(jwtSecret))
}

func verifyPassword(hash, pw string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw)) == nil
}

func hashPassword(pw string) string {
	h, _ := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	return string(h)
}

type principal struct {
	ID          int
	Username    string
	Role        string
	DisplayName string
}

func currentPrincipal(c *gin.Context) principal {
	return principal{
		ID:          c.GetInt("uid"),
		Username:    c.GetString("username"),
		Role:        c.GetString("role"),
		DisplayName: c.GetString("displayName"),
	}
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, errResp("UNAUTHORIZED", "缺少认证令牌"))
			return
		}
		tokenStr := strings.TrimPrefix(h, "Bearer ")
		claims := &Claims{}
		tok, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		})
		if err != nil || !tok.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, errResp("UNAUTHORIZED", "令牌无效或已过期"))
			return
		}
		c.Set("uid", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Set("displayName", claims.DisplayName)
		c.Next()
	}
}
