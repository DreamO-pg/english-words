import type { Level } from '../data/words';
import { storage } from '../telegram/webapp';

export type Settings = {
  set: string;
  level: Level;
  lessonSize: 10 | 20 | 30;
  /** предложение добавить на домашний экран уже закрывали */
  homeScreenHidden?: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  set: 'level',
  level: 'B1',
  lessonSize: 20,
};

const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const raw = await storage.get(KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await storage.set(KEY, JSON.stringify(s));
}
