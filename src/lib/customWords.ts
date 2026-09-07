import type { Level, Pos, Word } from '../data/words';
import { storage } from '../telegram/webapp';

/**
 * Свои слова. Одно слово — один ключ `cw_<id>`, так проще удалять и не нужно
 * ничего резать по 4096 символов: одна запись в них влезает с запасом.
 * Помечаются набором `custom`, а в уроках участвуют наравне с остальными —
 * подбор смотрит на уровень и часть речи, а не на происхождение слова.
 */

export const CUSTOM_SET = 'custom';
const PREFIX = 'cw_';

export const isCustom = (word: Word) => word.sets.includes(CUSTOM_SET);

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
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Собираем слово из формы. Транскрипции у своих слов нет — и не надо. */
export function draftToWord(draft: CustomDraft, taken: Set<string>): Word | null {
  const en = draft.en.trim();
  const ru = draft.ru
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (!en || ru.length === 0) return null;

  let id = slugify(en);
  if (!id) return null;
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
    exampleEn: draft.exampleEn.trim(),
    exampleRu: draft.exampleRu.trim(),
    collocations: [],
  };
}

export async function loadCustomWords(): Promise<Word[]> {
  const keys = (await storage.keys()).filter((k) => k.startsWith(PREFIX));
  if (keys.length === 0) return [];
  const values = await storage.getMany(keys);

  const words: Word[] = [];
  for (const raw of Object.values(values)) {
    try {
      const word = JSON.parse(raw) as Word;
      if (word && word.id && word.en && Array.isArray(word.ru)) {
        words.push({ ...word, sets: [CUSTOM_SET] });
      }
    } catch {
      /* битую запись просто пропускаем */
    }
  }
  return words.sort((a, b) => a.en.localeCompare(b.en));
}

export async function saveCustomWord(word: Word): Promise<boolean> {
  return storage.set(PREFIX + word.id, JSON.stringify(word));
}

export async function deleteCustomWord(id: string): Promise<void> {
  await storage.remove(PREFIX + id);
}
