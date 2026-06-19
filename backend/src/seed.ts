import { getDb, generateId } from "./db.js";

export function seedData(): void {
  const db = getDb();
  const countRow = db.prepare("SELECT COUNT(*) as cnt FROM orders").get() as { cnt: number };
  if (countRow.cnt > 0) return;

  const now = new Date().toISOString();
  const registrarId = "u1";
  const reviewerId = "u2";
  const archiverId = "u3";

  const orders = [
    { order_no: "CPXJ-001", dish_name: "秘制红烧肉", dish_category: "热菜", price: 58, description: "精选五花肉，秘制酱料慢炖3小时", status: "draft", version: 1, handler: registrarId },
    { order_no: "CPXJ-002", dish_name: "清蒸鲈鱼", dish_category: "海鲜", price: 88, description: "新鲜鲈鱼清蒸，保留原味", status: "submitted", version: 1, handler: reviewerId },
    { order_no: "CPXJ-003", dish_name: "宫保鸡丁", dish_category: "热菜", price: 42, description: "经典川菜，花生米与鸡丁完美结合", status: "submitted", version: 1, handler: reviewerId },
    { order_no: "CPXJ-004", dish_name: "蒜蓉西兰花", dish_category: "素菜", price: 28, description: "健康素菜，蒜香浓郁", status: "reviewed", version: 1, handler: archiverId },
    { order_no: "CPXJ-005", dish_name: "麻婆豆腐", dish_category: "热菜", price: 32, description: "正宗川味，麻辣鲜香", status: "returned_to_registrar", version: 2, handler: registrarId },
    { order_no: "CPXJ-006", dish_name: "糖醋里脊", dish_category: "热菜", price: 46, description: "外酥里嫩，酸甜可口", status: "returned_to_reviewer", version: 3, handler: reviewerId },
    { order_no: "CPXJ-007", dish_name: "水煮牛肉", dish_category: "热菜", price: 68, description: "鲜嫩牛肉配以麻辣汤底", status: "archived", version: 4, handler: archiverId },
  ];

  const insertOrder = db.prepare(
    `INSERT INTO orders (id, order_no, dish_name, dish_category, price, description, status, version, created_by, current_handler, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const insertLog = db.prepare(
    `INSERT INTO order_action_logs (id, order_id, action, operator, operator_role, comment, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const insertEvidence = db.prepare(
    `INSERT INTO evidence (id, order_id, type, file_name, description, uploaded_by, uploaded_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const orderIds: string[] = [];

  for (const order of orders) {
    const id = generateId();
    orderIds.push(id);
    insertOrder.run(
      id, order.order_no, order.dish_name, order.dish_category,
      order.price, order.description, order.status, order.version,
      registrarId, order.handler, now, now
    );

    insertLog.run(generateId(), id, "create", registrarId, "registrar", "创建菜品上新单", now);

    if (order.status !== "draft") {
      insertLog.run(generateId(), id, "submit", registrarId, "registrar", "提交单据", now);
    }

    if (["reviewed", "returned_to_reviewer", "archived"].includes(order.status)) {
      insertLog.run(generateId(), id, "review", reviewerId, "reviewer", "审核通过", now);
    }

    if (order.status === "returned_to_registrar") {
      insertLog.run(generateId(), id, "submit", registrarId, "registrar", "提交单据", now);
      insertLog.run(generateId(), id, "review_return", reviewerId, "reviewer", "退回补正：证据不清晰", now);
    }

    if (order.status === "returned_to_reviewer") {
      insertLog.run(generateId(), id, "review", reviewerId, "reviewer", "审核通过", now);
      insertLog.run(generateId(), id, "archive_return", archiverId, "archiver", "退回审核：需补充核验记录", now);
    }

    if (order.status === "archived") {
      insertLog.run(generateId(), id, "review", reviewerId, "reviewer", "审核通过", now);
      insertLog.run(generateId(), id, "archive", archiverId, "archiver", "复核归档", now);
    }
  }

  insertEvidence.run(generateId(), orderIds[0], "registration", "红烧肉配方.pdf", "秘制红烧肉配方及制作流程", registrarId, now);
  insertEvidence.run(generateId(), orderIds[1], "registration", "鲈鱼采购合同.pdf", "供应商采购合同", registrarId, now);
  insertEvidence.run(generateId(), orderIds[3], "registration", "西兰花检验报告.pdf", "食材检验合格报告", registrarId, now);
  insertEvidence.run(generateId(), orderIds[3], "verification", "核验记录_西兰花.docx", "审核主管核验记录", reviewerId, now);
  insertEvidence.run(generateId(), orderIds[6], "registration", "牛肉采购合同.pdf", "牛肉供应商采购合同", registrarId, now);
  insertEvidence.run(generateId(), orderIds[6], "verification", "核验记录_牛肉.docx", "审核主管核验记录", reviewerId, now);
  insertEvidence.run(generateId(), orderIds[6], "archive", "归档确认_水煮牛肉.pdf", "总部复核归档确认文件", archiverId, now);

  console.log("演示数据已初始化：7条样例单据 + 对应证据和操作日志");
}
