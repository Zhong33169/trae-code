-- Seed 用户数据 (密码统一为 123456，已 bcrypt 哈希)
INSERT OR IGNORE INTO users (username, password, role, real_name) VALUES
('initiator1', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'initiator', '张三（发起岗）'),
('handler1', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'handler', '李四（办理岗）'),
('reviewer1', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'reviewer', '王五（复核岗）'),
('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin', '系统管理员');

-- Seed 值机记录
INSERT OR IGNORE INTO checkin_records (
    batch_no, flight_no, flight_date, passenger_name, id_card_no, seat_no,
    boarding_gate, checkin_time, source, status, material_complete, is_overtime,
    is_abnormal, result, return_reason, audit_remark, initiator_id, handler_id, reviewer_id,
    initiated_at, handled_at, reviewed_at
) VALUES
-- 正常单：待发起
('BATCH20250101001', 'CA1234', '2025-01-15', '赵明', '110101199001011234', '12A',
 'A01', '2025-01-15 08:30:00', 'offline', 'pending', 1, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL,
 NULL, NULL, NULL),

-- 正常单：已发起待办理
('BATCH20250101001', 'CA1234', '2025-01-15', '钱伟', '110101199002022345', '12B',
 'A01', '2025-01-15 08:32:00', 'offline', 'processing', 1, 0, 0, NULL, NULL, NULL, 1, NULL, NULL,
 '2025-01-15 09:00:00', NULL, NULL),

-- 正常单：已办理待复核
('BATCH20250101001', 'CA1234', '2025-01-15', '孙强', '110101199003033456', '12C',
 'A01', '2025-01-15 08:35:00', 'offline', 'verified', 1, 0, 0, '值机成功', NULL, NULL, 1, 2, NULL,
 '2025-01-15 09:00:00', '2025-01-15 09:30:00', NULL),

-- 正常单：已归档
('BATCH20250101002', 'MU5678', '2025-01-15', '周杰', '110101199004044567', '15D',
 'B02', '2025-01-15 10:00:00', 'offline', 'archived', 1, 0, 0, '值机成功，已复核归档', NULL, '复核通过，数据一致', 1, 2, 3,
 '2025-01-15 10:15:00', '2025-01-15 10:30:00', '2025-01-15 11:00:00'),

-- 缺材料单
('BATCH20250101003', 'CZ9012', '2025-01-15', '吴芳', '110101199005055678', '08E',
 'C03', '2025-01-15 14:00:00', 'offline', 'returned', 0, 0, 0, NULL, '缺少身份证复印件，需补充材料', NULL, 1, 2, NULL,
 '2025-01-15 14:15:00', '2025-01-15 14:45:00', NULL),

-- 超时单
('BATCH20250101004', 'HU3456', '2025-01-14', '郑涛', '110101199006066789', '20F',
 'D04', '2025-01-14 22:00:00', 'offline', 'processing', 1, 1, 1, NULL, NULL, '超过值机截止时间1小时', 1, 2, NULL,
 '2025-01-14 22:30:00', '2025-01-14 23:00:00', NULL),

-- 退回单
('BATCH20250101005', 'CA8888', '2025-01-15', '冯雪', '110101199007077890', '05A',
 'A05', '2025-01-15 16:00:00', 'offline', 'returned', 1, 0, 0, NULL, '线上系统显示该旅客已取消值机，线下数据与线上不一致，请核实', NULL, 1, NULL, 3,
 '2025-01-15 16:15:00', NULL, '2025-01-15 17:00:00'),

-- 重复批次（同批次同证件，异常）
('BATCH20250101001', 'CA1234', '2025-01-15', '赵明', '110101199001011234', '12A',
 'A01', '2025-01-15 08:30:00', 'online', 'pending', 1, 0, 1, NULL, NULL, '批次内重复记录，待核实', NULL, NULL, NULL,
 NULL, NULL, NULL),

-- 状态不一致样例（同一旅客 offline pending 但 online archived）
('BATCH20250101006', 'MU1111', '2025-01-15', '陈磊', '110101199008088901', '03B',
 'B01', '2025-01-15 06:00:00', 'online', 'archived', 1, 0, 1, NULL, NULL, '线下状态待发起，但线上已归档，状态不一致', NULL, NULL, NULL,
 NULL, NULL, NULL),
('BATCH20250101006', 'MU1111', '2025-01-15', '陈磊', '110101199008088901', '03B',
 'B01', '2025-01-15 06:00:00', 'offline', 'pending', 1, 0, 1, NULL, NULL, '线上已归档但线下仍待发起，状态不一致', NULL, NULL, NULL,
 NULL, NULL, NULL);

-- Seed 附件数据
INSERT OR IGNORE INTO attachments (checkin_record_id, file_name, file_path, file_type, file_size, uploaded_by) VALUES
(1, '身份证扫描件_赵明.jpg', '/uploads/1/id_zhaoming.jpg', 'image/jpeg', 1024000, 1),
(2, '身份证扫描件_钱伟.jpg', '/uploads/2/id_qianwei.jpg', 'image/jpeg', 980000, 1),
(3, '身份证扫描件_孙强.jpg', '/uploads/3/id_sunqiang.jpg', 'image/jpeg', 1050000, 1),
(3, '登机牌_孙强.pdf', '/uploads/3/boarding_sunqiang.pdf', 'application/pdf', 256000, 2),
(4, '身份证扫描件_周杰.jpg', '/uploads/4/id_zhoujie.jpg', 'image/jpeg', 920000, 1),
(4, '登机牌_周杰.pdf', '/uploads/4/boarding_zhoujie.pdf', 'application/pdf', 240000, 2),
(4, '复核确认单.pdf', '/uploads/4/review_zhoujie.pdf', 'application/pdf', 180000, 3),
(6, '超时情况说明.docx', '/uploads/6/overtime.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 120000, 2);

-- Seed 审计日志
INSERT OR IGNORE INTO audit_logs (checkin_record_id, user_id, action, old_status, new_status, detail, failure_reason) VALUES
(2, 1, 'initiate', NULL, 'processing', '发起值机记录回填', NULL),
(3, 1, 'initiate', NULL, 'processing', '发起值机记录回填', NULL),
(3, 2, 'handle', 'processing', 'verified', '办理值机记录，核验材料完整', NULL),
(4, 1, 'initiate', NULL, 'processing', '发起值机记录回填', NULL),
(4, 2, 'handle', 'processing', 'verified', '办理值机记录，核验材料完整', NULL),
(4, 3, 'review', 'verified', 'archived', '复核归档通过', NULL),
(5, 1, 'initiate', NULL, 'processing', '发起值机记录回填', NULL),
(5, 2, 'return', 'processing', 'returned', '退回补充材料', '缺少身份证复印件'),
(6, 1, 'initiate', NULL, 'processing', '发起值机记录回填', NULL),
(6, 2, 'handle', 'processing', 'processing', '标记超时异常，进入异常处理', '超过值机截止时间'),
(7, 1, 'initiate', NULL, 'processing', '发起值机记录回填', NULL),
(7, 3, 'return', 'processing', 'returned', '复核退回', '线上系统显示该旅客已取消值机，与线下数据不一致'),

-- ======== 失败审计样例：权限拒绝 ========
(3, 1, 'archive', 'verified', 'archived', '发起岗尝试越权归档', '权限拒绝：角色 initiator 不允许执行 archive 操作，允许操作为 [initiate,update]'),
(2, 3, 'verify', 'processing', 'verified', '复核岗尝试越权核验（无权限）', '权限拒绝：角色 reviewer 不允许执行 verify 操作，允许操作为 [review,archive,return]'),
(1, 2, 'initiate', 'pending', 'processing', '办理岗尝试越权发起', '权限拒绝：角色 handler 不允许执行 initiate 操作，允许操作为 [handle,verify,return]'),

-- ======== 失败审计样例：状态流转拒绝 ========
(1, 1, 'archive', 'pending', 'archived', '尝试对未发起记录直接归档', '状态流转拒绝：不能从 pending 转为 archived，允许流转为 [processing]'),
(4, 3, 'verify', 'archived', 'verified', '尝试对已归档记录重新核验', '状态流转拒绝：不能从 archived 转为 verified，允许流转为 []'),
(2, 2, 'archive', 'processing', 'archived', '办理未通过尝试直接归档', '状态流转拒绝：不能从 processing 转为 archived，允许流转为 [verified,returned,rejected]'),
(5, 2, 'archive', 'returned', 'archived', '尝试对退回记录直接归档', '状态流转拒绝：不能从 returned 转为 archived，允许流转为 [processing]'),

-- ======== 失败审计样例：归档/复核拦截（一致性问题） ========
(8, 3, 'archive', 'pending', 'archived', '尝试归档重复批次记录 #8', '归档/复核拦截：存在 1 个数据一致性问题：批次 BATCH20250101001 内已存在身份证号 110101199001011234 的记录（共 1 条重复），请核实是否为重复录入'),
(10, 3, 'archive', 'pending', 'archived', '尝试归档状态不一致记录 #10', '归档/复核拦截：存在 2 个数据一致性问题：批次 BATCH20250101006 内已存在身份证号 110101199008088901 的记录；线上线下状态不一致：当前记录（offline）状态为 pending，对应online记录（ID:9）状态为 archived'),
(10, 4, 'review', 'pending', 'archived', '管理员复核被拦截', '归档/复核拦截：存在数据一致性问题，线上线下状态不一致，详情见失败日志'),

-- ======== 失败审计样例：退回原因缺失 ========
(6, 2, 'return', 'processing', 'returned', '办理岗退回但未填写原因', '退回原因缺失：执行退回操作但未填写退回原因'),
(3, 3, 'return', 'verified', 'returned', '复核岗退回但未填写原因', '退回原因缺失：执行退回操作但未填写退回原因'),

-- ======== 失败审计样例：批量权限拒绝 ========
(1, 1, 'archive', '', '', '批量操作被权限拦截', '批量权限拒绝：角色 initiator 不允许执行 archive 操作，允许操作为 [initiate,update]'),
(2, 1, 'archive', '', '', '批量操作被权限拦截', '批量权限拒绝：角色 initiator 不允许执行 archive 操作，允许操作为 [initiate,update]'),
(3, 1, 'archive', '', '', '批量操作被权限拦截', '批量权限拒绝：角色 initiator 不允许执行 archive 操作，允许操作为 [initiate,update]'),

-- ======== 失败审计样例：批量状态流转拒绝 ========
(1, 2, 'archive', 'pending', 'archived', '批量归档 - 状态不对', '状态不允许从 pending 转为 archived'),
(4, 2, 'archive', 'archived', 'archived', '批量归档 - 已归档', '状态不允许从 archived 转为 archived'),

-- ======== 失败审计样例：字段校验失败（无关联记录） ========
(NULL, 1, 'initiate', '', '', '尝试创建记录但必填字段缺失', '创建记录字段校验失败：batch_no: 批次号必填; flight_no: 航班号必填; passenger_name: 旅客姓名必填'),
(NULL, 2, 'initiate', '', '', '办理岗尝试创建记录（越权）', '创建权限拒绝：角色 handler 不允许创建记录，允许操作为 [handle,verify,return]');
