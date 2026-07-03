import { Router } from "express";
import db from "../db";
import { AuthedUser } from "../auth";
import { upload, mediaTypeFromMime } from "../upload";
import { processUploadedImage } from "../imageProcessing";
import { notifyUser, displayName } from "../notify";
import { avatarUrl } from "../avatars";

const router = Router();

// Все telegram_id подписчиков автора (для уведомлений о новом посте).
function getFollowerTelegramIds(authorId: number): string[] {
  const rows = db
    .prepare(
      `SELECT u.telegram_id FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.followee_id = ?`
    )
    .all(authorId) as { telegram_id: string }[];
  return rows.map((r) => r.telegram_id);
}

// Автор поста + его telegram_id (для уведомлений), либо null если пост не найден.
function getPostAuthor(postId: number): { author_id: number; telegram_id: string } | null {
  const row = db
    .prepare(
      `SELECT p.author_id, u.telegram_id
       FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.id = ?`
    )
    .get(postId) as { author_id: number; telegram_id: string } | undefined;
  return row || null;
}

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
      avatar_url: avatarUrl({ avatar_source: row.avatar_source, custom_avatar_path: row.custom_avatar_path, photo_url: row.photo_url }),
      role: row.author_role,
    },
    media_path: `/uploads/${row.media_path}`,
    thumb_path: row.thumb_path ? `/uploads/${row.thumb_path}` : null,
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
      `SELECT p.*, u.username, u.first_name, u.last_name, u.photo_url, u.avatar_source, u.custom_avatar_path, u.role as author_role
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
      `SELECT p.*, u.username, u.first_name, u.last_name, u.photo_url, u.avatar_source, u.custom_avatar_path, u.role as author_role
       FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.author_id = ? AND ${clause}
       ORDER BY p.id DESC`
    )
    .all(targetId, ...params);

  res.json(rows.map((r) => serializePost(r, user.id)));
});

// POST /api/posts — создать пост (multipart: media, caption, visibility)
router.post("/", upload.single("media"), async (req, res) => {
  const user = req.user!;
  if (!req.file) {
    res.status(400).json({ error: "Файл не загружен" });
    return;
  }
  const visibility = req.body.visibility === "hide_from_counselors" ? "hide_from_counselors" : "public";
  const caption = (req.body.caption || "").toString().slice(0, 2000);
  const mediaType = mediaTypeFromMime(req.file.mimetype);

  let mediaFilename = req.file.filename;
  let thumbFilename: string | null = null;
  if (mediaType === "photo") {
    const processed = await processUploadedImage(req.file.filename, req.file.mimetype, { withThumb: true });
    mediaFilename = processed.mediaFilename;
    thumbFilename = processed.thumbFilename;
  }

  const info = db
    .prepare(`INSERT INTO posts (author_id, media_path, thumb_path, media_type, caption, visibility) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(user.id, mediaFilename, thumbFilename, mediaType, caption, visibility);

  const row = db
    .prepare(
      `SELECT p.*, u.username, u.first_name, u.last_name, u.photo_url, u.avatar_source, u.custom_avatar_path, u.role as author_role
       FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ?`
    )
    .get(info.lastInsertRowid);

  res.status(201).json(serializePost(row, user.id));

  // Уведомляем подписчиков о новой публикации (только public — скрытые от вожатых
  // посты не рассылаем всем подряд, это не мешает автору всё равно быть видимым
  // подписчикам через ленту согласно обычным правилам видимости).
  if (visibility === "public") {
    const followerIds = getFollowerTelegramIds(user.id);
    for (const telegramId of followerIds) {
      notifyUser(telegramId, `📸 ${displayName(user)} опубликовал(а) новый пост в Sparta Social`);
    }
  }
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
  const nowLiked = !existing;
  res.json({ liked: nowLiked, like_count: likeCount.c });

  // Уведомляем автора только когда лайк ПОСТАВИЛИ (не сняли) и не самому себе.
  // Отправка не блокирует ответ — выполняется уже после res.json.
  if (nowLiked) {
    const post = getPostAuthor(postId);
    if (post && post.author_id !== user.id) {
      notifyUser(post.telegram_id, `❤️ ${displayName(user)} лайкнул(а) ваш пост в Sparta Social`);
    }
  }
});

function serializeComment(r: any) {
  return {
    id: r.id,
    text: r.text,
    media_path: r.media_path ? `/uploads/${r.media_path}` : null,
    created_at: r.created_at,
    author: {
      id: r.user_id,
      username: r.username,
      first_name: r.first_name,
      last_name: r.last_name,
      photo_url: r.photo_url,
      avatar_url: avatarUrl({ avatar_source: r.avatar_source, custom_avatar_path: r.custom_avatar_path, photo_url: r.photo_url }),
    },
  };
}

// GET /api/posts/:id/comments
router.get("/:id/comments", (req, res) => {
  const postId = Number(req.params.id);
  const rows = db
    .prepare(
      `SELECT c.*, u.username, u.first_name, u.last_name, u.photo_url, u.avatar_source, u.custom_avatar_path
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ? ORDER BY c.id ASC`
    )
    .all(postId);
  res.json(rows.map(serializeComment));
});

// POST /api/posts/:id/comments — multipart (текст + опционально поле "media" с фото)
router.post("/:id/comments", upload.single("media"), async (req, res) => {
  const user = req.user!;
  const postId = Number(req.params.id);
  const text = (req.body.text || "").toString().trim().slice(0, 1000);
  if (!text && !req.file) {
    res.status(400).json({ error: "Пустой комментарий" });
    return;
  }

  let mediaFilename: string | null = null;
  if (req.file) {
    if (!req.file.mimetype.startsWith("image/")) {
      res.status(400).json({ error: "К комментарию можно прикрепить только фото" });
      return;
    }
    const processed = await processUploadedImage(req.file.filename, req.file.mimetype, { withThumb: false });
    mediaFilename = processed.mediaFilename;
  }

  const info = db
    .prepare("INSERT INTO comments (post_id, user_id, text, media_path) VALUES (?, ?, ?, ?)")
    .run(postId, user.id, text, mediaFilename);
  const row = db
    .prepare(
      `SELECT c.*, u.username, u.first_name, u.last_name, u.photo_url, u.avatar_source, u.custom_avatar_path
       FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`
    )
    .get(info.lastInsertRowid) as any;
  res.status(201).json(serializeComment(row));

  // Уведомляем автора поста о новом комментарии (кроме случая, когда комментирует сам себе).
  const post = getPostAuthor(postId);
  if (post && post.author_id !== user.id) {
    const preview = text ? (text.length > 200 ? text.slice(0, 200) + "…" : text) : "📷 фото";
    notifyUser(post.telegram_id, `💬 ${displayName(user)} написал(а) комментарий к вашему посту в Sparta Social:\n«${preview}»`);
  }
});

export default router;
