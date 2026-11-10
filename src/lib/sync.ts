import type { Level } from '../data/words';
import type { LevelProgress, Progress } from './leitner';
import { mergeLevelProgress, saveLevelProgress } from './progress';
import { saveSettings, type Settings } from './settings';
import { saveStats, type Stats } from './stats';

/**
 * Очередь записи в облако.
 *
 * Всё, что нужно сохранить, сначала кладётся в «ожидающие» — в памяти и
 * копией в localStorage устройства. Потом очередь по одному пишет это в
 * CloudStorage. Запись не удалась — данные остаются в ожидающих: их
 * досылает следующая попытка, даже если приложение закрыли и открыли снова.
 *
 * Записи идут строго по одной, поэтому два быстрых урока подряд не
 * перехлёстываются, а прогресс уровня перед записью сливается с облаком.
 */

type PendingLevel = { progress: LevelProgress; removed: string[]; seq: number };

type Pending = {
  levels: Partial<Record<Level, PendingLevel>>;
  stats?: { value: Stats; seq: number };
  settings?: { value: Settings; seq: number };
};

/** Отдельный префикс: не должен попасть в storage.keys() браузерного фолбэка. */
const PENDING_KEY = 'ew-sync:pending';

let pending: Pending = readPending();
/** Счётчик продолжаем с сохранённых значений, иначе после перезапуска номера совпадут. */
let seq = maxSeq(pending);
let chain: Promise<unknown> = Promise.resolve();

function readPending(): Pending {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return { levels: {} };
    const parsed = JSON.parse(raw) as Pending;
    return { levels: parsed.levels ?? {}, stats: parsed.stats, settings: parsed.settings };
  } catch {
    return { levels: {} };
  }
}

function maxSeq(p: Pending): number {
  const all = [
    ...Object.values(p.levels).map((e) => e?.seq ?? 0),
    p.stats?.seq ?? 0,
    p.settings?.seq ?? 0,
  ];
  return Math.max(0, ...all.filter(Number.isFinite));
}

function writePending() {
  try {
    if (isEmpty()) localStorage.removeItem(PENDING_KEY);
    else localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* копия на устройстве — подстраховка; без неё очередь всё равно работает */
  }
}

function isEmpty(): boolean {
  return Object.keys(pending.levels).length === 0 && !pending.stats && !pending.settings;
}

export const hasPending = () => !isEmpty();

/** Несохранённое с прошлого запуска — его надо наложить поверх прочитанного из облака. */
export function pendingSnapshot(): {
  progress: Progress;
  removed: Partial<Record<Level, string[]>>;
  stats?: Stats;
  settings?: Settings;
} {
  const progress: Progress = {};
  const removed: Partial<Record<Level, string[]>> = {};
  for (const [level, entry] of Object.entries(pending.levels) as [Level, PendingLevel][]) {
    progress[level] = entry.progress;
    removed[level] = entry.removed;
  }
  return { progress, removed, stats: pending.stats?.value, settings: pending.settings?.value };
}

/** Положить изменения в очередь. Уровень передаётся целиком — как он сейчас в памяти. */
export function enqueue(change: {
  levels?: Partial<Record<Level, LevelProgress>>;
  removed?: Partial<Record<Level, string[]>>;
  stats?: Stats;
  settings?: Settings;
}) {
  const levels = new Set<Level>([
    ...(Object.keys(change.levels ?? {}) as Level[]),
    ...(Object.keys(change.removed ?? {}) as Level[]),
  ]);
  for (const level of levels) {
    const prev = pending.levels[level];
    const removed = [...(prev?.removed ?? []), ...(change.removed?.[level] ?? [])];
    const progress = change.levels?.[level] ?? prev?.progress ?? {};
    pending.levels[level] = { progress, removed: [...new Set(removed)], seq: ++seq };
  }
  if (change.stats) pending.stats = { value: change.stats, seq: ++seq };
  if (change.settings) pending.settings = { value: change.settings, seq: ++seq };
  writePending();
}

export type FlushResult = {
  ok: boolean;
  /** что получилось в облаке после слияния — его стоит влить в память */
  merged: Progress;
};

/** Отправить ожидающее. Вызовы встают в очередь и не пересекаются. */
export function flush(): Promise<FlushResult> {
  const run = chain.then(doFlush, doFlush);
  chain = run.catch(() => undefined);
  return run;
}

async function doFlush(): Promise<FlushResult> {
  const merged: Progress = {};
  let ok = true;

  for (const level of Object.keys(pending.levels) as Level[]) {
    const entry = pending.levels[level];
    if (!entry) continue;
    try {
      merged[level] = await saveLevelProgress(level, entry.progress, entry.removed);
      // За время записи уровень могли поменять снова — тогда оставляем в очереди.
      if (pending.levels[level]?.seq === entry.seq) delete pending.levels[level];
      writePending();
    } catch {
      ok = false;
    }
  }

  const stats = pending.stats;
  if (stats) {
    try {
      await saveStats(stats.value);
      if (pending.stats?.seq === stats.seq) pending.stats = undefined;
      writePending();
    } catch {
      ok = false;
    }
  }

  const settings = pending.settings;
  if (settings) {
    try {
      await saveSettings(settings.value);
      if (pending.settings?.seq === settings.seq) pending.settings = undefined;
      writePending();
    } catch {
      ok = false;
    }
  }

  return { ok, merged };
}

/**
 * Влить в память результат записи: свежие записи с других устройств
 * подтягиваются, но то, что изменилось в памяти за время записи, не теряется.
 */
export function absorb(
  current: Progress,
  merged: Progress,
  removed: Partial<Record<Level, string[]>> = {},
): Progress {
  const next: Progress = { ...current };
  for (const level of Object.keys(merged) as Level[]) {
    next[level] = mergeLevelProgress(merged[level] ?? {}, current[level] ?? {}, removed[level]);
  }
  return next;
}

/** Только для проверок: сбросить состояние модуля. */
export function __resetForTests() {
  pending = readPending();
  seq = maxSeq(pending);
  chain = Promise.resolve();
}
