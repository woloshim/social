import { Api, InlineKeyboard } from "grammy";

// Отдельный лёгкий клиент Telegram Bot API только для отправки сообщений (не long-polling).
// Работает независимо от того, запущен ли бот в index.ts на long polling — нужен только
// BOT_TOKEN. Так уведомления о лайках/комментариях доставляются даже если по каким-то
// причинам polling-бот не поднят.
let api: Api | null = null;
function getApi(): Api | null {
  const token = process.env.BOT_TOKEN;
  if (!token) return null;
  if (!api) api = new Api(token);
  return api;
}

export function displayName(u: { first_name?: string | null; username?: string | null }): string {
  return u.first_name || (u.username ? `@${u.username}` : "Кто-то");
}

/**
 * Отправляет пользователю уведомление в личку бота. Никогда не бросает исключение наружу —
 * ошибки (например, пользователь заблокировал бота) только логируются, чтобы не ронять
 * основной запрос (лайк/комментарий должны сохраниться в любом случае).
 */
export async function notifyUser(telegramId: string, text: string) {
  const a = getApi();
  if (!a) return;
  const webAppUrl = process.env.WEBAPP_URL;
  try {
    await a.sendMessage(telegramId, text, {
      reply_markup: webAppUrl ? new InlineKeyboard().webApp("Открыть Sparta Social", webAppUrl) : undefined,
    });
  } catch (err) {
    console.error(`Не удалось отправить уведомление пользователю ${telegramId}:`, err);
  }
}
