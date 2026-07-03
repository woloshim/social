import { Router } from "express";
import db from "../db";
import { upload, mediaTypeFromMime } from "../upload";
import { processUploadedImage } from "../imageProcessing";
import { avatarUrl } from "../avatars";

const router = Router();
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

function serializeAuthorStories(authorRow: any, stories: any[], viewerId: number) {
  return {
    author: {
      id: authorRow.author_id,
      username: authorRow.username,
      first_name: authorRow.first_name,
      last_name: authorRow.last_name,
      photo_url: authorRow.photo_url,
      avatar_url: avatarUrl({ avatar_source: authorRow.avatar_source, custom_avatar_path: authorRow.custom_avatar_path, photo_url: authorRow.photo_url }),
    },
    has_unseen: stories.some(
      (s) => !db.prepare("SELECT 1 FROM story_views WHERE story_id = ? AND user_id = ?").get(s.id, viewerId)
    ),
    stories: stories.map((s) => ({
      id: s.id,
      media_path: `/uploads/${s.media_path}`,
      media_type: s.media_type,
      created_at: s.created_at,
      expires_at: s.expires_at,
      seen_by_me: !!db.prepare("SELECT 1 FROM story_views WHERE story_id = ? AND user_id = ?").get(s.id, viewerId),
    })),
  };
}

// GET /api/stories — активные истории, сгруппированные по автору (лента историй сверху)
router.get("/", (req, res) => {
  const user = req.user!;
  db.prepare("DELETE FROM stories WHERE expires_at <= datetime('now')").run();

  const rows = db
    .prepare(
      `SELECT s.*, u.username, u.first_name, u.last_name, u.photo_url, u.avatar_source, u.custom_avatar_path
       FROM stories s JOIN users u ON u.id = s.author_id
       WHERE s.expires_at > datetime('now')
       ORDER BY s.created_at ASC`
    )
    .all() as any[];

  const byAuthor = new Map<number, any[]>();
  for (const r of rows) {
    if (!byAuthor.has(r.author_id)) byAuthor.set(r.author_id, []);
    byAuthor.get(r.author_id)!.push(r);
  }

  const result = Array.from(byAuthor.entries()).map(([authorId, stories]) =>
    serializeAuthorStories(stories[0], stories, user.id)
  );

  res.json(result);
});

// POST /api/stories — загрузить историю
router.post("/", upload.single("media"), async (req, res) => {
  const user = req.user!;
  if (!req.file) {
    res.status(400).json({ error: "Файл не загружен" });
    return;
  }
  const mediaType = mediaTypeFromMime(req.file.mimetype);
  const expiresAt = new Date(Date.now() + STORY_LIFETIME_MS).toISOString();

  let mediaFilename = req.file.filename;
  if (mediaType === "photo") {
    const processed = await processUploadedImage(req.file.filename, req.file.mimetype, { withThumb: false });
    mediaFilename = processed.mediaFilename;
  }

  const info = db
    .prepare(`INSERT INTO stories (author_id, media_path, media_type, expires_at) VALUES (?, ?, ?, ?)`)
    .run(user.id, mediaFilename, mediaType, expiresAt);

  res.status(201).json({
    id: info.lastInsertRowid,
    media_path: `/uploads/${mediaFilename}`,
    media_type: mediaType,
    expires_at: expiresAt,
  });
});

// POST /api/stories/:id/view — отметить как просмотренную
router.post("/:id/view", (req, res) => {
  const user = req.user!;
  const storyId = Number(req.params.id);
  db.prepare("INSERT OR IGNORE INTO story_views (story_id, user_id) VALUES (?, ?)").run(storyId, user.id);
  res.json({ ok: true });
});

export default router;
