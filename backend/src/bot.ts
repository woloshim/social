import { Bot, InlineKeyboard } from "grammy";
import db from "./db";

const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function createBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("BOT_TOKEN не задан в .env");
  const webAppUrl = process.env.WEBAPP_URL;
  if (!webAppUrl) throw new Error("WEBAPP_URL не задан в .env");

  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const role = ADMIN_IDS.includes(telegramId) ? "admin" : "child";

    db.prepare(
      `INSERT INTO users (telegram_id, username, first_name, last_name, role)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(telegram_id) DO UPDATE SET username = excluded.username, first_name = excluded.first_name, last_name = excluded.last_name`
    ).run(telegramId, ctx.from?.username || null, ctx.from?.first_name || null, ctx.from?.last_name || null, role);

    const keyboard = new InlineKeyboard().webApp("📸 Открыть лагерную соцсеть", webAppUrl);

    await ctx.reply(
      "Привет! Это наша лагерная соцсеть 🏕️\n\n" +
        "Публикуй фото и видео, смотри истории друзей, комментируй и лайкай.\n" +
        (role === "admin"
          ? "У тебя роль администратора — в приложении есть панель управления ролями."
          : "Роли (вожатый/администрация) выдаёт администратор лагеря."),
      { reply_markup: keyboard }
    );
  });

  bot.command("app", async (ctx) => {
    const keyboard = new InlineKeyboard().webApp("📸 Открыть соцсеть", webAppUrl);
    await ctx.reply("Открыть приложение:", { reply_markup: keyboard });
  });

  // Резервная команда назначения роли из чата, на случай если админ не в панели:
  // /setrole <telegram_id> <child|counselor|admin>
  bot.command("setrole", async (ctx) => {
    const requesterId = String(ctx.from?.id);
    if (!ADMIN_IDS.includes(requesterId)) {
      await ctx.reply("Эта команда доступна только администраторам лагеря.");
      return;
    }
    const parts = (ctx.match || "").toString().trim().split(/\s+/);
    const [targetTelegramId, role] = parts;
    if (!targetTelegramId || !["child", "counselor", "admin"].includes(role)) {
      await ctx.reply("Использование: /setrole <telegram_id> <child|counselor|admin>");
      return;
    }
    const info = db.prepare("UPDATE users SET role = ? WHERE telegram_id = ?").run(role, targetTelegramId);
    if (info.changes === 0) {
      await ctx.reply("Пользователь ещё не открывал приложение (нет в базе).");
    } else {
      await ctx.reply(`Готово: ${targetTelegramId} → роль ${role}`);
    }
  });

  bot.catch((err) => {
    console.error("Ошибка бота:", err);
  });

  return bot;
}
