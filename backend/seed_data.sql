PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO users (id, username, display_name, role, created_at) VALUES
('u_registrar_01', 'registrar01', '张登记', 'REGISTRAR', '2025-01-01T09:00:00+08:00'),
('u_auditor_01',   'auditor01',   '李审核', 'AUDITOR',   '2025-01-01T09:00:00+08:00'),
('u_reviewer_01',  'reviewer01',  '王复核', 'REVIEWER',  '2025-01-01T09:00:00+08:00');

INSERT OR IGNORE INTO financing_applications (
    id, application_no, applicant_name, applicant_id_card,
    company_name, company_credit_code, financing_amount, financing_term_months,
    risk_level, status, current_handler, version,
    required_evidence, submitted_evidence,
    last_handler_id, last_opinion, last_result,
    created_by, created_at, updated_at
) VALUES (
    'app_001', 'RZZ-2025-0601-001', '刘正常', '110101199001011234',
    '北京恒泰供应链管理有限公司', '91110108MA01ABC123', 5000000.00, 12,
    'MEDIUM', 'ARCHIVED', 'u_reviewer_01', 4,
    '["business_license","financial_statement","tax_certificate","collateral_document"]',
    '["business_license","financial_statement","tax_certificate","collateral_document"]',
    'u_auditor_01', '材料齐全，核验通过，风险等级中，建议复核归档', 'PASSED',
    'u_registrar_01', '2025-06-01T10:00:00+08:00', '2025-06-02T16:30:00+08:00'
),(
    'app_002', 'RZZ-2025-0602-002', '陈缺证', '310101199203042345',
    '上海润通物流有限公司', '91310107MA1G7XF234', 3200000.00, 6,
    'HIGH', 'EVIDENCE_MISSING', 'u_registrar_01', 3,
    '["business_license","financial_statement","tax_certificate","loan_usage_proof"]',
    '["business_license","financial_statement"]',
    'u_auditor_01', '缺少税务证明和贷款用途证明，风险等级偏高，请补充材料', 'EVIDENCE_MISSING',
    'u_registrar_01', '2025-06-02T11:20:00+08:00', '2025-06-03T14:10:00+08:00'
),(
    'app_003', 'RZZ-2025-0603-003', '赵逾期', '440101198805063456',
    '广州鑫源商贸有限公司', '91440106MA59D3E345', 8000000.00, 24,
    'CRITICAL', 'OVERDUE', 'u_auditor_01', 2,
    '["business_license","financial_statement","tax_certificate","credit_report","guarantee_agreement"]',
    '["business_license","financial_statement","tax_certificate","credit_report","guarantee_agreement"]',
    'u_auditor_01', '企业征信显示过往3次逾期记录，当前评级为高风险CRITICAL，需专项会议审议', 'OVERDUE',
    'u_registrar_01', '2025-06-03T09:15:00+08:00', '2025-06-04T10:45:00+08:00'
),(
    'app_004', 'RZZ-2025-0604-004', '孙退回', '510101199507084567',
    '成都智联科技有限公司', '91510100MA61X8Y456', 1500000.00, 3,
    'LOW', 'RETURNED_FOR_CORRECTION', 'u_registrar_01', 2,
    '["business_license","financial_statement","tax_certificate"]',
    '["business_license","financial_statement","tax_certificate"]',
    'u_auditor_01', '财务报表数据与税务证明不一致，融资金额与营收比例不匹配，请核对后补正', 'RETURNED',
    'u_registrar_01', '2025-06-04T14:30:00+08:00', '2025-06-05T09:20:00+08:00'
),(
    'app_005', 'RZZ-2025-0605-005', '周冲突', '330101199109105678',
    '杭州远景进出口有限公司', '91330106MA28X2Z567', 6500000.00, 18,
    'HIGH', 'STATUS_CONFLICT', 'u_auditor_01', 3,
    '["business_license","financial_statement","tax_certificate","trade_contracts","customs_declaration"]',
    '["business_license","financial_statement","tax_certificate","trade_contracts","customs_declaration"]',
    'u_auditor_01', '海关报关数据与贸易合同金额存在差异，工商系统状态显示存在经营异常未结案，状态冲突待核查', 'CONFLICT',
    'u_registrar_01', '2025-06-05T16:00:00+08:00', '2025-06-06T11:50:00+08:00'
),(
    'app_006', 'RZZ-2025-0606-006', '吴待审', '320101199311126789',
    '南京恒达制造有限公司', '91320104MA1N3P6789', 4200000.00, 9,
    'MEDIUM', 'PENDING_VERIFICATION', 'u_auditor_01', 1,
    '["business_license","financial_statement","tax_certificate","inventory_report"]',
    '["business_license","financial_statement","tax_certificate","inventory_report"]',
    NULL, NULL, NULL,
    'u_registrar_01', '2025-06-06T10:30:00+08:00', '2025-06-06T10:30:00+08:00'
),(
    'app_007', 'RZZ-2025-0607-007', '郑复核', '370101198903147890',
    '济南瑞华机械有限公司', '91370100MA3M9A8790', 9800000.00, 36,
    'HIGH', 'REVIEW_PENDING', 'u_reviewer_01', 3,
    '["business_license","financial_statement","tax_certificate","collateral_document","guarantor_info","audit_report"]',
    '["business_license","financial_statement","tax_certificate","collateral_document","guarantor_info","audit_report"]',
    'u_auditor_01', '材料齐全，但风险等级高，抵押物需评估。建议复核后决定是否归档', 'REVIEW_PENDING',
    'u_registrar_01', '2025-06-02T08:00:00+08:00', '2025-06-07T15:00:00+08:00'
),(
    'app_008', 'RZZ-2025-0608-008', '冯草稿', '420101199405168901',
    '武汉长盛建筑工程有限公司', '91420100MA4K9B7901', 2600000.00, 6,
    'MEDIUM', 'DRAFT', 'u_registrar_01', 1,
    '["business_license","financial_statement"]',
    '["business_license"]',
    NULL, NULL, NULL,
    'u_registrar_01', '2025-06-08T15:40:00+08:00', '2025-06-08T15:40:00+08:00'
);

INSERT OR IGNORE INTO operation_records (
    id, application_id, operator_id, operator_role, action,
    from_status, to_status, from_risk_level, to_risk_level,
    opinion, result, version_before, version_after, created_at
) VALUES
    ('rec_001_1', 'app_001', 'u_registrar_01', 'REGISTRAR', 'CREATE',
     NULL, 'DRAFT', NULL, 'MEDIUM',
     '融资申请单首次录入，风险评估为中等', 'SUCCESS', 0, 1, '2025-06-01T10:00:00+08:00'),
    ('rec_001_2', 'app_001', 'u_registrar_01', 'REGISTRAR', 'SUBMIT',
     'DRAFT', 'PENDING_VERIFICATION', 'MEDIUM', 'MEDIUM',
     '材料齐全，提交审核主管核验', 'SUBMITTED', 1, 2, '2025-06-01T11:30:00+08:00'),
    ('rec_001_3', 'app_001', 'u_auditor_01', 'AUDITOR', 'VERIFY_PASS',
     'PENDING_VERIFICATION', 'REVIEW_PENDING', 'MEDIUM', 'MEDIUM',
     '材料齐全，核验通过，风险等级中，建议复核归档', 'PASSED', 2, 3, '2025-06-02T10:00:00+08:00'),
    ('rec_001_4', 'app_001', 'u_reviewer_01', 'REVIEWER', 'REVIEW_PASS_ARCHIVE',
     'REVIEW_PENDING', 'ARCHIVED', 'MEDIUM', 'MEDIUM',
     '复核通过，资料完整，风险可控，同意归档', 'ARCHIVED', 3, 4, '2025-06-02T16:30:00+08:00'),

    ('rec_002_1', 'app_002', 'u_registrar_01', 'REGISTRAR', 'CREATE',
     NULL, 'DRAFT', NULL, 'MEDIUM',
     '融资申请录入', 'SUCCESS', 0, 1, '2025-06-02T11:20:00+08:00'),
    ('rec_002_2', 'app_002', 'u_registrar_01', 'REGISTRAR', 'SUBMIT',
     'DRAFT', 'PENDING_VERIFICATION', 'MEDIUM', 'MEDIUM',
     '提交审核', 'SUBMITTED', 1, 2, '2025-06-02T15:00:00+08:00'),
    ('rec_002_3', 'app_002', 'u_auditor_01', 'AUDITOR', 'RISK_UPGRADE',
     'PENDING_VERIFICATION', 'PENDING_VERIFICATION', 'MEDIUM', 'HIGH',
     '核查征信发现存在关联企业违约记录，风险等级升级为高风险', 'RISK_UPGRADED', 2, 3, '2025-06-03T10:00:00+08:00'),
    ('rec_002_4', 'app_002', 'u_auditor_01', 'AUDITOR', 'VERIFY_FAIL_EVIDENCE',
     'PENDING_VERIFICATION', 'EVIDENCE_MISSING', 'HIGH', 'HIGH',
     '缺少税务证明和贷款用途证明，风险等级偏高，请补充材料', 'EVIDENCE_MISSING', 3, 3, '2025-06-03T14:10:00+08:00'),

    ('rec_003_1', 'app_003', 'u_registrar_01', 'REGISTRAR', 'CREATE',
     NULL, 'DRAFT', NULL, 'MEDIUM',
     '大额融资申请录入', 'SUCCESS', 0, 1, '2025-06-03T09:15:00+08:00'),
    ('rec_003_2', 'app_003', 'u_registrar_01', 'REGISTRAR', 'SUBMIT',
     'DRAFT', 'PENDING_VERIFICATION', 'MEDIUM', 'MEDIUM',
     '材料齐全提交审核', 'SUBMITTED', 1, 2, '2025-06-03T14:00:00+08:00'),
    ('rec_003_3', 'app_003', 'u_auditor_01', 'AUDITOR', 'RISK_UPGRADE',
     'PENDING_VERIFICATION', 'PENDING_VERIFICATION', 'MEDIUM', 'HIGH',
     '首次征信核查发现一次逾期，升级高风险', 'RISK_UPGRADED', 2, 2, '2025-06-04T09:00:00+08:00'),
    ('rec_003_4', 'app_003', 'u_auditor_01', 'AUDITOR', 'RISK_UPGRADE',
     'PENDING_VERIFICATION', 'PENDING_VERIFICATION', 'HIGH', 'CRITICAL',
     '深度核查发现3次逾期，涉及金额超千万，升级至极高风险', 'RISK_UPGRADED', 2, 2, '2025-06-04T10:30:00+08:00'),
    ('rec_003_5', 'app_003', 'u_auditor_01', 'AUDITOR', 'VERIFY_FAIL_OVERDUE',
     'PENDING_VERIFICATION', 'OVERDUE', 'CRITICAL', 'CRITICAL',
     '企业征信显示过往3次逾期记录，当前评级为高风险CRITICAL，需专项会议审议', 'OVERDUE', 2, 2, '2025-06-04T10:45:00+08:00'),

    ('rec_004_1', 'app_004', 'u_registrar_01', 'REGISTRAR', 'CREATE',
     NULL, 'DRAFT', NULL, 'LOW',
     '小额融资申请录入', 'SUCCESS', 0, 1, '2025-06-04T14:30:00+08:00'),
    ('rec_004_2', 'app_004', 'u_registrar_01', 'REGISTRAR', 'SUBMIT',
     'DRAFT', 'PENDING_VERIFICATION', 'LOW', 'LOW',
     '提交审核', 'SUBMITTED', 1, 2, '2025-06-04T17:00:00+08:00'),
    ('rec_004_3', 'app_004', 'u_auditor_01', 'AUDITOR', 'VERIFY_RETURN_CORRECTION',
     'PENDING_VERIFICATION', 'RETURNED_FOR_CORRECTION', 'LOW', 'LOW',
     '财务报表数据与税务证明不一致，融资金额与营收比例不匹配，请核对后补正', 'RETURNED', 2, 2, '2025-06-05T09:20:00+08:00'),

    ('rec_005_1', 'app_005', 'u_registrar_01', 'REGISTRAR', 'CREATE',
     NULL, 'DRAFT', NULL, 'MEDIUM',
     '进出口贸易融资录入', 'SUCCESS', 0, 1, '2025-06-05T16:00:00+08:00'),
    ('rec_005_2', 'app_005', 'u_registrar_01', 'REGISTRAR', 'SUBMIT',
     'DRAFT', 'PENDING_VERIFICATION', 'MEDIUM', 'MEDIUM',
     '提交审核', 'SUBMITTED', 1, 2, '2025-06-06T08:30:00+08:00'),
    ('rec_005_3', 'app_005', 'u_auditor_01', 'AUDITOR', 'RISK_UPGRADE',
     'PENDING_VERIFICATION', 'PENDING_VERIFICATION', 'MEDIUM', 'HIGH',
     '核查发现存在海关行政处罚记录，升级高风险', 'RISK_UPGRADED', 2, 3, '2025-06-06T10:00:00+08:00'),
    ('rec_005_4', 'app_005', 'u_auditor_01', 'AUDITOR', 'VERIFY_CONFLICT',
     'PENDING_VERIFICATION', 'STATUS_CONFLICT', 'HIGH', 'HIGH',
     '海关报关数据与贸易合同金额存在差异，工商系统状态显示存在经营异常未结案，状态冲突待核查', 'CONFLICT', 3, 3, '2025-06-06T11:50:00+08:00'),

    ('rec_006_1', 'app_006', 'u_registrar_01', 'REGISTRAR', 'CREATE',
     NULL, 'DRAFT', NULL, 'MEDIUM',
     '制造业融资申请录入', 'SUCCESS', 0, 1, '2025-06-06T10:30:00+08:00'),
    ('rec_006_2', 'app_006', 'u_registrar_01', 'REGISTRAR', 'SUBMIT',
     'DRAFT', 'PENDING_VERIFICATION', 'MEDIUM', 'MEDIUM',
     '材料齐全，提交审核', 'SUBMITTED', 1, 1, '2025-06-06T10:30:00+08:00'),

    ('rec_007_1', 'app_007', 'u_registrar_01', 'REGISTRAR', 'CREATE',
     NULL, 'DRAFT', NULL, 'MEDIUM',
     '大额长期融资申请录入', 'SUCCESS', 0, 1, '2025-06-02T08:00:00+08:00'),
    ('rec_007_2', 'app_007', 'u_registrar_01', 'REGISTRAR', 'SUBMIT',
     'DRAFT', 'PENDING_VERIFICATION', 'MEDIUM', 'MEDIUM',
     '提交审核', 'SUBMITTED', 1, 2, '2025-06-02T12:00:00+08:00'),
    ('rec_007_3', 'app_007', 'u_auditor_01', 'AUDITOR', 'RISK_UPGRADE',
     'PENDING_VERIFICATION', 'PENDING_VERIFICATION', 'MEDIUM', 'HIGH',
     '长期大额+抵押物估值波动大，升级高风险', 'RISK_UPGRADED', 2, 2, '2025-06-06T15:00:00+08:00'),
    ('rec_007_4', 'app_007', 'u_auditor_01', 'AUDITOR', 'VERIFY_PASS',
     'PENDING_VERIFICATION', 'REVIEW_PENDING', 'HIGH', 'HIGH',
     '材料齐全，但风险等级高，抵押物需评估。建议复核后决定是否归档', 'REVIEW_PENDING', 2, 3, '2025-06-07T15:00:00+08:00'),

    ('rec_008_1', 'app_008', 'u_registrar_01', 'REGISTRAR', 'CREATE',
     NULL, 'DRAFT', NULL, 'MEDIUM',
     '建筑行业融资申请草稿，待补充财务报表', 'SUCCESS', 0, 1, '2025-06-08T15:40:00+08:00');
