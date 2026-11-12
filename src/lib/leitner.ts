import type { Level } from '../data/words';

/**
 * Система Лейтнера: box 1–5, интервал растёт.
 * Ошибся → box = 1 и слово возвращается внутри того же урока.
 * Верно → box + 1, следующий показ через INTERVALS[box - 1] дней.
 */
export const INTERVALS = [1, 3, 7, 16, 35] as const;
export const MAX_BOX = 5;

/** День считаем от 2020-01-01 — влезает в 4 цифры и читается в отладке. */
const DAY_EPOCH = Date.UTC(2020, 0, 1);
const DAY_MS = 86_400_000;

/**
 * Номер дня по местному времени: в Москве день меняется в полночь,
 * а не в 03:00, как было бы по UTC. Урок в час ночи — это ещё сегодня
 * для серии, но уже «новый день» по календарю пользователя.
 * `offsetMinutes` — как у Date#getTimezoneOffset (для Москвы −180).
 */
export function dayOf(ms: number, offsetMinutes: number): number {
  return Math.floor((ms - offsetMinutes * 60_000 - DAY_EPOCH) / DAY_MS);
}

export function today(): number {
  const now = new Date();
  return dayOf(now.getTime(), now.getTimezoneOffset());
}

export type WordProgress = {
  /** 1–5 */
  box: number;
  /** сколько раз ошибся за всё время */
  errors: number;
  /** день последнего показа */
  lastDay: number;
};

/** Прогресс одного уровня: id слова → запись. */
export type LevelProgress = Record<string, WordProgress>;
/** Весь прогресс, разложенный по уровням — так же, как в CloudStorage. */
export type Progress = Partial<Record<Level, LevelProgress>>;

export function isDue(p: WordProgress, day = today()): boolean {
  return day - p.lastDay >= INTERVALS[p.box - 1];
}

/** На сколько дней просрочен показ. Отрицательное — ещё рано. */
export function overdueBy(p: WordProgress, day = today()): number {
  return day - p.lastDay - INTERVALS[p.box - 1];
}

export function applyAnswer(
  prev: WordProgress | undefined,
  correct: boolean,
  day = today(),
): WordProgress {
  const errors = prev?.errors ?? 0;
  if (!correct) return { box: 1, errors: errors + 1, lastDay: day };
  // Срок ещё не наступил — слово показали раньше времени (добор урока,
  // повтор ошибок). Верный ответ сейчас ничего не говорит о долгой памяти:
  // box и дату не трогаем, иначе слово дошло бы до «знаю» за один вечер.
  if (prev && !isDue(prev, day)) return prev;
  // Новое слово считаем лежащим в box 1: угадал с первого раза — сразу box 2,
  // иначе верный ответ и ошибка давали бы одно и то же, а по легенде точек
  // одна красная — это «только ошибся».
  const box = Math.min(MAX_BOX, (prev?.box ?? 1) + 1);
  return { box, errors, lastDay: day };
}

/** Кружки усвоения на карточке слова. */
export function boxTone(box: number): 'bad' | 'warm' | 'accent' | 'ok' {
  if (box <= 1) return 'bad';
  if (box === 2) return 'warm';
  if (box <= 4) return 'accent';
  return 'ok';
}
