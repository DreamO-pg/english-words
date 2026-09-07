import type { Level } from '../data/words';
import { storage } from '../telegram/webapp';
import type { LevelProgress, Progress } from './leitner';

/**
 * Хранение прогресса в CloudStorage.
 *
 * Формат значения — как договорились:
 *   diligent:4:0:1738;eventually:1:3:1740
 * слово : box Лейтнера : число ошибок : день последнего показа.
 *
 * Ключ на уровень: progress_a1 … progress_c1. Значение ограничено 4096
 * символами, а слов на уровне уже больше двухсот, поэтому при переполнении
 * заводим продолжение: progress_b1_1, progress_b1_2 и так далее.
 * Читаем всё разом через getKeys + getItems — два обращения, не двести.
 */

const MAX_VALUE = 4096;
const PREFIX = 'progress_';
const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

const baseKey = (level: Level) => `${PREFIX}${level.toLowerCase()}`;
const shardKey = (level: Level, i: number) => (i === 0 ? baseKey(level) : `${baseKey(level)}_${i}`);

/** Все ключи, которые могут принадлежать этому уровню. */
function levelOfKey(key: string): Level | null {
  if (!key.startsWith(PREFIX)) return null;
  const rest = key.slice(PREFIX.length).split('_')[0];
  return LEVELS.find((l) => l.toLowerCase() === rest) ?? null;
}

export function parseLevelProgress(raw: string): LevelProgress {
  const out: LevelProgress = {};
  for (const chunk of raw.split(';')) {
    if (!chunk) continue;
    const parts = chunk.split(':');
    // Битую запись отбрасываем целиком: лучше потерять одно слово,
    // чем сделать вид, что его показывали в нулевой день.
    if (parts.length !== 4) continue;
    const [id, box, errors, lastDay] = parts;
    if (!id || !isNumeric(box) || !isNumeric(errors) || !isNumeric(lastDay)) continue;
    out[id] = {
      box: clampBox(Number(box)),
      errors: Math.max(0, Math.round(Number(errors))),
      lastDay: Math.round(Number(lastDay)),
    };
  }
  return out;
}

const isNumeric = (s: string) => s !== '' && Number.isFinite(Number(s));

const clampBox = (n: number) => (Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : 1);

/** Режем прогресс уровня на куски не длиннее 4096 символов. */
export function serializeLevelProgress(progress: LevelProgress): string[] {
  const parts = Object.entries(progress).map(
    ([id, p]) => `${id}:${p.box}:${Math.min(99, p.errors)}:${p.lastDay}`,
  );
  const chunks: string[] = [];
  let current = '';
  for (const part of parts) {
    const next = current ? `${current};${part}` : part;
    if (next.length > MAX_VALUE) {
      chunks.push(current);
      current = part;
    } else {
      current = next;
    }
  }
  if (current || chunks.length === 0) chunks.push(current);
  return chunks;
}

export async function loadProgress(): Promise<Progress> {
  const keys = (await storage.keys()).filter((k) => levelOfKey(k) !== null);
  if (keys.length === 0) return {};
  const values = await storage.getMany(keys);

  const progress: Progress = {};
  for (const key of keys) {
    const level = levelOfKey(key);
    const raw = values[key];
    if (!level || !raw) continue;
    progress[level] = { ...(progress[level] ?? {}), ...parseLevelProgress(raw) };
  }
  return progress;
}

/**
 * Пишем только те уровни, которые тронул урок, и только в конце урока.
 * Хвостовые шарды, ставшие ненужными, чистим — иначе при удалении слов
 * останутся висеть старые записи.
 */
export async function saveLevelProgress(level: Level, progress: LevelProgress): Promise<void> {
  const chunks = serializeLevelProgress(progress);
  await Promise.all(chunks.map((value, i) => storage.set(shardKey(level, i), value)));

  const stale = (await storage.keys()).filter((key) => {
    if (levelOfKey(key) !== level) return false;
    const suffix = key.slice(baseKey(level).length);
    const index = suffix === '' ? 0 : Number(suffix.slice(1));
    return Number.isFinite(index) && index >= chunks.length;
  });
  await Promise.all(stale.map((key) => storage.remove(key)));
}

export async function saveProgress(progress: Progress, levels: Level[]): Promise<void> {
  for (const level of levels) {
    await saveLevelProgress(level, progress[level] ?? {});
  }
}
