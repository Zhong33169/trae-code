import { Router, Request, Response } from "express";
import { getDb, generateId } from "../db.js";
import { authMiddleware } from "../auth.js";
import {
  Order,
  OrderActionLog,
  OrderStatus,
  ActionName,
  ERROR_CODES,
  ROLE_LABEL,
  STATUS_LABEL,
} from "../types.js";
import {
  validateAction,
  validateDuplicateSubmission,
  validateNotAlreadyProcessed,
} from "../validation.js";

const router = Router();

router.use(authMiddleware);

router.get("/", (req: Request, res: Response) => {
  const db = getDb();
  const { status, role, keyword, handler } = req.query;

  let sql = "SELECT * FROM orders WHERE 1=1";
  const params: unknown[] = [];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (handler) {
    sql += " AND current_handler = ?";
    params.push(handler);
  }
  if (keyword) {
    sql += " AND (order_no LIKE ? OR dish_name LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  if (role === "registrar") {
    sql += " AND (created_by = ? OR status IN ('returned_to_registrar', 'draft'))";
    params.push(req.user!.id);
  } else if (role === "reviewer") {
    sql += " AND status IN ('submitted', 'returned_to_reviewer')";
  } else if (role === "archiver") {
    sql += " AND status = 'reviewed'";
  }

  sql += " ORDER BY updated_at DESC";

  const orders = db.prepare(sql).all(...params) as Order[];
  res.json({ success: true, data: orders });
});

router.get("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as Order | undefined;

  if (!order) {
    res.status(404).json({ success: false, error: ERROR_CODES.NOT_FOUND });
    return;
  }

  const evidence = db.prepare("SELECT * FROM evidence WHERE order_id = ?").all(order.id);
  const logs = db
    .prepare(
      `SELECT l.*, u.display_name as operator_name 
       FROM order_action_logs l 
       LEFT JOIN users u ON l.operator = u.id 
       WHERE l.order_id = ? 
       ORDER BY l.created_at ASC`
    )
    .all(order.id);

  res.json({
    success: true,
    data: { ...order, evidence, action_logs: logs },
  });
});

router.post("/", (req: Request, res: Response) => {
  const validationError = validateAction("create", null, req.user!.role, req.user!.id, req.body);
  if (validationError) {
    res.status(validationError.status || 400).json({ success: false, error: validationError });
    return;
  }

  const { dish_name, dish_category, price, description } = req.body;
  if (!dish_name || !dish_category || price === undefined) {
    res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "菜品名称、分类和价格不能为空" },
    });
    return;
  }

  const db = getDb();
  const id = generateId();

  const countRow = db.prepare("SELECT COUNT(*) as cnt FROM orders").get() as { cnt: number };
  const orderNo = `CPXJ-${String(countRow.cnt + 1).padStart(3, "0")}`;

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO orders (id, order_no, dish_name, dish_category, price, description, status, version, created_by, current_handler, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?)`
  ).run(id, orderNo, dish_name, dish_category, price, description || "", req.user!.id, req.user!.id, now, now);

  db.prepare(
    `INSERT INTO order_action_logs (id, order_id, action, operator, operator_role, comment, created_at) 
     VALUES (?, ?, 'create', ?, ?, '创建菜品上新单', ?)`
  ).run(generateId(), id, req.user!.id, req.user!.role, now);

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Order;
  res.status(201).json({ success: true, data: order });
});

router.put("/:id/submit", (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as Order | undefined;

  const validationError = validateAction("submit", order || null, req.user!.role, req.user!.id, req.body);
  if (validationError) {
    res.status(validationError.status || 400).json({ success: false, error: validationError });
    return;
  }

  const dupError = validateDuplicateSubmission(order!.id, "submit", req.user!.id);
  if (dupError) {
    res.status(dupError.status || 409).json({ success: false, error: dupError });
    return;
  }

  const processedError = validateNotAlreadyProcessed(order!, "submit");
  if (processedError) {
    res.status(processedError.status || 409).json({ success: false, error: processedError });
    return;
  }

  const reviewer = db.prepare("SELECT id FROM users WHERE role = 'reviewer' LIMIT 1").get() as { id: string };
  const now = new Date().toISOString();

  db.prepare(
    "UPDATE orders SET status = 'submitted', version = version + 1, current_handler = ?, updated_at = ? WHERE id = ?"
  ).run(reviewer.id, now, order!.id);

  db.prepare(
    `INSERT INTO order_action_logs (id, order_id, action, operator, operator_role, comment, created_at) 
     VALUES (?, ?, 'submit', ?, ?, ?, ?)`
  ).run(generateId(), order!.id, req.user!.id, req.user!.role, req.body.comment || "提交单据", now);

  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as Order;
  res.json({ success: true, data: updated });
});

router.put("/:id/review", (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as Order | undefined;

  const validationError = validateAction("review", order || null, req.user!.role, req.user!.id, req.body);
  if (validationError) {
    res.status(validationError.status || 400).json({ success: false, error: validationError });
    return;
  }

  const dupError = validateDuplicateSubmission(order!.id, "review", req.user!.id);
  if (dupError) {
    res.status(dupError.status || 409).json({ success: false, error: dupError });
    return;
  }

  const processedError = validateNotAlreadyProcessed(order!, "review");
  if (processedError) {
    res.status(processedError.status || 409).json({ success: false, error: processedError });
    return;
  }

  const archiver = db.prepare("SELECT id FROM users WHERE role = 'archiver' LIMIT 1").get() as { id: string };
  const now = new Date().toISOString();

  db.prepare(
    "UPDATE orders SET status = 'reviewed', version = version + 1, current_handler = ?, updated_at = ? WHERE id = ?"
  ).run(archiver.id, now, order!.id);

  db.prepare(
    `INSERT INTO order_action_logs (id, order_id, action, operator, operator_role, comment, created_at) 
     VALUES (?, ?, 'review', ?, ?, ?, ?)`
  ).run(generateId(), order!.id, req.user!.id, req.user!.role, req.body.comment || "审核通过", now);

  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as Order;
  res.json({ success: true, data: updated });
});

router.put("/:id/review-return", (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as Order | undefined;

  const validationError = validateAction(
    "review_return",
    order || null,
    req.user!.role,
    req.user!.id,
    req.body
  );
  if (validationError) {
    res.status(validationError.status || 400).json({ success: false, error: validationError });
    return;
  }

  const registrar = db.prepare("SELECT id FROM users WHERE role = 'registrar' LIMIT 1").get() as { id: string };
  const now = new Date().toISOString();

  db.prepare(
    "UPDATE orders SET status = 'returned_to_registrar', version = version + 1, current_handler = ?, updated_at = ? WHERE id = ?"
  ).run(registrar.id, now, order!.id);

  db.prepare(
    `INSERT INTO order_action_logs (id, order_id, action, operator, operator_role, comment, created_at) 
     VALUES (?, ?, 'review_return', ?, ?, ?, ?)`
  ).run(generateId(), order!.id, req.user!.id, req.user!.role, req.body.comment || "退回补正", now);

  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as Order;
  res.json({ success: true, data: updated });
});

router.put("/:id/archive", (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as Order | undefined;

  const validationError = validateAction("archive", order || null, req.user!.role, req.user!.id, req.body);
  if (validationError) {
    res.status(validationError.status || 400).json({ success: false, error: validationError });
    return;
  }

  const dupError = validateDuplicateSubmission(order!.id, "archive", req.user!.id);
  if (dupError) {
    res.status(dupError.status || 409).json({ success: false, error: dupError });
    return;
  }

  const processedError = validateNotAlreadyProcessed(order!, "archive");
  if (processedError) {
    res.status(processedError.status || 409).json({ success: false, error: processedError });
    return;
  }

  const now = new Date().toISOString();

  db.prepare(
    "UPDATE orders SET status = 'archived', version = version + 1, current_handler = ?, updated_at = ? WHERE id = ?"
  ).run(req.user!.id, now, order!.id);

  db.prepare(
    `INSERT INTO order_action_logs (id, order_id, action, operator, operator_role, comment, created_at) 
     VALUES (?, ?, 'archive', ?, ?, ?, ?)`
  ).run(generateId(), order!.id, req.user!.id, req.user!.role, req.body.comment || "复核归档", now);

  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as Order;
  res.json({ success: true, data: updated });
});

router.put("/:id/archive-return", (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as Order | undefined;

  const validationError = validateAction(
    "archive_return",
    order || null,
    req.user!.role,
    req.user!.id,
    req.body
  );
  if (validationError) {
    res.status(validationError.status || 400).json({ success: false, error: validationError });
    return;
  }

  const reviewer = db.prepare("SELECT id FROM users WHERE role = 'reviewer' LIMIT 1").get() as { id: string };
  const now = new Date().toISOString();

  db.prepare(
    "UPDATE orders SET status = 'returned_to_reviewer', version = version + 1, current_handler = ?, updated_at = ? WHERE id = ?"
  ).run(reviewer.id, now, order!.id);

  db.prepare(
    `INSERT INTO order_action_logs (id, order_id, action, operator, operator_role, comment, created_at) 
     VALUES (?, ?, 'archive_return', ?, ?, ?, ?)`
  ).run(generateId(), order!.id, req.user!.id, req.user!.role, req.body.comment || "退回审核", now);

  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as Order;
  res.json({ success: true, data: updated });
});

router.put("/:id/amend", (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as Order | undefined;

  const validationError = validateAction("amend", order || null, req.user!.role, req.user!.id, req.body);
  if (validationError) {
    res.status(validationError.status || 400).json({ success: false, error: validationError });
    return;
  }

  const dupError = validateDuplicateSubmission(order!.id, "amend", req.user!.id);
  if (dupError) {
    res.status(dupError.status || 409).json({ success: false, error: dupError });
    return;
  }

  const { dish_name, dish_category, price, description } = req.body;
  const reviewer = db.prepare("SELECT id FROM users WHERE role = 'reviewer' LIMIT 1").get() as { id: string };
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE orders SET 
      dish_name = COALESCE(?, dish_name),
      dish_category = COALESCE(?, dish_category),
      price = COALESCE(?, price),
      description = COALESCE(?, description),
      status = 'submitted',
      version = version + 1,
      current_handler = ?,
      updated_at = ?
    WHERE id = ?`
  ).run(dish_name || null, dish_category || null, price ?? null, description || null, reviewer.id, now, order!.id);

  db.prepare(
    `INSERT INTO order_action_logs (id, order_id, action, operator, operator_role, comment, created_at) 
     VALUES (?, ?, 'amend', ?, ?, ?, ?)`
  ).run(generateId(), order!.id, req.user!.id, req.user!.role, req.body.comment || "补正后重新提交", now);

  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as Order;
  res.json({ success: true, data: updated });
});

router.post("/batch", (req: Request, res: Response) => {
  const { action, orderIds, comment } = req.body;
  if (!action || !orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "缺少操作类型或单据ID列表" },
    });
    return;
  }

  const db = getDb();
  const results: { id: string; success: boolean; error?: { code: string; message: string } }[] = [];

  for (const orderId of orderIds) {
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as Order | undefined;
    const validationError = validateAction(
      action as ActionName,
      order || null,
      req.user!.role,
      req.user!.id,
      { ...req.body, version: order?.version }
    );

    if (validationError) {
      results.push({ id: orderId, success: false, error: validationError });
      continue;
    }

    const dupError = validateDuplicateSubmission(orderId, action, req.user!.id);
    if (dupError) {
      results.push({ id: orderId, success: false, error: dupError });
      continue;
    }

    let newStatus: OrderStatus;
    let nextHandler: string;
    let logComment = comment || "";

    switch (action) {
      case "review": {
        const archiver = db.prepare("SELECT id FROM users WHERE role = 'archiver' LIMIT 1").get() as { id: string };
        newStatus = "reviewed";
        nextHandler = archiver.id;
        logComment = logComment || "批量审核通过";
        break;
      }
      case "review_return": {
        const registrar = db.prepare("SELECT id FROM users WHERE role = 'registrar' LIMIT 1").get() as { id: string };
        newStatus = "returned_to_registrar";
        nextHandler = registrar.id;
        logComment = logComment || "批量退回补正";
        break;
      }
      case "archive": {
        newStatus = "archived";
        nextHandler = req.user!.id;
        logComment = logComment || "批量归档";
        break;
      }
      case "archive_return": {
        const reviewer = db.prepare("SELECT id FROM users WHERE role = 'reviewer' LIMIT 1").get() as { id: string };
        newStatus = "returned_to_reviewer";
        nextHandler = reviewer.id;
        logComment = logComment || "批量退回审核";
        break;
      }
      default:
        results.push({
          id: orderId,
          success: false,
          error: { code: "BAD_REQUEST", message: `不支持批量操作[${action}]` },
        });
        continue;
    }

    const now = new Date().toISOString();
    db.prepare(
      "UPDATE orders SET status = ?, version = version + 1, current_handler = ?, updated_at = ? WHERE id = ?"
    ).run(newStatus, nextHandler, now, orderId);

    db.prepare(
      `INSERT INTO order_action_logs (id, order_id, action, operator, operator_role, comment, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(generateId(), orderId, action, req.user!.id, req.user!.role, logComment, now);

    results.push({ id: orderId, success: true });
  }

  res.json({ success: true, data: results });
});

export default router;
