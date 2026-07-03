import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import db from "./db";

export interface AuthedUser {
  id: number;
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  role: "child" | "counselor" | "admin";
  squad: string | null;
  bio: string | null;
  created_at: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Проверяет initData, присланный Telegram Mini App, по алгоритму из
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function verifyInitData(initData: string, botToken: string): URLSearchParams | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckArr: string[] = [];
  params.forEach((value, key) => dataCheckArr.push(`${key}=${value}`));
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computedHash !== hash) return null;

  // optional: reject stale initData (older than 24h)
  const authDate = Number(params.get("auth_date") || 0);
  if (authDate && Date.now() / 1000 - authDate > 60 * 60 * 24) return null;

  return params;
}

export function telegramAuth(req: Request, res: Response, next: NextFunction) {
  const botToken = process.env.BOT_TOKEN;
  const initData = req.header("X-Telegram-Init-Data");

  if (!botToken || !initData) {
    res.status(401).json({ error: "Нет initData или не настроен BOT_TOKEN" });
    return;
  }

  // Allow a dev bypass only outside production, for local testing without a real Telegram client.
  const isDevBypass = process.env.NODE_ENV !== "production" && initData === "dev";
  let telegramUser: any;

  if (isDevBypass) {
    telegramUser = { id: "0000000001", username: "dev_user", first_name: "Dev", last_name: "User" };
  } else {
    const parsed = verifyInitData(initData, botToken);
    if (!parsed) {
      res.status(401).json({ error: "Невалидная подпись initData" });
      return;
    }
    const userJson = parsed.get("user");
    if (!userJson) {
      res.status(401).json({ error: "В initData нет user" });
      return;
    }
    telegramUser = JSON.parse(userJson);
  }

  const telegramId = String(telegramUser.id);

  let user = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(telegramId) as AuthedUser | undefined;

  if (!user) {
    const role = ADMIN_IDS.includes(telegramId) ? "admin" : "child";
    const info = db
      .prepare(
        `INSERT INTO users (telegram_id, username, first_name, last_name, photo_url, role) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        telegramId,
        telegramUser.username || null,
        telegramUser.first_name || null,
        telegramUser.last_name || null,
        telegramUser.photo_url || null,
        role
      );
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid) as AuthedUser;
  } else {
    // Keep profile info fresh (name/username/photo can change), but never touch role here.
    // Telegram only includes photo_url in initData when the user has a public profile photo,
    // so we only overwrite it when a fresh value is actually present (avoids wiping it on
    // requests where Telegram omits the field).
    db.prepare(
      "UPDATE users SET username = ?, first_name = ?, last_name = ?, photo_url = COALESCE(?, photo_url) WHERE id = ?"
    ).run(
      telegramUser.username || null,
      telegramUser.first_name || null,
      telegramUser.last_name || null,
      telegramUser.photo_url || null,
      user.id
    );
    // Promote to admin if they're in ADMIN_TELEGRAM_IDS but weren't marked as such yet
    // (e.g. env var updated after first login).
    if (ADMIN_IDS.includes(telegramId) && user.role !== "admin") {
      db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id);
    }
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as AuthedUser;
  }

  req.user = user;
  next();
}

export function requireRole(...roles: Array<AuthedUser["role"]>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Недостаточно прав" });
      return;
    }
    next();
  };
}
