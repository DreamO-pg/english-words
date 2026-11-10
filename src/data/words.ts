export type Pos = 'noun' | 'verb' | 'adj' | 'adv' | 'phrase' | 'phrasal';
export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export const LEVELS: readonly Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export type Word = {
  /** совпадает с en в нижнем регистре, дефисы вместо пробелов: "figure-out" */
  id: string;
  en: string;
  /** 1–3 значения, порядок = от основного к оттенку */
  ru: string[];
  /** МФА, как в Cambridge/Oxford */
  ipa: string;
  pos: Pos;
  level: Level;
  /** тематические наборы: "it-work", "meetings", "phrasal"; может быть пусто */
  sets: string[];
  /** до 12 слов, живой, не учебный */
  exampleEn: string;
  exampleRu: string;
  collocations: string[];
  synonyms?: string[];
  /** только там, где реально есть на чём споткнуться */
  falseFriend?: string;
  /**
   * То самое ложное значение одной строкой: «магазин» для magazine.
   * Движок обязан подставить его одним из дистракторов — именно на нём
   * слово и запоминается. Заполняется всегда вместе с falseFriend.
   */
  falseFriendRu?: string;
};

export const POS_LABEL: Record<Pos, string> = {
  noun: 'сущ.',
  verb: 'глаг.',
  adj: 'прил.',
  adv: 'нареч.',
  phrase: 'выражение',
  phrasal: 'фраз. глагол',
};

export type WordSet = {
  id: string;
  title: string;
  subtitle: string;
};

export const SETS: WordSet[] = [
  { id: 'level', title: 'По уровню', subtitle: 'Частотные слова уровня' },
  { id: 'it-work', title: 'Работа и IT', subtitle: 'Про задачи, релизы, команду' },
  { id: 'meetings', title: 'Встречи', subtitle: 'Созвоны и переговоры' },
  { id: 'phrasal', title: 'Фразовые', subtitle: 'Глаголы с предлогами' },
];

import { WORDS_B1_1 } from './b1-01';
import { WORDS_B1_2 } from './b1-02';
import { WORDS_B1_3 } from './b1-03';
import { WORDS_B1_4 } from './b1-04';
import { WORDS_B1_5 } from './b1-05';
import { WORDS_B2_1 } from './b2-01';
import { WORDS_B2_2 } from './b2-02';
import { WORDS_B2_3 } from './b2-03';
import { WORDS_B2_4 } from './b2-04';
import { WORDS_B2_5 } from './b2-05';
import { WORDS_B2_6 } from './b2-06';

/** Все слова словаря — порции складываются сюда. */
export const WORDS: Word[] = [
  ...WORDS_B1_1,
  ...WORDS_B1_2,
  ...WORDS_B1_3,
  ...WORDS_B1_4,
  ...WORDS_B1_5,
  ...WORDS_B2_1,
  ...WORDS_B2_2,
  ...WORDS_B2_3,
  ...WORDS_B2_4,
  ...WORDS_B2_5,
  ...WORDS_B2_6,
];
