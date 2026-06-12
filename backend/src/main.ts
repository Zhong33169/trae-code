import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { initDatabase, prepare, exec } from './db';
import {
  Role,
  FormStatus,
  ActionType,
  User,
  MerchantOnboardingForm,
  Attachment,
  AuditLog,
  ApiResponse,
  BatchResult,
  roleLabels,
  statusLabels,
  actionLabels,
} from './types';

const PORT = 8107;
const FRONTEND_PORT = 3107;

const server: FastifyInstance = fastify({ logger: true });

server.register(cors, {
  origin: `http://localhost:${FRONTEND_PORT}`,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Role', 'X-User-Id'],
});

let currentUser: User | null = null;
let dbInitialized = false;

async function ensureDb() {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
}

function rowToForm(row: any): MerchantOnboardingForm {
  return {
    id: row.id as string,
    batchNo: row.batch_no as string,
    merchantName: row.merchant_name as string,
    contact: row.contact as string,
    phone: row.phone as string,
    email: (row.email as string) || '',
    businessLicense: (row.business_license as string) || '',
    taxCertificate: (row.tax_certificate as string) || '',
    orgCode: (row.org_code as string) || '',
    legalPerson: (row.legal_person as string) || '',
    registeredCapital: (row.registered_capital as string) || '',
    businessScope: (row.business_scope as string) || '',
    status: row.status as FormStatus,
    currentRole: row.current_role as Role,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    submittedBy: (row.submitted_by as string) || undefined,
    submittedAt: (row.submitted_at as string) || undefined,
    reviewedBy: (row.reviewed_by as string) || undefined,
    reviewedAt: (row.reviewed_at as string) || undefined,
    archivedBy: (row.archived_by as string) || undefined,
    archivedAt: (row.archived_at as string) || undefined,
    rejectReason: (row.reject_reason as string) || undefined,
    materialsMissingNote: (row.materials_missing_note as string) || undefined,
    auditRemark: (row.audit_remark as string) || undefined,
    isOverdue: row.is_overdue === 1,
    hasException: row.has_exception === 1,
    exceptionMessage: (row.exception_message as string) || undefined,
    offlineStatus: (row.offline_status as string) || undefined,
    deadline: (row.deadline as string) || undefined,
  };
}

function rowToAttachment(row: any): Attachment {
  return {
    id: row.id as string,
    formId: row.form_id as string,
    fileName: row.file_name as string,
    fileType: row.file_type as string,
    fileSize: row.file_size as number,
    uploadedBy: row.uploaded_by as string,
    uploadedAt: row.uploaded_at as string,
    remark: (row.remark as string) || undefined,
  };
}

function rowToAuditLog(row: any): AuditLog {
  return {
    id: row.id as string,
    formId: row.form_id as string,
    operator: row.operator as string,
    operatorRole: row.operator_role as Role,
    operatorName: row.operator_name as string,
    action: row.action as ActionType,
    oldStatus: (row.old_status as FormStatus) || undefined,
    newStatus: (row.new_status as FormStatus) || undefined,
    reason: (row.reason as string) || undefined,
    remark: (row.remark as string) || undefined,
    createdAt: row.created_at as string,
  };
}

async function createAuditLog(
  formId: string,
  operator: string,
  operatorRole: Role,
  action: ActionType,
  options: { oldStatus?: FormStatus; newStatus?: FormStatus; reason?: string; remark?: string } = {}
) {
  const userRow = await prepare('SELECT name FROM users WHERE id = ?').get(operator);
  const operatorName = (userRow?.name as string) || '未知用户';

  const logId = uuidv4();
  await prepare(`
    INSERT INTO audit_logs (
      id, form_id, operator, operator_role, operator_name, action,
      old_status, new_status, reason, remark, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    logId,
    formId,
    operator,
    operatorRole,
    operatorName,
    action,
    options.oldStatus || null,
    options.newStatus || null,
    options.reason || null,
    options.remark || null,
    dayjs().format()
  );
}

async function validateBatchNo(batchNo: string, excludeId?: string): Promise<{ valid: boolean; message?: string }> {
  const existing = await prepare(
    'SELECT id, merchant_name FROM merchant_onboarding_forms WHERE batch_no = ?'
  ).all(batchNo);

  const duplicates = excludeId
    ? existing.filter((r: any) => r.id !== excludeId)
    : existing;

  if (duplicates.length > 0) {
    const names = duplicates.map((d: any) => d.merchant_name).join('、');
    return {
      valid: false,
      message: `批次号${batchNo}重复，系统中已存在该批次的入驻单：${names}`,
    };
  }
  return { valid: true };
}

function validateStatusConsistency(form: MerchantOnboardingForm): { valid: boolean; message?: string } {
  if (form.offlineStatus && form.offlineStatus !== statusLabels[form.status]) {
    return {
      valid: false,
      message: `状态不一致：线上状态为【${statusLabels[form.status]}】，离线台账状态为【${form.offlineStatus}】`,
    };
  }
  return { valid: true };
}

function checkRolePermission(userRole: Role, form: MerchantOnboardingForm, action: ActionType): boolean {
  if (action === ActionType.ADD_AUDIT_NOTE) {
    return true;
  }

  if (form.hasException && action !== ActionType.CORRECT_OFFLINE_STATUS && action !== ActionType.RESOLVE_EXCEPTION) {
    return false;
  }

  if (form.currentRole !== userRole && action !== ActionType.CREATE && action !== ActionType.RESOLVE_EXCEPTION && action !== ActionType.CORRECT_OFFLINE_STATUS) {
    return false;
  }

  const roleActions: Record<Role, ActionType[]> = {
    [Role.CLERK]: [
      ActionType.CREATE,
      ActionType.SUBMIT,
      ActionType.RESUBMIT,
      ActionType.ADD_ATTACHMENT,
      ActionType.REMOVE_ATTACHMENT,
      ActionType.ADD_AUDIT_NOTE,
      ActionType.CORRECT_OFFLINE_STATUS,
    ],
    [Role.SUPERVISOR]: [
      ActionType.START_REVIEW,
      ActionType.REQUEST_MATERIALS,
      ActionType.APPROVE_QUALIFICATION,
      ActionType.REJECT,
      ActionType.ADD_ATTACHMENT,
      ActionType.REMOVE_ATTACHMENT,
      ActionType.ADD_AUDIT_NOTE,
      ActionType.CORRECT_OFFLINE_STATUS,
      ActionType.RESOLVE_EXCEPTION,
    ],
    [Role.REVIEWER]: [
      ActionType.OPEN_STORE,
      ActionType.ARCHIVE,
      ActionType.ADD_ATTACHMENT,
      ActionType.REMOVE_ATTACHMENT,
      ActionType.ADD_AUDIT_NOTE,
      ActionType.CORRECT_OFFLINE_STATUS,
    ],
  };

  return roleActions[userRole]?.includes(action) ?? false;
}

function getStatusTransition(
  currentStatus: FormStatus,
  action: ActionType
): { valid: boolean; newStatus?: FormStatus; nextRole?: Role } {
  const transitions: Record<FormStatus, Partial<Record<ActionType, { newStatus: FormStatus; nextRole: Role }>>> = {
    [FormStatus.DRAFT]: {
      [ActionType.SUBMIT]: { newStatus: FormStatus.SUBMITTED, nextRole: Role.SUPERVISOR },
    },
    [FormStatus.SUBMITTED]: {
      [ActionType.START_REVIEW]: { newStatus: FormStatus.UNDER_REVIEW, nextRole: Role.SUPERVISOR },
    },
    [FormStatus.UNDER_REVIEW]: {
      [ActionType.REQUEST_MATERIALS]: { newStatus: FormStatus.MATERIALS_MISSING, nextRole: Role.CLERK },
      [ActionType.APPROVE_QUALIFICATION]: { newStatus: FormStatus.QUALIFIED, nextRole: Role.REVIEWER },
      [ActionType.REJECT]: { newStatus: FormStatus.REJECTED, nextRole: Role.CLERK },
    },
    [FormStatus.MATERIALS_MISSING]: {
      [ActionType.RESUBMIT]: { newStatus: FormStatus.UNDER_REVIEW, nextRole: Role.SUPERVISOR },
    },
    [FormStatus.QUALIFIED]: {
      [ActionType.OPEN_STORE]: { newStatus: FormStatus.STORE_OPENED, nextRole: Role.REVIEWER },
    },
    [FormStatus.STORE_OPENED]: {
      [ActionType.ARCHIVE]: { newStatus: FormStatus.ARCHIVED, nextRole: Role.REVIEWER },
    },
    [FormStatus.REJECTED]: {
      [ActionType.RESUBMIT]: { newStatus: FormStatus.UNDER_REVIEW, nextRole: Role.SUPERVISOR },
    },
    [FormStatus.ARCHIVED]: {},
  };

  const transition = transitions[currentStatus]?.[action];
  if (transition) {
    return { valid: true, ...transition };
  }
  return { valid: false };
}

server.get('/api/health', async (request, reply) => {
  return { success: true, data: { status: 'ok', port: PORT } };
});

server.get('/api/users', async (request, reply) => {
  await ensureDb();
  const rows = await prepare('SELECT * FROM users').all();
  const users: User[] = rows.map((row: any) => ({
    id: row.id as string,
    username: row.username as string,
    name: row.name as string,
    role: row.role as Role,
  }));
  return { success: true, data: users };
});

server.post('/api/users/switch', async (request, reply) => {
  await ensureDb();
  const { userId } = request.body as { userId: string };
  const row = await prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!row) {
    reply.code(404);
    return { success: false, error: '用户不存在' };
  }
  currentUser = {
    id: row.id as string,
    username: row.username as string,
    name: row.name as string,
    role: row.role as Role,
  };
  return {
    success: true,
    data: {
      ...currentUser,
      roleLabel: roleLabels[currentUser!.role],
    },
  };
});

server.get('/api/users/current', async (request, reply) => {
  await ensureDb();
  if (!currentUser) {
    const defaultUser = await prepare('SELECT * FROM users LIMIT 1').get();
    if (defaultUser) {
      currentUser = {
        id: defaultUser.id as string,
        username: defaultUser.username as string,
        name: defaultUser.name as string,
        role: defaultUser.role as Role,
      };
    }
  }
  if (!currentUser) {
    reply.code(401);
    return { success: false, error: '未登录' };
  }
  return {
    success: true,
    data: {
      ...currentUser,
      roleLabel: roleLabels[currentUser!.role],
    },
  };
});

server.get('/api/forms', async (request, reply) => {
  await ensureDb();
  const { status, hasException, isOverdue, currentRole, keyword, tabRoles, tabStatuses } = request.query as any;

  let sql = 'SELECT * FROM merchant_onboarding_forms WHERE 1=1';
  const params: any[] = [];

  if (currentRole) {
    sql += ' AND current_role = ?';
    params.push(currentRole);
  }

  if (tabRoles && typeof tabRoles === 'string') {
    const roles = tabRoles.split(',');
    if (roles.length > 0) {
      sql += ` AND (current_role IN (${roles.map(() => '?').join(',')}) OR has_exception = 1)`;
      params.push(...roles);
    }
  }

  if (tabStatuses && typeof tabStatuses === 'string') {
    const statuses = tabStatuses.split(',');
    if (statuses.length > 0) {
      sql += ` AND (status IN (${statuses.map(() => '?').join(',')}) OR has_exception = 1)`;
      params.push(...statuses);
    }
  } else if (status && status !== 'ALL') {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (hasException === 'true' || hasException === '1') {
    sql += ' AND has_exception = 1';
  }

  if (isOverdue === 'true' || isOverdue === '1') {
    sql += ' AND is_overdue = 1';
  }

  if (keyword) {
    sql += ' AND (merchant_name LIKE ? OR batch_no LIKE ? OR contact LIKE ? OR phone LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw, kw);
  }

  sql += ' ORDER BY has_exception DESC, is_overdue DESC, created_at DESC';

  const rows = await prepare(sql).all(...params);
  const forms = rows.map(rowToForm);
  const user = currentUser;

  return {
    success: true,
    data: {
      items: forms,
      total: forms.length,
      currentRole: user?.role,
    },
  };
});

server.get('/api/forms/:id', async (request, reply) => {
  await ensureDb();
  const { id } = request.params as { id: string };
  const row = await prepare('SELECT * FROM merchant_onboarding_forms WHERE id = ?').get(id);
  if (!row) {
    reply.code(404);
    return { success: false, error: '入驻单不存在' };
  }

  const form = rowToForm(row);

  const attachmentRows = await prepare(
    'SELECT * FROM attachments WHERE form_id = ? ORDER BY uploaded_at DESC'
  ).all(id);
  const attachments = attachmentRows.map(rowToAttachment);

  const auditRows = await prepare(
    'SELECT * FROM audit_logs WHERE form_id = ? ORDER BY created_at DESC'
  ).all(id);
  const auditLogs = auditRows.map(rowToAuditLog);

  return {
    success: true,
    data: {
      form: {
        ...form,
        statusLabel: statusLabels[form.status],
        currentRoleLabel: roleLabels[form.currentRole],
      },
      attachments,
      auditLogs: auditLogs.map((log: AuditLog) => ({
        ...log,
        actionLabel: actionLabels[log.action as ActionType],
        operatorRoleLabel: roleLabels[log.operatorRole as Role],
        oldStatusLabel: log.oldStatus ? statusLabels[log.oldStatus as FormStatus] : null,
        newStatusLabel: log.newStatus ? statusLabels[log.newStatus as FormStatus] : null,
      })),
    },
  };
});

server.post('/api/forms', async (request, reply) => {
  await ensureDb();
  const user = currentUser;
  if (!user || user.role !== Role.CLERK) {
    reply.code(403);
    return { success: false, error: '只有商家入驻登记员可以创建入驻单' };
  }

  const body = request.body as Partial<MerchantOnboardingForm>;

  const batchCheck = await validateBatchNo(body.batchNo!);
  const formData: Partial<MerchantOnboardingForm> = {
    ...body,
    hasException: !batchCheck.valid,
    exceptionMessage: batchCheck.message,
    status: FormStatus.DRAFT,
    currentRole: Role.CLERK,
    isOverdue: false,
  };

  const statusCheck = validateStatusConsistency(formData as MerchantOnboardingForm);
  if (!statusCheck.valid) {
    formData.hasException = true;
    formData.exceptionMessage = formData.exceptionMessage
      ? `${formData.exceptionMessage}；${statusCheck.message}`
      : statusCheck.message;
  }

  const formId = uuidv4();
  const now = dayjs().format();

  await prepare(`
    INSERT INTO merchant_onboarding_forms (
      id, batch_no, merchant_name, contact, phone, email, business_license,
      tax_certificate, org_code, legal_person, registered_capital, business_scope,
      status, current_role, created_by, created_at, is_overdue, has_exception,
      exception_message, offline_status, deadline
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    formId,
    formData.batchNo,
    formData.merchantName,
    formData.contact,
    formData.phone,
    formData.email || null,
    formData.businessLicense || null,
    formData.taxCertificate || null,
    formData.orgCode || null,
    formData.legalPerson || null,
    formData.registeredCapital || null,
    formData.businessScope || null,
    formData.status,
    formData.currentRole,
    user.id,
    now,
    formData.isOverdue ? 1 : 0,
    formData.hasException ? 1 : 0,
    formData.exceptionMessage || null,
    formData.offlineStatus || null,
    formData.deadline || dayjs().add(10, 'day').format()
  );

  await createAuditLog(formId, user.id, user.role, ActionType.CREATE, {
    remark: '创建商家入驻单',
  });

  if (formData.hasException) {
    await createAuditLog(formId, user.id, user.role, ActionType.DETECT_EXCEPTION, {
      reason: formData.exceptionMessage,
      remark: '创建时检测到数据异常，已标记为异常单，禁止流转',
    });
  }

  return { success: true, data: { id: formId, hasException: formData.hasException, exceptionMessage: formData.exceptionMessage } };
});

interface ActionRequest {
  action: ActionType;
  reason?: string;
  remark?: string;
  formData?: Partial<MerchantOnboardingForm>;
}

server.post('/api/forms/:id/action', async (request, reply) => {
  await ensureDb();
  const user = currentUser;
  if (!user) {
    reply.code(401);
    return { success: false, error: '未登录' };
  }

  const { id } = request.params as { id: string };
  const { action, reason, remark, formData } = request.body as ActionRequest;

  const row = await prepare('SELECT * FROM merchant_onboarding_forms WHERE id = ?').get(id);
  if (!row) {
    reply.code(404);
    return { success: false, error: '入驻单不存在' };
  }

  const form = rowToForm(row);

  if (form.hasException && action !== ActionType.ADD_AUDIT_NOTE && action !== ActionType.CORRECT_OFFLINE_STATUS && action !== ActionType.RESOLVE_EXCEPTION) {
    await createAuditLog(id, user.id, user.role, ActionType.ADD_AUDIT_NOTE, {
      reason: `尝试操作【${actionLabels[action]}】被拦截`,
      remark: `单据存在异常：${form.exceptionMessage}，禁止流转操作`,
    });
    reply.code(400);
    return {
      success: false,
      error: `入驻单存在异常，无法处理：${form.exceptionMessage}`,
      exceptionMessage: form.exceptionMessage,
    };
  }

  if (action === ActionType.RESOLVE_EXCEPTION && !reason) {
    reply.code(400);
    return {
      success: false,
      error: '解除异常标记必须填写解除原因',
    };
  }

  if (!checkRolePermission(user.role, form, action)) {
    reply.code(403);
    return {
      success: false,
      error: `当前角色【${roleLabels[user.role]}】无权执行此操作【${actionLabels[action]}】，当前单据应由【${roleLabels[form.currentRole]}】处理`,
    };
  }

  const transition = getStatusTransition(form.status, action);

  const actionsWithoutTransition = [
    ActionType.ADD_ATTACHMENT,
    ActionType.REMOVE_ATTACHMENT,
    ActionType.ADD_AUDIT_NOTE,
    ActionType.CORRECT_OFFLINE_STATUS,
    ActionType.RESOLVE_EXCEPTION,
  ];

  if (!transition.valid && !actionsWithoutTransition.includes(action)) {
    reply.code(400);
    return {
      success: false,
      error: `状态【${statusLabels[form.status]}】不允许执行操作【${actionLabels[action]}】`,
    };
  }

  const now = dayjs().format();
  const updates: string[] = [];
  const params: any[] = [];

  if (formData) {
    if (formData.merchantName) {
      updates.push('merchant_name = ?');
      params.push(formData.merchantName);
    }
    if (formData.contact) {
      updates.push('contact = ?');
      params.push(formData.contact);
    }
    if (formData.phone) {
      updates.push('phone = ?');
      params.push(formData.phone);
    }
    if (formData.email !== undefined) {
      updates.push('email = ?');
      params.push(formData.email);
    }
    if (formData.businessLicense !== undefined) {
      updates.push('business_license = ?');
      params.push(formData.businessLicense);
    }
    if (formData.taxCertificate !== undefined) {
      updates.push('tax_certificate = ?');
      params.push(formData.taxCertificate);
    }
    if (formData.orgCode !== undefined) {
      updates.push('org_code = ?');
      params.push(formData.orgCode);
    }
    if (formData.legalPerson !== undefined) {
      updates.push('legal_person = ?');
      params.push(formData.legalPerson);
    }
    if (formData.registeredCapital !== undefined) {
      updates.push('registered_capital = ?');
      params.push(formData.registeredCapital);
    }
    if (formData.businessScope !== undefined) {
      updates.push('business_scope = ?');
      params.push(formData.businessScope);
    }
    if (formData.offlineStatus !== undefined) {
      updates.push('offline_status = ?');
      params.push(formData.offlineStatus);
    }
  }

  if (transition.valid) {
    updates.push('status = ?');
    params.push(transition.newStatus);
    updates.push('current_role = ?');
    params.push(transition.nextRole);

    if (action === ActionType.SUBMIT || action === ActionType.RESUBMIT) {
      updates.push('submitted_by = ?');
      params.push(user.id);
      updates.push('submitted_at = ?');
      params.push(now);
      updates.push('reject_reason = ?');
      params.push(null);
      updates.push('materials_missing_note = ?');
      params.push(null);
    }

    if (action === ActionType.START_REVIEW) {
      updates.push('reviewed_by = ?');
      params.push(user.id);
      updates.push('reviewed_at = ?');
      params.push(now);
    }

    if (action === ActionType.REQUEST_MATERIALS) {
      updates.push('materials_missing_note = ?');
      params.push(reason || '需要补充材料');
      updates.push('reviewed_by = ?');
      params.push(user.id);
      updates.push('reviewed_at = ?');
      params.push(now);
    }

    if (action === ActionType.REJECT) {
      updates.push('reject_reason = ?');
      params.push(reason || '审核不通过');
      updates.push('reviewed_by = ?');
      params.push(user.id);
      updates.push('reviewed_at = ?');
      params.push(now);
    }

    if (action === ActionType.ARCHIVE) {
      updates.push('archived_by = ?');
      params.push(user.id);
      updates.push('archived_at = ?');
      params.push(now);
    }
  }

  if (action === ActionType.ADD_AUDIT_NOTE && remark) {
    const currentRemark = form.auditRemark || '';
    const newRemark = currentRemark + `\n[${dayjs().format('YYYY-MM-DD HH:mm')}] ${user.name}: ${remark}`;
    updates.push('audit_remark = ?');
    params.push(newRemark);
  }

  if (action === ActionType.CORRECT_OFFLINE_STATUS && formData?.offlineStatus !== undefined) {
    updates.push('offline_status = ?');
    params.push(formData.offlineStatus);

    const batchCheck = await validateBatchNo(form.batchNo, form.id);
    const tempForm = { ...form, offlineStatus: formData.offlineStatus };
    const statusCheck = validateStatusConsistency(tempForm as MerchantOnboardingForm);

    const newErrors: string[] = [];
    if (!batchCheck.valid) newErrors.push(batchCheck.message!);
    if (!statusCheck.valid) newErrors.push(statusCheck.message!);

    if (newErrors.length > 0) {
      updates.push('has_exception = ?');
      params.push(1);
      updates.push('exception_message = ?');
      params.push(newErrors.join('；'));
    } else {
      updates.push('has_exception = ?');
      params.push(0);
      updates.push('exception_message = ?');
      params.push(null);
    }
  }

  if (action === ActionType.RESOLVE_EXCEPTION) {
    updates.push('has_exception = ?');
    params.push(0);
    updates.push('exception_message = ?');
    params.push(null);
  }

  if (updates.length > 0) {
    params.push(id);
    const sql = `UPDATE merchant_onboarding_forms SET ${updates.join(', ')} WHERE id = ?`;
    await prepare(sql).run(...params);
  }

  await createAuditLog(id, user.id, user.role, action, {
    oldStatus: form.status,
    newStatus: transition.newStatus,
    reason,
    remark,
  });

  const updatedRow = await prepare('SELECT * FROM merchant_onboarding_forms WHERE id = ?').get(id);
  const updatedForm = rowToForm(updatedRow);

  return {
    success: true,
    data: {
      form: updatedForm,
      message: `${actionLabels[action]}成功`,
      oldStatus: statusLabels[form.status],
      newStatus: transition.newStatus ? statusLabels[transition.newStatus] : statusLabels[form.status],
      nextRole: transition.nextRole ? roleLabels[transition.nextRole] : null,
    },
  };
});

server.post('/api/forms/:id/attachments', async (request, reply) => {
  await ensureDb();
  const user = currentUser;
  if (!user) {
    reply.code(401);
    return { success: false, error: '未登录' };
  }

  const { id } = request.params as { id: string };
  const { fileName, fileType, fileSize, remark } = request.body as any;

  const row = await prepare('SELECT * FROM merchant_onboarding_forms WHERE id = ?').get(id);
  if (!row) {
    reply.code(404);
    return { success: false, error: '入驻单不存在' };
  }

  const attachmentId = uuidv4();
  const now = dayjs().format();

  await prepare(`
    INSERT INTO attachments (id, form_id, file_name, file_type, file_size, uploaded_by, uploaded_at, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(attachmentId, id, fileName, fileType, fileSize, user.id, now, remark || null);

  await createAuditLog(id, user.id, user.role, ActionType.ADD_ATTACHMENT, {
    remark: `上传附件：${fileName}${remark ? `（${remark}）` : ''}`,
  });

  return { success: true, data: { id: attachmentId, fileName } };
});

server.delete('/api/forms/:id/attachments/:attachmentId', async (request, reply) => {
  await ensureDb();
  const user = currentUser;
  if (!user) {
    reply.code(401);
    return { success: false, error: '未登录' };
  }

  const { id, attachmentId } = request.params as any;

  const attachmentRow = await prepare(
    'SELECT * FROM attachments WHERE id = ? AND form_id = ?'
  ).get(attachmentId, id);
  if (!attachmentRow) {
    reply.code(404);
    return { success: false, error: '附件不存在' };
  }

  await prepare('DELETE FROM attachments WHERE id = ?').run(attachmentId);

  await createAuditLog(id, user.id, user.role, ActionType.REMOVE_ATTACHMENT, {
    remark: `删除附件：${attachmentRow.file_name}`,
  });

  return { success: true, data: { id: attachmentId } };
});

server.get('/api/audit-logs', async (request, reply) => {
  await ensureDb();
  const { formId, operator, action, startDate, endDate } = request.query as any;

  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: any[] = [];

  if (formId) {
    sql += ' AND form_id = ?';
    params.push(formId);
  }
  if (operator) {
    sql += ' AND operator = ?';
    params.push(operator);
  }
  if (action) {
    sql += ' AND action = ?';
    params.push(action);
  }
  if (startDate) {
    sql += ' AND created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND created_at <= ?';
    params.push(endDate + ' 23:59:59');
  }

  sql += ' ORDER BY created_at DESC';

  const rows = await prepare(sql).all(...params);
  const logs = rows.map(rowToAuditLog).map((log: AuditLog) => ({
    ...log,
    actionLabel: actionLabels[log.action as ActionType],
    operatorRoleLabel: roleLabels[log.operatorRole as Role],
    oldStatusLabel: log.oldStatus ? statusLabels[log.oldStatus as FormStatus] : null,
    newStatusLabel: log.newStatus ? statusLabels[log.newStatus as FormStatus] : null,
  }));

  return { success: true, data: logs };
});

server.post('/api/batch/process', async (request, reply) => {
  await ensureDb();
  const user = currentUser;
  if (!user) {
    reply.code(401);
    return { success: false, error: '未登录' };
  }

  const { batchNo, forms, action, reason } = request.body as {
    batchNo: string;
    forms: Array<{ id: string; merchantName: string }>;
    action: ActionType;
    reason?: string;
  };

  const result: BatchResult = {
    success: true,
    batchNo,
    total: forms.length,
    processed: 0,
    failed: 0,
    results: [],
  };

  for (const formItem of forms) {
    try {
      const row = await prepare('SELECT * FROM merchant_onboarding_forms WHERE id = ?').get(formItem.id);
      if (!row) {
        result.failed++;
        result.results.push({
          merchantName: formItem.merchantName,
          success: false,
          message: '入驻单不存在',
        });
        continue;
      }

      const form = rowToForm(row);

      if (form.hasException) {
        result.failed++;
        result.results.push({
          merchantName: form.merchantName,
          success: false,
          message: `存在异常：${form.exceptionMessage}`,
        });
        await createAuditLog(formItem.id, user.id, user.role, ActionType.BATCH_FAILED, {
          reason: form.exceptionMessage,
          remark: `批量${actionLabels[action]}失败：单据存在异常，禁止流转`,
        });
        continue;
      }

      if (!checkRolePermission(user.role, form, action)) {
        result.failed++;
        result.results.push({
          merchantName: form.merchantName,
          success: false,
          message: `权限不足：当前角色【${roleLabels[user.role]}】无权处理应由【${roleLabels[form.currentRole]}】处理的单据`,
        });
        await createAuditLog(formItem.id, user.id, user.role, ActionType.BATCH_FAILED, {
          reason: `角色权限不匹配，当前角色${roleLabels[user.role]}，单据处理角色${roleLabels[form.currentRole]}`,
          remark: `批量${actionLabels[action]}失败：权限不足`,
        });
        continue;
      }

      const transition = getStatusTransition(form.status, action);
      if (!transition.valid) {
        result.failed++;
        result.results.push({
          merchantName: form.merchantName,
          success: false,
          message: `状态不允许：当前状态【${statusLabels[form.status]}】无法执行【${actionLabels[action]}】`,
        });
        await createAuditLog(formItem.id, user.id, user.role, ActionType.BATCH_FAILED, {
          reason: `当前状态${statusLabels[form.status]}不允许执行${actionLabels[action]}`,
          remark: `批量${actionLabels[action]}失败：状态流转不允许`,
        });
        continue;
      }

      const now = dayjs().format();
      const updates: string[] = [];
      const params: any[] = [];

      updates.push('status = ?');
      params.push(transition.newStatus);
      updates.push('current_role = ?');
      params.push(transition.nextRole);

      if (action === ActionType.SUBMIT || action === ActionType.RESUBMIT) {
        updates.push('submitted_by = ?');
        params.push(user.id);
        updates.push('submitted_at = ?');
        params.push(now);
      }

      if (action === ActionType.REQUEST_MATERIALS) {
        updates.push('materials_missing_note = ?');
        params.push(reason || '需要补充材料');
      }

      if (action === ActionType.REJECT) {
        updates.push('reject_reason = ?');
        params.push(reason || '审核不通过');
      }

      if (action === ActionType.ARCHIVE) {
        updates.push('archived_by = ?');
        params.push(user.id);
        updates.push('archived_at = ?');
        params.push(now);
      }

      params.push(formItem.id);
      const sql = `UPDATE merchant_onboarding_forms SET ${updates.join(', ')} WHERE id = ?`;
      await prepare(sql).run(...params);

      await createAuditLog(formItem.id, user.id, user.role, action, {
        oldStatus: form.status,
        newStatus: transition.newStatus,
        reason,
        remark: `批量${actionLabels[action]}`,
      });

      result.processed++;
      result.results.push({
        merchantName: form.merchantName,
        success: true,
        message: `${actionLabels[action]}成功：${statusLabels[form.status]} → ${statusLabels[transition.newStatus!]}`,
      });
    } catch (err: any) {
      result.failed++;
      result.results.push({
        merchantName: formItem.merchantName,
        success: false,
        message: `处理失败：${err.message}`,
      });
      try {
        await createAuditLog(formItem.id, user.id, user.role, ActionType.BATCH_FAILED, {
          reason: err.message,
          remark: `批量${actionLabels[action]}失败：系统异常`,
        });
      } catch (e) {
        console.error('Failed to create batch failed audit log:', e);
      }
    }
  }

  result.success = result.failed === 0;

  return { success: true, data: result };
});

server.get('/api/meta', async (request, reply) => {
  return {
    success: true,
    data: {
      roles: Object.values(Role).map((r) => ({ value: r, label: roleLabels[r] })),
      statuses: Object.values(FormStatus).map((s) => ({ value: s, label: statusLabels[s] })),
      actions: Object.values(ActionType).map((a) => ({ value: a, label: actionLabels[a] })),
    },
  };
});

server.get('/api/forms/:id/validate', async (request, reply) => {
  await ensureDb();
  const { id } = request.params as { id: string };
  const row = await prepare('SELECT * FROM merchant_onboarding_forms WHERE id = ?').get(id);
  if (!row) {
    reply.code(404);
    return { success: false, error: '入驻单不存在' };
  }

  const form = rowToForm(row);
  const errors: string[] = [];

  const batchCheck = await validateBatchNo(form.batchNo, form.id);
  if (!batchCheck.valid) {
    errors.push(batchCheck.message!);
  }

  const statusCheck = validateStatusConsistency(form);
  if (!statusCheck.valid) {
    errors.push(statusCheck.message!);
  }

  if (!form.businessLicense) {
    errors.push('缺少营业执照号');
  }

  if (form.status !== FormStatus.DRAFT && !form.taxCertificate) {
    errors.push('缺少税务登记证');
  }

  if (form.status !== FormStatus.DRAFT && !form.orgCode) {
    errors.push('缺少组织机构代码');
  }

  return {
    success: true,
    data: {
      valid: errors.length === 0,
      errors,
      hasException: errors.some((e) => e.includes('重复') || e.includes('不一致')),
    },
  };
});

async function start() {
  await ensureDb();

  server.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      server.log.error(err);
      process.exit(1);
    }
    console.log(`🚀 Backend server running at ${address}`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Frontend allowed: http://localhost:${FRONTEND_PORT}`);
    console.log('');
    console.log('API Endpoints:');
    console.log('   GET  /api/health - Health check');
    console.log('   GET  /api/users - List all users');
    console.log('   POST /api/users/switch - Switch current user');
    console.log('   GET  /api/users/current - Get current user');
    console.log('   GET  /api/forms - List forms (queue)');
    console.log('   GET  /api/forms/:id - Get form detail');
    console.log('   POST /api/forms - Create form');
    console.log('   POST /api/forms/:id/action - Process form action');
    console.log('   GET  /api/forms/:id/validate - Validate form');
    console.log('   GET  /api/audit-logs - Query audit logs');
    console.log('   POST /api/batch/process - Batch process forms');
    console.log('   GET  /api/meta - Get metadata');
  });
}

start();
