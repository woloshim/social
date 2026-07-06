import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { DATA_DIR, UPLOADS_DIR } from "./paths";

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, "camp.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---- Schema ----
// Roles: 'child' (ребёнок), 'counselor' (вожатый), 'admin' (администрация)
// Post visibility: 'public' (видно всем) | 'hide_from_counselors' (скрыт от вожатых,
//   но ВСЕГДА виден admin-ролям — это осознанное ограничение ради безопасности детей:
//   ни один пост не может быть полностью невидим для ответственного взрослого-администратора).
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'child' CHECK (role IN ('child','counselor','admin')),
  squad TEXT,
  bio TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_path TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo','video')),
  caption TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','hide_from_counselors')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_path TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo','video')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS story_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(story_id, user_id)
);

-- Подписки на новые публикации автора (feature: "подписаться на публикации").
CREATE TABLE IF NOT EXISTS follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(follower_id, followee_id)
);

-- Просмотры постов (для счётчика "сколько раз посмотрели", виден только автору).
CREATE TABLE IF NOT EXISTS post_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(post_id, user_id)
);

-- Доп. фото для постов-каруселей (Instagram-style слайды). Первый слайд по position=0.
CREATE TABLE IF NOT EXISTS post_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  media_path TEXT NOT NULL,
  thumb_path TEXT,
  media_type TEXT NOT NULL DEFAULT 'photo' CHECK (media_type IN ('photo')),
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);
CREATE INDEX IF NOT EXISTS idx_post_views_post ON post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_media_post ON post_media(post_id, position);
`);

// Лёгкая миграция для баз, созданных до появления превьюшек (thumb_path).
// Безопасна и на свежей, и на уже существующей базе — просто добавляет колонку, если её нет.
function ensureColumn(table: string, column: string, type: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}
ensureColumn("posts", "thumb_path", "TEXT");
// avatar_source: 'telegram' (по умолчанию, аватар из Telegram-профиля) | 'custom' (загруженный вручную).
ensureColumn("users", "avatar_source", "TEXT NOT NULL DEFAULT 'telegram'");
ensureColumn("users", "custom_avatar_path", "TEXT");
ensureColumn("comments", "media_path", "TEXT");

// Миграция: разрешить текстовые посты без медиа (media_path NULL, media_type = 'text').
// Исходная схема требовала media_path NOT NULL и media_type IN ('photo','video') — SQLite не
// умеет менять constraints через ALTER TABLE, поэтому пересобираем таблицу целиком, сохраняя
// все данные. Идемпотентно: если таблица уже пересобрана (media_path допускает NULL), ничего
// не делаем.
function migratePostsAllowText() {
  const cols = db.prepare(`PRAGMA table_info(posts)`).all() as { name: string; notnull: number }[];
  const mediaPathCol = cols.find((c) => c.name === "media_path");
  if (!mediaPathCol || mediaPathCol.notnull !== 1) return; // уже мигрировано (или таблицы ещё нет)

  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE posts_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        media_path TEXT,
        media_type TEXT NOT NULL CHECK (media_type IN ('photo','video','text')),
        thumb_path TEXT,
        caption TEXT,
        visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','hide_from_counselors')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO posts_new (id, author_id, media_path, media_type, thumb_path, caption, visibility, created_at)
        SELECT id, author_id, media_path, media_type, thumb_path, caption, visibility, created_at FROM posts;
      DROP TABLE posts;
      ALTER TABLE posts_new RENAME TO posts;
      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
    `);
  });

  db.pragma("foreign_keys = OFF");
  try {
    migrate();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}
migratePostsAllowText();

// Миграция: разрешить media_type = 'carousel' (пост-слайдшоу из нескольких фото, как в Instagram).
// Сами файлы карусели лежат в отдельной таблице post_media; на самой posts это просто ещё одно
// допустимое значение media_type в CHECK-констрейнте. SQLite не даёт менять CHECK через ALTER
// TABLE, поэтому снова пересобираем таблицу целиком (как в migratePostsAllowText). Идемпотентно:
// проверяем текст constraint'а в sqlite_master — если 'carousel' уже там, ничего не делаем.
function migratePostsAllowCarousel() {
  const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'posts'`).get() as
    | { sql: string }
    | undefined;
  if (!row || row.sql.includes("'carousel'")) return; // уже мигрировано (или таблицы ещё нет)

  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE posts_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        media_path TEXT,
        media_type TEXT NOT NULL CHECK (media_type IN ('photo','video','text','carousel')),
        thumb_path TEXT,
        caption TEXT,
        visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','hide_from_counselors')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO posts_new (id, author_id, media_path, media_type, thumb_path, caption, visibility, created_at)
        SELECT id, author_id, media_path, media_type, thumb_path, caption, visibility, created_at FROM posts;
      DROP TABLE posts;
      ALTER TABLE posts_new RENAME TO posts;
      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
    `);
  });

  db.pragma("foreign_keys = OFF");
  try {
    migrate();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}
migratePostsAllowCarousel();

export default db;
