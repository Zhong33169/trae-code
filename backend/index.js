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

function validateTransition(role, action, currentStatus, currentVersion, form) {
  const roleActions = STATUS_FLOW[role];
  if (!roleActions) {
    return { valid: false, reason: `角色(${role})无任何操作权限` };
  }
  const transition = roleActions[action];
  if (!transition) {
    return { valid: false, reason: `角色(${role})无权执行"${action}"操作` };
  }
  if (!transition.from.includes(currentStatus)) {
    return { valid: false, reason: `当前状态为"${currentStatus}"，无法执行"${action}"，允许的状态：${transition.from.join("、")}` };
  }
  if (action === "submit" && form) {
    const db = getDb();
    const evidences = db.prepare("SELECT evidence_type FROM form_evidence WHERE form_id = ?").all(form.id);
    const types = new Set(evidences.map((e) => e.evidence_type));
    const missing = [];
    if (!types.has("budget_adjustment")) missing.push("预算调整申请表");
    if (!types.has("department_confirm")) missing.push("部门确认函");
    if (!types.has("approval_effective")) missing.push("审批生效通知书");
    if (missing.length > 0) {
      return { valid: false, reason: `证据不足，缺少：${missing.join("、")}` };
    }
  }
  return { valid: true, toStatus: transition.to };
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
  const { action, comment } = body;

  if (!action) {
    return c.json({ error: "缺少操作类型(action)" }, 400);
  }

  const db = getDb();
  const form = db.prepare("SELECT * FROM adjustment_forms WHERE id = ?").get(formId);
  if (!form) {
    return c.json({ error: "预算调整单不存在" }, 404);
  }

  const validation = validateTransition(userRole, action, form.status, form.version, form);
  if (!validation.valid) {
    return c.json({ error: validation.reason }, 403);
  }

  const newStatus = validation.toStatus;
  const newVersion = action === "correct" ? form.version + 1 : form.version;

  const actionId = `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  const tx = db.transaction(() => {
    db.prepare("UPDATE adjustment_forms SET status = ?, version = ?, updated_at = datetime('now') WHERE id = ?")
      .run(newStatus, newVersion, formId);

    db.prepare(`
      INSERT INTO form_actions (id, form_id, action, actor_id, actor_role, comment, from_status, to_status, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(actionId, formId, action, userId, userRole, comment || null, form.status, newStatus, newVersion);
  });

  tx();

  return c.json({
    id: formId,
    action,
    fromStatus: form.status,
    toStatus: newStatus,
    version: newVersion,
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
    return c.json({ error: `该预算调整单已存在"${evidence_type}"类型证据，不能重复添加` }, 409);
  }

  const evidenceId = `EV-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  db.prepare(`
    INSERT INTO form_evidence (id, form_id, evidence_type, description, file_name, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(evidenceId, formId, evidence_type, description, file_name || null, userId);

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
  db.prepare(`
    INSERT INTO form_supplements (id, form_id, supplement_type, content, reason, supplemented_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(supplementId, formId, supplement_type, content, reason, userId);

  return c.json({ id: supplementId, message: "补录成功" }, 201);
});

app.post("/api/forms/batch-action", async (c) => {
  const auth = requireAuth(c);
  if (auth.error) return auth.response;

  const { userId, userRole } = auth;
  const body = await c.req.json();
  const { formIds, action, comment } = body;

  if (!Array.isArray(formIds) || formIds.length === 0 || !action) {
    return c.json({ error: "缺少表单ID列表或操作类型" }, 400);
  }

  const db = getDb();
  const results = [];

  for (const formId of formIds) {
    const form = db.prepare("SELECT * FROM adjustment_forms WHERE id = ?").get(formId);
    if (!form) {
      results.push({ formId, success: false, error: "预算调整单不存在" });
      continue;
    }

    const validation = validateTransition(userRole, action, form.status, form.version, form);
    if (!validation.valid) {
      results.push({ formId, success: false, error: validation.reason });
      continue;
    }

    const newStatus = validation.toStatus;
    const newVersion = action === "correct" ? form.version + 1 : form.version;
    const actionId = `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    const tx = db.transaction(() => {
      db.prepare("UPDATE adjustment_forms SET status = ?, version = ?, updated_at = datetime('now') WHERE id = ?")
        .run(newStatus, newVersion, formId);
      db.prepare(`
        INSERT INTO form_actions (id, form_id, action, actor_id, actor_role, comment, from_status, to_status, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(actionId, formId, action, userId, userRole, comment || null, form.status, newStatus, newVersion);
    });
    tx();

    results.push({ formId, success: true, fromStatus: form.status, toStatus: newStatus });
  }

  return c.json({ results });
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
