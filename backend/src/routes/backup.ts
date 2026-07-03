import { Router } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import fs from "fs";
import { DATA_DIR, UPLOADS_DIR, ROOT } from "../paths";

// Служебные роуты для ручной миграции данных (SQLite + uploads) при переносе на
// Render Persistent Disk. Защищены отдельным секретом (BACKUP_SECRET), а не
// Telegram-авторизацией — их нужно дёргать напрямую из браузера/curl, до того как
// приложение вообще открыто в Telegram. Если BACKUP_SECRET не задан в окружении —
// оба роута всегда отвечают 404, как будто их не существует.
//
// ВАЖНО: после того как миграция на диск завершена и данные восстановлены,
// удали переменную BACKUP_SECRET в Render (или смени её), чтобы закрыть доступ.

const router = Router();
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

function checkSecret(req: any, res: any): boolean {
  const secret = process.env.BACKUP_SECRET;
  if (!secret || req.query.key !== secret) {
    res.status(404).send("Not found");
    return false;
  }
  return true;
}

// GET /api/backup?key=SECRET — скачивает zip с текущими data/ и uploads/
router.get("/backup", (req, res) => {
  if (!checkSecret(req, res)) return;

  const zip = new AdmZip();
  if (fs.existsSync(DATA_DIR)) zip.addLocalFolder(DATA_DIR, "data");
  if (fs.existsSync(UPLOADS_DIR)) zip.addLocalFolder(UPLOADS_DIR, "uploads");

  const buffer = zip.toBuffer();
  res.set({
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="camp-social-backup-${Date.now()}.zip"`,
    "Content-Length": buffer.length,
  });
  res.send(buffer);
});

// POST /api/backup/restore?key=SECRET, multipart form field "backup" — распаковывает
// zip (созданный этим же роутом) обратно в текущий persist root (DATA_DIR/UPLOADS_DIR).
router.post("/backup/restore", memoryUpload.single("backup"), (req, res) => {
  if (!checkSecret(req, res)) return;
  if (!req.file) {
    res.status(400).send("Файл backup обязателен (form field 'backup')");
    return;
  }

  try {
    const zip = new AdmZip(req.file.buffer);
    zip.extractAllTo(ROOT, true);
    res.json({ ok: true, message: "Восстановлено в " + ROOT });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

export default router;
