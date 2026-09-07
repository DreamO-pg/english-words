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

/** Слова набора и уровня, из которых вообще можно составить урок. */
export function poolFor(words: Word[], set: string, level: Level): Word[] {
  if (set === 'level') return words.filter((w) => w.level === level);
  return words.filter((w) => w.sets.includes(set));
}

/** Если слов на повторе больше этого — пропорция урока переворачивается. */
const REVIEW_FLIP = 30;

/**
 * 70% новых и давно не встречавшихся, 30% из низких box.
 * Когда повторов накопилось больше тридцати — наоборот.
 */
export function pickLessonWords(
  pool: Word[],
  progress: Progress,
  size: number,
  day = today(),
): Word[] {
  const recordOf = (w: Word): WordProgress | undefined => progress[w.level]?.[w.id];

  const fresh: Word[] = [];
  const lowBox: Word[] = [];
  const staleDue: Word[] = [];
  const resting: Word[] = [];

  for (const word of pool) {
    const record = recordOf(word);
    if (!record) fresh.push(word);
    else if (!isDue(record, day)) resting.push(word);
    else if (record.box <= 2) lowBox.push(word);
    else staleDue.push(word);
  }

  const byOverdue = (a: Word, b: Word) =>
    overdueBy(recordOf(b)!, day) - overdueBy(recordOf(a)!, day);

  const groupNew = [...shuffle(fresh), ...staleDue.sort(byOverdue)];
  const groupReview = lowBox.sort((a, b) => {
    const ra = recordOf(a)!;
    const rb = recordOf(b)!;
    return ra.box - rb.box || byOverdue(a, b);
  });

  const reviewShare = groupReview.length > REVIEW_FLIP ? 0.7 : 0.3;
  const wantReview = Math.round(size * reviewShare);

  const picked: Word[] = [
    ...groupReview.slice(0, wantReview),
    ...groupNew.slice(0, size - Math.min(wantReview, groupReview.length)),
  ];

  // Добираем из того, что осталось: сначала повторы, потом отдыхающие слова.
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

/** «Повторить ошибки» — только box 1–2. */
export function pickRepeatWords(pool: Word[], progress: Progress, size: number): Word[] {
  const low = pool.filter((w) => {
    const record = progress[w.level]?.[w.id];
    return record !== undefined && record.box <= 2;
  });
  low.sort((a, b) => progress[a.level]![a.id].box - progress[b.level]![b.id].box);
  return low.slice(0, size);
}

// ─── варианты ответа ──────────────────────────────────────────────────────

const norm = (s: string) => s.trim().toLowerCase();

/** Показываем в варианте первое значение — на карточке потом будет весь ряд. */
const optionText = (word: Word) => word.ru[0];

/**
 * Три дистрактора того же уровня и той же части речи.
 * Иначе ответ угадывается по грамматике: «прилежный» среди трёх
 * существительных виден сразу.
 */
export function buildCard(word: Word, pool: Word[], all: Word[]): LessonCard {
  const correct = optionText(word);
  const used = new Set([norm(correct)]);
  const options: string[] = [];

  // Ложный друг идёт первым: он должен попасть в четвёрку обязательно.
  if (word.falseFriendRu && !used.has(norm(word.falseFriendRu))) {
    options.push(word.falseFriendRu);
    used.add(norm(word.falseFriendRu));
  }

  const sameKind = (source: Word[]) =>
    source.filter((w) => w.id !== word.id && w.pos === word.pos && w.level === word.level);

  const candidates = [
    ...shuffle(sameKind(pool)),
    ...shuffle(sameKind(all)),
    // Запасной вариант, если слов такой части речи почему-то мало.
    ...shuffle(all.filter((w) => w.id !== word.id && w.pos === word.pos)),
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
