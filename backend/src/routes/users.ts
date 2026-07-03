import { Router } from "express";
import db from "../db";
import { upload } from "../upload";
import { processUploadedImage } from "../imageProcessing";
import { avatarUrl } from "../avatars";

const router = Router();

const VALID_SQUADS = new Set(["1", "2", "3", "4", "5"]);

// Приводит присланное значение отряда к валидному: "1".."5" или null (не указан).
// Прошлые свободные значения (введённые до этого ограничения) в базе не трогаем —
// просто не даём сохранить новое невалидное значение.
function normalizeSquad(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  return VALID_SQUADS.has(s) ? s : null;
}

function followCounts(userId: number) {
  const followers = db.prepare("SELECT COUNT(*) c FROM follows WHERE followee_id = ?").get(userId) as any;
  const following = db.prepare("SELECT COUNT(*) c FROM follows WHERE follower_id = ?").get(userId) as any;
  return { follower_count: followers.c as number, following_count: following.c as number };
}

function publicUser(u: any, viewerId?: number) {
  const counts = followCounts(u.id);
  return {
    id: u.id,
    telegram_id: u.telegram_id,
    username: u.username,
    first_name: u.first_name,
    last_name: u.last_name,
    photo_url: u.photo_url,
    avatar_url: avatarUrl(u),
    avatar_source: u.avatar_source || "telegram",
    role: u.role,
    squad: u.squad,
    bio: u.bio,
    created_at: u.created_at,
    ...counts,
    is_following:
      viewerId !== undefined && viewerId !== u.id
        ? !!db.prepare("SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?").get(viewerId, u.id)
        : undefined,
  };
}

// GET /api/users/me
router.get("/me", (req, res) => {
  res.json(publicUser(req.user));
});

// PATCH /api/users/me — редактирование bio/squad/avatar_source своего профиля
router.patch("/me", (req, res) => {
  const user = req.user!;
  const bio = req.body.bio !== undefined ? String(req.body.bio).slice(0, 300) : user.bio;
  const squad = req.body.squad !== undefined ? normalizeSquad(req.body.squad) : user.squad;

  let avatarSource = (user as any).avatar_source || "telegram";
  if (req.body.avatar_source !== undefined) {
    const requested = String(req.body.avatar_source);
    if (requested !== "telegram" && requested !== "custom") {
      res.status(400).json({ error: "Некорректный источник аватара" });
      return;
    }
    // Нельзя переключиться на custom, если своего аватара ещё не загружали.
    if (requested === "custom" && !(user as any).custom_avatar_path) {
      res.status(400).json({ error: "Сначала загрузите свой аватар" });
      return;
    }
    avatarSource = requested;
  }

  db.prepare("UPDATE users SET bio = ?, squad = ?, avatar_source = ? WHERE id = ?").run(bio, squad, avatarSource, user.id);
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  res.json(publicUser(row, user.id));
});

// POST /api/users/me/avatar — загрузить свой аватар (multipart, поле "avatar")
router.post("/me/avatar", upload.single("avatar"), async (req, res) => {
  const user = req.user!;
  if (!req.file) {
    res.status(400).json({ error: "Файл не загружен" });
    return;
  }
  if (!req.file.mimetype.startsWith("image/")) {
    res.status(400).json({ error: "Аватар должен быть изображением" });
    return;
  }
  const processed = await processUploadedImage(req.file.filename, req.file.mimetype, { withThumb: false });
  db.prepare("UPDATE users SET custom_avatar_path = ?, avatar_source = 'custom' WHERE id = ?").run(
    processed.mediaFilename,
    user.id
  );
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  res.json(publicUser(row, user.id));
});

// POST /api/users/:id/follow — подписаться/отписаться от новых публикаций пользователя
router.post("/:id/follow", (req, res) => {
  const user = req.user!;
  const targetId = Number(req.params.id);
  if (targetId === user.id) {
    res.status(400).json({ error: "Нельзя подписаться на самого себя" });
    return;
  }
  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(targetId);
  if (!target) {
    res.status(404).json({ error: "Пользователь не найден" });
    return;
  }
  const existing = db.prepare("SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?").get(user.id, targetId);
  if (existing) {
    db.prepare("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?").run(user.id, targetId);
  } else {
    db.prepare("INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)").run(user.id, targetId);
  }
  const counts = followCounts(targetId);
  res.json({ following: !existing, ...counts });
});

// GET /api/users/:id — публичный профиль другого пользователя
router.get("/:id", (req, res) => {
  const user = req.user!;
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Пользователь не найден" });
    return;
  }
  res.json(publicUser(row, user.id));
});

// GET /api/users?q=&squad= — поиск/список (для тегания, поиска друзей)
router.get("/", (req, res) => {
  const user = req.user!;
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
  res.json((rows as any[]).map((r) => publicUser(r, user.id)));
});

export default router;
