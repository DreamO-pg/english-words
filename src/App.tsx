import { useCallback, useEffect, useMemo, useState } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { LessonScreen } from './screens/LessonScreen';
import { ResultScreen } from './screens/ResultScreen';
import { WordsScreen } from './screens/WordsScreen';
import { AddWordScreen } from './screens/AddWordScreen';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './lib/settings';
import { WORDS, type Level, type Word } from './data/words';
import {
  deleteCustomWord,
  draftToWord,
  loadCustomWords,
  saveCustomWord,
  type CustomDraft,
} from './lib/customWords';
import { loadProgress, saveProgress } from './lib/progress';
import { applyAnswer, today, type Progress } from './lib/leitner';
import { EMPTY_STATS, loadStats, recordLesson, saveStats, summarize, type Stats } from './lib/stats';
import {
  answerCard,
  createLesson,
  isLessonOver,
  pickLessonWords,
  pickRepeatWords,
  poolFor,
  type LessonState,
} from './lib/lesson';
import { addToHomeScreen, checkHomeScreen, setBackButton } from './telegram/webapp';
import type { HomeScreenStatus } from './telegram/types';

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

  useEffect(() => {
    loadSettings().then(setSettings);
    loadProgress().then(setProgress);
    loadStats().then(setStats);
    loadCustomWords().then(setCustom);
    checkHomeScreen().then(setHomeScreenStatus);
  }, []);

  // Своей кнопки «назад» нет — только нативная телеграмовская.
  useEffect(() => {
    if (screen === 'home') return setBackButton(null);
    return setBackButton(() => setScreen(screen === 'addWord' ? 'words' : 'home'));
  }, [screen]);

  /** Свои слова живут в словаре наравне с остальными. */
  const allWords = useMemo(() => [...WORDS, ...custom], [custom]);

  const pool = useMemo(
    () => poolFor(allWords, settings.set, settings.level),
    [allWords, settings.set, settings.level],
  );

  const summary = useMemo(() => summarize(pool, progress, stats), [pool, progress, stats]);

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveSettings(next);
      return next;
    });
  }, []);

  const startLesson = useCallback(() => {
    const words = pickLessonWords(pool, progress, settings.lessonSize);
    if (words.length === 0) return;
    setLesson(createLesson(words, pool, allWords));
    setScreen('lesson');
  }, [pool, allWords, progress, settings.lessonSize]);

  /** «Повторить ошибки» — только слова из box 1–2. */
  const repeatWords = useMemo(
    () => pickRepeatWords(pool, progress, settings.lessonSize),
    [pool, progress, settings.lessonSize],
  );

  const startRepeat = useCallback(() => {
    if (repeatWords.length === 0) return;
    setLesson(createLesson(repeatWords, pool, allWords));
    setScreen('lesson');
  }, [repeatWords, pool, allWords]);

  /**
   * Урок закончен: применяем Лейтнер и пишем в CloudStorage — один раз,
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

      setProgress(next);
      setStats(nextStats);
      void saveProgress(next, [...touched]);
      void saveStats(nextStats);
      setScreen('result');
    },
    [progress, stats],
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

  const addCustomWord = (draft: CustomDraft) => {
    const taken = new Set(allWords.map((w) => w.id));
    const word = draftToWord(draft, taken);
    if (!word) return;
    setCustom((prev) => [...prev, word].sort((a, b) => a.en.localeCompare(b.en)));
    void saveCustomWord(word);
    setScreen('words');
  };

  const removeCustomWord = (word: Word) => {
    setCustom((prev) => prev.filter((w) => w.id !== word.id));
    void deleteCustomWord(word.id);
  };

  const offerHomeScreen = homeScreenStatus === 'missed' && !settings.homeScreenHidden;

  const home = (
    <HomeScreen
      settings={settings}
      onChange={patchSettings}
      onStart={startLesson}
      onOpenWords={() => setScreen('words')}
      summary={summary}
      homeScreen={
        offerHomeScreen
          ? {
              onAdd: () => {
                addToHomeScreen();
                patchSettings({ homeScreenHidden: true });
              },
              onDismiss: () => patchSettings({ homeScreenHidden: true }),
            }
          : undefined
      }
    />
  );

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
      <AddWordScreen level={settings.level} onSave={addCustomWord} onCancel={() => setScreen('words')} />
    );
  if (screen === 'words')
    return (
      <WordsScreen
        words={allWords}
        progress={progress}
        onAdd={() => setScreen('addWord')}
        onDelete={removeCustomWord}
      />
    );
  return home;
}
