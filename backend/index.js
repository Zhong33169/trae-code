const { Hono } = require("hono");
const { cors } = require("hono/cors");
const { getDb, initSchema, seedData } = require("./db");

const app = new Hono();

app.use(
  "/*",
  cors({
    origin: "http://localhost:3002",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-User-Id", "X-User-Role"],
  })
);

app.use("/*", async (c, next) => {
  const userId = c.req.header("X-User-Id");
  const userRole = c.req.header("X-User-Role");
  if (userId && userRole) {
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE id = ? AND role = ?").get(userId, userRole);
    if (!user) {
      return c.json({ error: "身份验证失败：用户不存在或角色不匹配" }, 401);
    }
    c.set("userId", userId);
    c.set("userRole", userRole);
    c.set("userName", user.name);
  }
  await next();
});

function requireAuth(c) {
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  if (!userId || !userRole) {
    return { error: true, response: c.json({ error: "未登录，请先选择角色" }, 401) };
  }
  return { userId, userRole, userName: c.get("userName") };
}

function requireRole(userRole, ...allowed) {
  if (!allowed.includes(userRole)) {
    return { error: true, response: `当前角色(${userRole})无权执行此操作，需要角色：${allowed.join("、")}` };
  }
  return { ok: true };
}

const STATUS_FLOW = {
  registrar: {
    submit: { from: ["draft", "returned"], to: "pending_review" },
    correct: { from: ["returned"], to: "draft" },
  },
  supervisor: {
    review_approve: { from: ["pending_review"], to: "pending_archive" },
    review_reject: { from: ["pending_review"], to: "rejected" },
    review_return: { from: ["pending_review"], to: "returned" },
  },
  reviewer: {
    archive: { from: ["pending_archive"], to: "archived" },
  },
};

function validateTransition(role, action, currentStatus, currentVersion, form, options = {}) {
  const roleActions = STATUS_FLOW[role];
  if (!roleActions) {
    return { valid: false, reason: `角色(${role})无任何操作权限`, code: "wrong_role" };
  }
  const transition = roleActions[action];
  if (!transition) {
    return { valid: false, reason: `角色(${role})无权执行"${action}"操作`, code: "wrong_role_action" };
  }
  if (!transition.from.includes(currentStatus)) {
    return {
      valid: false,
      reason: `当前状态为"${currentStatus}"，无法执行"${action}"，允许的状态：${transition.from.join("、")}`,
      code: "wrong_status",
    };
  }
  const evidenceRequired = options.checkEvidence === false ? false : ["submit", "review_approve", "archive"].includes(action);
  if (evidenceRequired && form) {
    const db = getDb();
    const evidences = db.prepare("SELECT evidence_type FROM form_evidence WHERE form_id = ?").all(form.id);
    const types = new Set(evidences.map((e) => e.evidence_type));
    const missing = [];
    if (!types.has("budget_adjustment")) missing.push("预算调整申请表");
    if (!types.has("department_confirm")) missing.push("部门确认函");
    if (!types.has("approval_effective")) missing.push("审批生效通知书");
    if (missing.length > 0) {
      return {
        valid: false,
        reason: `证据不足，缺少：${missing.join("、")}`,
        code: "missing_evidence",
        missingEvidence: missing,
      };
    }
  }
  return { valid: true, toStatus: transition.to };
}

function recordActionAudit(db, options) {
  const {
    formId,
    action,
    userId,
    userRole,
    comment,
    fromStatus,
    toStatus,
    version,
    expectedVersion,
    currentVersion,
    success,
    failureReason,
    failureCode,
  } = options;

  const actionId = `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  try {
    db.prepare(`
      INSERT INTO form_actions (
        id, form_id, action, actor_id, actor_role, comment,
        from_status, to_status, version, expected_version, current_version,
        success, failure_reason, failure_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actionId,
      formId,
      action,
      userId,
      userRole,
      comment || null,
      fromStatus,
      toStatus || fromStatus,
      version,
      expectedVersion,
      currentVersion,
      success ? 1 : 0,
      failureReason || null,
      failureCode || null
    );
  } catch (e) {
    if (e.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
      db.pragma("foreign_keys = OFF");
      try {
        db.prepare(`
          INSERT INTO form_actions (
            id, form_id, action, actor_id, actor_role, comment,
            from_status, to_status, version, expected_version, current_version,
            success, failure_reason, failure_code
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          actionId,
          formId,
          action,
          userId,
          userRole,
          comment || null,
          fromStatus,
          toStatus || fromStatus,
          version,
          expectedVersion,
          currentVersion,
          success ? 1 : 0,
          failureReason || null,
          failureCode || null
        );
      } finally {
        db.pragma("foreign_keys = ON");
      }
    } else {
      throw e;
    }
  }

  return actionId;
}

app.post("/api/login", async (c) => {
  const body = await c.req.json();
  const { userId, password } = body;
  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE id = ? AND password = ?").get(userId, password);
  if (!user) {
    return c.json({ error: "用户名或密码错误" }, 401);
  }
  return c.json({ id: user.id, name: user.name, role: user.role });
});

app.get("/api/users", (c) => {
  const db = getDb();
  const users = db.prepare("SELECT id, name, role FROM users").all();
  return c.json(users);
});

app.get("/api/forms", (c) => {
  const auth = requireAuth(c);
  if (auth.error) return auth.response;

  const db = getDb();
  const { status, department, type, search } = c.req.query();

  let sql = `
    SELECT f.*, u.name as creator_name,
      (SELECT COUNT(*) FROM form_supplements WHERE form_id = f.id) as supplement_count
    FROM adjustment_forms f
    LEFT JOIN users u ON f.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    sql += " AND f.status = ?";
    params.push(status);
  }
  if (department) {
    sql += " AND f.department = ?";
    params.push(department);
  }
  if (type) {
    sql += " AND f.adjustment_type = ?";
    params.push(type);
  }
  if (search) {
    sql += " AND (f.title LIKE ? OR f.id LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += " ORDER BY f.updated_at DESC";

  const forms = db.prepare(sql).all(...params);
  return c.json(forms);
});

app.get("/api/forms/:id", (c) => {
  const auth = requireAuth(c);
  if (auth.error) return auth.response;

  const db = getDb();
  const form = db.prepare("SELECT f.*, u.name as creator_name FROM adjustment_forms f LEFT JOIN users u ON f.created_by = u.id WHERE f.id = ?").get(c.req.param("id"));
  if (!form) {
    return c.json({ error: "预算调整单不存在" }, 404);
  }

  const evidences = db.prepare("SELECT e.*, u.name as uploader_name FROM form_evidence e LEFT JOIN users u ON e.uploaded_by = u.id WHERE e.form_id = ? ORDER BY e.uploaded_at").all(form.id);
  const actions = db.prepare("SELECT a.*, u.name as actor_name FROM form_actions a LEFT JOIN users u ON a.actor_id = u.id WHERE a.form_id = ? ORDER BY a.acted_at").all(form.id);
  const supplements = db.prepare("SELECT s.*, u.name as supplementer_name FROM form_supplements s LEFT JOIN users u ON s.supplemented_by = u.id WHERE s.form_id = ? ORDER BY s.supplemented_at").all(form.id);

  return c.json({ ...form, evidences, actions, supplements });
});

app.post("/api/forms", async (c) => {
  const auth = requireAuth(c);
  if (auth.error) return auth.response;

  const { userId, userRole } = auth;
  const roleCheck = requireRole(userRole, "registrar");
  if (roleCheck.error) {
    return c.json({ error: roleCheck.response }, 403);
  }

  const body = await c.req.json();
  const { title, department, adjustment_type, amount, reason } = body;

  if (!title || !department || !adjustment_type || !amount || !reason) {
    return c.json({ error: "缺少必填字段：title, department, adjustment_type, amount, reason" }, 400);
  }

  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) as c FROM adjustment_forms").get().c;
  const id = `ADJ-2026-${String(count + 1).padStart(3, "0")}`;

  db.prepare(`
    INSERT INTO adjustment_forms (id, title, department, adjustment_type, amount, reason, status, version, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'draft', 1, ?)
  `).run(id, title, department, adjustment_type, amount, reason, userId);

  return c.json({ id, message: "预算调整单创建成功" }, 201);
});

app.post("/api/forms/:id/action", async (c) => {
  const auth = requireAuth(c);
  if (auth.error) return auth.response;

  const { userId, userRole, userName } = auth;
  const formId = c.req.param("id");
  const body = await c.req.json();
  const { action, comment, expectedVersion } = body;

  const db = getDb();

  if (!action) {
    return c.json(
      {
        error: "缺少操作类型(action)",
        code: "missing_action",
        expectedVersion: expectedVersion,
        currentVersion: null,
        failureReason: "缺少操作类型(action)",
        failureCode: "missing_action",
      },
      400
    );
  }

  if (expectedVersion === undefined || expectedVersion === null || expectedVersion === "") {
    recordActionAudit(db, {
      formId,
      action,
      userId,
      userRole,
      comment,
      fromStatus: "unknown",
      toStatus: "unknown",
      version: 0,
      expectedVersion: null,
      currentVersion: null,
      success: false,
      failureReason: "缺少版本号(expectedVersion)，请刷新页面后重试",
      failureCode: "missing_version",
    });

    return c.json(
      {
        error: "缺少版本号(expectedVersion)，请刷新页面后重试",
        code: "missing_version",
        expectedVersion: null,
        currentVersion: null,
        failureReason: "缺少版本号(expectedVersion)，请刷新页面后重试",
        failureCode: "missing_version",
      },
      400
    );
  }

  const expected = Number(expectedVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    recordActionAudit(db, {
      formId,
      action,
      userId,
      userRole,
      comment,
      fromStatus: "unknown",
      toStatus: "unknown",
      version: 0,
      expectedVersion: expectedVersion,
      currentVersion: null,
      success: false,
      failureReason: `版本号格式错误：expectedVersion="${expectedVersion}" 不是有效的正整数`,
      failureCode: "invalid_version",
    });

    return c.json(
      {
        error: `版本号格式错误：expectedVersion="${expectedVersion}" 不是有效的正整数`,
        code: "invalid_version",
        expectedVersion: expectedVersion,
        currentVersion: null,
        failureReason: `版本号格式错误：expectedVersion="${expectedVersion}" 不是有效的正整数`,
        failureCode: "invalid_version",
      },
      400
    );
  }

  const form = db.prepare("SELECT * FROM adjustment_forms WHERE id = ?").get(formId);
  if (!form) {
    recordActionAudit(db, {
      formId,
      action,
      userId,
      userRole,
      comment,
      fromStatus: "unknown",
      toStatus: "unknown",
      version: 0,
      expectedVersion: expected,
      currentVersion: null,
      success: false,
      failureReason: "预算调整单不存在",
      failureCode: "not_found",
    });

    return c.json(
      {
        error: "预算调整单不存在",
        code: "not_found",
        expectedVersion: expected,
        currentVersion: null,
        failureReason: "预算调整单不存在",
        failureCode: "not_found",
      },
      404
    );
  }

  if (expected !== form.version) {
    recordActionAudit(db, {
      formId,
      action,
      userId,
      userRole,
      comment,
      fromStatus: form.status,
      toStatus: form.status,
      version: form.version,
      expectedVersion: expected,
      currentVersion: form.version,
      success: false,
      failureReason: `版本冲突：你看到的是 v${expected}，当前版本已是 v${form.version}`,
      failureCode: "version_conflict",
    });

    return c.json(
      {
        error: `版本冲突：你看到的是 v${expected}，当前版本已是 v${form.version}，请刷新后重试`,
        code: "version_conflict",
        expectedVersion: expected,
        currentVersion: form.version,
        failureReason: `版本冲突：你看到的是 v${expected}，当前版本已是 v${form.version}`,
        failureCode: "version_conflict",
      },
      409
    );
  }

  const validation = validateTransition(userRole, action, form.status, form.version, form);
  if (!validation.valid) {
    recordActionAudit(db, {
      formId,
      action,
      userId,
      userRole,
      comment,
      fromStatus: form.status,
      toStatus: form.status,
      version: form.version,
      expectedVersion: expected,
      currentVersion: form.version,
      success: false,
      failureReason: validation.reason,
      failureCode: validation.code,
    });

    const statusCode = validation.code === "missing_evidence" ? 422 : 403;
    return c.json(
      {
        error: validation.reason,
        code: validation.code,
        expectedVersion: expected,
        currentVersion: form.version,
        missingEvidence: validation.missingEvidence,
        failureReason: validation.reason,
        failureCode: validation.code,
      },
      statusCode
    );
  }

  const newStatus = validation.toStatus;
  const newVersion = form.version + 1;

  const tx = db.transaction(() => {
    db.prepare("UPDATE adjustment_forms SET status = ?, version = ?, updated_at = datetime('now') WHERE id = ?")
      .run(newStatus, newVersion, formId);

    recordActionAudit(db, {
      formId,
      action,
      userId,
      userRole,
      comment,
      fromStatus: form.status,
      toStatus: newStatus,
      version: newVersion,
      expectedVersion: expected,
      currentVersion: form.version,
      success: true,
    });
  });

  tx();

  return c.json({
    id: formId,
    action,
    fromStatus: form.status,
    toStatus: newStatus,
    version: newVersion,
    previousVersion: form.version,
    expectedVersion: expected,
    currentVersion: form.version,
    message: `操作成功：${action}，状态从"${form.status}"变更为"${newStatus}"`,
  });
});

app.post("/api/forms/:id/evidence", async (c) => {
  const auth = requireAuth(c);
  if (auth.error) return auth.response;

  const { userId, userRole } = auth;
  const roleCheck = requireRole(userRole, "registrar");
  if (roleCheck.error) {
    return c.json({ error: roleCheck.response }, 403);
  }

  const formId = c.req.param("id");
  const body = await c.req.json();
  const { evidence_type, description, file_name } = body;

  if (!evidence_type || !description) {
    return c.json({ error: "缺少证据类型或描述" }, 400);
  }

  const db = getDb();
  const form = db.prepare("SELECT * FROM adjustment_forms WHERE id = ?").get(formId);
  if (!form) {
    return c.json({ error: "预算调整单不存在" }, 404);
  }

  if (!["draft", "returned"].includes(form.status)) {
    return c.json({ error: `当前状态为"${form.status}"，只能在"草稿"或"被退回"状态下添加证据` }, 403);
  }

  const existing = db.prepare("SELECT id FROM form_evidence WHERE form_id = ? AND evidence_type = ?").get(formId, evidence_type);
  if (existing) {
    return c.json(
      {
        error: `该预算调整单已存在"${evidence_type}"类型证据，不能重复添加`,
        code: "duplicate_evidence",
        evidence_type,
      },
      409
    );
  }

  const evidenceId = `EV-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  db.prepare(`
    INSERT INTO form_evidence (id, form_id, evidence_type, description, file_name, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(evidenceId, formId, evidence_type, description, file_name || null, userId);

  db.prepare("UPDATE adjustment_forms SET updated_at = datetime('now') WHERE id = ?").run(formId);

  return c.json({ id: evidenceId, message: "证据添加成功" }, 201);
});

app.post("/api/forms/:id/supplement", async (c) => {
  const auth = requireAuth(c);
  if (auth.error) return auth.response;

  const { userId, userRole } = auth;
  const formId = c.req.param("id");
  const body = await c.req.json();
  const { supplement_type, content, reason } = body;

  if (!supplement_type || !content || !reason) {
    return c.json({ error: "缺少补录类型、内容或原因" }, 400);
  }

  const db = getDb();
  const form = db.prepare("SELECT * FROM adjustment_forms WHERE id = ?").get(formId);
  if (!form) {
    return c.json({ error: "预算调整单不存在" }, 404);
  }

  if (userRole === "registrar" && !["draft", "returned"].includes(form.status)) {
    return c.json({ error: `登记员只能在"草稿"或"被退回"状态下补录` }, 403);
  }
  if (userRole === "supervisor" && form.status !== "pending_review") {
    return c.json({ error: `审核主管只能在"待审核"状态下补录` }, 403);
  }
  if (userRole === "reviewer" && form.status !== "pending_archive") {
    return c.json({ error: `复核负责人只能在"待归档"状态下补录` }, 403);
  }

  const supplementId = `SUP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO form_supplements (id, form_id, supplement_type, content, reason, supplemented_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(supplementId, formId, supplement_type, content, reason, userId);

    db.prepare("UPDATE adjustment_forms SET updated_at = datetime('now') WHERE id = ?").run(formId);
  });
  tx();

  return c.json({
    id: supplementId,
    message: "补录成功",
    supplement_type,
    content,
    reason,
  }, 201);
});

app.post("/api/forms/batch-action", async (c) => {
  const auth = requireAuth(c);
  if (auth.error) return auth.response;

  const { userId, userRole } = auth;
  const body = await c.req.json();
  const { formIds, action, comment, expectedVersions } = body;

  const db = getDb();

  if (!Array.isArray(formIds) || formIds.length === 0 || !action) {
    return c.json(
      {
        error: "缺少表单ID列表或操作类型",
        code: "missing_params",
        expectedVersion: null,
        currentVersion: null,
        failureReason: "缺少表单ID列表或操作类型",
        failureCode: "missing_params",
        results: [],
        successCount: 0,
        failCount: formIds ? formIds.length : 0,
      },
      400
    );
  }

  if (!expectedVersions || typeof expectedVersions !== "object") {
    formIds.forEach((formId) => {
      recordActionAudit(db, {
        formId,
        action,
        userId,
        userRole,
        comment,
        fromStatus: "unknown",
        toStatus: "unknown",
        version: 0,
        expectedVersion: null,
        currentVersion: null,
        success: false,
        failureReason: "缺少版本映射(expectedVersions)，请刷新页面后重试",
        failureCode: "missing_version",
      });
    });

    return c.json(
      {
        error: "缺少版本映射(expectedVersions)，请刷新页面后重试",
        code: "missing_version",
        expectedVersion: null,
        currentVersion: null,
        failureReason: "缺少版本映射(expectedVersions)，请刷新页面后重试",
        failureCode: "missing_version",
        results: formIds.map((formId) => ({
          formId,
          success: false,
          error: "缺少版本映射(expectedVersions)，请刷新页面后重试",
          code: "missing_version",
          expectedVersion: null,
          currentVersion: null,
          failureReason: "缺少版本映射(expectedVersions)，请刷新页面后重试",
          failureCode: "missing_version",
        })),
        successCount: 0,
        failCount: formIds.length,
      },
      400
    );
  }

  const invalidVersions = [];
  const missingVersions = [];
  formIds.forEach((id) => {
    const v = expectedVersions[id];
    if (v === undefined || v === null || v === "") {
      missingVersions.push(id);
    } else {
      const num = Number(v);
      if (!Number.isInteger(num) || num < 1) {
        invalidVersions.push({ id, value: v });
      }
    }
  });

  if (missingVersions.length > 0) {
    missingVersions.forEach((formId) => {
      recordActionAudit(db, {
        formId,
        action,
        userId,
        userRole,
        comment,
        fromStatus: "unknown",
        toStatus: "unknown",
        version: 0,
        expectedVersion: null,
        currentVersion: null,
        success: false,
        failureReason: "缺少版本号(expectedVersion)，请刷新页面后重试",
        failureCode: "missing_version",
      });
    });

    const results = formIds.map((formId) => {
      if (missingVersions.includes(formId)) {
        return {
          formId,
          success: false,
          error: "缺少版本号(expectedVersion)，请刷新页面后重试",
          code: "missing_version",
          expectedVersion: null,
          currentVersion: null,
          failureReason: "缺少版本号(expectedVersion)，请刷新页面后重试",
          failureCode: "missing_version",
        };
      }
      return {
        formId,
        success: false,
        error: "批量操作因其他表单参数错误已取消",
        code: "batch_cancelled",
        expectedVersion: expectedVersions[formId],
        currentVersion: null,
        failureReason: "批量操作因其他表单参数错误已取消",
        failureCode: "batch_cancelled",
      };
    });

    return c.json(
      {
        error: `以下表单缺少版本号：${missingVersions.join("、")}，请刷新页面后重试`,
        code: "missing_version",
        expectedVersion: null,
        currentVersion: null,
        failureReason: `以下表单缺少版本号：${missingVersions.join("、")}，请刷新页面后重试`,
        failureCode: "missing_version",
        missingFormIds: missingVersions,
        results,
        successCount: 0,
        failCount: formIds.length,
      },
      400
    );
  }

  if (invalidVersions.length > 0) {
    invalidVersions.forEach(({ id: formId, value }) => {
      recordActionAudit(db, {
        formId,
        action,
        userId,
        userRole,
        comment,
        fromStatus: "unknown",
        toStatus: "unknown",
        version: 0,
        expectedVersion: value,
        currentVersion: null,
        success: false,
        failureReason: `版本号格式错误：expectedVersion="${value}" 不是有效的正整数`,
        failureCode: "invalid_version",
      });
    });

    const invalidFormIds = invalidVersions.map((iv) => iv.id);
    const results = formIds.map((formId) => {
      const invalid = invalidVersions.find((iv) => iv.id === formId);
      if (invalid) {
        return {
          formId,
          success: false,
          error: `版本号格式错误：expectedVersion="${invalid.value}" 不是有效的正整数`,
          code: "invalid_version",
          expectedVersion: invalid.value,
          currentVersion: null,
          failureReason: `版本号格式错误：expectedVersion="${invalid.value}" 不是有效的正整数`,
          failureCode: "invalid_version",
        };
      }
      return {
        formId,
        success: false,
        error: "批量操作因其他表单参数错误已取消",
        code: "batch_cancelled",
        expectedVersion: expectedVersions[formId],
        currentVersion: null,
        failureReason: "批量操作因其他表单参数错误已取消",
        failureCode: "batch_cancelled",
      };
    });

    return c.json(
      {
        error: `以下表单版本号格式错误：${invalidVersions.map((iv) => `${iv.id}="${iv.value}"`).join("、")}，不是有效的正整数`,
        code: "invalid_version",
        expectedVersion: null,
        currentVersion: null,
        failureReason: `以下表单版本号格式错误：${invalidVersions.map((iv) => `${iv.id}="${iv.value}"`).join("、")}，不是有效的正整数`,
        failureCode: "invalid_version",
        invalidVersions: invalidVersions.map((iv) => `${iv.id}="${iv.value}"`),
        results,
        successCount: 0,
        failCount: formIds.length,
      },
      400
    );
  }

  const results = [];

  for (let i = 0; i < formIds.length; i++) {
    const formId = formIds[i];
    const expected = Number(expectedVersions[formId]);

    const form = db.prepare("SELECT * FROM adjustment_forms WHERE id = ?").get(formId);

    if (!form) {
      recordActionAudit(db, {
        formId,
        action,
        userId,
        userRole,
        comment,
        fromStatus: "unknown",
        toStatus: "unknown",
        version: 0,
        expectedVersion: expected,
        currentVersion: null,
        success: false,
        failureReason: "预算调整单不存在",
        failureCode: "not_found",
      });

      results.push({
        formId,
        success: false,
        error: "预算调整单不存在",
        code: "not_found",
        expectedVersion: expected,
        currentVersion: null,
        failureReason: "预算调整单不存在",
        failureCode: "not_found",
      });
      continue;
    }

    if (expected !== form.version) {
      recordActionAudit(db, {
        formId,
        action,
        userId,
        userRole,
        comment,
        fromStatus: form.status,
        toStatus: form.status,
        version: form.version,
        expectedVersion: expected,
        currentVersion: form.version,
        success: false,
        failureReason: `版本冲突：你看到的是 v${expected}，当前版本已是 v${form.version}`,
        failureCode: "version_conflict",
      });

      results.push({
        formId,
        success: false,
        error: `版本冲突：你看到的是 v${expected}，当前版本已是 v${form.version}`,
        code: "version_conflict",
        expectedVersion: expected,
        currentVersion: form.version,
        failureReason: `版本冲突：你看到的是 v${expected}，当前版本已是 v${form.version}`,
        failureCode: "version_conflict",
      });
      continue;
    }

    const validation = validateTransition(userRole, action, form.status, form.version, form);
    if (!validation.valid) {
      recordActionAudit(db, {
        formId,
        action,
        userId,
        userRole,
        comment,
        fromStatus: form.status,
        toStatus: form.status,
        version: form.version,
        expectedVersion: expected,
        currentVersion: form.version,
        success: false,
        failureReason: validation.reason,
        failureCode: validation.code,
      });

      results.push({
        formId,
        success: false,
        error: validation.reason,
        code: validation.code,
        expectedVersion: expected,
        currentVersion: form.version,
        missingEvidence: validation.missingEvidence,
        failureReason: validation.reason,
        failureCode: validation.code,
      });
      continue;
    }

    const newStatus = validation.toStatus;
    const newVersion = form.version + 1;

    const tx = db.transaction(() => {
      db.prepare("UPDATE adjustment_forms SET status = ?, version = ?, updated_at = datetime('now') WHERE id = ?")
        .run(newStatus, newVersion, formId);

      recordActionAudit(db, {
        formId,
        action,
        userId,
        userRole,
        comment,
        fromStatus: form.status,
        toStatus: newStatus,
        version: newVersion,
        expectedVersion: expected,
        currentVersion: form.version,
        success: true,
      });
    });
    tx();

    results.push({
      formId,
      success: true,
      fromStatus: form.status,
      toStatus: newStatus,
      version: newVersion,
      previousVersion: form.version,
      expectedVersion: expected,
      currentVersion: form.version,
    });
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  return c.json({
    results,
    successCount,
    failCount,
    expectedVersion: null,
    currentVersion: null,
    message: `批量操作完成：成功${successCount}条，失败${failCount}条`,
  });
});

app.get("/api/forms/:id/validate-action", (c) => {
  const auth = requireAuth(c);
  if (auth.error) return auth.response;

  const { userRole } = auth;
  const formId = c.req.param("id");
  const action = c.req.query("action");

  const db = getDb();
  const form = db.prepare("SELECT * FROM adjustment_forms WHERE id = ?").get(formId);
  if (!form) {
    return c.json({ error: "预算调整单不存在" }, 404);
  }

  const validation = validateTransition(userRole, action, form.status, form.version, form);
  return c.json(validation);
});

app.get("/api/stats", (c) => {
  const auth = requireAuth(c);
  if (auth.error) return auth.response;

  const db = getDb();
  const stats = db.prepare(`
    SELECT status, COUNT(*) as count FROM adjustment_forms GROUP BY status
  `).all();

  const result = {};
  for (const row of stats) {
    result[row.status] = row.count;
  }

  return c.json(result);
});

app.post("/api/init", (c) => {
  initSchema();
  seedData();
  return c.json({ message: "数据库初始化完成" });
});

const port = 8002;
initSchema();
seedData();

console.log(`预算调整单后端服务启动于 http://localhost:${port}`);

module.exports = { app, port };
