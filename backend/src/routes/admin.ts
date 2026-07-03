import { Router } from "express";
import db from "../db";
import { requireRole } from "../auth";

const router = Router();

// Все роуты здесь требуют роль admin
router.use(requireRole("admin"));

// GET /api/admin/users — список всех пользователей для панели управления ролями
router.get("/users", (_req, res) => {
  const rows = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  res.json(rows);
});

// PATCH /api/admin/users/:id/role — назначить роль (child | counselor | admin)
router.patch("/users/:id/role", (req, res) => {
  const role = req.body.role;
  if (!["child", "counselor", "admin"].includes(role)) {
    res.status(400).json({ error: "Некорректная роль" });
    return;
  }
  const targetId = Number(req.params.id);
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, targetId);
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId);
  res.json(row);
});

// PATCH /api/admin/users/:id/squad — назначить отряд
router.patch("/users/:id/squad", (req, res) => {
  const squad = String(req.body.squad || "").slice(0, 50);
  const targetId = Number(req.params.id);
  db.prepare("UPDATE users SET squad = ? WHERE id = ?").run(squad, targetId);
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId);
  res.json(row);
});

// GET /api/admin/stats — базовая статистика для админа
router.get("/stats", (_req, res) => {
  const users = db.prepare("SELECT COUNT(*) c FROM users").get() as any;
  const posts = db.prepare("SELECT COUNT(*) c FROM posts").get() as any;
  const stories = db.prepare("SELECT COUNT(*) c FROM stories WHERE expires_at > datetime('now')").get() as any;
  const byRole = db.prepare("SELECT role, COUNT(*) c FROM users GROUP BY role").all();
  res.json({ users: users.c, posts: posts.c, active_stories: stories.c, by_role: byRole });
});

export default router;
