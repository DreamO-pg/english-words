/** Минимальные типы того, чем мы реально пользуемся из telegram-web-app.js. */

export type HomeScreenStatus = 'unsupported' | 'unknown' | 'added' | 'missed';

export interface TelegramCloudStorage {
  getItem(key: string, cb: (err: string | null, value: string | null) => void): void;
  getItems(keys: string[], cb: (err: string | null, values: Record<string, string> | null) => void): void;
  setItem(key: string, value: string, cb?: (err: string | null, ok: boolean) => void): void;
  removeItem(key: string, cb?: (err: string | null, ok: boolean) => void): void;
  removeItems(keys: string[], cb?: (err: string | null, ok: boolean) => void): void;
  getKeys(cb: (err: string | null, keys: string[] | null) => void): void;
}

export interface TelegramHaptic {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  selectionChanged(): void;
}

export interface TelegramBackButton {
  isVisible: boolean;
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

export interface TelegramWebApp {
  version: string;
  platform: string;
  viewportHeight: number;
  viewportStableHeight: number;
  isExpanded: boolean;
  ready(): void;
  expand(): void;
  close(): void;
  isVersionAtLeast(version: string): boolean;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  disableVerticalSwipes?(): void;
  /** 7.10+ */
  setBottomBarColor?(color: string): void;
  /** 6.2+ */
  showConfirm(message: string, cb?: (ok: boolean) => void): void;
  /** 6.2+ */
  enableClosingConfirmation(): void;
  /** 6.2+ */
  disableClosingConfirmation(): void;
  onEvent(event: string, cb: (...args: unknown[]) => void): void;
  offEvent(event: string, cb: (...args: unknown[]) => void): void;
  BackButton: TelegramBackButton;
  HapticFeedback: TelegramHaptic;
  CloudStorage: TelegramCloudStorage;
  checkHomeScreenStatus?(cb: (status: HomeScreenStatus) => void): void;
  addToHomeScreen?(): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}
