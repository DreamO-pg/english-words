/**
 * Проверка хранения на моке localStorage (вне телеграма обёртка работает
 * через него): сбои чтения и записи, слияние, очередь, перезапуск.
 */

// Мок до импорта модулей: sync.ts читает очередь при загрузке.
const fail = { read: false, write: false };
class MockStorage {
  getItem(k) {
    if (fail.read) throw new Error('read failed');
    return Object.prototype.hasOwnProperty.call(this, k) ? this[k] : null;
  }
  setItem(k, v) {
    if (fail.write && k.startsWith('ew:')) throw new Error('write failed');
    this[k] = String(v);
  }
  removeItem(k) {
    if (fail.write && k.startsWith('ew:')) throw new Error('write failed');
    delete this[k];
  }
}
globalThis.localStorage = new MockStorage();
// Object.keys(localStorage) тоже должен падать при сбое чтения.
const realKeys = Object.keys;
Object.keys = (o) => {
  if (o === globalThis.localStorage && fail.read) throw new Error('read failed');
  return realKeys(o);
};

const m = await import('../.cache/storage.mjs');

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed++;
  console.log(`  ${cond ? '✓' : '✗'} ${name}${!cond && extra ? ' — ' + extra : ''}`);
};
const rejects = async (p) => p.then(() => false, () => true);
const cloud = (key) => globalThis.localStorage['ew:' + key];

console.log('\nсбой чтения');
{
  fail.read = true;
  ok('loadProgress бросает ошибку, а не возвращает пустой прогресс', await rejects(m.loadProgress()));
  ok('storage.get бросает StorageError', await m.storage.get('stats').then(() => false, (e) => e instanceof m.StorageError));
  fail.read = false;
}

console.log('\nлимиты CloudStorage');
{
  ok('ключ длиннее 128 символов не отправляется', await rejects(m.storage.set('x'.repeat(129), '1')));
  ok('ключ с недопустимыми символами не отправляется', await rejects(m.storage.set('cw_é', '1')));
  ok('значение длиннее 4096 символов не отправляется', await rejects(m.storage.set('k', 'x'.repeat(4097))));
}

console.log('\nслияние');
{
  const merged = m.mergeLevelProgress(
    { a: { box: 3, errors: 0, lastDay: 10 }, b: { box: 2, errors: 1, lastDay: 12 }, c: { box: 4, errors: 0, lastDay: 5 } },
    { a: { box: 1, errors: 1, lastDay: 11 }, b: { box: 5, errors: 0, lastDay: 9 }, c: { box: 1, errors: 2, lastDay: 5 } },
    [],
  );
  ok('побеждает более поздний показ (свой)', merged.a.box === 1);
  ok('побеждает более поздний показ (чужой)', merged.b.box === 2);
  ok('при равном дне побеждает своё', merged.c.box === 1);
  const removed = m.mergeLevelProgress({ a: { box: 3, errors: 0, lastDay: 10 } }, {}, ['a']);
  ok('удалённое слово выбрасывается', !('a' in removed));
}

console.log('\nзапись не затирает другое устройство');
{
  // «Другое устройство» уже записало слово x.
  await m.saveLevelProgress('B1', { x: { box: 4, errors: 0, lastDay: 100 } });
  // Это устройство не знает про x и пишет только y.
  const result = await m.saveLevelProgress('B1', { y: { box: 2, errors: 0, lastDay: 101 } });
  const back = await m.loadProgress();
  ok('в облаке оба слова', back.B1?.x?.box === 4 && back.B1?.y?.box === 2, JSON.stringify(back.B1));
  ok('возвращается слитый уровень', result.x && result.y);
}

console.log('\nшарды');
{
  const big = {};
  for (let i = 0; i < 400; i++) big[`word-number-${i}`] = { box: 1 + (i % 5), errors: i % 3, lastDay: 1000 + i };
  await m.saveLevelProgress('B2', big);
  ok('большой уровень разложен на несколько шардов', Boolean(cloud('progress_b2_1')));
  const small = await m.saveLevelProgress('B2', {}, Object.keys(big));
  ok('после удаления всех слов уровень пуст', Object.keys(small).length === 0);
  ok('хвостовые шарды удалены', !cloud('progress_b2_1'));
}

console.log('\nочередь при сбое записи');
{
  const level = { z: { box: 3, errors: 0, lastDay: 200 } };
  const stats = { lessons: 7, answers: 0, correct: 0, streak: 2, bestStreak: 3, lastDay: 200, history: [] };
  fail.write = true;
  m.enqueue({ levels: { B1: level }, stats });
  const r1 = await m.flush();
  ok('flush сообщает о неудаче', r1.ok === false);
  ok('несохранённое лежит на устройстве', Boolean(globalThis.localStorage['ew-sync:pending']));

  // «Перезапуск»: модуль заново читает очередь с устройства.
  m.__resetForTests();
  ok('после перезапуска очередь не потеряна', m.hasPending());
  ok('снимок очереди содержит урок', m.pendingSnapshot().progress.B1?.z?.box === 3);

  fail.write = false;
  const r2 = await m.flush();
  ok('после восстановления связи flush успешен', r2.ok === true);
  ok('очередь пуста', !m.hasPending() && !globalThis.localStorage['ew-sync:pending']);
  const back = await m.loadProgress();
  ok('урок в облаке, старые слова на месте', back.B1?.z?.box === 3 && back.B1?.x?.box === 4);
  ok('stats в облаке', JSON.parse(cloud('stats')).lessons === 7);
}

console.log('\nдва сохранения подряд не перехлёстываются');
{
  m.enqueue({ levels: { B1: { p: { box: 2, errors: 0, lastDay: 300 } } } });
  const a = m.flush();
  m.enqueue({ levels: { B1: { p: { box: 3, errors: 0, lastDay: 301 } } } });
  const b = m.flush();
  await Promise.all([a, b]);
  const back = await m.loadProgress();
  ok('в облаке последняя версия', back.B1?.p?.box === 3, JSON.stringify(back.B1?.p));
  ok('очередь пуста', !m.hasPending());
}

console.log('\nудаление своего слова через очередь');
{
  m.enqueue({ removed: { B1: ['z'] } });
  await m.flush();
  const back = await m.loadProgress();
  ok('прогресс слова удалён, остальное на месте', !back.B1?.z && back.B1?.x?.box === 4);
}

console.log('\nсвои слова');
{
  const base = { ru: 'перевод', exampleEn: '', exampleRu: '', pos: 'noun', level: 'B1' };
  const long = m.draftToWord({ ...base, en: 'a'.repeat(300) }, new Set());
  ok('id длинного слова укладывается в ключ CloudStorage', ('cw_' + long.id).length <= 128 && long.en.length <= 60);
  const cyr = m.draftToWord({ ...base, en: 'слово' }, new Set());
  ok('слово без латиницы сохраняется с id из времени', Boolean(cyr) && /^w-[a-z0-9]+$/.test(cyr.id));
  ok('naïve → naive', m.slugify('naïve') === 'naive');
  ok('битая часть речи отбрасывается', m.parseCustomWord(JSON.stringify({ id: 'a', en: 'a', ru: ['б'], pos: 'xxx', level: 'B1' })) === null);
  ok('битый уровень отбрасывается', m.parseCustomWord(JSON.stringify({ id: 'a', en: 'a', ru: ['б'], pos: 'noun', level: 'Z9' })) === null);
  ok('нормальная запись читается', m.parseCustomWord(JSON.stringify({ id: 'a', en: 'a', ru: ['б'], pos: 'noun', level: 'B1' }))?.en === 'a');
  fail.write = true;
  ok('сбой записи своего слова виден вызывающему', await rejects(m.saveCustomWord(cyr)));
  fail.write = false;
}

console.log('\nCloudStorage телеграма');
{
  // Второй экземпляр модулей (другой URL) — уже «внутри телеграма».
  const data = {};
  const tg = { errors: 0, err: 'STORAGE_FAILED' };
  // Ответ асинхронный, как у настоящего клиента; первые tg.errors вызовов падают.
  const reply = (cb, value) =>
    setTimeout(() => (tg.errors > 0 ? (tg.errors--, cb(tg.err, null)) : cb(null, value())), 0);
  globalThis.window = {
    Telegram: {
      WebApp: {
        platform: 'ios',
        CloudStorage: {
          getItem: (k, cb) => reply(cb, () => data[k] ?? ''),
          getItems: (ks, cb) => reply(cb, () => Object.fromEntries(ks.map((k) => [k, data[k] ?? '']))),
          setItem: (k, v, cb) => reply(cb, () => ((data[k] = v), true)),
          removeItem: (k, cb) => reply(cb, () => (delete data[k], true)),
          getKeys: (cb) => reply(cb, () => Object.keys(data)),
        },
      },
    },
  };
  const t = await import('../.cache/storage.mjs?telegram');

  tg.errors = 100;
  ok('getKeys с ошибкой → loadProgress бросает, а не отдаёт пустой прогресс', await rejects(t.loadProgress()));
  tg.errors = 0;

  data.progress_b1 = 'w:3:0:500';
  tg.errors = 1;
  const p = await t.loadProgress();
  ok('разовый сбой переживается повтором', p.B1?.w?.box === 3);

  ok('отсутствующий ключ (пустая строка) читается как null', (await t.storage.get('nope')) === null);

  tg.errors = 100;
  t.enqueue({ levels: { B1: { v: { box: 2, errors: 0, lastDay: 501 } } } });
  const r = await t.flush();
  ok('сбой setItem → flush не ok, данные в очереди', r.ok === false && t.hasPending());
  tg.errors = 0;
  const r2 = await t.flush();
  ok('после восстановления запись дошла и не затёрла чужое', r2.ok && data.progress_b1.includes('v:2') && data.progress_b1.includes('w:3'));
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nхранение в порядке');
process.exit(failed ? 1 : 0);
