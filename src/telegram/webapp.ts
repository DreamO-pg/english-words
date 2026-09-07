import { colors } from '../theme/colors';
import type { HomeScreenStatus, TelegramWebApp } from './types';

/**
 * Обёртка над Telegram WebApp с полным фолбэком на браузер.
 * Внутри телеграма — CloudStorage и HapticFeedback,
 * в обычном браузере — localStorage и тишина. Ничего не падает.
 */

const sdk: TelegramWebApp | undefined =
  typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

/**
 * telegram-web-app.js подключён скриптом и в обычном браузере тоже —
 * там он отдаёт platform 'unknown' и version '6.0' и ругается в консоль
 * на CloudStorage и BackButton. Поэтому за настоящий телеграм считаем
 * только живую платформу, а всё остальное уводим в браузерный фолбэк.
 */
export const isTelegram = Boolean(sdk && sdk.platform !== 'unknown');

const raw = isTelegram ? sdk : undefined;

/** Аккуратно вызвать метод SDK: старые клиенты его могут не знать. */
function safe(fn: () => void) {
  try {
    fn();
  } catch {
    /* старый клиент — просто пропускаем */
  }
}

// ─── старт ────────────────────────────────────────────────────────────────

export function initWebApp() {
  applyHeight();

  if (!raw) {
    // Браузер: высота окна.
    window.addEventListener('resize', applyHeight);
    return;
  }

  safe(() => raw.ready());
  safe(() => raw.expand());
  // Иначе свайп по списку вариантов сворачивает окно.
  safe(() => raw.disableVerticalSwipes?.());
  // Тема фиксированно светлая, themeParams пользователя игнорируем.
  safe(() => raw.setHeaderColor(colors.bg));
  safe(() => raw.setBackgroundColor(colors.bg));

  raw.onEvent('viewportChanged', applyHeight);
}

/** Высота из viewportStableHeight — не из 100vh. */
function applyHeight() {
  const h = raw?.viewportStableHeight || window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${h}px`);
}

export function getViewportHeight(): number {
  return raw?.viewportStableHeight || window.innerHeight;
}

/** Подписка на изменение высоты вьюпорта. Возвращает отписку. */
export function onViewportChange(cb: (height: number) => void): () => void {
  const handler = () => cb(getViewportHeight());
  if (raw) {
    raw.onEvent('viewportChanged', handler);
    return () => raw.offEvent('viewportChanged', handler);
  }
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}

// ─── кнопка «назад» ───────────────────────────────────────────────────────

/** Свою «назад» не рисуем — только нативная кнопка телеграма. */
export function setBackButton(handler: (() => void) | null): () => void {
  if (!raw) {
    // В браузере нативной кнопки нет — чтобы не застрять на экране
    // при отладке, назад работает по Escape. Ничего не рисуем.
    if (!handler) return () => {};
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }
  const back = raw.BackButton;
  if (!handler) {
    safe(() => back.hide());
    return () => {};
  }
  safe(() => {
    back.onClick(handler);
    back.show();
  });
  return () => {
    safe(() => {
      back.offClick(handler);
      back.hide();
    });
  };
}

// ─── тактильный отклик ────────────────────────────────────────────────────

export const haptic = {
  success() {
    safe(() => raw?.HapticFeedback.notificationOccurred('success'));
  },
  error() {
    safe(() => raw?.HapticFeedback.notificationOccurred('error'));
  },
  select() {
    safe(() => raw?.HapticFeedback.selectionChanged());
  },
  tap() {
    safe(() => raw?.HapticFeedback.impactOccurred('light'));
  },
};

// ─── хранилище ────────────────────────────────────────────────────────────

const LS_PREFIX = 'ew:';

/**
 * CloudStorage: до 1024 ключей, значение до 4096 символов.
 * В браузере — localStorage с тем же интерфейсом.
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    if (!raw) return localStorage.getItem(LS_PREFIX + key);
    return new Promise((resolve) => {
      try {
        raw.CloudStorage.getItem(key, (err, value) => {
          resolve(err ? null : value ?? null);
        });
      } catch {
        resolve(null);
      }
    });
  },

  async getMany(keys: string[]): Promise<Record<string, string>> {
    if (keys.length === 0) return {};
    if (!raw) {
      const out: Record<string, string> = {};
      for (const k of keys) {
        const v = localStorage.getItem(LS_PREFIX + k);
        if (v !== null) out[k] = v;
      }
      return out;
    }
    return new Promise((resolve) => {
      try {
        raw.CloudStorage.getItems(keys, (err, values) => {
          resolve(err || !values ? {} : values);
        });
      } catch {
        resolve({});
      }
    });
  },

  async set(key: string, value: string): Promise<boolean> {
    if (value.length > 4096) {
      console.warn(`[storage] значение ключа ${key} длиннее 4096 символов`);
    }
    if (!raw) {
      try {
        localStorage.setItem(LS_PREFIX + key, value);
        return true;
      } catch {
        return false;
      }
    }
    return new Promise((resolve) => {
      try {
        raw.CloudStorage.setItem(key, value, (err, ok) => resolve(!err && ok));
      } catch {
        resolve(false);
      }
    });
  },

  async remove(key: string): Promise<boolean> {
    if (!raw) {
      localStorage.removeItem(LS_PREFIX + key);
      return true;
    }
    return new Promise((resolve) => {
      try {
        raw.CloudStorage.removeItem(key, (err, ok) => resolve(!err && ok));
      } catch {
        resolve(false);
      }
    });
  },

  async keys(): Promise<string[]> {
    if (!raw) {
      return Object.keys(localStorage)
        .filter((k) => k.startsWith(LS_PREFIX))
        .map((k) => k.slice(LS_PREFIX.length));
    }
    return new Promise((resolve) => {
      try {
        raw.CloudStorage.getKeys((err, keys) => resolve(err || !keys ? [] : keys));
      } catch {
        resolve([]);
      }
    });
  },
};

// ─── экран «домой» ────────────────────────────────────────────────────────

export async function checkHomeScreen(): Promise<HomeScreenStatus> {
  if (!raw?.checkHomeScreenStatus) return 'unsupported';
  return new Promise((resolve) => {
    try {
      raw.checkHomeScreenStatus!((status) => resolve(status));
      setTimeout(() => resolve('unknown'), 1500);
    } catch {
      resolve('unsupported');
    }
  });
}

export function addToHomeScreen() {
  safe(() => raw?.addToHomeScreen?.());
}
