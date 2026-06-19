package repository

import (
	"database/sql"
	"fmt"

	"knowledge-revision-system/internal/model"
)

func GetUsersByRole(db *sql.DB, role string) ([]model.User, error) {
	rows, err := db.Query("SELECT id, name, role FROM users WHERE role = $1 ORDER BY id", role)
	if err != nil {
		return nil, fmt.Errorf("查询用户失败: %w", err)
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(&u.ID, &u.Name, &u.Role); err != nil {
			return nil, fmt.Errorf("扫描用户数据失败: %w", err)
		}
		users = append(users, u)
	}
	return users, nil
}

func GetUserByID(db *sql.DB, id string) (*model.User, error) {
	var u model.User
	err := db.QueryRow("SELECT id, name, role FROM users WHERE id = $1", id).Scan(&u.ID, &u.Name, &u.Role)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("查询用户失败: %w", err)
	}
	return &u, nil
}

func GetAllUsers(db *sql.DB) ([]model.User, error) {
	rows, err := db.Query("SELECT id, name, role FROM users ORDER BY id")
	if err != nil {
		return nil, fmt.Errorf("查询所有用户失败: %w", err)
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(&u.ID, &u.Name, &u.Role); err != nil {
			return nil, fmt.Errorf("扫描用户数据失败: %w", err)
		}
		users = append(users, u)
	}
	return users, nil
}
