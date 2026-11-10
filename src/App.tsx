import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { LessonScreen } from './screens/LessonScreen';
import { ResultScreen } from './screens/ResultScreen';
import { WordsScreen } from './screens/WordsScreen';
import { AddWordScreen } from './screens/AddWordScreen';
import { LoadScreen } from './screens/LoadScreen';
import { UpdateScreen } from './screens/UpdateScreen';
import { Banner } from './components/ui';
import { DEFAULT_SETTINGS, loadSettings, type Settings } from './lib/settings';
import { LEVELS, WORDS, type Level, type Word } from './data/words';
import {
  deleteCustomWord,
  draftToWord,
  loadCustomWords,
  saveCustomWord,
  type CustomDraft,
} from './lib/customWords';
import { loadProgress, mergeLevelProgress } from './lib/progress';
import { applyAnswer, today, type LevelProgress, type Progress } from './lib/leitner';
import { EMPTY_STATS, loadStats, recordLesson, summarize, type Stats } from './lib/stats';
import { absorb, enqueue, flush, hasPending, pendingSnapshot } from './lib/sync';
import {
  answerCard,
  createLesson,
  isLessonOver,
  lessonMistakes,
  pickLessonWords,
  poolFor,
  type LessonState,
} from './lib/lesson';
import {
  addToHomeScreen,
  checkHomeScreen,
  confirmAction,
  isOutdatedClient,
  onHomeScreenAdded,
  setBackButton,
  setClosingConfirmation,
} from './telegram/webapp';
import type { HomeScreenStatus } from './telegram/types';

/** Через сколько повторить неудавшуюся запись в облако. */
const RETRY_MS = 20_000;

/** Экраны меняются одним состоянием — это одно окно, а не сайт. */
type ScreenName = 'home' | 'lesson' | 'result' | 'words' | 'addWord';

export function App() {
  const [screen, setScreen] = useState<ScreenName>('home');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [progress, setProgress] = useState<Progress>({});
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [lesson, setLesson] = useState<LessonState | null>(null);
  const [custom, setCustom] = useState<Word[]>([]);
  const [homeScreenStatus, setHomeScreenStatus] = useState<HomeScreenStatus>('unsupported');
  /**
   * Пока данные не прочитаны, ничего не показываем и ничего не пишем:
   * урок на пустом прогрессе перезаписал бы облако.
   */
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [syncFailed, setSyncFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const retryTimer = useRef<number | undefined>(undefined);

  /** Отправить очередь в облако и влить в память то, что там оказалось. */
  const sync = useCallback(async () => {
    window.clearTimeout(retryTimer.current);
    const result = await flush();
    if (Object.keys(result.merged).length > 0) {
      setProgress((prev) => absorb(prev, result.merged));
    }
    setSyncFailed(!result.ok);
    if (!result.ok) retryTimer.current = window.setTimeout(() => void sync(), RETRY_MS);
  }, []);

  const loadAll = useCallback(async () => {
    setLoad('loading');
    try {
      const [cloudSettings, cloudProgress, cloudStats, customWords] = await Promise.all([
        loadSettings(),
        loadProgress(),
        loadStats(),
        loadCustomWords(),
      ]);
      // Не отправленное в прошлый раз новее облака — накладываем сверху.
      const pending = pendingSnapshot();
      const merged: Progress = { ...cloudProgress };
      for (const level of Object.keys(pending.progress) as Level[]) {
        merged[level] = mergeLevelProgress(
          cloudProgress[level] ?? {},
          pending.progress[level] ?? {},
          pending.removed[level],
        );
      }
      setSettings(pending.settings ?? cloudSettings);
      setProgress(merged);
      setStats(pending.stats ?? cloudStats);
      setCustom(customWords);
      setLoad('ready');
      if (hasPending()) void sync();
    } catch {
      setLoad('error');
    }
  }, [sync]);

  useEffect(() => {
    // На клиенте без CloudStorage читать нечего — там экран «обновите Telegram».
    if (isOutdatedClient) return;
    void loadAll();
    checkHomeScreen().then(setHomeScreenStatus);
    return onHomeScreenAdded(() => setHomeScreenStatus('added'));
  }, [loadAll]);

  // Вернулись в приложение — пробуем дослать несохранённое.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && hasPending()) void sync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearTimeout(retryTimer.current);
    };
  }, [sync]);

  // Есть ли в уроке что терять: хотя бы один ответ уже дан.
  const lessonInProgress = screen === 'lesson' && (lesson?.position ?? 0) > 0;

  // Своей кнопки «назад» нет — только нативная телеграмовская.
  // Из начатого урока — только после подтверждения: ответы пишутся в конце урока.
  useEffect(() => {
    if (screen === 'home') return setBackButton(null);
    return setBackButton(() => {
      if (!lessonInProgress) {
        setScreen(screen === 'addWord' ? 'words' : 'home');
        return;
      }
      void confirmAction('Выйти из урока? Ответы этого урока не сохранятся.').then((ok) => {
        if (ok) setScreen('home');
      });
    });
  }, [screen, lessonInProgress]);

  // Свернуть или закрыть окно посреди урока — тоже с вопросом.
  useEffect(() => {
    setClosingConfirmation(lessonInProgress);
  }, [lessonInProgress]);

  /** Свои слова живут в словаре наравне с остальными. */
  const allWords = useMemo(() => [...WORDS, ...custom], [custom]);

  /** Уровни, в которых вообще есть слова — остальные на главной не показываем. */
  const levels = useMemo(
    () => LEVELS.filter((level) => allWords.some((w) => w.level === level)),
    [allWords],
  );
  // В настройках мог остаться уровень, слов которого больше нет (удалили свои).
  const level: Level = levels.includes(settings.level) ? settings.level : (levels[0] ?? 'B1');

  const pool = useMemo(
    () => poolFor(allWords, settings.set, level),
    [allWords, settings.set, level],
  );

  const summary = useMemo(() => summarize(pool, progress, stats), [pool, progress, stats]);

  const patchSettings = useCallback(
    (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      enqueue({ settings: next });
      void sync();
    },
    [settings, sync],
  );

  const startLesson = useCallback(() => {
    const words = pickLessonWords(pool, progress, settings.lessonSize);
    if (words.length === 0) return;
    setLesson(createLesson(words, pool, allWords));
    setScreen('lesson');
  }, [pool, allWords, progress, settings.lessonSize]);

  /** «Повторить ошибки» — ровно те слова, в которых ошибся в этом уроке. */
  const repeatWords = useMemo(() => (lesson ? lessonMistakes(lesson) : []), [lesson]);

  const startRepeat = useCallback(() => {
    if (repeatWords.length === 0) return;
    setLesson(createLesson(repeatWords, pool, allWords));
    setScreen('lesson');
  }, [repeatWords, pool, allWords]);

  /**
   * Урок закончен: применяем Лейтнер и ставим запись в очередь — один раз,
   * а не после каждого слова. Слово, в котором ошибся хотя бы раз,
   * уходит в box 1, даже если потом ответил верно.
   */
  const finishLesson = useCallback(
    (state: LessonState) => {
      const day = today();
      const next: Progress = { ...progress };
      const touched = new Set<Level>();

      for (const card of state.cards) {
        const { level, id } = { level: card.word.level, id: card.word.id };
        const wasWrong = Boolean(state.wrong[id]);
        const levelProgress = { ...(next[level] ?? {}) };
        levelProgress[id] = applyAnswer(levelProgress[id], !wasWrong, day);
        next[level] = levelProgress;
        touched.add(level);
      }

      const mistakes = Object.keys(state.wrong).length;
      const nextStats = recordLesson(
        stats,
        {
          size: state.cards.length,
          correct: state.cards.length - mistakes,
          answers: state.queue.length,
        },
        day,
      );

      const levels: Partial<Record<Level, LevelProgress>> = {};
      for (const level of touched) levels[level] = next[level];

      setProgress(next);
      setStats(nextStats);
      enqueue({ levels, stats: nextStats });
      void sync();
      setScreen('result');
    },
    [progress, stats, sync],
  );

  const handleAnswer = useCallback(
    (correct: boolean) => {
      if (!lesson) return;
      const next = answerCard(lesson, correct);
      setLesson(next);
      if (isLessonOver(next)) finishLesson(next);
    },
    [lesson, finishLesson],
  );

  /** Возвращает текст ошибки или null, если слово сохранено. */
  const addCustomWord = async (draft: CustomDraft): Promise<string | null> => {
    const taken = new Set(allWords.map((w) => w.id));
    const word = draftToWord(draft, taken);
    if (!word) return 'Заполните слово и перевод.';
    try {
      await saveCustomWord(word);
    } catch {
      return 'Не удалось сохранить слово. Проверьте связь и попробуйте ещё раз.';
    }
    setCustom((prev) => [...prev, word].sort((a, b) => a.en.localeCompare(b.en)));
    setScreen('words');
    return null;
  };

  const removeCustomWord = async (word: Word) => {
    const ok = await confirmAction(`Удалить «${word.en}»? Прогресс по слову тоже удалится.`);
    if (!ok) return;
    try {
      await deleteCustomWord(word.id);
    } catch {
      setNotice('Не удалось удалить слово. Проверьте связь и попробуйте ещё раз.');
      return;
    }
    setCustom((prev) => prev.filter((w) => w.id !== word.id));
    // Прогресс удалённого слова тоже убираем — иначе новое слово с тем же
    // id унаследовало бы старый box и ошибки.
    setProgress((prev) => {
      const level = prev[word.level];
      if (!level?.[word.id]) return prev;
      const { [word.id]: _gone, ...rest } = level;
      return { ...prev, [word.level]: rest };
    });
    enqueue({ removed: { [word.level]: [word.id] } });
    void sync();
  };

  const offerHomeScreen = homeScreenStatus === 'missed' && !settings.homeScreenHidden;

  const home = (
    <HomeScreen
      settings={settings}
      onChange={patchSettings}
      onStart={startLesson}
      onOpenWords={() => setScreen('words')}
      summary={summary}
      levels={levels}
      level={level}
      empty={pool.length === 0}
      homeScreen={
        offerHomeScreen
          ? {
              // Плашку убирает событие homeScreenAdded, а не само нажатие:
              // системный диалог можно отменить.
              onAdd: addToHomeScreen,
              onDismiss: () => patchSettings({ homeScreenHidden: true }),
            }
          : undefined
      }
    />
  );

  if (isOutdatedClient) return <UpdateScreen />;
  if (load !== 'ready') return <LoadScreen failed={load === 'error'} onRetry={loadAll} />;

  const banner = notice ? (
    <Banner text={notice} action="Скрыть" onAction={() => setNotice(null)} />
  ) : syncFailed && screen !== 'lesson' ? (
    <Banner
      text="Не всё сохранено в облако. Прогресс хранится на этом устройстве и отправится позже."
      action="Повторить"
      onAction={() => void sync()}
    />
  ) : null;

  return <Frame banner={banner}>{renderScreen()}</Frame>;

  function renderScreen() {
    if (screen === 'lesson' && lesson) return <LessonScreen lesson={lesson} onNext={handleAnswer} />;
    if (screen === 'result' && lesson)
      return (
        <ResultScreen
          lesson={lesson}
          progress={progress}
          stats={stats}
          canRepeat={repeatWords.length > 0}
          onRepeat={startRepeat}
          onAgain={startLesson}
        />
      );
    if (screen === 'addWord')
      return (
        <AddWordScreen level={level} onSave={addCustomWord} onCancel={() => setScreen('words')} />
      );
    if (screen === 'words')
      return (
        <WordsScreen
          words={allWords}
          progress={progress}
          onAdd={() => setScreen('addWord')}
          onDelete={(word) => void removeCustomWord(word)}
        />
      );
    return home;
  }
}

/** Плашка о сбое сверху, экран — во всю оставшуюся высоту. */
function Frame({ banner, children }: { banner: ReactNode; children: ReactNode }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {banner}
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}
