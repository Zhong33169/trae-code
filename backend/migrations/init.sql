-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('clerk', 'supervisor', 'reviewer'))
);

-- Knowledge items table
CREATE TABLE IF NOT EXISTS knowledge_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'normal'
);

-- Knowledge revision orders table
CREATE TABLE IF NOT EXISTS knowledge_revision_orders (
    id TEXT PRIMARY KEY,
    order_no TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    knowledge_item_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review', 'pending_final_review', 'pending_correction', 'archived')),
    is_overdue INTEGER NOT NULL DEFAULT 0,
    overdue_days INTEGER NOT NULL DEFAULT 0,
    overdue_reason TEXT DEFAULT '',
    overdue_action TEXT DEFAULT '',
    creator_id TEXT NOT NULL,
    current_handler_id TEXT DEFAULT '',
    current_handler_role TEXT DEFAULT '',
    time_limit_hours INTEGER NOT NULL DEFAULT 48,
    deadline TEXT NOT NULL,
    revision_before TEXT DEFAULT '',
    revision_after TEXT DEFAULT '',
    revision_description TEXT DEFAULT '',
    processing_opinion TEXT DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (knowledge_item_id) REFERENCES knowledge_items(id),
    FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- Materials table
CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    name TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT '',
    is_complete INTEGER NOT NULL DEFAULT 0,
    uploaded_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES knowledge_revision_orders(id) ON DELETE CASCADE
);

-- Knowledge feedbacks table
CREATE TABLE IF NOT EXISTS knowledge_feedbacks (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    content TEXT NOT NULL,
    is_resolved INTEGER NOT NULL DEFAULT 0,
    resolved_at TEXT,
    FOREIGN KEY (order_id) REFERENCES knowledge_revision_orders(id) ON DELETE CASCADE
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    order_no TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    from_status TEXT DEFAULT '',
    to_status TEXT DEFAULT '',
    opinion TEXT DEFAULT '',
    reason TEXT DEFAULT '',
    failure_reason TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES knowledge_revision_orders(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON knowledge_revision_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_creator_id ON knowledge_revision_orders(creator_id);
CREATE INDEX IF NOT EXISTS idx_orders_current_handler_id ON knowledge_revision_orders(current_handler_id);
CREATE INDEX IF NOT EXISTS idx_orders_current_handler_role ON knowledge_revision_orders(current_handler_role);
CREATE INDEX IF NOT EXISTS idx_orders_is_overdue ON knowledge_revision_orders(is_overdue);
CREATE INDEX IF NOT EXISTS idx_orders_deadline ON knowledge_revision_orders(deadline);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON knowledge_revision_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_materials_order_id ON materials(order_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_order_id ON knowledge_feedbacks(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_order_id ON audit_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_status ON knowledge_items(status);

-- =============================================
-- Seed Data
-- =============================================

-- Users
INSERT OR IGNORE INTO users (id, name, role) VALUES ('u1', '张登记', 'clerk');
INSERT OR IGNORE INTO users (id, name, role) VALUES ('u2', '李审核', 'supervisor');
INSERT OR IGNORE INTO users (id, name, role) VALUES ('u3', '王复核', 'reviewer');

-- Knowledge Items
INSERT OR IGNORE INTO knowledge_items (id, title, category, expiry_date, status) VALUES ('ki1', '客服话术标准V2.1', '服务规范', '2026-06-25', 'expiring');
INSERT OR IGNORE INTO knowledge_items (id, title, category, expiry_date, status) VALUES ('ki2', '投诉处理流程V3.0', '投诉管理', '2026-06-10', 'expired');
INSERT OR IGNORE INTO knowledge_items (id, title, category, expiry_date, status) VALUES ('ki3', '产品退换货政策', '售后管理', '2026-06-22', 'expiring');
INSERT OR IGNORE INTO knowledge_items (id, title, category, expiry_date, status) VALUES ('ki4', 'VIP客户服务规范', '服务规范', '2026-12-31', 'normal');
INSERT OR IGNORE INTO knowledge_items (id, title, category, expiry_date, status) VALUES ('ki5', '呼叫中心应急预案', '应急管理', '2026-05-30', 'expired');

-- =============================================
-- Demo Orders
-- =============================================

-- 1. KSX-20260601001: 正常流程-待审核 (pending_review, not overdue, all materials complete, feedbacks resolved)
INSERT OR IGNORE INTO knowledge_revision_orders (
    id, order_no, title, knowledge_item_id, status,
    is_overdue, overdue_days, overdue_reason, overdue_action,
    creator_id, current_handler_id, current_handler_role,
    time_limit_hours, deadline,
    revision_before, revision_after, revision_description, processing_opinion,
    version, created_at, updated_at
) VALUES (
    'ord1', 'KSX-20260601001', '客服话术标准V2.1修订', 'ki1', 'pending_review',
    0, 0, '', '',
    'u1', 'u2', 'supervisor',
    72, '2026-06-25 10:00:00',
    '原话术标准中缺少新型业务引导话术', '新增5G套餐引导话术和IPTV业务推荐话术', '针对5G业务上线，补充相关服务引导话术', '',
    1, '2026-06-01 09:00:00', '2026-06-01 09:00:00'
);

-- Materials for ord1 (all complete)
INSERT OR IGNORE INTO materials (id, order_id, name, file_type, is_complete, uploaded_at) VALUES ('mat1', 'ord1', '话术修订对照表.pdf', 'pdf', 1, '2026-06-01 09:05:00');
INSERT OR IGNORE INTO materials (id, order_id, name, file_type, is_complete, uploaded_at) VALUES ('mat2', 'ord1', '新话术测试报告.docx', 'docx', 1, '2026-06-01 09:10:00');

-- Feedbacks for ord1 (all resolved)
INSERT OR IGNORE INTO knowledge_feedbacks (id, order_id, content, is_resolved, resolved_at) VALUES ('fb1', 'ord1', '5G套餐引导话术需要补充老年用户版本', 1, '2026-06-02 14:00:00');
INSERT OR IGNORE INTO knowledge_feedbacks (id, order_id, content, is_resolved, resolved_at) VALUES ('fb2', 'ord1', '建议增加方言区域的话术变体', 1, '2026-06-02 15:00:00');

-- Audit log for ord1
INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al1', 'ord1', 'KSX-20260601001', 'create', 'u1', '张登记', 'clerk', '', 'pending_review', '', '', '', '2026-06-01 09:00:00');


-- 2. KSX-20260601002: 正常流程-待复核 (pending_final_review, not overdue)
INSERT OR IGNORE INTO knowledge_revision_orders (
    id, order_no, title, knowledge_item_id, status,
    is_overdue, overdue_days, overdue_reason, overdue_action,
    creator_id, current_handler_id, current_handler_role,
    time_limit_hours, deadline,
    revision_before, revision_after, revision_description, processing_opinion,
    version, created_at, updated_at
) VALUES (
    'ord2', 'KSX-20260601002', '产品退换货政策更新', 'ki3', 'pending_final_review',
    0, 0, '', '',
    'u1', 'u3', 'reviewer',
    72, '2026-06-28 10:00:00',
    '原政策未包含线上退换货流程', '新增线上退换货流程及7天无理由退货细则', '根据电商平台发展，更新退换货政策', '',
    2, '2026-06-01 10:00:00', '2026-06-05 11:00:00'
);

INSERT OR IGNORE INTO materials (id, order_id, name, file_type, is_complete, uploaded_at) VALUES ('mat3', 'ord2', '退换货政策修订稿.pdf', 'pdf', 1, '2026-06-01 10:05:00');
INSERT OR IGNORE INTO materials (id, order_id, name, file_type, is_complete, uploaded_at) VALUES ('mat4', 'ord2', '线上退换货流程图.png', 'png', 1, '2026-06-01 10:10:00');

INSERT OR IGNORE INTO knowledge_feedbacks (id, order_id, content, is_resolved, resolved_at) VALUES ('fb3', 'ord2', '需要明确跨境商品的退换货规则', 1, '2026-06-03 09:00:00');

INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al2', 'ord2', 'KSX-20260601002', 'create', 'u1', '张登记', 'clerk', '', 'pending_review', '', '', '', '2026-06-01 10:00:00');
INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al3', 'ord2', 'KSX-20260601002', 'advance', 'u2', '李审核', 'supervisor', 'pending_review', 'pending_final_review', '修订内容完整，同意提交复核', '', '', '2026-06-05 11:00:00');


-- 3. KSX-20260601003: 已归档 (archived)
INSERT OR IGNORE INTO knowledge_revision_orders (
    id, order_no, title, knowledge_item_id, status,
    is_overdue, overdue_days, overdue_reason, overdue_action,
    creator_id, current_handler_id, current_handler_role,
    time_limit_hours, deadline,
    revision_before, revision_after, revision_description, processing_opinion,
    version, created_at, updated_at
) VALUES (
    'ord3', 'KSX-20260601003', '投诉处理流程V3.0修订', 'ki2', 'archived',
    0, 0, '', '',
    'u1', '', '',
    72, '2026-06-10 10:00:00',
    '原流程缺少紧急投诉升级机制', '新增紧急投诉30分钟内升级处理流程', '完善投诉处理流程，增加紧急升级机制', '修订内容规范完整，同意归档',
    3, '2026-05-20 09:00:00', '2026-05-28 16:00:00'
);

INSERT OR IGNORE INTO materials (id, order_id, name, file_type, is_complete, uploaded_at) VALUES ('mat5', 'ord3', '投诉流程修订对照表.pdf', 'pdf', 1, '2026-05-20 09:05:00');
INSERT OR IGNORE INTO materials (id, order_id, name, file_type, is_complete, uploaded_at) VALUES ('mat6', 'ord3', '紧急升级流程图.png', 'png', 1, '2026-05-20 09:10:00');
INSERT OR IGNORE INTO materials (id, order_id, name, file_type, is_complete, uploaded_at) VALUES ('mat7', 'ord3', '投诉处理培训材料.pptx', 'pptx', 1, '2026-05-20 09:15:00');

INSERT OR IGNORE INTO knowledge_feedbacks (id, order_id, content, is_resolved, resolved_at) VALUES ('fb4', 'ord3', '紧急升级需通知部门负责人', 1, '2026-05-22 10:00:00');
INSERT OR IGNORE INTO knowledge_feedbacks (id, order_id, content, is_resolved, resolved_at) VALUES ('fb5', 'ord3', '建议增加升级后处理时限要求', 1, '2026-05-22 11:00:00');

-- Audit logs for ord3 - full flow: create -> advance -> advance
INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al4', 'ord3', 'KSX-20260601003', 'create', 'u1', '张登记', 'clerk', '', 'pending_review', '', '', '', '2026-05-20 09:00:00');
INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al5', 'ord3', 'KSX-20260601003', 'advance', 'u2', '李审核', 'supervisor', 'pending_review', 'pending_final_review', '修订内容完整，流程清晰，同意提交复核', '', '', '2026-05-24 14:00:00');
INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al6', 'ord3', 'KSX-20260601003', 'advance', 'u3', '王复核', 'reviewer', 'pending_final_review', 'archived', '修订内容规范完整，同意归档', '', '', '2026-05-28 16:00:00');


-- 4. KSX-20260601004: 待补正 (pending_correction, returned by supervisor, materials incomplete)
INSERT OR IGNORE INTO knowledge_revision_orders (
    id, order_no, title, knowledge_item_id, status,
    is_overdue, overdue_days, overdue_reason, overdue_action,
    creator_id, current_handler_id, current_handler_role,
    time_limit_hours, deadline,
    revision_before, revision_after, revision_description, processing_opinion,
    version, created_at, updated_at
) VALUES (
    'ord4', 'KSX-20260601004', '呼叫中心应急预案更新', 'ki5', 'pending_correction',
    0, 0, '', '',
    'u1', 'u1', 'clerk',
    72, '2026-06-25 10:00:00',
    '原预案缺少网络故障应急处理方案', '新增网络故障分级应急处理流程', '更新应急预案，补充网络故障处理', '',
    2, '2026-06-02 08:00:00', '2026-06-08 10:00:00'
);

-- Materials for ord4 (some incomplete)
INSERT OR IGNORE INTO materials (id, order_id, name, file_type, is_complete, uploaded_at) VALUES ('mat8', 'ord4', '应急预案修订稿.pdf', 'pdf', 1, '2026-06-02 08:05:00');
INSERT OR IGNORE INTO materials (id, order_id, name, file_type, is_complete, uploaded_at) VALUES ('mat9', 'ord4', '网络故障应急流程图.png', 'png', 0, '2026-06-02 08:10:00');

-- Feedbacks for ord4 (unresolved)
INSERT OR IGNORE INTO knowledge_feedbacks (id, order_id, content, is_resolved, resolved_at) VALUES ('fb6', 'ord4', '需补充灾备切换的具体操作步骤', 0, NULL);

INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al7', 'ord4', 'KSX-20260601004', 'create', 'u1', '张登记', 'clerk', '', 'pending_review', '', '', '', '2026-06-02 08:00:00');
INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al8', 'ord4', 'KSX-20260601004', 'return', 'u2', '李审核', 'supervisor', 'pending_review', 'pending_correction', '', '流程图不完整，需补充灾备切换步骤', '', '2026-06-08 10:00:00');


-- 5. KSX-20260601005: 逾期-待审核 (pending_review, is_overdue=true, overdue_days=5)
INSERT OR IGNORE INTO knowledge_revision_orders (
    id, order_no, title, knowledge_item_id, status,
    is_overdue, overdue_days, overdue_reason, overdue_action,
    creator_id, current_handler_id, current_handler_role,
    time_limit_hours, deadline,
    revision_before, revision_after, revision_description, processing_opinion,
    version, created_at, updated_at
) VALUES (
    'ord5', 'KSX-20260601005', '投诉处理流程V3.0补充修订', 'ki2', 'pending_review',
    1, 5, '', '',
    'u1', 'u2', 'supervisor',
    48, '2026-06-14 10:00:00',
    '投诉处理流程需增加客户回访环节', '新增投诉处理后的客户回访流程', '补充投诉处理流程的客户回访环节', '',
    1, '2026-06-10 09:00:00', '2026-06-14 10:00:00'
);

INSERT OR IGNORE INTO materials (id, order_id, name, file_type, is_complete, uploaded_at) VALUES ('mat10', 'ord5', '客户回访流程图.pdf', 'pdf', 1, '2026-06-10 09:05:00');
INSERT OR IGNORE INTO materials (id, order_id, name, file_type, is_complete, uploaded_at) VALUES ('mat11', 'ord5', '回访话术模板.docx', 'docx', 1, '2026-06-10 09:10:00');

INSERT OR IGNORE INTO knowledge_feedbacks (id, order_id, content, is_resolved, resolved_at) VALUES ('fb7', 'ord5', '回访时限建议为3个工作日内', 1, '2026-06-11 10:00:00');
INSERT OR IGNORE INTO knowledge_feedbacks (id, order_id, content, is_resolved, resolved_at) VALUES ('fb8', 'ord5', '需增加回访不满意时的二次处理流程', 1, '2026-06-11 14:00:00');

INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al9', 'ord5', 'KSX-20260601005', 'create', 'u1', '张登记', 'clerk', '', 'pending_review', '', '', '', '2026-06-10 09:00:00');


-- 6. KSX-20260601006: 逾期-待复核 (pending_final_review, is_overdue=true, overdue_days=3)
INSERT OR IGNORE INTO knowledge_revision_orders (
    id, order_no, title, knowledge_item_id, status,
    is_overdue, overdue_days, overdue_reason, overdue_action,
    creator_id, current_handler_id, current_handler_role,
    time_limit_hours, deadline,
    revision_before, revision_after, revision_description, processing_opinion,
    version, created_at, updated_at
) VALUES (
    'ord6', 'KSX-20260601006', 'VIP客户服务规范更新', 'ki4', 'pending_final_review',
    1, 3, '', '',
    'u1', 'u3', 'reviewer',
    48, '2026-06-16 10:00:00',
    '原规范缺少VIP客户专属服务通道说明', '新增VIP客户专属热线和服务优先级规则', '完善VIP客户服务规范', '',
    2, '2026-06-08 09:00:00', '2026-06-12 11:00:00'
);

INSERT OR IGNORE INTO materials (id, order_id, name, file_type, is_complete, uploaded_at) VALUES ('mat12', 'ord6', 'VIP服务规范修订稿.pdf', 'pdf', 1, '2026-06-08 09:05:00');
INSERT OR IGNORE INTO materials (id, order_id, name, file_type, is_complete, uploaded_at) VALUES ('mat13', 'ord6', 'VIP服务优先级说明.docx', 'docx', 1, '2026-06-08 09:10:00');

INSERT OR IGNORE INTO knowledge_feedbacks (id, order_id, content, is_resolved, resolved_at) VALUES ('fb9', 'ord6', 'VIP等级划分需要与最新的会员体系对齐', 1, '2026-06-10 10:00:00');

INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al10', 'ord6', 'KSX-20260601006', 'create', 'u1', '张登记', 'clerk', '', 'pending_review', '', '', '', '2026-06-08 09:00:00');
INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al11', 'ord6', 'KSX-20260601006', 'advance', 'u2', '李审核', 'supervisor', 'pending_review', 'pending_final_review', '内容完善，同意提交复核', '', '', '2026-06-12 11:00:00');


-- 7. KSX-20260601007: 材料不全-待审核 (pending_review, has incomplete material, unresolved feedback)
INSERT OR IGNORE INTO knowledge_revision_orders (
    id, order_no, title, knowledge_item_id, status,
    is_overdue, overdue_days, overdue_reason, overdue_action,
    creator_id, current_handler_id, current_handler_role,
    time_limit_hours, deadline,
    revision_before, revision_after, revision_description, processing_opinion,
    version, created_at, updated_at
) VALUES (
    'ord7', 'KSX-20260601007', '客服话术标准V2.1补充修订', 'ki1', 'pending_review',
    0, 0, '', '',
    'u1', 'u2', 'supervisor',
    72, '2026-06-28 10:00:00',
    '补充智能客服话术模板', '新增智能客服场景的话术模板', '针对智能客服场景补充话术模板', '',
    1, '2026-06-10 10:00:00', '2026-06-10 10:00:00'
);

-- Materials for ord7 (incomplete material)
INSERT OR IGNORE INTO materials (id, order_id, name, file_type, is_complete, uploaded_at) VALUES ('mat14', 'ord7', '智能客服话术模板.docx', 'docx', 0, '2026-06-10 10:05:00');
INSERT OR IGNORE INTO materials (id, order_id, name, file_type, is_complete, uploaded_at) VALUES ('mat15', 'ord7', '智能客服测试报告.pdf', 'pdf', 1, '2026-06-10 10:10:00');

-- Feedbacks for ord7 (unresolved)
INSERT OR IGNORE INTO knowledge_feedbacks (id, order_id, content, is_resolved, resolved_at) VALUES ('fb10', 'ord7', '智能客服话术需要覆盖多轮对话场景', 0, NULL);
INSERT OR IGNORE INTO knowledge_feedbacks (id, order_id, content, is_resolved, resolved_at) VALUES ('fb11', 'ord7', '需增加转人工客服的触发条件说明', 0, NULL);

INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al12', 'ord7', 'KSX-20260601007', 'create', 'u1', '张登记', 'clerk', '', 'pending_review', '', '', '', '2026-06-10 10:00:00');


-- 8. KSX-20260601008: 正常流程-待审核2 (another clerk's order)
INSERT OR IGNORE INTO knowledge_revision_orders (
    id, order_no, title, knowledge_item_id, status,
    is_overdue, overdue_days, overdue_reason, overdue_action,
    creator_id, current_handler_id, current_handler_role,
    time_limit_hours, deadline,
    revision_before, revision_after, revision_description, processing_opinion,
    version, created_at, updated_at
) VALUES (
    'ord8', 'KSX-20260601008', '客服话术标准V2.1日常修订', 'ki1', 'pending_review',
    0, 0, '', '',
    'u1', 'u2', 'supervisor',
    48, '2026-06-25 10:00:00',
    '更新业务办理指引话术', '新增宽带业务办理指引话术', '更新业务办理相关话术', '',
    1, '2026-06-12 14:00:00', '2026-06-12 14:00:00'
);

INSERT OR IGNORE INTO materials (id, order_id, name, file_type, is_complete, uploaded_at) VALUES ('mat16', 'ord8', '宽带业务话术模板.pdf', 'pdf', 1, '2026-06-12 14:05:00');
INSERT OR IGNORE INTO materials (id, order_id, name, file_type, is_complete, uploaded_at) VALUES ('mat17', 'ord8', '话术修订说明.docx', 'docx', 1, '2026-06-12 14:10:00');

INSERT OR IGNORE INTO knowledge_feedbacks (id, order_id, content, is_resolved, resolved_at) VALUES ('fb12', 'ord8', '建议增加融合套餐推荐话术', 1, '2026-06-13 10:00:00');

INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al13', 'ord8', 'KSX-20260601008', 'create', 'u1', '张登记', 'clerk', '', 'pending_review', '', '', '', '2026-06-12 14:00:00');


-- =============================================
-- Demo Failure Audit Logs (失败留痕样例)
-- =============================================

-- ord1: 伪造角色失败 - clerk冒充supervisor尝试推进
INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al_fail1', 'ord1', 'KSX-20260601001', 'auth_failed', 'u1', '张登记', 'supervisor', 'pending_review', '', '', '', '伪造角色：用户 u1 实际角色为 clerk，请求角色为 supervisor', '2026-06-15 09:00:00');

-- ord1: 业务越权失败 - clerk尝试推进
INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al_fail2', 'ord1', 'KSX-20260601001', 'advance_failed', 'u1', '张登记', 'clerk', 'pending_review', '', '', '', '越权操作：角色 clerk 无权执行从 pending_review 到 pending_final_review 的状态转换，需要角色 supervisor', '2026-06-15 09:05:00');

-- ord5: 逾期工单顺序错误 - clerk尝试推进（已逾期但仍越权操作）
INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al_fail3', 'ord5', 'KSX-20260601005', 'advance_failed', 'u1', '张登记', 'clerk', 'pending_review', '', '', '', '越权操作：角色 clerk 无权执行从 pending_review 到 pending_final_review 的状态转换，需要角色 supervisor', '2026-06-15 10:00:00');

-- ord7: 证据缺失失败 - 材料不全
INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al_fail4', 'ord7', 'KSX-20260601007', 'advance_failed', 'u2', '李审核', 'supervisor', 'pending_review', '', '', '', '证据缺失：存在未完成的材料（智能客服话术模板.docx），无法推进', '2026-06-15 11:00:00');

-- ord7: 证据缺失失败 - 反馈未解决
INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al_fail5', 'ord7', 'KSX-20260601007', 'advance_failed', 'u2', '李审核', 'supervisor', 'pending_review', '', '', '', '证据缺失：存在未解决的反馈（智能客服话术需要覆盖多轮对话场景），无法推进', '2026-06-15 11:30:00');

-- ord8: 版本冲突失败
INSERT OR IGNORE INTO audit_logs (id, order_id, order_no, action, actor_id, actor_name, actor_role, from_status, to_status, opinion, reason, failure_reason, created_at)
VALUES ('al_fail6', 'ord8', 'KSX-20260601008', 'advance_failed', 'u2', '李审核', 'supervisor', 'pending_review', '', '', '', '版本冲突：版本冲突：工单版本已变更，当前版本为 1，请求版本为 99', '2026-06-15 14:00:00');
