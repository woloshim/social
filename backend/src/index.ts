import "dotenv/config";
import express from "express";
import cors from "cors";
import cron from "node-cron";
import db from "./db";
import { telegramAuth } from "./auth";
import usersRouter from "./routes/users";
import postsRouter from "./routes/posts";
import storiesRouter from "./routes/stories";
import adminRouter from "./routes/admin";
import backupRouter from "./routes/backup";
import { createBot } from "./bot";
import { UPLOADS_DIR } from "./paths";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);
app.use(express.json());
app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Роут бэкапа/восстановления — вне Telegram-авторизации, защищён своим секретом (см. routes/backup.ts)
app.use("/api", backupRouter);

// Все остальные /api/* роуты требуют валидный Telegram initData
app.use("/api", telegramAuth);
app.use("/api/users", usersRouter);
app.use("/api/posts", postsRouter);
app.use("/api/stories", storiesRouter);
app.use("/api/admin", adminRouter);

// Раз в час подчищаем протухшие истории (медиафайлы на диске тоже можно чистить cron'ом отдельно, см. README)
cron.schedule("0 * * * *", () => {
  db.prepare("DELETE FROM stories WHERE expires_at <= datetime('now')").run();
});

app.listen(PORT, () => {
  console.log(`API запущено на http://localhost:${PORT}`);
});

// Бот запускаем только если задан токен — удобно для локальной разработки без бота
if (process.env.BOT_TOKEN && process.env.WEBAPP_URL) {
  const bot = createBot();
  bot.start();
  console.log("Telegram-бот запущен (long polling)");
} else {
  console.log("BOT_TOKEN/WEBAPP_URL не заданы — бот не запущен (только API)");
}
