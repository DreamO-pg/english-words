import {
  WORDS,
  buildCard,
  createLesson,
  answerCard,
  currentCard,
  isLessonOver,
  lessonMistakes,
  pickLessonWords,
  pickRepeatWords,
  poolFor,
  applyAnswer,
  isDue,
  INTERVALS,
  parseLevelProgress,
  serializeLevelProgress,
  recordLesson,
  EMPTY_STATS,
  summarize,
} from '../.cache/engine.mjs';

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) {
    failed++;
    console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`);
  } else {
    console.log(`  ✓ ${name}`);
  }
};

const byId = Object.fromEntries(WORDS.map((w) => [w.id, w]));

console.log('\nдистракторы');
{
  let sameKind = 0;
  let checked = 0;
  const bad = [];
  for (const word of WORDS) {
    const pool = WORDS.filter((w) => w.level === word.level);
    const card = buildCard(word, pool, WORDS);
    checked++;
    if (card.options.length !== 4) bad.push(`${word.id}: вариантов ${card.options.length}`);
    if (new Set(card.options.map((o) => o.toLowerCase())).size !== 4)
      bad.push(`${word.id}: повторяющиеся варианты`);
    if (card.options[card.correctIndex] !== word.ru[0])
      bad.push(`${word.id}: correctIndex указывает не туда`);

    for (const option of card.options) {
      if (option === word.ru[0]) continue;
      if (option === word.falseFriendRu) continue;
      const source = WORDS.find((w) => w.ru[0] === option && w.pos === word.pos && w.level === word.level);
      if (!source) bad.push(`${word.id}: дистрактор «${option}» не той части речи или уровня`);
      else sameKind++;
    }
  }
  ok(`все ${checked} слов дают 4 непохожих варианта`, bad.length === 0, bad.slice(0, 5).join('; '));
  ok(`${sameKind} дистракторов взяты того же уровня и части речи`, sameKind > 0);
}

console.log('\nложные друзья');
{
  const ff = WORDS.filter((w) => w.falseFriendRu);
  const misses = [];
  for (const word of ff) {
    const pool = WORDS.filter((w) => w.level === word.level);
    // прогоняем несколько раз: подбор рандомизирован
    for (let i = 0; i < 50; i++) {
      const card = buildCard(word, pool, WORDS);
      if (!card.options.includes(word.falseFriendRu)) {
        misses.push(`${word.id} (попытка ${i})`);
        break;
      }
    }
  }
  ok(`ложное значение всегда среди вариантов (${ff.length} слов × 50 прогонов)`, misses.length === 0, misses.join(', '));
}

console.log('\nЛейтнер');
{
  let p = applyAnswer(undefined, true);
  ok('новое слово, угаданное с первого раза, уходит в box 2', p.box === 2);
  ok('новое слово с ошибкой остаётся в box 1', applyAnswer(undefined, false).box === 1);
  for (let i = 0; i < 10; i++) p = applyAnswer(p, true, 1000 + i * 100);
  ok('box не растёт выше 5', p.box === 5);
  const wrong = applyAnswer(p, false, 2000);
  ok('ошибка сбрасывает в box 1 и считает ошибку', wrong.box === 1 && wrong.errors === 1);

  const intervalsOk = INTERVALS.every((days, i) => {
    const rec = { box: i + 1, errors: 0, lastDay: 100 };
    return !isDue(rec, 100 + days - 1) && isDue(rec, 100 + days);
  });
  ok(`интервалы ${INTERVALS.join('/')} срабатывают ровно в свой день`, intervalsOk);
}

console.log('\nурок из 20 слов');
{
  const pool = poolFor(WORDS, 'level', 'B1');
  const words = pickLessonWords(pool, {}, 20);
  ok('подобрано ровно 20 слов', words.length === 20, `${words.length}`);
  ok('без повторов', new Set(words.map((w) => w.id)).size === 20);

  let state = createLesson(words, pool, WORDS);
  let guard = 0;
  let answers = 0;
  while (!isLessonOver(state) && guard++ < 500) {
    const card = currentCard(state);
    // каждое третье слово отвечаем неверно с первого раза
    const seenWrong = state.wrong[card.word.id] ?? 0;
    const correct = seenWrong > 0 || answers % 3 !== 0;
    state = answerCard(state, correct);
    answers++;
  }
  ok('урок завершается', isLessonOver(state) && guard < 500);
  ok('закрыты все 20 слов', state.done === 20, `done=${state.done}`);
  ok('ошибочные слова вернулись внутри урока', answers > 20, `ответов ${answers}`);
  ok('разбор ошибок непустой', lessonMistakes(state).length > 0);
}

console.log('\nпропорция урока');
{
  const pool = poolFor(WORDS, 'level', 'B1');
  const day = 1000;
  const progress = { B1: {} };
  // 40 слов на повторе в низких box — больше порога в 30
  pool.slice(0, 40).forEach((w) => {
    progress.B1[w.id] = { box: 1, errors: 1, lastDay: day - 50 };
  });
  const words = pickLessonWords(pool, progress, 20, day);
  const review = words.filter((w) => progress.B1[w.id]).length;
  ok('когда повторов больше 30 — их в уроке около 70%', review >= 12 && review <= 16, `${review}/20`);

  const few = { B1: {} };
  pool.slice(0, 10).forEach((w) => {
    few.B1[w.id] = { box: 1, errors: 1, lastDay: day - 50 };
  });
  const words2 = pickLessonWords(pool, few, 20, day);
  const review2 = words2.filter((w) => few.B1[w.id]).length;
  ok('когда повторов мало — их около 30%', review2 >= 4 && review2 <= 8, `${review2}/20`);
}

console.log('\nсвои слова');
{
  const custom = {
    id: 'gruntwork', en: 'gruntwork', ru: ['рутина'], ipa: '', pos: 'verb', level: 'B1',
    sets: ['custom'], exampleEn: 'Somebody has to do the gruntwork.', exampleRu: 'Кто-то должен.',
    collocations: [],
  };
  const all = [...WORDS, custom];
  const pool = poolFor(all, 'level', 'B1');
  ok('своё слово попадает в набор своего уровня', pool.some((w) => w.id === 'gruntwork'));

  let seen = 0;
  for (let i = 0; i < 200; i++) {
    if (pickLessonWords(pool, {}, 10).some((w) => w.id === 'gruntwork')) seen++;
  }
  ok(`своё слово встречается в уроках наравне (${seen} раз из 200)`, seen > 0);

  const card = buildCard(custom, pool, all);
  ok('для своего слова собираются 4 варианта', card.options.length === 4 && card.options.includes('рутина'));
  const wrongOnes = card.options.filter((o) => o !== 'рутина');
  ok(
    'дистракторы к своему слову — глаголы того же уровня',
    wrongOnes.every((o) => all.some((w) => w.ru[0] === o && w.pos === 'verb' && w.level === 'B1')),
    wrongOnes.join(', '),
  );

  const asDistractor = WORDS.filter((w) => w.pos === 'verb' && w.level === 'B1').slice(0, 1)[0];
  const card2 = buildCard(asDistractor, pool, all);
  ok('своё слово не ломает подбор для остальных', card2.options.length === 4);
}

console.log('\n«повторить ошибки»');
{
  const pool = poolFor(WORDS, 'level', 'B1');
  const progress = { B1: {} };
  pool.slice(0, 5).forEach((w) => (progress.B1[w.id] = { box: 1, errors: 2, lastDay: 900 }));
  pool.slice(5, 10).forEach((w) => (progress.B1[w.id] = { box: 4, errors: 0, lastDay: 900 }));
  const repeat = pickRepeatWords(pool, progress, 20);
  ok('берёт только box 1–2', repeat.length === 5 && repeat.every((w) => progress.B1[w.id].box <= 2), `${repeat.length}`);
}

console.log('\nхранилище');
{
  const big = {};
  for (const w of WORDS.filter((w) => w.level === 'B2')) {
    big[w.id] = { box: 3, errors: 1, lastDay: 2441 };
  }
  const chunks = serializeLevelProgress(big);
  ok(`${Object.keys(big).length} слов уровня влезают в ${chunks.length} шард(а)`, chunks.length >= 1);
  ok('ни один шард не длиннее 4096 символов', chunks.every((c) => c.length <= 4096), chunks.map((c) => c.length).join(', '));

  const restored = {};
  for (const chunk of chunks) Object.assign(restored, parseLevelProgress(chunk));
  ok('после чтения прогресс совпадает посимвольно', JSON.stringify(restored) === JSON.stringify(big));

  ok('формат как договорились', /^achieve:4:0:1738(;|$)/.test(serializeLevelProgress({ achieve: { box: 4, errors: 0, lastDay: 1738 } })[0]));
  ok('мусор в значении не роняет разбор', Object.keys(parseLevelProgress('achieve:4:0:1738;;битое;afford:2:1:1740')).length === 2);
}

console.log('\nсчётчики и серия дней');
{
  let stats = recordLesson(EMPTY_STATS, { size: 20, correct: 18, answers: 23 }, 100);
  ok('первый урок начинает серию', stats.streak === 1 && stats.lessons === 1);
  stats = recordLesson(stats, { size: 20, correct: 20, answers: 20 }, 100);
  ok('второй урок в тот же день серию не удлиняет', stats.streak === 1 && stats.lessons === 2);
  stats = recordLesson(stats, { size: 20, correct: 20, answers: 20 }, 101);
  ok('следующий день продлевает серию', stats.streak === 2);
  stats = recordLesson(stats, { size: 20, correct: 20, answers: 20 }, 105);
  ok('пропуск обнуляет серию', stats.streak === 1 && stats.bestStreak === 2);

  let many = EMPTY_STATS;
  for (let d = 0; d < 30; d++) many = recordLesson(many, { size: 10, correct: 9, answers: 11 }, 200 + d);
  ok('история хранит последние 20 уроков', many.history.length === 20 && many.history[19].d === 229);
  ok('ключ stats остаётся коротким', JSON.stringify(many).length < 4096, `${JSON.stringify(many).length} символов`);
}

console.log('\nсводка на главной');
{
  const pool = poolFor(WORDS, 'level', 'B1');
  const progress = { B1: {} };
  pool.slice(0, 3).forEach((w) => (progress.B1[w.id] = { box: 5, errors: 0, lastDay: 1000 }));
  pool.slice(3, 7).forEach((w) => (progress.B1[w.id] = { box: 2, errors: 1, lastDay: 1000 }));
  const s = summarize(pool, progress, EMPTY_STATS, 1010);
  // box 5 показывали 10 дней назад, интервал 35 — на повтор они ещё не просятся,
  // а box 2 с интервалом 3 уже просятся.
  ok('знаю / учу / на повторе считаются раздельно', s.known === 3 && s.learning === 4 && s.due === 4, JSON.stringify(s));
  ok('остальные слова считаются новыми', s.fresh === pool.length - 7);
}

console.log(failed === 0 ? '\nдвижок в порядке\n' : `\nпровалено проверок: ${failed}\n`);
process.exit(failed === 0 ? 0 : 1);
