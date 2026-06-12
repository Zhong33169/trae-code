package handlers

import (
	"backend/database"
	"backend/middleware"
	"backend/models"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string      `json:"token"`
	User  *models.User `json:"user"`
}

func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ParamError(c, "参数错误")
		return
	}

	var user models.User
	result := database.DB.Where("username = ?", req.Username).First(&user)
	if result.Error != nil {
		utils.ParamError(c, "用户名或密码错误")
		return
	}

	err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		utils.ParamError(c, "用户名或密码错误")
		return
	}

	token := utils.GenerateToken(user.Username, user.Role)

	utils.Success(c, LoginResponse{
		Token: token,
		User:  &user,
	})
}

func GetCurrentUser(c *gin.Context) {
	user := middleware.GetCurrentUser(c)
	if user == nil {
		utils.UnauthorizedError(c, "未登录")
		return
	}
	utils.Success(c, user)
}
