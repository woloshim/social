import { Router } from "express";
import db from "../db";

const router = Router();

function publicUser(u: any) {
  return {
    id: u.id,
    telegram_id: u.telegram_id,
    username: u.username,
    first_name: u.first_name,
    last_name: u.last_name,
    photo_url: u.photo_url,
    role: u.role,
    squad: u.squad,
    bio: u.bio,
    created_at: u.created_at,
  };
}

// GET /api/users/me
router.get("/me", (req, res) => {
  res.json(publicUser(req.user));
});

// PATCH /api/users/me — редактирование bio/squad своего профиля
router.patch("/me", (req, res) => {
  const user = req.user!;
  const bio = req.body.bio !== undefined ? String(req.body.bio).slice(0, 300) : user.bio;
  const squad = req.body.squad !== undefined ? String(req.body.squad).slice(0, 50) : user.squad;
  db.prepare("UPDATE users SET bio = ?, squad = ? WHERE id = ?").run(bio, squad, user.id);
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  res.json(publicUser(row));
});

// GET /api/users/:id — публичный профиль другого пользователя
router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Пользователь не найден" });
    return;
  }
  res.json(publicUser(row));
});

// GET /api/users?q=&squad= — поиск/список (для тегания, поиска друзей)
router.get("/", (req, res) => {
  const q = (req.query.q || "").toString().trim();
  let rows;
  if (q) {
    rows = db
      .prepare(
        `SELECT * FROM users WHERE username LIKE ? OR first_name LIKE ? OR last_name LIKE ? ORDER BY first_name LIMIT 50`
      )
      .all(`%${q}%`, `%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare("SELECT * FROM users ORDER BY first_name LIMIT 200").all();
  }
  res.json((rows as any[]).map(publicUser));
});

export default router;
