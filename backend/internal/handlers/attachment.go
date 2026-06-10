package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"backend/internal/database"
	"backend/internal/middleware"
	"backend/internal/models"

	"github.com/gin-gonic/gin"
)

type UploadAttachmentRequest struct {
	ApplicationID uint   `form:"applicationId" binding:"required"`
	Category      string `form:"category"`
}

func ensureUploadDir() {
	os.MkdirAll("./data/uploads", 0755)
}

func UploadAttachment(c *gin.Context) {
	userID, _, realName, _ := middleware.GetCurrentUser(c)
	ensureUploadDir()

	var req UploadAttachmentRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误：缺少申请ID"})
		return
	}

	var app models.LeaseApplication
	result := database.DB.First(&app, req.ApplicationID)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "租约申请不存在"})
		return
	}

	if app.Status == models.StatusCompleted || app.Status == models.StatusRejected {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "当前状态不允许上传附件"})
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "未找到上传文件"})
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowedExts := map[string]bool{
		".pdf": true, ".jpg": true, ".jpeg": true, ".png": true, ".doc": true, ".docx": true,
		".xls": true, ".xlsx": true, ".txt": true,
	}
	if !allowedExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": fmt.Sprintf("不支持的文件类型：%s，仅支持 PDF、图片、Office 文档", ext)})
		return
	}

	if header.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "文件大小不能超过 10MB"})
		return
	}

	fileName := fmt.Sprintf("%d_%d_%s%s", req.ApplicationID, time.Now().Unix(), generateRandStr(6), ext)
	filePath := fmt.Sprintf("./data/uploads/%s", fileName)

	out, err := os.Create(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "保存文件失败"})
		return
	}
	defer out.Close()

	io.Copy(out, file)

	category := req.Category
	if category == "" {
		category = "其他"
	}

	attachment := models.Attachment{
		ApplicationID:  req.ApplicationID,
		FileName:       header.Filename,
		FileType:       ext[1:],
		FileSize:       header.Size,
		FileURL:        fmt.Sprintf("/api/attachments/download/%s", fileName),
		Category:       category,
		UploadedBy:     userID,
		UploadedByName: realName,
	}
	database.DB.Create(&attachment)

	database.CreateOperationLog(req.ApplicationID, userID, realName, "", "upload", "上传附件", string(app.Status), string(app.Status),
		fmt.Sprintf("上传附件：%s（分类：%s）", header.Filename, category))

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "附件上传成功",
		"data":    attachment,
	})
}

func DownloadAttachment(c *gin.Context) {
	fileName := c.Param("fileName")
	filePath := fmt.Sprintf("./data/uploads/%s", fileName)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "文件不存在"})
		return
	}

	c.FileAttachment(filePath, fileName)
}

func DeleteAttachment(c *gin.Context) {
	userID, _, realName, role := middleware.GetCurrentUser(c)

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "附件ID格式错误"})
		return
	}

	var attachment models.Attachment
	result := database.DB.First(&attachment, uint(id))
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "附件不存在"})
		return
	}

	var app models.LeaseApplication
	database.DB.First(&app, attachment.ApplicationID)

	if role == models.RoleRegistrar && attachment.UploadedBy != userID {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "只能删除自己上传的附件"})
		return
	}

	if app.Status == models.StatusCompleted || app.Status == models.StatusRejected {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "当前状态不允许删除附件"})
		return
	}

	database.DB.Delete(&attachment)

	if attachment.FileURL != "" {
		fileName := filepath.Base(attachment.FileURL)
		filePath := fmt.Sprintf("./data/uploads/%s", fileName)
		os.Remove(filePath)
	}

	database.CreateOperationLog(attachment.ApplicationID, userID, realName, string(role), "delete", "删除附件", string(app.Status), string(app.Status),
		fmt.Sprintf("删除附件：%s", attachment.FileName))

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "附件删除成功",
	})
}

func generateRandStr(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[i%len(letters)]
	}
	return string(b)
}
