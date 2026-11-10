// Точка входа только для scripts/check-storage.mjs — в приложение не попадает.
export { storage, StorageError } from '../src/telegram/webapp';
export * from '../src/lib/progress';
export * from '../src/lib/sync';
export { draftToWord, parseCustomWord, slugify, saveCustomWord } from '../src/lib/customWords';
