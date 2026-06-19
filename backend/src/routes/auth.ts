import { Router, Request, Response } from "express";
import { getDb, hashPassword } from "../db.js";
import { createToken, removeToken, authMiddleware } from "../auth.js";
import { User, ERROR_CODES } from "../types.js";

const router = Router();

function publicUserFields(u: User) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    display_name: u.display_name,
  };
}

router.post("/login", (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "用户名和密码不能为空" },
    });
    return;
  }

  const db = getDb();
  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as User | undefined;

  if (!user || user.password_hash !== hashPassword(password)) {
    res.status(401).json({
      success: false,
      error: { code: "AUTH_FAILED", message: "用户名或密码错误" },
    });
    return;
  }

  const token = createToken(user);
  res.json({
    success: true,
    data: { token, user: publicUserFields(user) },
  });
});

router.post("/logout", authMiddleware, (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.slice(7);
    removeToken(token);
  }
  res.json({ success: true });
});

router.get("/me", authMiddleware, (req: Request, res: Response) => {
  if (!req.user) {
    res.status(ERROR_CODES.UNAUTHORIZED.status).json({
      success: false,
      error: ERROR_CODES.UNAUTHORIZED,
    });
    return;
  }
  res.json({
    success: true,
    data: publicUserFields(req.user),
  });
});

router.get("/switch-role", authMiddleware, (req: Request, res: Response) => {
  const { role } = req.query;
  if (!role || !["registrar", "reviewer", "archiver"].includes(role as string)) {
    res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "无效的角色" },
    });
    return;
  }

  const db = getDb();
  const targetUser = db
    .prepare("SELECT * FROM users WHERE role = ?")
    .get(role) as User | undefined;

  if (!targetUser) {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "该角色用户不存在" },
    });
    return;
  }

  const token = createToken(targetUser);
  res.json({
    success: true,
    data: { token, user: publicUserFields(targetUser) },
  });
});

export default router;
