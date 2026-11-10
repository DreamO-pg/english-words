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

/**
 * Клиент поддерживает этот метод? На старых клиентах SDK на неподдержанный
 * метод пишет в консоль ошибку или бросает — поэтому сначала спрашиваем версию.
 */
function since(version: string): boolean {
  if (!raw) return false;
  try {
    return raw.isVersionAtLeast(version);
  } catch {
    return false;
  }
}

/**
 * Минимальная версия, с которой приложение работает полноценно: 6.9 —
 * это CloudStorage. Ниже прогресс сохранять некуда, и честнее сказать
 * «обновите Telegram», чем молча терять уроки.
 */
export const MIN_VERSION = '6.9';
export const isOutdatedClient = Boolean(raw) && !since(MIN_VERSION);
export const clientVersion = raw?.version ?? '';

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
  if (since('7.7')) safe(() => raw.disableVerticalSwipes?.());
  // Тема фиксированно светлая, themeParams пользователя игнорируем.
  // Цвет шапки hex-строкой — с 6.9, раньше только ключи темы.
  if (since('6.9')) safe(() => raw.setHeaderColor(colors.bg));
  if (since('6.1')) safe(() => raw.setBackgroundColor(colors.bg));
  // Нижняя полоса (Android, iOS) иначе остаётся цвета темы — тёмной в тёмной теме.
  if (since('7.10')) safe(() => raw.setBottomBarColor?.(colors.bg));

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
  if (!since('6.1')) return () => {};
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

const hapticOk = () => since('6.1');

export const haptic = {
  success() {
    if (hapticOk()) safe(() => raw?.HapticFeedback.notificationOccurred('success'));
  },
  error() {
    if (hapticOk()) safe(() => raw?.HapticFeedback.notificationOccurred('error'));
  },
  select() {
    if (hapticOk()) safe(() => raw?.HapticFeedback.selectionChanged());
  },
  tap() {
    if (hapticOk()) safe(() => raw?.HapticFeedback.impactOccurred('light'));
  },
};

// ─── подтверждения ────────────────────────────────────────────────────────

/** Нативный диалог «ОК / Отмена»; в браузере и на старых клиентах — window.confirm. */
export function confirmAction(message: string): Promise<boolean> {
  if (raw && since('6.2')) {
    return new Promise((resolve) => {
      try {
        raw.showConfirm(message, (ok) => resolve(Boolean(ok)));
      } catch {
        resolve(window.confirm(message));
      }
    });
  }
  return Promise.resolve(window.confirm(message));
}

/** Спрашивать ли «закрыть?» при сворачивании окна — включаем на время урока. */
export function setClosingConfirmation(on: boolean) {
  if (!raw || !since('6.2')) return;
  safe(() => (on ? raw.enableClosingConfirmation() : raw.disableClosingConfirmation()));
}

// ─── хранилище ────────────────────────────────────────────────────────────

const LS_PREFIX = 'ew:';

/** Лимиты CloudStorage: ключ 1–128 символов из A-Z a-z 0-9 _ -, значение до 4096. */
export const MAX_KEY = 128;
export const MAX_VALUE = 4096;
const KEY_RE = /^[A-Za-z0-9_-]{1,128}$/;

/** Ответ не пришёл за это время — считаем сбоем, а не пустотой. */
const TIMEOUT_MS = 8000;
const ATTEMPTS = 3;

/**
 * Любой сбой хранилища — ошибка, а не «пусто». Пустой ответ и упавший запрос
 * должны различаться: иначе после сбоя чтения приложение решит, что прогресса
 * нет, и следующее сохранение перезапишет облако.
 */
export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Колбэк CloudStorage → промис с таймаутом. */
function cloudCall<T>(fn: (done: (err: string | null, value: T) => void) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new StorageError('timeout')), TIMEOUT_MS);
    try {
      fn((err, value) => {
        clearTimeout(timer);
        if (err) reject(new StorageError(String(err)));
        else resolve(value);
      });
    } catch (e) {
      clearTimeout(timer);
      reject(new StorageError(e instanceof Error ? e.message : String(e)));
    }
  });
}

/** Сеть в телеграме бывает плохой — пара повторов с паузой. */
async function withRetry<T>(op: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      return await op();
    } catch (e) {
      last = e;
      if (i < ATTEMPTS - 1) await sleep(300 * 2 ** i);
    }
  }
  throw last instanceof StorageError ? last : new StorageError(String(last));
}

/** localStorage тоже может бросить: приватный режим, запрет хранилища. */
function local<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    throw new StorageError(e instanceof Error ? e.message : String(e));
  }
}

function assertWritable(key: string, value?: string) {
  if (!KEY_RE.test(key)) throw new StorageError(`недопустимый ключ: ${key.slice(0, 40)}`);
  if (value !== undefined && value.length > MAX_VALUE) {
    throw new StorageError(`значение ключа ${key} длиннее ${MAX_VALUE} символов`);
  }
}

/**
 * CloudStorage: до 1024 ключей, значение до 4096 символов.
 * В браузере — localStorage с тем же интерфейсом.
 * Все методы при сбое бросают StorageError.
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    if (!raw) return local(() => localStorage.getItem(LS_PREFIX + key));
    return withRetry(() =>
      cloudCall<string | null>((done) => raw.CloudStorage.getItem(key, done)),
    ).then((v) => (v === '' || v === undefined ? null : v));
  },

  async getMany(keys: string[]): Promise<Record<string, string>> {
    if (keys.length === 0) return {};
    if (!raw) {
      return local(() => {
        const out: Record<string, string> = {};
        for (const k of keys) {
          const v = localStorage.getItem(LS_PREFIX + k);
          if (v !== null) out[k] = v;
        }
        return out;
      });
    }
    const values = await withRetry(() =>
      cloudCall<Record<string, string> | null>((done) => raw.CloudStorage.getItems(keys, done)),
    );
    if (!values) throw new StorageError('getItems вернул пустой ответ');
    const out: Record<string, string> = {};
    for (const k of keys) if (values[k]) out[k] = values[k];
    return out;
  },

  async set(key: string, value: string): Promise<void> {
    assertWritable(key, value);
    if (!raw) return local(() => localStorage.setItem(LS_PREFIX + key, value));
    const ok = await withRetry(() =>
      cloudCall<boolean>((done) => raw.CloudStorage.setItem(key, value, done)),
    );
    if (!ok) throw new StorageError(`setItem(${key}) не подтверждён`);
  },

  async remove(key: string): Promise<void> {
    assertWritable(key);
    if (!raw) return local(() => localStorage.removeItem(LS_PREFIX + key));
    const ok = await withRetry(() =>
      cloudCall<boolean>((done) => raw.CloudStorage.removeItem(key, done)),
    );
    if (!ok) throw new StorageError(`removeItem(${key}) не подтверждён`);
  },

  async keys(): Promise<string[]> {
    if (!raw) {
      return local(() =>
        Object.keys(localStorage)
          .filter((k) => k.startsWith(LS_PREFIX))
          .map((k) => k.slice(LS_PREFIX.length)),
      );
    }
    const keys = await withRetry(() =>
      cloudCall<string[] | null>((done) => raw.CloudStorage.getKeys(done)),
    );
    if (!keys) throw new StorageError('getKeys вернул пустой ответ');
    return keys;
  },
};

// ─── экран «домой» ────────────────────────────────────────────────────────

export async function checkHomeScreen(): Promise<HomeScreenStatus> {
  if (!raw?.checkHomeScreenStatus || !since('8.0')) return 'unsupported';
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
  if (since('8.0')) safe(() => raw?.addToHomeScreen?.());
}

/**
 * Приложение действительно добавили на экран (8.0). Нажатие «Добавить»
 * само по себе ничего не значит: пользователь может отменить системный диалог.
 */
export function onHomeScreenAdded(cb: () => void): () => void {
  if (!raw || !since('8.0')) return () => {};
  safe(() => raw.onEvent('homeScreenAdded', cb));
  return () => safe(() => raw.offEvent('homeScreenAdded', cb));
}
