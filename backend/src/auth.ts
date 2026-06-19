import { Request, Response, NextFunction } from "express";
import { getDb } from "./db.js";
import { User, ERROR_CODES } from "./types.js";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const TOKEN_STORE = new Map<string, User>();

export function createToken(user: User): string {
  const token = `tk_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  TOKEN_STORE.set(token, user);
  return token;
}

export function getUserByToken(token: string): User | undefined {
  return TOKEN_STORE.get(token);
}

export function removeToken(token: string): void {
  TOKEN_STORE.delete(token);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(ERROR_CODES.UNAUTHORIZED.status).json({
      success: false,
      error: ERROR_CODES.UNAUTHORIZED,
    });
    return;
  }

  const token = authHeader.slice(7);
  const user = TOKEN_STORE.get(token);

  if (!user) {
    res.status(ERROR_CODES.UNAUTHORIZED.status).json({
      success: false,
      error: ERROR_CODES.UNAUTHORIZED,
    });
    return;
  }

  req.user = user;
  next();
}

export function roleMiddleware(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(ERROR_CODES.UNAUTHORIZED.status).json({
        success: false,
        error: ERROR_CODES.UNAUTHORIZED,
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(ERROR_CODES.WRONG_ROLE.status).json({
        success: false,
        error: {
          ...ERROR_CODES.WRONG_ROLE,
          message: `当前角色[${req.user.role}]无权执行此操作，需要角色: ${allowedRoles.join("/")}`,
        },
      });
      return;
    }

    next();
  };
}

export function refreshUserFromDb(user: User): User | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as User | undefined;
  return row;
}
