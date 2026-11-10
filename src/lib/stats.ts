import type { Word } from '../data/words';
import { storage } from '../telegram/webapp';
import { isDue, today, type Progress } from './leitner';

/** Счётчики и история последних двадцати уроков — один ключ `stats`. */
export type LessonRecord = {
  /** день от 2020-01-01 */
  d: number;
  /** слов в уроке */
  n: number;
  /** сколько закрыл с первого раза */
  ok: number;
};

export type Stats = {
  lessons: number;
  /** всего ответов за всё время (включая повторные показы ошибок) */
  answers: number;
  /** из них верных — доля correct / answers и есть точность */
  correct: number;
  streak: number;
  bestStreak: number;
  lastDay: number;
  history: LessonRecord[];
};

export const EMPTY_STATS: Stats = {
  lessons: 0,
  answers: 0,
  correct: 0,
  streak: 0,
  bestStreak: 0,
  lastDay: 0,
  history: [],
};

const KEY = 'stats';
const HISTORY_LIMIT = 20;

export async function loadStats(): Promise<Stats> {
  const raw = await storage.get(KEY);
  if (!raw) return EMPTY_STATS;
  try {
    return { ...EMPTY_STATS, ...(JSON.parse(raw) as Partial<Stats>) };
  } catch {
    return EMPTY_STATS;
  }
}

export async function saveStats(stats: Stats): Promise<void> {
  await storage.set(KEY, JSON.stringify(stats));
}

/**
 * Итог урока. Две разные меры, и путать их нельзя:
 * firstTry — сколько слов закрыто с первого раза (это кольцо на экране итога
 * и `ok` в истории), answers / wrongAnswers — все ответы и ошибочные из них.
 */
export type LessonOutcome = {
  size: number;
  firstTry: number;
  answers: number;
  wrongAnswers: number;
};

/** Считаем урок закрытым: обновляем серию дней и историю. */
export function recordLesson(stats: Stats, lesson: LessonOutcome, day = today()): Stats {
  const streak =
    stats.lastDay === day ? stats.streak : day - stats.lastDay === 1 ? stats.streak + 1 : 1;

  const history = [...stats.history, { d: day, n: lesson.size, ok: lesson.firstTry }].slice(
    -HISTORY_LIMIT,
  );

  return {
    lessons: stats.lessons + 1,
    answers: stats.answers + lesson.answers,
    correct: stats.correct + (lesson.answers - lesson.wrongAnswers),
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    lastDay: day,
    history,
  };
}

/** Серия рвётся, если вчера и сегодня уроков не было. */
export function currentStreak(stats: Stats, day = today()): number {
  if (stats.lastDay === day || day - stats.lastDay === 1) return stats.streak;
  return 0;
}

export type Summary = {
  known: number;
  learning: number;
  due: number;
  fresh: number;
  streak: number;
};

export function summarize(
  pool: Word[],
  progress: Progress,
  stats: Stats,
  day = today(),
): Summary {
  let known = 0;
  let learning = 0;
  let due = 0;
  let fresh = 0;

  for (const word of pool) {
    const record = progress[word.level]?.[word.id];
    if (!record) {
      fresh++;
      continue;
    }
    if (record.box >= 5) known++;
    else learning++;
    if (isDue(record, day)) due++;
  }

  return { known, learning, due, fresh, streak: currentStreak(stats, day) };
}
