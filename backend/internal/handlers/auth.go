package handlers

import (
	"net/http"

	"backend/internal/database"
	"backend/internal/middleware"
	"backend/internal/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token      string      `json:"token"`
	ExpiresAt  string      `json:"expiresAt"`
	User       UserInfo    `json:"user"`
}

type UserInfo struct {
	ID       uint        `json:"id"`
	Username string      `json:"username"`
	RealName string      `json:"realName"`
	Role     models.Role `json:"role"`
	RoleName string      `json:"roleName"`
}

func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误：用户名和密码不能为空",
		})
		return
	}

	var user models.User
	result := database.DB.Where("username = ?", req.Username).First(&user)
	if result.Error != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "登录失败：用户名不存在",
		})
		return
	}

	err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "登录失败：密码错误",
		})
		return
	}

	token, expiresAt, err := middleware.GenerateToken(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "生成认证令牌失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "登录成功",
		"data": LoginResponse{
			Token:     token,
			ExpiresAt: expiresAt.Format("2006-01-02 15:04:05"),
			User: UserInfo{
				ID:       user.ID,
				Username: user.Username,
				RealName: user.RealName,
				Role:     user.Role,
				RoleName: user.Role.GetRoleName(),
			},
		},
	})
}

func Logout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "退出登录成功",
	})
}

func GetCurrentUserInfo(c *gin.Context) {
	userID, username, realName, role := middleware.GetCurrentUser(c)

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取用户信息成功",
		"data": UserInfo{
			ID:       userID,
			Username: username,
			RealName: realName,
			Role:     role,
			RoleName: role.GetRoleName(),
		},
	})
}

func ChangePassword(c *gin.Context) {
	var req struct {
		OldPassword string `json:"oldPassword" binding:"required"`
		NewPassword string `json:"newPassword" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误",
		})
		return
	}

	userID, _, _, _ := middleware.GetCurrentUser(c)
	var user models.User
	database.DB.First(&user, userID)

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.OldPassword)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "原密码错误",
		})
		return
	}

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	database.DB.Model(&user).Update("password", string(hashedPassword))

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "密码修改成功",
	})
}
