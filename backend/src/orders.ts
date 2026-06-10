import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { prepare } from './db.js';
import { authMiddleware } from './auth.js';
import { JwtPayload, Order, EvidenceItem, AuditLog } from './types.js';

function formatOrder(row: any): Order {
  return {
    id: row.id,
    order_no: row.order_no,
    guest_name: row.guest_name,
    guest_phone: row.guest_phone,
    room_number: row.room_number,
    supplement_reason: row.supplement_reason,
    status: row.status,
    version: row.version,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function loadEvidenceItems(orderId: string): EvidenceItem[] {
  return prepare('SELECT * FROM evidence_items WHERE order_id = ?').all(orderId);
}

function loadAuditLogs(orderId: string): AuditLog[] {
  return prepare('SELECT * FROM audit_logs WHERE order_id = ? ORDER BY created_at').all(orderId);
}

function loadOrderWithRelations(orderId: string): Order | null {
  const row = prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!row) return null;
  const order = formatOrder(row);
  order.evidenceItems = loadEvidenceItems(orderId);
  order.auditLogs = loadAuditLogs(orderId);
  return order;
}

function generateOrderNo(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `ORD-${dateStr}-${seq}`;
}

export async function registerOrderRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/orders', {
    preHandler: [authMiddleware],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { status } = request.query as { status?: string };
      let sql = 'SELECT * FROM orders WHERE 1=1';
      const params: any[] = [];
      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }
      sql += ' ORDER BY created_at DESC';

      const rows = prepare(sql).all(...params);
      const orders = rows.map((row: any) => {
        const order = formatOrder(row);
        order.evidenceItems = loadEvidenceItems(row.id);
        order.auditLogs = loadAuditLogs(row.id);
        return order;
      });

      reply.send(orders);
    },
  });

  app.get('/api/orders/:id', {
    preHandler: [authMiddleware],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const order = loadOrderWithRelations(id);
      if (!order) {
        reply.code(404).send({ error: '订单不存在' });
        return;
      }
      reply.send(order);
    },
  });

  app.post('/api/orders', {
    preHandler: [authMiddleware],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      if (user.role !== 'receptionist') {
        reply.code(403).send({ error: '权限不足', reason: '仅前厅接待可以创建订单' });
        return;
      }

      const { guestName, guestPhone, roomNumber, supplementReason } = request.body as {
        guestName: string;
        guestPhone?: string;
        roomNumber?: string;
        supplementReason?: string;
      };

      if (!guestName) {
        reply.code(400).send({ error: '住客姓名不能为空' });
        return;
      }

      const id = randomUUID();
      const orderNo = generateOrderNo();

      prepare(`
        INSERT INTO orders (id, order_no, guest_name, guest_phone, room_number, supplement_reason, status, version, created_by)
        VALUES (?, ?, ?, ?, ?, ?, 'pending_supplement', 1, ?)
      `).run(id, orderNo, guestName, guestPhone || null, roomNumber || null, supplementReason || null, user.id);

      const order = loadOrderWithRelations(id);
      reply.code(201).send(order);
    },
  });

  app.put('/api/orders/:id/supplement', {
    preHandler: [authMiddleware],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const body = request.body as {
        version: number;
        guestName: string;
        guestPhone?: string;
        roomNumber?: string;
        supplementReason?: string;
        evidenceItems: { type: string; description: string }[];
      };

      const orderRow = prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
      if (!orderRow) {
        reply.code(404).send({ error: '订单不存在' });
        return;
      }

      if (user.role !== 'receptionist') {
        reply.code(403).send({ error: '权限不足', reason: '仅前厅接待可以补录登记' });
        return;
      }
      if (orderRow.status !== 'pending_supplement') {
        reply.code(403).send({ error: '状态错误', reason: '订单状态不是待补录，无法补录' });
        return;
      }
      if (!body.evidenceItems || body.evidenceItems.length === 0) {
        reply.code(403).send({ error: '证据不足', reason: '补录登记必须至少提供1项登记证据' });
        return;
      }
      if (body.version !== orderRow.version) {
        reply.code(403).send({ error: '版本冲突', reason: '订单已被他人修改，请刷新后重试（版本冲突）' });
        return;
      }

      const existingSupplement = prepare(
        "SELECT id FROM audit_logs WHERE order_id = ? AND action = 'supplement'"
      ).get(id);
      if (existingSupplement) {
        reply.code(403).send({ error: '重复补录', reason: '该订单已有补录记录，不可重复补录' });
        return;
      }

      const newVersion = orderRow.version + 1;
      prepare(`
        UPDATE orders SET
          guest_name = ?, guest_phone = ?, room_number = ?, supplement_reason = ?,
          status = 'pending_verification', version = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(body.guestName, body.guestPhone || null, body.roomNumber || null, body.supplementReason || null, newVersion, id);

      for (const item of body.evidenceItems) {
        prepare(`
          INSERT INTO evidence_items (id, order_id, stage, type, description)
          VALUES (?, ?, 'registration', ?, ?)
        `).run(randomUUID(), id, item.type, item.description);
      }

      prepare(`
        INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail)
        VALUES (?, ?, 'supplement', ?, ?, ?)
      `).run(randomUUID(), id, user.id, user.role, '补录登记完成');

      const order = loadOrderWithRelations(id);
      reply.send(order);
    },
  });

  app.put('/api/orders/:id/verify', {
    preHandler: [authMiddleware],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const body = request.body as {
        version: number;
        verified: boolean;
        evidenceItems?: { type: string; description: string }[];
        remark?: string;
      };

      const orderRow = prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
      if (!orderRow) {
        reply.code(404).send({ error: '订单不存在' });
        return;
      }

      if (user.role !== 'room_supervisor') {
        reply.code(403).send({ error: '权限不足', reason: '仅客房主管可以进行过程核验' });
        return;
      }
      if (orderRow.status !== 'pending_verification') {
        reply.code(403).send({ error: '状态错误', reason: '订单状态不是待核验，无法核验' });
        return;
      }
      if (body.verified && (!body.evidenceItems || body.evidenceItems.length === 0)) {
        reply.code(403).send({ error: '证据不足', reason: '核验通过必须至少提供1项核验证据' });
        return;
      }
      if (body.version !== orderRow.version) {
        reply.code(403).send({ error: '版本冲突', reason: '订单已被他人修改，请刷新后重试（版本冲突）' });
        return;
      }

      const newVersion = orderRow.version + 1;
      const newStatus = body.verified ? 'pending_review' : 'pending_supplement';

      prepare(`
        UPDATE orders SET status = ?, version = ?, updated_at = datetime('now') WHERE id = ?
      `).run(newStatus, newVersion, id);

      if (body.verified && body.evidenceItems) {
        for (const item of body.evidenceItems) {
          prepare(`
            INSERT INTO evidence_items (id, order_id, stage, type, description)
            VALUES (?, ?, 'verification', ?, ?)
          `).run(randomUUID(), id, item.type, item.description);
        }
      }

      const action = body.verified ? 'verify' : 'verify_reject';
      const detail = body.verified
        ? `核验通过${body.remark ? '：' + body.remark : ''}`
        : `核验退回${body.remark ? '：' + body.remark : ''}`;

      prepare(`
        INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), id, action, user.id, user.role, detail);

      const order = loadOrderWithRelations(id);
      reply.send(order);
    },
  });

  app.put('/api/orders/:id/review', {
    preHandler: [authMiddleware],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const body = request.body as {
        version: number;
        approved: boolean;
        evidenceItems?: { type: string; description: string }[];
        remark?: string;
      };

      const orderRow = prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
      if (!orderRow) {
        reply.code(404).send({ error: '订单不存在' });
        return;
      }

      if (user.role !== 'duty_manager') {
        reply.code(403).send({ error: '权限不足', reason: '仅值班经理可以进行复核归档' });
        return;
      }
      if (orderRow.status !== 'pending_review') {
        if (orderRow.status === 'archived') {
          reply.code(403).send({ error: '已归档', reason: '已归档订单不可修改' });
          return;
        }
        reply.code(403).send({ error: '状态错误', reason: '订单状态不是待复核，无法归档' });
        return;
      }
      if (body.approved && (!body.evidenceItems || body.evidenceItems.length === 0)) {
        reply.code(403).send({ error: '证据不足', reason: '归档确认必须至少提供1项归档证据' });
        return;
      }
      if (body.version !== orderRow.version) {
        reply.code(403).send({ error: '版本冲突', reason: '订单已被他人修改，请刷新后重试（版本冲突）' });
        return;
      }

      const newVersion = orderRow.version + 1;
      const newStatus = body.approved ? 'archived' : 'pending_verification';

      prepare(`
        UPDATE orders SET status = ?, version = ?, updated_at = datetime('now') WHERE id = ?
      `).run(newStatus, newVersion, id);

      if (body.approved && body.evidenceItems) {
        for (const item of body.evidenceItems) {
          prepare(`
            INSERT INTO evidence_items (id, order_id, stage, type, description)
            VALUES (?, ?, 'archive', ?, ?)
          `).run(randomUUID(), id, item.type, item.description);
        }
      }

      const action = body.approved ? 'review' : 'review_reject';
      const detail = body.approved
        ? `复核归档完成${body.remark ? '：' + body.remark : ''}`
        : `复核退回${body.remark ? '：' + body.remark : ''}`;

      prepare(`
        INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), id, action, user.id, user.role, detail);

      const order = loadOrderWithRelations(id);
      reply.send(order);
    },
  });

  app.post('/api/orders/batch-action', {
    preHandler: [authMiddleware],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const body = request.body as {
        orderIds: string[];
        action: 'supplement' | 'verify' | 'review';
        version: number;
        evidenceItems?: { type: string; description: string }[];
        verified?: boolean;
        approved?: boolean;
        remark?: string;
      };

      const successes: string[] = [];
      const failures: { id: string; reason: string }[] = [];

      for (const orderId of body.orderIds) {
        const orderRow = prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
        if (!orderRow) {
          failures.push({ id: orderId, reason: '订单不存在' });
          continue;
        }

        try {
          if (body.action === 'supplement') {
            if (user.role !== 'receptionist') {
              failures.push({ id: orderId, reason: '仅前厅接待可以补录登记' });
              continue;
            }
            if (orderRow.status !== 'pending_supplement') {
              failures.push({ id: orderId, reason: '订单状态不是待补录，无法补录' });
              continue;
            }
            if (!body.evidenceItems || body.evidenceItems.length === 0) {
              failures.push({ id: orderId, reason: '补录登记必须至少提供1项登记证据' });
              continue;
            }
            if (body.version !== orderRow.version) {
              failures.push({ id: orderId, reason: '订单已被他人修改，请刷新后重试（版本冲突）' });
              continue;
            }
            const existingSupplement = prepare(
              "SELECT id FROM audit_logs WHERE order_id = ? AND action = 'supplement'"
            ).get(orderId);
            if (existingSupplement) {
              failures.push({ id: orderId, reason: '该订单已有补录记录，不可重复补录' });
              continue;
            }

            const newVersion = orderRow.version + 1;
            prepare(`
              UPDATE orders SET status = 'pending_verification', version = ?, updated_at = datetime('now') WHERE id = ?
            `).run(newVersion, orderId);

            for (const item of body.evidenceItems) {
              prepare(`
                INSERT INTO evidence_items (id, order_id, stage, type, description)
                VALUES (?, ?, 'registration', ?, ?)
              `).run(randomUUID(), orderId, item.type, item.description);
            }
            prepare(`
              INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail)
              VALUES (?, ?, 'supplement', ?, ?, ?)
            `).run(randomUUID(), orderId, user.id, user.role, '批量补录登记完成');

            successes.push(orderId);

          } else if (body.action === 'verify') {
            if (user.role !== 'room_supervisor') {
              failures.push({ id: orderId, reason: '仅客房主管可以进行过程核验' });
              continue;
            }
            if (orderRow.status !== 'pending_verification') {
              failures.push({ id: orderId, reason: '订单状态不是待核验，无法核验' });
              continue;
            }
            if (body.verified && (!body.evidenceItems || body.evidenceItems.length === 0)) {
              failures.push({ id: orderId, reason: '核验通过必须至少提供1项核验证据' });
              continue;
            }
            if (body.version !== orderRow.version) {
              failures.push({ id: orderId, reason: '订单已被他人修改，请刷新后重试（版本冲突）' });
              continue;
            }

            const newVersion = orderRow.version + 1;
            const newStatus = body.verified ? 'pending_review' : 'pending_supplement';
            prepare(`
              UPDATE orders SET status = ?, version = ?, updated_at = datetime('now') WHERE id = ?
            `).run(newStatus, newVersion, orderId);

            if (body.verified && body.evidenceItems) {
              for (const item of body.evidenceItems) {
                prepare(`
                  INSERT INTO evidence_items (id, order_id, stage, type, description)
                  VALUES (?, ?, 'verification', ?, ?)
                `).run(randomUUID(), orderId, item.type, item.description);
              }
            }

            const action = body.verified ? 'verify' : 'verify_reject';
            const detail = body.verified
              ? `批量核验通过${body.remark ? '：' + body.remark : ''}`
              : `批量核验退回${body.remark ? '：' + body.remark : ''}`;
            prepare(`
              INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(randomUUID(), orderId, action, user.id, user.role, detail);

            successes.push(orderId);

          } else if (body.action === 'review') {
            if (user.role !== 'duty_manager') {
              failures.push({ id: orderId, reason: '仅值班经理可以进行复核归档' });
              continue;
            }
            if (orderRow.status === 'archived') {
              failures.push({ id: orderId, reason: '已归档订单不可修改' });
              continue;
            }
            if (orderRow.status !== 'pending_review') {
              failures.push({ id: orderId, reason: '订单状态不是待复核，无法归档' });
              continue;
            }
            if (body.approved && (!body.evidenceItems || body.evidenceItems.length === 0)) {
              failures.push({ id: orderId, reason: '归档确认必须至少提供1项归档证据' });
              continue;
            }
            if (body.version !== orderRow.version) {
              failures.push({ id: orderId, reason: '订单已被他人修改，请刷新后重试（版本冲突）' });
              continue;
            }

            const newVersion = orderRow.version + 1;
            const newStatus = body.approved ? 'archived' : 'pending_verification';
            prepare(`
              UPDATE orders SET status = ?, version = ?, updated_at = datetime('now') WHERE id = ?
            `).run(newStatus, newVersion, orderId);

            if (body.approved && body.evidenceItems) {
              for (const item of body.evidenceItems) {
                prepare(`
                  INSERT INTO evidence_items (id, order_id, stage, type, description)
                  VALUES (?, ?, 'archive', ?, ?)
                `).run(randomUUID(), orderId, item.type, item.description);
              }
            }

            const action = body.approved ? 'review' : 'review_reject';
            const detail = body.approved
              ? `批量复核归档完成${body.remark ? '：' + body.remark : ''}`
              : `批量复核退回${body.remark ? '：' + body.remark : ''}`;
            prepare(`
              INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(randomUUID(), orderId, action, user.id, user.role, detail);

            successes.push(orderId);
          }
        } catch (err: any) {
          failures.push({ id: orderId, reason: err.message || '操作失败' });
        }
      }

      reply.send({ successes, failures });
    },
  });
}
