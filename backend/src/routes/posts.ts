import { Router } from "express";
import db from "../db";
import { AuthedUser } from "../auth";
import { upload, mediaTypeFromMime } from "../upload";

const router = Router();

// admin всегда видит всё (safety net), остальные не видят посты со скрытием "hide_from_counselors"
// адресованные вожатым/детям — child и counselor видят: public + свои собственные посты любой видимости.
function visibilityClause(user: AuthedUser): { clause: string; params: any[] } {
  if (user.role === "admin") {
    return { clause: "1=1", params: [] };
  }
  return {
    clause: "(p.visibility = 'public' OR p.author_id = ?)",
    params: [user.id],
  };
}

function serializePost(row: any, viewerId: number) {
  const likeCount = db.prepare("SELECT COUNT(*) c FROM likes WHERE post_id = ?").get(row.id) as any;
  const commentCount = db.prepare("SELECT COUNT(*) c FROM comments WHERE post_id = ?").get(row.id) as any;
  const likedByMe = db
    .prepare("SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?")
    .get(row.id, viewerId);
  return {
    id: row.id,
    author: {
      id: row.author_id,
      username: row.username,
      first_name: row.first_name,
      last_name: row.last_name,
      photo_url: row.photo_url,
      role: row.author_role,
    },
    media_path: `/uploads/${row.media_path}`,
    media_type: row.media_type,
    caption: row.caption,
    visibility: row.visibility,
    created_at: row.created_at,
    like_count: likeCount.c,
    comment_count: commentCount.c,
    liked_by_me: !!likedByMe,
  };
}

// GET /api/posts?before=<id>&limit=20  — лента (курсорная пагинация)
router.get("/", (req, res) => {
  const user = req.user!;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const before = req.query.before ? Number(req.query.before) : null;
  const { clause, params } = visibilityClause(user);

  const rows = db
    .prepare(
      `SELECT p.*, u.username, u.first_name, u.last_name, u.photo_url, u.role as author_role
       FROM posts p JOIN users u ON u.id = p.author_id
       WHERE ${clause} ${before ? "AND p.id < ?" : ""}
       ORDER BY p.id DESC
       LIMIT ?`
    )
    .all(...params, ...(before ? [before] : []), limit);

  res.json(rows.map((r) => serializePost(r, user.id)));
});

// GET /api/posts/user/:userId — фотоальбом конкретного пользователя (для профиля)
router.get("/user/:userId", (req, res) => {
  const user = req.user!;
  const targetId = Number(req.params.userId);
  const { clause, params } = visibilityClause(user);

  const rows = db
    .prepare(
      `SELECT p.*, u.username, u.first_name, u.last_name, u.photo_url, u.role as author_role
       FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.author_id = ? AND ${clause}
       ORDER BY p.id DESC`
    )
    .all(targetId, ...params);

  res.json(rows.map((r) => serializePost(r, user.id)));
});

// POST /api/posts — создать пост (multipart: media, caption, visibility)
router.post("/", upload.single("media"), (req, res) => {
  const user = req.user!;
  if (!req.file) {
    res.status(400).json({ error: "Файл не загружен" });
    return;
  }
  const visibility = req.body.visibility === "hide_from_counselors" ? "hide_from_counselors" : "public";
  const caption = (req.body.caption || "").toString().slice(0, 2000);
  const mediaType = mediaTypeFromMime(req.file.mimetype);

  const info = db
    .prepare(`INSERT INTO posts (author_id, media_path, media_type, caption, visibility) VALUES (?, ?, ?, ?, ?)`)
    .run(user.id, req.file.filename, mediaType, caption, visibility);

  const row = db
    .prepare(
      `SELECT p.*, u.username, u.first_name, u.last_name, u.photo_url, u.role as author_role
       FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ?`
    )
    .get(info.lastInsertRowid);

  res.status(201).json(serializePost(row, user.id));
});

// DELETE /api/posts/:id — автор или admin может удалить
router.delete("/:id", (req, res) => {
  const user = req.user!;
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(Number(req.params.id)) as any;
  if (!post) {
    res.status(404).json({ error: "Пост не найден" });
    return;
  }
  if (post.author_id !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Недостаточно прав" });
    return;
  }
  db.prepare("DELETE FROM posts WHERE id = ?").run(post.id);
  res.json({ ok: true });
});

// POST /api/posts/:id/like — переключить лайк
router.post("/:id/like", (req, res) => {
  const user = req.user!;
  const postId = Number(req.params.id);
  const existing = db.prepare("SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?").get(postId, user.id);
  if (existing) {
    db.prepare("DELETE FROM likes WHERE post_id = ? AND user_id = ?").run(postId, user.id);
  } else {
    db.prepare("INSERT INTO likes (post_id, user_id) VALUES (?, ?)").run(postId, user.id);
  }
  const likeCount = db.prepare("SELECT COUNT(*) c FROM likes WHERE post_id = ?").get(postId) as any;
  res.json({ liked: !existing, like_count: likeCount.c });
});

// GET /api/posts/:id/comments
router.get("/:id/comments", (req, res) => {
  const postId = Number(req.params.id);
  const rows = db
    .prepare(
      `SELECT c.*, u.username, u.first_name, u.last_name, u.photo_url
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ? ORDER BY c.id ASC`
    )
    .all(postId);
  res.json(
    rows.map((r: any) => ({
      id: r.id,
      text: r.text,
      created_at: r.created_at,
      author: { id: r.user_id, username: r.username, first_name: r.first_name, last_name: r.last_name, photo_url: r.photo_url },
    }))
  );
});

// POST /api/posts/:id/comments
router.post("/:id/comments", (req, res) => {
  const user = req.user!;
  const postId = Number(req.params.id);
  const text = (req.body.text || "").toString().trim().slice(0, 1000);
  if (!text) {
    res.status(400).json({ error: "Пустой комментарий" });
    return;
  }
  const info = db.prepare("INSERT INTO comments (post_id, user_id, text) VALUES (?, ?, ?)").run(postId, user.id, text);
  const row = db.prepare("SELECT * FROM comments WHERE id = ?").get(info.lastInsertRowid) as any;
  res.status(201).json({
    id: row.id,
    text: row.text,
    created_at: row.created_at,
    author: { id: user.id, username: user.username, first_name: user.first_name, last_name: user.last_name, photo_url: user.photo_url },
  });
});

export default router;
