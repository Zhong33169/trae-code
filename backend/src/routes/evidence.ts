import { Router, Request, Response } from "express";
import { getDb, generateId } from "../db.js";
import { authMiddleware } from "../auth.js";
import { Evidence, Order, ERROR_CODES, ACTION_ROLE_MAP, ActionName } from "../types.js";

const router = Router();

router.use(authMiddleware);

router.get("/:orderId/evidence", (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare("SELECT id FROM orders WHERE id = ?").get(req.params.orderId);

  if (!order) {
    res.status(404).json({ success: false, error: ERROR_CODES.NOT_FOUND });
    return;
  }

  const evidence = db
    .prepare("SELECT e.*, u.display_name as uploader_name FROM evidence e LEFT JOIN users u ON e.uploaded_by = u.id WHERE e.order_id = ? ORDER BY e.uploaded_at ASC")
    .all(req.params.orderId);

  res.json({ success: true, data: evidence });
});

router.post("/:orderId/evidence", (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.orderId) as Order | undefined;

  if (!order) {
    res.status(404).json({ success: false, error: ERROR_CODES.NOT_FOUND });
    return;
  }

  const { type, file_name, description } = req.body;
  if (!type || !file_name) {
    res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "证据类型和文件名不能为空" },
    });
    return;
  }

  const roleForEvidence: Record<string, string> = {
    registration: "registrar",
    verification: "reviewer",
    archive: "archiver",
  };

  const requiredRole = roleForEvidence[type];
  if (req.user!.role !== requiredRole) {
    res.status(403).json({
      success: false,
      error: {
        ...ERROR_CODES.WRONG_ROLE,
        message: `当前角色[${req.user!.role}]无权上传[${type}]类型证据，需要[${requiredRole}]角色`,
      },
    });
    return;
  }

  const id = generateId();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO evidence (id, order_id, type, file_name, description, uploaded_by, uploaded_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.params.orderId, type, file_name, description || "", req.user!.id, now);

  db.prepare(
    `INSERT INTO order_action_logs (id, order_id, action, operator, operator_role, comment, created_at) 
     VALUES (?, ?, 'upload_evidence', ?, ?, ?, ?)`
  ).run(
    generateId(),
    req.params.orderId,
    req.user!.id,
    req.user!.role,
    `上传${type}类型证据: ${file_name}`,
    now
  );

  const evidence = db.prepare("SELECT * FROM evidence WHERE id = ?").get(id);
  res.status(201).json({ success: true, data: evidence });
});

export default router;
