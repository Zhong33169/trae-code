-- 演示数据初始化

-- 用户数据 (密码统一为: 123456)
INSERT OR IGNORE INTO users (id, username, password_hash, role, name) VALUES
(1, 'registrar1', '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$Z7y5i6kF7TJGwF/MBb3E5g', 'registrar', '张登记员'),
(2, 'auditor1', '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$Z7y5i6kF7TJGwF/MBb3E5g', 'auditor', '李审核主管'),
(3, 'reviewer1', '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$Z7y5i6kF7TJGwF/MBb3E5g', 'reviewer', '王复核负责人');

-- 投诉工单演示数据
INSERT OR IGNORE INTO complaint_tickets
(id, ticket_no, title, content, complainant, contact, status, priority, source,
 is_exception, exception_reason, deadline, created_by, handler_id, reviewer_id,
 result_summary, return_reason, audit_remark, created_at, updated_at)
VALUES
-- 正常单：待审核（登记员刚提交）
(1, 'TS202606001', '家政服务人员迟到问题', '预约上午9点上门服务，结果10点半才到，影响当天安排。',
 '陈先生', '13800138001', 'pending_audit', 'normal', 'online',
 0, NULL, '2026-06-25 18:00:00', 1, NULL, NULL,
 NULL, NULL, NULL, '2026-06-20 09:30:00', '2026-06-20 09:30:00'),

-- 正常单：办理中（审核主管办理中）
(2, 'TS202606002', '保洁服务质量不满意', '家政阿姨打扫不干净，厨房油污还有残留，要求重新服务。',
 '刘女士', '13900139002', 'processing', 'high', 'phone',
 0, NULL, '2026-06-22 18:00:00', 1, 2, NULL,
 '已联系服务站站长，安排重新上门保洁。', NULL, NULL, '2026-06-19 14:20:00', '2026-06-20 10:15:00'),

-- 正常单：待复核（审核主管办理完成）
(3, 'TS202606003', '保姆私自调整服务时间', '保姆未经同意将服务时间从下午改到上午，造成家中无人。',
 '赵先生', '13700137003', 'pending_review', 'normal', 'online',
 0, NULL, '2026-06-23 18:00:00', 1, 2, NULL,
 '已对保姆进行批评教育，扣除当月奖金50元，赠送客户一次免费深度保洁。客户表示接受。',
 NULL, '处理及时，客户满意。', '2026-06-18 11:00:00', '2026-06-20 16:00:00'),

-- 正常单：已归档（复核通过）
(4, 'TS202606004', '月嫂专业技能不足', ' hired的月嫂不会给新生儿洗澡，换尿布也不熟练，要求更换。',
 '孙女士', '13600136004', 'archived', 'high', 'online',
 0, NULL, '2026-06-15 18:00:00', 1, 2, 3,
 '已为客户更换资深月嫂，并退还30%服务费作为补偿。',
 NULL, '复核通过，处理流程规范，客户反馈良好。', '2026-06-10 08:30:00', '2026-06-14 17:30:00'),

-- 缺材料单：退回补正（审核主管退回）
(5, 'TS202606005', '家电清洗损坏财物', '清洗空调时弄坏了客厅灯罩，要求赔偿。',
 '周先生', '13500135005', 'returned', 'high', 'online',
 1, '缺少损坏物品照片及购买凭证', '2026-06-28 18:00:00', 1, 2, NULL,
 NULL,
 '缺少损坏物品现场照片及购买凭证，请补充材料后重新提交。',
 NULL, '2026-06-21 08:00:00', '2026-06-21 11:30:00'),

-- 超时单：待审核（已超期）
(6, 'TS202606006', '搬家服务物品损坏', '搬家过程中衣柜被刮花，镜子碎了一面，要求赔偿。',
 '吴女士', '13400134006', 'pending_audit', 'urgent', 'phone',
 1, '工单已超时未处理', '2026-06-18 18:00:00', 1, NULL, NULL,
 NULL, NULL, NULL, '2026-06-15 16:00:00', '2026-06-15 16:00:00'),

-- 退回单：已退回补正（复核退回）
(7, 'TS202606007', '育儿嫂服务态度差', '育儿嫂对孩子不耐烦，经常玩手机不专心。',
 '郑先生', '13300133007', 'returned', 'high', 'online',
 1, '复核退回，处理结果不充分', '2026-06-26 18:00:00', 1, 2, NULL,
 '已批评教育育儿嫂。',
 '仅批评教育不足以解决问题，请重新评估处理方案，给出具体改进措施和对客户的补偿方案。',
 '第一次审核通过，但复核认为处理力度不够，退回重办。', '2026-06-17 10:00:00', '2026-06-20 14:00:00'),

-- 草稿：登记员未提交
(8, 'TS202606008', '钟点工做饭不合口味', '钟点工做的饭菜味道不好，老人孩子都不爱吃。',
 '冯女士', '13200132008', 'draft', 'low', 'online',
 0, NULL, '2026-06-30 18:00:00', 1, NULL, NULL,
 NULL, NULL, NULL, '2026-06-21 09:00:00', '2026-06-21 09:00:00');

-- 附件数据
INSERT OR IGNORE INTO ticket_attachments (id, ticket_id, filename, file_path, file_size, uploaded_by) VALUES
(1, 1, '预约记录截图.png', '/uploads/1/appointment.png', 102400, 1),
(2, 4, '服务评价表.pdf', '/uploads/4/evaluation.pdf', 204800, 1),
(3, 5, '初步描述.txt', '/uploads/5/description.txt', 1024, 1);

-- 审计日志
INSERT OR IGNORE INTO audit_logs (id, ticket_id, user_id, action, detail, is_failure, failure_reason) VALUES
(1, 1, 1, 'create_ticket', '创建投诉工单', 0, NULL),
(2, 2, 1, 'create_ticket', '创建投诉工单', 0, NULL),
(3, 2, 2, 'start_process', '审核主管开始办理', 0, NULL),
(4, 3, 1, 'create_ticket', '创建投诉工单', 0, NULL),
(5, 3, 2, 'start_process', '审核主管开始办理', 0, NULL),
(6, 3, 2, 'submit_review', '提交复核', 0, NULL),
(7, 4, 1, 'create_ticket', '创建投诉工单', 0, NULL),
(8, 4, 2, 'start_process', '审核主管开始办理', 0, NULL),
(9, 4, 2, 'submit_review', '提交复核', 0, NULL),
(10, 4, 3, 'archive', '复核通过，归档', 0, NULL),
(11, 5, 1, 'create_ticket', '创建投诉工单', 0, NULL),
(12, 5, 2, 'return_ticket', '退回补正：缺少材料', 0, NULL),
(13, 6, 1, 'create_ticket', '创建投诉工单', 0, NULL),
(14, 7, 1, 'create_ticket', '创建投诉工单', 0, NULL),
(15, 7, 2, 'start_process', '审核主管开始办理', 0, NULL),
(16, 7, 2, 'submit_review', '提交复核', 0, NULL),
(17, 7, 3, 'return_ticket', '复核退回：处理结果不充分', 0, NULL),
(18, 8, 1, 'create_ticket', '创建草稿工单', 0, NULL);

-- 导入批次示例
INSERT OR IGNORE INTO import_batches (id, batch_no, source, total_count, success_count, fail_count, imported_by) VALUES
(1, 'BATCH20260601', 'offline_excel', 5, 3, 2, 1);

-- 导入记录示例
INSERT OR IGNORE INTO import_records (id, batch_id, ticket_id, original_ticket_no, original_data, status, diff_detail, error_message) VALUES
(1, 1, NULL, 'OFF-001', '{"title":"测试导入1"}', 'success', NULL, NULL),
(2, 1, NULL, 'OFF-002', '{"title":"测试导入2"}', 'duplicate', NULL, '工单号已存在'),
(3, 1, NULL, 'OFF-003', '{"title":"测试导入3"}', 'conflict', '状态不一致', '线上状态与线下状态冲突'),
(4, 1, NULL, 'OFF-004', '{"title":"测试导入4"}', 'failed', NULL, '数据格式错误'),
(5, 1, NULL, 'OFF-005', '{"title":"测试导入5"}', 'success', NULL, NULL);
