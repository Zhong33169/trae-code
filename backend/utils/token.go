package utils

import (
	"encoding/base64"
	"strings"
)

type UserClaims struct {
	Username string
	Role     string
}

func GenerateToken(username, role string) string {
	payload := username + ":" + role
	return base64.StdEncoding.EncodeToString([]byte(payload))
}

func ParseToken(token string) (*UserClaims, error) {
	decoded, err := base64.StdEncoding.DecodeString(token)
	if err != nil {
		return nil, err
	}
	parts := strings.SplitN(string(decoded), ":", 2)
	if len(parts) != 2 {
		return nil, err
	}
	return &UserClaims{
		Username: parts[0],
		Role:     parts[1],
	}, nil
}
