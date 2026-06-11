package utils

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	"github.com/google/uuid"
)

func NewID() string {
	return uuid.New().String()
}

func HashPassword(password string) string {
	h := sha256.New()
	h.Write([]byte(password + "subcontract-salt-v1"))
	return hex.EncodeToString(h.Sum(nil))
}

func VerifyPassword(password, hash string) bool {
	return HashPassword(password) == hash
}

func ToJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func FromJSON(s string, v interface{}) error {
	return json.Unmarshal([]byte(s), v)
}
