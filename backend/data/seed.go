package data

import (
	"fmt"
	"log"
	"time"

	"inventory-adjust-system/db"
	"inventory-adjust-system/models"
)

func SeedData() error {
	database := db.GetDB()

	var userCount int64
	database.Model(&models.User{}).Count(&userCount)
	if userCount > 0 {
		log.Println("Data already seeded, skipping...")
		return nil
	}

	users := []models.User{
		{Username: "keeper01", Password: "123456", RealName: "张库管", Role: models.RoleWarehouseKeeper},
		{Username: "keeper02", Password: "123456", RealName: "李库管", Role: models.RoleWarehouseKeeper},
		{Username: "super01", Password: "123456", RealName: "王主管", Role: models.RoleWarehouseSupervisor},
		{Username: "manager01", Password: "123456", RealName: "赵经理", Role: models.RoleOperationManager},
	}
	for i := range users {
		if err := database.Create(&users[i]).Error; err != nil {
			return fmt.Errorf("failed to create user: %w", err)
		}
	}

	now := time.Now()
	orders := []models.InventoryAdjustOrder{
		{
			OrderNo: "IA20260601001", Title: "A类商品盘亏调整-001", AdjustType: "盘亏调整",
			Warehouse: "北京中心仓", SKU: "SKU-A001", ProductName: "高端智能手机",
			BatchNo: "B20260501", SystemStock: 100, ActualStock: 95, AdjustQuantity: -5,
			AdjustReason: "月度盘点发现差异，待核实具体原因",
			Status: models.StatusPendingSubmit, Version: 1,
			CreatedBy: users[0].ID, CreatedByName: users[0].RealName,
			CreateAt: now.AddDate(0, 0, -5),
		},
		{
			OrderNo: "IA20260601002", Title: "B类商品报损调整-002", AdjustType: "报损调整",
			Warehouse: "北京中心仓", SKU: "SKU-B003", ProductName: "蓝牙耳机",
			BatchNo: "B20260415", SystemStock: 200, ActualStock: 180, AdjustQuantity: -20,
			AdjustReason: "运输破损导致无法销售",
			Status: models.StatusPendingVerify, Version: 1,
			CreatedBy: users[0].ID, CreatedByName: users[0].RealName,
			CreateAt: now.AddDate(0, 0, -3),
		},
		{
			OrderNo: "IA20260601003", Title: "C类商品盘盈调整-003", AdjustType: "盘盈调整",
			Warehouse: "上海分仓", SKU: "SKU-C007", ProductName: "数据线",
			BatchNo: "B20260320", SystemStock: 500, ActualStock: 520, AdjustQuantity: 20,
			AdjustReason: "之前出库统计错误导致盘盈",
			Status: models.StatusReturned, Version: 2,
			CreatedBy: users[1].ID, CreatedByName: users[1].RealName,
			ReturnReason: strPtr("缺少破损照片证据，且调整原因描述不清晰，请补充后重新提交"),
			ReturnedBy: &users[2].ID, ReturnedByName: &users[2].RealName,
			ReturnedAt: timePtr(now.AddDate(0, 0, -1)),
			CreateAt: now.AddDate(0, 0, -7),
		},
		{
			OrderNo: "IA20260601004", Title: "D类商品效期调整-004", AdjustType: "效期调整",
			Warehouse: "广州分仓", SKU: "SKU-D012", ProductName: "智能手表",
			BatchNo: "B20260210", SystemStock: 80, ActualStock: 70, AdjustQuantity: -10,
			AdjustReason: "临期商品折价处理，已补充效期证明",
			Status: models.StatusResubmitted, Version: 3,
			CreatedBy: users[1].ID, CreatedByName: users[1].RealName,
			CreateAt: now.AddDate(0, 0, -10),
		},
		{
			OrderNo: "IA20260601005", Title: "A类商品串号调整-005", AdjustType: "串号调整",
			Warehouse: "北京中心仓", SKU: "SKU-A002", ProductName: "平板电脑",
			BatchNo: "B20260515", SystemStock: 150, ActualStock: 148, AdjustQuantity: -2,
			AdjustReason: "发货串号导致库存差异，已核实订单记录",
			Status: models.StatusPendingReview, Version: 3,
			CreatedBy: users[0].ID, CreatedByName: users[0].RealName,
			VerifiedBy: &users[2].ID, VerifiedByName: &users[2].RealName,
			VerifiedAt: timePtr(now.AddDate(0, 0, -2)),
			VerifyOpinion: strPtr("证据充分，原因合理，同意核验通过"),
			CreateAt: now.AddDate(0, 0, -6),
		},
		{
			OrderNo: "IA20260601006", Title: "E类商品损耗调整-006", AdjustType: "自然损耗",
			Warehouse: "成都分仓", SKU: "SKU-E005", ProductName: "充电宝",
			BatchNo: "B20260105", SystemStock: 300, ActualStock: 295, AdjustQuantity: -5,
			AdjustReason: "电池自然损耗，属正常范围",
			Status: models.StatusPendingReview, Version: 2,
			CreatedBy: users[1].ID, CreatedByName: users[1].RealName,
			VerifiedBy: &users[2].ID, VerifiedByName: &users[2].RealName,
			VerifiedAt: timePtr(now.AddDate(0, 0, -1)),
			VerifyOpinion: strPtr("损耗率在合理范围内，同意提交复核"),
			CreateAt: now.AddDate(0, 0, -4),
		},
		{
			OrderNo: "IA20260601007", Title: "F类商品退货调整-007", AdjustType: "退货调整",
			Warehouse: "深圳分仓", SKU: "SKU-F008", ProductName: "无线充电器",
			BatchNo: "B20260428", SystemStock: 400, ActualStock: 415, AdjustQuantity: 15,
			AdjustReason: "客户退回商品重新入库",
			Status: models.StatusReviewPassed, Version: 3,
			CreatedBy: users[0].ID, CreatedByName: users[0].RealName,
			VerifiedBy: &users[2].ID, VerifiedByName: &users[2].RealName,
			VerifiedAt: timePtr(now.AddDate(0, 0, -4)),
			VerifyOpinion: strPtr("退货单齐全，入库核验无误"),
			ReviewedBy: &users[3].ID, ReviewedByName: &users[3].RealName,
			ReviewedAt: timePtr(now.AddDate(0, 0, -1)),
			ReviewOpinion: strPtr("复核通过，待归档"),
			CreateAt: now.AddDate(0, 0, -8),
		},
		{
			OrderNo: "IA20260601008", Title: "G类商品错发调整-008", AdjustType: "错发调整",
			Warehouse: "杭州分仓", SKU: "SKU-G003", ProductName: "蓝牙耳机Pro",
			BatchNo: "B20260315", SystemStock: 250, ActualStock: 245, AdjustQuantity: -5,
			AdjustReason: "错发商品已补发，原商品追回中",
			Status: models.StatusArchived, Version: 4,
			CreatedBy: users[1].ID, CreatedByName: users[1].RealName,
			VerifiedBy: &users[2].ID, VerifiedByName: &users[2].RealName,
			VerifiedAt: timePtr(now.AddDate(0, 0, -10)),
			VerifyOpinion: strPtr("错发记录完整，同意核验通过"),
			ReviewedBy: &users[3].ID, ReviewedByName: &users[3].RealName,
			ReviewedAt: timePtr(now.AddDate(0, 0, -8)),
			ReviewOpinion: strPtr("复核通过，同意归档"),
			ArchivedBy: &users[3].ID, ArchivedByName: &users[3].RealName,
			ArchivedAt: timePtr(now.AddDate(0, 0, -7)),
			CreateAt: now.AddDate(0, 0, -15),
		},
		{
			OrderNo: "IA20260601009", Title: "H类商品盘点差异-009", AdjustType: "盘亏调整",
			Warehouse: "北京中心仓", SKU: "SKU-H002", ProductName: "移动电源",
			BatchNo: "B20260520", SystemStock: 120, ActualStock: 115, AdjustQuantity: -5,
			AdjustReason: "盘点差异5件，原因待查",
			Status: models.StatusPendingSubmit, Version: 1,
			CreatedBy: users[0].ID, CreatedByName: users[0].RealName,
			CreateAt: now.AddDate(0, 0, -1),
		},
		{
			OrderNo: "IA20260601010", Title: "I类商品调拨差异-010", AdjustType: "调拨调整",
			Warehouse: "上海分仓", SKU: "SKU-I004", ProductName: "保护壳",
			BatchNo: "B20260525", SystemStock: 300, ActualStock: 310, AdjustQuantity: 10,
			AdjustReason: "调拨入库差异，多出10件",
			Status: models.StatusPendingVerify, Version: 1,
			CreatedBy: users[1].ID, CreatedByName: users[1].RealName,
			CreateAt: now.AddDate(0, 0, -2),
		},
	}
	for i := range orders {
		if err := database.Create(&orders[i]).Error; err != nil {
			return fmt.Errorf("failed to create order: %w", err)
		}
	}

	evidences := []models.OrderEvidence{
		{OrderID: 2, Type: models.EvidenceTypeRegister, FileName: "盘点表_20260618.pdf", FileType: "pdf", FileSize: 1024000, Remark: "月度盘点原始记录", UploadedBy: users[0].ID, UploadByName: users[0].RealName},
		{OrderID: 3, Type: models.EvidenceTypeRegister, FileName: "差异说明.docx", FileType: "docx", FileSize: 512000, Remark: "初步差异说明（证据不足）", UploadedBy: users[1].ID, UploadByName: users[1].RealName},
		{OrderID: 4, Type: models.EvidenceTypeRegister, FileName: "效期证明.jpg", FileType: "image/jpeg", FileSize: 2048000, Remark: "商品效期照片", UploadedBy: users[1].ID, UploadByName: users[1].RealName},
		{OrderID: 4, Type: models.EvidenceTypeSupplement, FileName: "折价审批单.pdf", FileType: "pdf", FileSize: 768000, Remark: "补录：折价处理审批单", UploadedBy: users[1].ID, UploadByName: users[1].RealName},
		{OrderID: 5, Type: models.EvidenceTypeRegister, FileName: "订单核对表.xlsx", FileType: "xlsx", FileSize: 256000, Remark: "发货订单核对记录", UploadedBy: users[0].ID, UploadByName: users[0].RealName},
		{OrderID: 5, Type: models.EvidenceTypeVerify, FileName: "核验报告.pdf", FileType: "pdf", FileSize: 1536000, Remark: "仓储主管核验报告", UploadedBy: users[2].ID, UploadByName: users[2].RealName},
		{OrderID: 6, Type: models.EvidenceTypeRegister, FileName: "损耗检测报告.pdf", FileType: "pdf", FileSize: 896000, Remark: "电池损耗检测报告", UploadedBy: users[1].ID, UploadByName: users[1].RealName},
		{OrderID: 6, Type: models.EvidenceTypeVerify, FileName: "损耗核验记录.xlsx", FileType: "xlsx", FileSize: 384000, Remark: "核验记录", UploadedBy: users[2].ID, UploadByName: users[2].RealName},
		{OrderID: 7, Type: models.EvidenceTypeRegister, FileName: "退货单_20260612.pdf", FileType: "pdf", FileSize: 640000, Remark: "客户退货凭证", UploadedBy: users[0].ID, UploadByName: users[0].RealName},
		{OrderID: 7, Type: models.EvidenceTypeVerify, FileName: "入库验收单.jpg", FileType: "image/jpeg", FileSize: 1792000, Remark: "重新入库验收照片", UploadedBy: users[2].ID, UploadByName: users[2].RealName},
		{OrderID: 7, Type: models.EvidenceTypeReview, FileName: "复核确认单.pdf", FileType: "pdf", FileSize: 1024000, Remark: "运营经理复核确认", UploadedBy: users[3].ID, UploadByName: users[3].RealName},
		{OrderID: 8, Type: models.EvidenceTypeRegister, FileName: "错发说明.pdf", FileType: "pdf", FileSize: 512000, Remark: "错发情况说明", UploadedBy: users[1].ID, UploadByName: users[1].RealName},
		{OrderID: 8, Type: models.EvidenceTypeSupplement, FileName: "补发快递单.jpg", FileType: "image/jpeg", FileSize: 1280000, Remark: "补录：补发商品快递单", UploadedBy: users[1].ID, UploadByName: users[1].RealName},
		{OrderID: 8, Type: models.EvidenceTypeVerify, FileName: "核验意见.pdf", FileType: "pdf", FileSize: 768000, Remark: "主管核验意见", UploadedBy: users[2].ID, UploadByName: users[2].RealName},
		{OrderID: 8, Type: models.EvidenceTypeReview, FileName: "复核意见书.pdf", FileType: "pdf", FileSize: 896000, Remark: "经理复核意见", UploadedBy: users[3].ID, UploadByName: users[3].RealName},
		{OrderID: 10, Type: models.EvidenceTypeRegister, FileName: "调拨差异说明.pdf", FileType: "pdf", FileSize: 640000, Remark: "调拨入库差异记录", UploadedBy: users[1].ID, UploadByName: users[1].RealName},
	}
	for i := range evidences {
		if err := database.Create(&evidences[i]).Error; err != nil {
			return fmt.Errorf("failed to create evidence: %w", err)
		}
	}

	supplements := []models.SupplementRecord{
		{
			OrderID: 3, Type: models.SupplementTypeException,
			Content: "发现原记录中实际库存数量录入错误，应为178而非180",
			FieldName: "ActualStock", OldValue: "180", NewValue: "178",
			Reason: "初盘时统计错误，复盘后确认实际库存为178",
			SupplementedBy: users[1].ID, SupplementedByName: users[1].RealName,
			CreateAt: now.AddDate(0, 0, -2),
		},
		{
			OrderID: 4, Type: models.SupplementTypeCorrect,
			Content: "补充调整原因说明，附效期证明和折价审批单",
			FieldName: "AdjustReason", OldValue: "临期商品处理", NewValue: "临期商品折价处理，已补充效期证明",
			Reason: "原原因描述过于简略，按退回意见补充详细说明和证据",
			SupplementedBy: users[1].ID, SupplementedByName: users[1].RealName,
			CreateAt: now.AddDate(0, 0, -1),
		},
		{
			OrderID: 4, Type: models.SupplementTypeException,
			Content: "异常记录：发现该批次商品效期标注与实际不符",
			Reason: "移动补录时发现效期异常，需要质量部门进一步确认",
			SupplementedBy: users[0].ID, SupplementedByName: users[0].RealName,
			CreateAt: now.AddDate(0, 0, -1).Add(time.Hour * 2),
		},
		{
			OrderID: 5, Type: models.SupplementTypeReview,
			Content: "复核确认：串号订单已找到，涉及2个订单号SO20260610015、SO20260610018",
			Reason: "移动核验时补充订单信息，完善证据链",
			SupplementedBy: users[2].ID, SupplementedByName: users[2].RealName,
			CreateAt: now.AddDate(0, 0, -2).Add(time.Hour * 3),
		},
		{
			OrderID: 8, Type: models.SupplementTypeCorrect,
			Content: "补充补发快递单号：SF1234567890，追回快递单号：YT0987654321",
			FieldName: "AdjustReason", OldValue: "错发商品已补发", NewValue: "错发商品已补发，原商品追回中",
			Reason: "原记录未包含快递单号信息，补录完善",
			SupplementedBy: users[1].ID, SupplementedByName: users[1].RealName,
			CreateAt: now.AddDate(0, 0, -12),
		},
		{
			OrderID: 8, Type: models.SupplementTypeReview,
			Content: "复核确认：错发责任已明确，相关人员已进行培训",
			Reason: "复核阶段补充整改措施记录",
			SupplementedBy: users[3].ID, SupplementedByName: users[3].RealName,
			CreateAt: now.AddDate(0, 0, -8).Add(time.Hour * 4),
		},
	}
	for i := range supplements {
		if err := database.Create(&supplements[i]).Error; err != nil {
			return fmt.Errorf("failed to create supplement: %w", err)
		}
	}

	logs := []models.OperationLog{
		{OrderID: 2, Operation: "提交核验", OldStatus: models.StatusPendingSubmit, NewStatus: models.StatusPendingVerify, OperatorID: users[0].ID, OperatorName: users[0].RealName, OperatorRole: users[0].Role, Remark: "库管员提交库存调整单，等待仓储主管核验"},
		{OrderID: 3, Operation: "提交核验", OldStatus: models.StatusPendingSubmit, NewStatus: models.StatusPendingVerify, OperatorID: users[1].ID, OperatorName: users[1].RealName, OperatorRole: users[1].Role, Remark: "库管员提交库存调整单"},
		{OrderID: 3, Operation: "核验退回", OldStatus: models.StatusPendingVerify, NewStatus: models.StatusReturned, OperatorID: users[2].ID, OperatorName: users[2].RealName, OperatorRole: users[2].Role, Remark: "缺少破损照片证据，且调整原因描述不清晰，请补充后重新提交"},
		{OrderID: 5, Operation: "提交核验", OldStatus: models.StatusPendingSubmit, NewStatus: models.StatusPendingVerify, OperatorID: users[0].ID, OperatorName: users[0].RealName, OperatorRole: users[0].Role, Remark: "提交核验"},
		{OrderID: 5, Operation: "核验通过", OldStatus: models.StatusPendingVerify, NewStatus: models.StatusVerifyPassed, OperatorID: users[2].ID, OperatorName: users[2].RealName, OperatorRole: users[2].Role, Remark: "证据充分，原因合理，同意核验通过"},
		{OrderID: 5, Operation: "待复核认领", OldStatus: models.StatusVerifyPassed, NewStatus: models.StatusPendingReview, OperatorID: users[2].ID, OperatorName: users[2].RealName, OperatorRole: users[2].Role, Remark: "核验通过，进入待复核队列"},
		{OrderID: 6, Operation: "提交核验", OldStatus: models.StatusPendingSubmit, NewStatus: models.StatusPendingVerify, OperatorID: users[1].ID, OperatorName: users[1].RealName, OperatorRole: users[1].Role, Remark: "提交核验"},
		{OrderID: 6, Operation: "核验通过", OldStatus: models.StatusPendingVerify, NewStatus: models.StatusVerifyPassed, OperatorID: users[2].ID, OperatorName: users[2].RealName, OperatorRole: users[2].Role, Remark: "损耗率在合理范围内，同意提交复核"},
		{OrderID: 6, Operation: "待复核认领", OldStatus: models.StatusVerifyPassed, NewStatus: models.StatusPendingReview, OperatorID: users[2].ID, OperatorName: users[2].RealName, OperatorRole: users[2].Role, Remark: "核验通过，进入待复核队列"},
		{OrderID: 7, Operation: "提交核验", OldStatus: models.StatusPendingSubmit, NewStatus: models.StatusPendingVerify, OperatorID: users[0].ID, OperatorName: users[0].RealName, OperatorRole: users[0].Role, Remark: "提交核验"},
		{OrderID: 7, Operation: "核验通过", OldStatus: models.StatusPendingVerify, NewStatus: models.StatusVerifyPassed, OperatorID: users[2].ID, OperatorName: users[2].RealName, OperatorRole: users[2].Role, Remark: "退货单齐全，入库核验无误"},
		{OrderID: 7, Operation: "待复核认领", OldStatus: models.StatusVerifyPassed, NewStatus: models.StatusPendingReview, OperatorID: users[2].ID, OperatorName: users[2].RealName, OperatorRole: users[2].Role, Remark: "核验通过，进入待复核队列"},
		{OrderID: 7, Operation: "复核通过", OldStatus: models.StatusPendingReview, NewStatus: models.StatusReviewPassed, OperatorID: users[3].ID, OperatorName: users[3].RealName, OperatorRole: users[3].Role, Remark: "复核通过，待归档"},
		{OrderID: 8, Operation: "提交核验", OldStatus: models.StatusPendingSubmit, NewStatus: models.StatusPendingVerify, OperatorID: users[1].ID, OperatorName: users[1].RealName, OperatorRole: users[1].Role, Remark: "提交核验"},
		{OrderID: 8, Operation: "核验通过", OldStatus: models.StatusPendingVerify, NewStatus: models.StatusVerifyPassed, OperatorID: users[2].ID, OperatorName: users[2].RealName, OperatorRole: users[2].Role, Remark: "错发记录完整，同意核验通过"},
		{OrderID: 8, Operation: "待复核认领", OldStatus: models.StatusVerifyPassed, NewStatus: models.StatusPendingReview, OperatorID: users[2].ID, OperatorName: users[2].RealName, OperatorRole: users[2].Role, Remark: "核验通过，进入待复核队列"},
		{OrderID: 8, Operation: "复核通过", OldStatus: models.StatusPendingReview, NewStatus: models.StatusReviewPassed, OperatorID: users[3].ID, OperatorName: users[3].RealName, OperatorRole: users[3].Role, Remark: "复核通过，同意归档"},
		{OrderID: 8, Operation: "归档", OldStatus: models.StatusReviewPassed, NewStatus: models.StatusArchived, OperatorID: users[3].ID, OperatorName: users[3].RealName, OperatorRole: users[3].Role, Remark: "运营经理完成归档"},
		{OrderID: 10, Operation: "提交核验", OldStatus: models.StatusPendingSubmit, NewStatus: models.StatusPendingVerify, OperatorID: users[1].ID, OperatorName: users[1].RealName, OperatorRole: users[1].Role, Remark: "提交核验"},
	}
	for i := range logs {
		if err := database.Create(&logs[i]).Error; err != nil {
			return fmt.Errorf("failed to create log: %w", err)
		}
	}

	log.Println("Demo data seeded successfully")
	return nil
}

func strPtr(s string) *string { return &s }
func timePtr(t time.Time) *time.Time { return &t }
