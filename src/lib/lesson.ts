import type { Level, Word } from '../data/words';
import { isDue, overdueBy, today, type Progress, type WordProgress } from './leitner';

/**
 * Подбор слов и вариантов ответа.
 * Ничего случайного «просто так»: дистракторы всегда того же уровня и той же
 * части речи, а у слова с ложным другом среди вариантов обязательно стоит
 * то самое ложное значение.
 */

export type LessonCard = {
  word: Word;
  /** четыре варианта перевода, уже перемешанные */
  options: string[];
  correctIndex: number;
};

export type LessonState = {
  cards: LessonCard[];
  /** индексы карточек; ошибочные попадают сюда повторно */
  queue: number[];
  position: number;
  /** сколько слов закрыто верно — это и есть прогресс урока */
  done: number;
  /** id слова → сколько раз ошибся в этом уроке */
  wrong: Record<string, number>;
};

// ─── подбор слов ──────────────────────────────────────────────────────────

const shuffle = <T,>(items: T[]): T[] => {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Слова набора и уровня, из которых вообще можно составить урок.
 * Тематический набор тоже режется по уровню — иначе переключатель уровня
 * на главной для него ничего бы не значил.
 */
export function poolFor(words: Word[], set: string, level: Level): Word[] {
  if (set === 'level') return words.filter((w) => w.level === level);
  return words.filter((w) => w.level === level && w.sets.includes(set));
}

/** Если слов на повторе больше этого — пропорция урока переворачивается. */
const REVIEW_FLIP = 30;

/**
 * 70% новых, 30% повторов. Когда повторов накопилось больше тридцати —
 * наоборот. Повторы — все слова, у которых наступил срок, любого box:
 * первыми самые просроченные, при равенстве — с меньшим box. Так давно
 * выученное слово не ждёт, пока кончатся новые.
 */
export function pickLessonWords(
  pool: Word[],
  progress: Progress,
  size: number,
  day = today(),
): Word[] {
  const recordOf = (w: Word): WordProgress | undefined => progress[w.level]?.[w.id];

  const fresh: Word[] = [];
  const due: Word[] = [];
  const resting: Word[] = [];

  for (const word of pool) {
    const record = recordOf(word);
    if (!record) fresh.push(word);
    else if (isDue(record, day)) due.push(word);
    else resting.push(word);
  }

  const groupReview = due.sort((a, b) => {
    const ra = recordOf(a)!;
    const rb = recordOf(b)!;
    return overdueBy(rb, day) - overdueBy(ra, day) || ra.box - rb.box;
  });
  const groupNew = shuffle(fresh);

  const reviewShare = groupReview.length > REVIEW_FLIP ? 0.7 : 0.3;
  const wantReview = Math.round(size * reviewShare);

  const picked: Word[] = [
    ...groupReview.slice(0, wantReview),
    ...groupNew.slice(0, size - Math.min(wantReview, groupReview.length)),
  ];

  // Добираем из того, что осталось: сначала повторы и новые, потом отдыхающие.
  // Отдыхающее слово в уроке box не повышает (см. applyAnswer) — это просто тренировка.
  if (picked.length < size) {
    const taken = new Set(picked.map((w) => w.id));
    for (const word of [...groupReview, ...groupNew, ...shuffle(resting)]) {
      if (picked.length >= size) break;
      if (taken.has(word.id)) continue;
      taken.add(word.id);
      picked.push(word);
    }
  }

  return shuffle(picked.slice(0, size));
}

// ─── варианты ответа ──────────────────────────────────────────────────────

const norm = (s: string) => s.trim().toLowerCase();

/** Показываем в варианте первое значение — на карточке потом будет весь ряд. */
const optionText = (word: Word) => word.ru[0];

/**
 * Три дистрактора того же уровня и той же части речи.
 * Иначе ответ угадывается по грамматике: «прилежный» среди трёх
 * существительных виден сразу.
 *
 * Ни один неправильный вариант не может совпадать с любым значением
 * самого слова: для benefit [польза, выгода, преимущество] вариант
 * «преимущество» от advantage был бы верным ответом, засчитанным как ошибка.
 */
export function buildCard(word: Word, pool: Word[], all: Word[]): LessonCard {
  const correct = optionText(word);
  const used = new Set(word.ru.map(norm));
  const options: string[] = [];

  // Ложный друг идёт первым: он должен попасть в четвёрку обязательно.
  if (word.falseFriendRu && !used.has(norm(word.falseFriendRu))) {
    options.push(word.falseFriendRu);
    used.add(norm(word.falseFriendRu));
  }

  const others = (source: Word[]) => source.filter((w) => w.id !== word.id);
  const sameKind = (source: Word[]) =>
    others(source).filter((w) => w.pos === word.pos && w.level === word.level);

  const candidates = [
    ...shuffle(sameKind(pool)),
    ...shuffle(sameKind(all)),
    // Запасной вариант, если слов такой части речи и уровня мало.
    ...shuffle(others(all).filter((w) => w.pos === word.pos)),
    // Последний запас: своё слово редкой части речи (например, «выражение»,
    // которых в словаре нет) не должно остаться с одним вариантом.
    ...shuffle(others(all)),
  ];

  for (const candidate of candidates) {
    if (options.length >= 3) break;
    const text = optionText(candidate);
    if (used.has(norm(text))) continue;
    used.add(norm(text));
    options.push(text);
  }

  const all4 = shuffle([correct, ...options.slice(0, 3)]);
  return { word, options: all4, correctIndex: all4.indexOf(correct) };
}

// ─── урок ─────────────────────────────────────────────────────────────────

export function createLesson(words: Word[], pool: Word[], all: Word[]): LessonState {
  return {
    cards: words.map((w) => buildCard(w, pool, all)),
    queue: words.map((_, i) => i),
    position: 0,
    done: 0,
    wrong: {},
  };
}

export const currentCard = (state: LessonState): LessonCard | undefined =>
  state.cards[state.queue[state.position]];

/** Ошибся — слово возвращается через две-три карточки, внутри того же урока. */
export function answerCard(state: LessonState, correct: boolean): LessonState {
  const cardIndex = state.queue[state.position];
  const card = state.cards[cardIndex];
  if (!card) return state;

  const queue = state.queue.slice();
  const wrong = { ...state.wrong };

  if (!correct) {
    wrong[card.word.id] = (wrong[card.word.id] ?? 0) + 1;
    const gap = 2 + Math.floor(Math.random() * 2);
    queue.splice(Math.min(state.position + gap, queue.length), 0, cardIndex);
  }

  return {
    ...state,
    queue,
    position: state.position + 1,
    done: state.done + (correct ? 1 : 0),
    wrong,
  };
}

export const isLessonOver = (state: LessonState) => state.position >= state.queue.length;

/** Слова, в которых ошиблись — для разбора на экране итога. */
export const lessonMistakes = (state: LessonState): Word[] =>
  state.cards.filter((c) => state.wrong[c.word.id]).map((c) => c.word);
