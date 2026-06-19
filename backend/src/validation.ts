import { Request, Response, NextFunction } from "express";
import { getDb } from "./db.js";
import {
  Order,
  OrderStatus,
  ActionName,
  ACTION_ROLE_MAP,
  ACTION_STATUS_MAP,
  ERROR_CODES,
  Evidence,
} from "./types.js";

export interface ValidationError {
  code: string;
  message: string;
}

export function validateAction(
  action: ActionName,
  order: Order | null,
  userRole: string,
  userId: string,
  requestBody?: Record<string, unknown>
): ValidationError | null {
  if (!order && action !== "create") {
    return ERROR_CODES.NOT_FOUND;
  }

  const requiredRole = ACTION_ROLE_MAP[action];
  if (userRole !== requiredRole) {
    return {
      ...ERROR_CODES.WRONG_ROLE,
      message: `当前角色[${userRole}]无权执行[${action}]操作，需要[${requiredRole}]角色`,
    };
  }

  if (action !== "create" && order) {
    const allowedStatuses = ACTION_STATUS_MAP[action];
    if (!allowedStatuses.includes(order.status)) {
      return {
        ...ERROR_CODES.WRONG_STATUS,
        message: `单据状态[${order.status}]不允许执行[${action}]操作，需要状态: ${allowedStatuses.join("/")}`,
      };
    }

    if (requestBody?.version !== undefined && Number(requestBody.version) !== order.version) {
      return {
        ...ERROR_CODES.VERSION_CONFLICT,
        message: `版本号冲突：提交版本[${requestBody.version}]，当前版本[${order.version}]，数据已被他人修改`,
      };
    }

    if (
      action === "review" ||
      action === "archive" ||
      action === "submit" ||
      action === "amend"
    ) {
      const evidenceError = validateEvidenceRequirement(action, order.id);
      if (evidenceError) return evidenceError;
    }
  }

  return null;
}

function validateEvidenceRequirement(
  action: ActionName,
  orderId: string
): ValidationError | null {
  const db = getDb();
  const evidences = db
    .prepare("SELECT type FROM evidence WHERE order_id = ?")
    .all(orderId) as { type: string }[];

  const hasType = (t: string) => evidences.some((e) => e.type === t);

  if ((action === "submit" || action === "amend") && !hasType("registration")) {
    return {
      ...ERROR_CODES.MISSING_EVIDENCE,
      message: "缺少登记证据(registration)，提交前必须上传至少一条登记证据",
    };
  }

  if (action === "review" && !hasType("verification")) {
    return {
      ...ERROR_CODES.MISSING_EVIDENCE,
      message: "缺少核验证据(verification)，审核前必须上传至少一条核验证据",
    };
  }

  if (action === "archive" && !hasType("archive")) {
    return {
      ...ERROR_CODES.MISSING_EVIDENCE,
      message: "缺少归档证据(archive)，归档前必须上传至少一条归档证据",
    };
  }

  return null;
}

export function validateDuplicateSubmission(
  orderId: string,
  action: string,
  userId: string
): ValidationError | null {
  const db = getDb();
  const recent = db
    .prepare(
      "SELECT id FROM order_action_logs WHERE order_id = ? AND action = ? AND operator = ? AND created_at > datetime('now', '-5 seconds')"
    )
    .get(orderId, action, userId);

  if (recent) {
    return {
      ...ERROR_CODES.DUPLICATE_SUBMISSION,
      message: `5秒内重复提交[${action}]操作被拦截`,
    };
  }

  return null;
}

export function validateNotAlreadyProcessed(
  order: Order,
  action: ActionName
): ValidationError | null {
  if (action === "submit" && order.status === "submitted") {
    return {
      ...ERROR_CODES.ALREADY_PROCESSED,
      message: "单据已提交，不可重复提交",
    };
  }

  if (action === "review" && order.status === "reviewed") {
    return {
      ...ERROR_CODES.ALREADY_PROCESSED,
      message: "单据已审核通过，不可重复审核",
    };
  }

  if (action === "archive" && order.status === "archived") {
    return {
      ...ERROR_CODES.ALREADY_PROCESSED,
      message: "单据已归档，不可重复归档",
    };
  }

  return null;
}
