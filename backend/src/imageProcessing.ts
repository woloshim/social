import sharp from "sharp";
import path from "path";
import fs from "fs";
import { UPLOADS_DIR } from "./paths";

const MAIN_MAX_DIMENSION = 1600;
const MAIN_QUALITY = 82;
const THUMB_DIMENSION = 480;
const THUMB_QUALITY = 70;

// GIF-ы не трогаем — пережатие через sharp убивает анимацию (берёт только первый кадр).
const SKIP_MIME = new Set(["image/gif"]);

/**
 * Сжимает загруженное фото (уменьшает размер, конвертирует в jpeg), опционально
 * генерирует отдельное уменьшенное превью для сеток (профиль). Уменьшает вес фото
 * с телефона (часто 3-10 МБ) до сотен КБ — это основная причина медленной загрузки ленты.
 * На видео и gif не действует.
 */
export async function processUploadedImage(
  filename: string,
  mimetype: string,
  opts: { withThumb: boolean }
): Promise<{ mediaFilename: string; thumbFilename: string | null }> {
  if (SKIP_MIME.has(mimetype)) {
    return { mediaFilename: filename, thumbFilename: null };
  }

  const inputPath = path.join(UPLOADS_DIR, filename);
  const baseName = path.parse(filename).name;
  const mediaFilename = `${baseName}.jpg`;
  const mediaTmpPath = path.join(UPLOADS_DIR, `${mediaFilename}.tmp`);
  const mediaFinalPath = path.join(UPLOADS_DIR, mediaFilename);

  try {
    await sharp(inputPath)
      .rotate() // авто-поворот по EXIF (фото с телефона часто "лежат на боку" без этого)
      .resize({
        width: MAIN_MAX_DIMENSION,
        height: MAIN_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: MAIN_QUALITY, mozjpeg: true })
      .toFile(mediaTmpPath);

    let thumbFilename: string | null = null;
    if (opts.withThumb) {
      thumbFilename = `thumb_${baseName}.jpg`;
      await sharp(inputPath)
        .rotate()
        .resize({ width: THUMB_DIMENSION, height: THUMB_DIMENSION, fit: "cover" })
        .jpeg({ quality: THUMB_QUALITY })
        .toFile(path.join(UPLOADS_DIR, thumbFilename));
    }

    fs.renameSync(mediaTmpPath, mediaFinalPath);
    if (mediaFilename !== filename && fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath); // исходник больше не нужен, оставляем только сжатую версию
    }

    return { mediaFilename, thumbFilename };
  } catch (err) {
    // Если sharp не смог обработать файл (битый/необычный формат) — не роняем загрузку,
    // просто отдаём исходный файл без сжатия.
    console.error("Не удалось сжать изображение, использую оригинал:", err);
    if (fs.existsSync(mediaTmpPath)) fs.unlinkSync(mediaTmpPath);
    return { mediaFilename: filename, thumbFilename: null };
  }
}
