import { WORDS, POS_LABEL } from '../.cache/words.mjs';

const problems = [];
const warn = [];
const ids = new Set();
const byLevelPos = {};
// дифтонг считаем одним слогом, иначе односложные crowd/vague ложно попадают в ошибки
const diphthongs = /aʊ|aɪ|eɪ|əʊ|ɔɪ|ɪə|eə|ʊə/g;
const vowels = /[aeiouɪʊəɜɔɑʌæɒɛ]/g;
const syllables = (ipa) => (ipa.replace(diphthongs, 'D').match(/[Daeiouɪʊəɜɔɑʌæɒɛ]/g) || []).length;

for (const w of WORDS) {
  const expectedId = w.en.toLowerCase().replace(/\s+/g, '-');
  if (w.id !== expectedId) problems.push(`id ≠ en: ${w.id} / ${w.en}`);
  if (ids.has(w.id)) problems.push(`дубль id: ${w.id}`);
  ids.add(w.id);
  if (!/^\/.+\/$/.test(w.ipa)) problems.push(`ipa не в слэшах: ${w.id}`);
  const syll = syllables(w.ipa);
  if (syll > 1 && !/[ˈ]/.test(w.ipa)) problems.push(`нет главного ударения: ${w.id} ${w.ipa}`);
  if (!POS_LABEL[w.pos]) problems.push(`неизвестная часть речи: ${w.id}`);
  if (w.ru.length < 1 || w.ru.length > 3) problems.push(`ru не 1–3 значения: ${w.id}`);
  const n = w.exampleEn.split(/\s+/).length;
  if (n > 12) problems.push(`пример длиннее 12 слов (${n}): ${w.id}`);
  if (!w.exampleRu.trim()) problems.push(`нет перевода примера: ${w.id}`);
  if (!w.collocations.length) problems.push(`нет сочетаемости: ${w.id}`);
  if (w.falseFriend && w.falseFriend.length > 160) problems.push(`ложный друг длиннее 160 символов: ${w.id}`);
  if (Boolean(w.falseFriend) !== Boolean(w.falseFriendRu))
    problems.push(`falseFriend и falseFriendRu должны идти парой: ${w.id}`);
  const stem = w.en.split(' ')[0].slice(0, 4).toLowerCase();
  if (!w.exampleEn.toLowerCase().includes(stem)) warn.push(`слово не в начальной форме в примере: ${w.id} — «${w.exampleEn}»`);
  const k = `${w.level} ${w.pos}`;
  byLevelPos[k] = (byLevelPos[k] || 0) + 1;
}

console.log('всего слов:', WORDS.length);
console.log('по уровню и части речи:');
for (const [k, v] of Object.entries(byLevelPos).sort()) {
  console.log(`  ${k.padEnd(12)} ${v}${v < 4 ? '  ← меньше 4, не хватит на дистракторы' : ''}`);
}
const ff = WORDS.filter((w) => w.falseFriend);
console.log(`ложных друзей: ${ff.length} — ${ff.map((w) => w.en).join(', ')}`);
console.log('в наборах:', ['it-work','meetings','phrasal'].map(s => `${s}=${WORDS.filter(w=>w.sets.includes(s)).length}`).join('  '));
console.log('с синонимами:', WORDS.filter(w=>w.synonyms?.length).length);
const maxEx = Math.max(...WORDS.map(w=>w.exampleEn.split(/\s+/).length));
console.log('самый длинный пример, слов:', maxEx);
if (warn.length) console.log('\nВНИМАНИЕ (не ошибка):\n' + warn.join('\n'));
console.log(problems.length ? '\nПРОБЛЕМЫ:\n' + problems.join('\n') : '\nпроблем нет');
