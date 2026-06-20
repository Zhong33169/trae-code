package services

import (
	"errors"
	"fmt"

	"gorm.io/gorm"
	"inventory-adjust-system/db"
	"inventory-adjust-system/models"
)

type UserService struct{}

func NewUserService() *UserService {
	return &UserService{}
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (s *UserService) Login(req *LoginRequest) (*models.User, error) {
	database := db.GetDB()

	var user models.User
	if err := database.Where("username = ?", req.Username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("用户名或密码错误")
		}
		return nil, fmt.Errorf("查询用户失败: %w", err)
	}

	if user.Password != req.Password {
		return nil, errors.New("用户名或密码错误")
	}

	return &user, nil
}

func (s *UserService) GetUserList() ([]*models.User, error) {
	database := db.GetDB()

	var users []*models.User
	if err := database.Find(&users).Error; err != nil {
		return nil, fmt.Errorf("查询用户列表失败: %w", err)
	}

	return users, nil
}

func (s *UserService) GetUserByID(id int64) (*models.User, error) {
	database := db.GetDB()

	var user models.User
	if err := database.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("用户不存在")
		}
		return nil, fmt.Errorf("查询用户失败: %w", err)
	}

	return &user, nil
}

func (s *UserService) CreateUser(user *models.User) (*models.User, error) {
	database := db.GetDB()

	var existing models.User
	if err := database.Where("username = ?", user.Username).First(&existing).Error; err == nil {
		return nil, errors.New("用户名已存在")
	}

	if err := database.Create(user).Error; err != nil {
		return nil, fmt.Errorf("创建用户失败: %w", err)
	}

	return user, nil
}
