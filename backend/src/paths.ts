import path from "path";

// Единая точка правды для путей хранения данных. Если задана переменная окружения
// PERSIST_DIR (указывает на смонтированный Render Persistent Disk, например /var/data),
// база и загруженные файлы хранятся под ней — так они переживают redeploy/restart.
// Без неё (локальная разработка) — используются старые относительные папки внутри backend/,
// поведение не меняется.
export const ROOT = process.env.PERSIST_DIR
  ? process.env.PERSIST_DIR
  : path.join(__dirname, "..");

export const DATA_DIR = path.join(ROOT, "data");
export const UPLOADS_DIR = path.join(ROOT, "uploads");
