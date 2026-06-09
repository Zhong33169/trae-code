package middleware

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"prescription-transfer/internal/model"
)

type contextKey string

const UserContextKey contextKey = "user"

func GetUserFromContext(ctx context.Context) *model.User {
	user, ok := ctx.Value(UserContextKey).(*model.User)
	if !ok {
		return nil
	}
	return user
}

func Auth(db *sql.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := GetBearerToken(r)
			if token == "" {
				respondError(w, http.StatusUnauthorized, "未授权访问")
				return
			}

			user, err := parseToken(token, db)
			if err != nil || user == nil {
				respondError(w, http.StatusUnauthorized, "无效的token")
				return
			}

			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func parseToken(token string, db *sql.DB) (*model.User, error) {
	decoded, err := base64.StdEncoding.DecodeString(token)
	if err != nil {
		return nil, fmt.Errorf("decode token: %w", err)
	}

	parts := strings.SplitN(string(decoded), ":", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid token format")
	}

	username := parts[0]
	passwordHash := parts[1]

	var user model.User
	err = db.QueryRow(
		"SELECT id, username, password_hash, role, name, created_at FROM users WHERE username = ?",
		username,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role, &user.Name, &user.CreatedAt)

	if err != nil {
		return nil, err
	}

	if user.PasswordHash != passwordHash {
		return nil, fmt.Errorf("password mismatch")
	}

	return &user, nil
}

func GenerateToken(user *model.User) string {
	payload := fmt.Sprintf("%s:%s", user.Username, user.PasswordHash)
	return base64.StdEncoding.EncodeToString([]byte(payload))
}

func HashPassword(password string) string {
	h := sha256.Sum256([]byte(password))
	return hex.EncodeToString(h[:])
}

func respondError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
