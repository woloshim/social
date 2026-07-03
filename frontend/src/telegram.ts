import WebApp from "@twa-dev/sdk";

const runningInTelegram = typeof window !== "undefined" && !!(window as any).Telegram?.WebApp?.initData;

export function initTelegram() {
  if (runningInTelegram) {
    WebApp.ready();
    WebApp.expand();
    try {
      WebApp.setHeaderColor("#ffffff");
      WebApp.setBackgroundColor("#fafafa");
    } catch {
      // старая версия клиента может не поддерживать — не критично
    }
  }
}

/**
 * initData, который отправляем на backend для проверки подписи.
 * В браузере вне Telegram (локальная разработка) используем строку "dev",
 * которую backend принимает только при NODE_ENV !== production.
 */
export function getInitData(): string {
  if (runningInTelegram) return WebApp.initData;
  return "dev";
}

export function getCurrentTelegramUser() {
  if (runningInTelegram) return WebApp.initDataUnsafe?.user;
  return { id: 1, first_name: "Dev", username: "dev_user" };
}

export function hapticSelection() {
  if (runningInTelegram) {
    try {
      WebApp.HapticFeedback.selectionChanged();
    } catch {
      /* noop */
    }
  }
}

export function hapticImpact(style: "light" | "medium" | "heavy" = "light") {
  if (runningInTelegram) {
    try {
      WebApp.HapticFeedback.impactOccurred(style);
    } catch {
      /* noop */
    }
  }
}

export const isInTelegram = runningInTelegram;
