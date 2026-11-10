import { LEVELS, POS_LABEL, type Level, type Pos, type Word } from '../data/words';
import { MAX_VALUE, storage } from '../telegram/webapp';

/**
 * Свои слова. Одно слово — один ключ `cw_<id>`, так проще удалять и не нужно
 * ничего резать по 4096 символов: одна запись в них влезает с запасом.
 * Помечаются набором `custom`, а в уроках участвуют наравне с остальными —
 * подбор смотрит на уровень и часть речи, а не на происхождение слова.
 */

export const CUSTOM_SET = 'custom';
const PREFIX = 'cw_';

export const isCustom = (word: Word) => word.sets.includes(CUSTOM_SET);

/** Длины полей формы. С ними запись слова гарантированно меньше 4096 символов. */
export const LIMITS = { en: 60, ru: 120, example: 200 } as const;
/** Ключ CloudStorage до 128 символов: `cw_` + id не длиннее этого. */
const MAX_ID = 64;


export type CustomDraft = {
  en: string;
  ru: string;
  exampleEn: string;
  exampleRu: string;
  pos: Pos;
  level: Level;
};

export function slugify(en: string): string {
  return en
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // naïve → naive
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_ID - 8)
    .replace(/-$/, '');
}

/** Собираем слово из формы. Транскрипции у своих слов нет — и не надо. */
export function draftToWord(draft: CustomDraft, taken: Set<string>): Word | null {
  const en = draft.en.trim().slice(0, LIMITS.en);
  const ru = draft.ru
    .slice(0, LIMITS.ru)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (!en || ru.length === 0) return null;

  // Без латиницы slug пустой — тогда id из времени, а не молчаливый отказ.
  let id = slugify(en) || `w-${Date.now().toString(36)}`;
  if (taken.has(id)) {
    let i = 2;
    while (taken.has(`${id}-${i}`)) i++;
    id = `${id}-${i}`;
  }

  return {
    id,
    en,
    ru,
    ipa: '',
    pos: draft.pos,
    level: draft.level,
    sets: [CUSTOM_SET],
    exampleEn: draft.exampleEn.trim().slice(0, LIMITS.example),
    exampleRu: draft.exampleRu.trim().slice(0, LIMITS.example),
    collocations: [],
  };
}

export async function loadCustomWords(): Promise<Word[]> {
  const keys = (await storage.keys()).filter((k) => k.startsWith(PREFIX));
  if (keys.length === 0) return [];
  const values = await storage.getMany(keys);

  const words: Word[] = [];
  for (const raw of Object.values(values)) {
    const word = parseCustomWord(raw);
    if (word) words.push(word);
  }
  return words.sort((a, b) => a.en.localeCompare(b.en));
}

const isStr = (v: unknown): v is string => typeof v === 'string';

/**
 * Запись из хранилища приводим к форме Word полностью: с кривой частью речи
 * или уровнем слово дальше уронило бы рендер. Битую запись пропускаем.
 */
export function parseCustomWord(raw: string): Word | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const { id, en, ru, pos, level } = data;
  if (!isStr(id) || !/^[a-z0-9-]{1,64}$/.test(id) || !isStr(en) || !en.trim()) return null;
  if (!Array.isArray(ru) || !ru.every(isStr) || ru.length === 0) return null;
  if (!isStr(pos) || !(pos in POS_LABEL)) return null;
  if (!isStr(level) || !LEVELS.includes(level as Level)) return null;
  return {
    id,
    en,
    ru: ru.slice(0, 3),
    ipa: '',
    pos: pos as Pos,
    level: level as Level,
    sets: [CUSTOM_SET],
    exampleEn: isStr(data.exampleEn) ? data.exampleEn : '',
    exampleRu: isStr(data.exampleRu) ? data.exampleRu : '',
    collocations: [],
  };
}

/** Бросает StorageError, если записать не удалось. */
export async function saveCustomWord(word: Word): Promise<void> {
  const value = JSON.stringify(word);
  if (value.length > MAX_VALUE) throw new Error('слово слишком длинное');
  await storage.set(PREFIX + word.id, value);
}

/** Бросает StorageError, если удалить не удалось. */
export async function deleteCustomWord(id: string): Promise<void> {
  await storage.remove(PREFIX + id);
}
