import { POS_LABEL, type Word } from '../data/words';
import { colors, radius } from '../theme/colors';
import { PrimaryButton, ProgressDots, Screen, SectionTitle } from '../components/ui';
import { IconFlame } from '../components/icons';
import { SoundButton } from '../components/SoundButton';
import { lessonMistakes, type LessonState } from '../lib/lesson';
import type { Progress } from '../lib/leitner';
import { currentStreak, type Stats } from '../lib/stats';

/** Итог урока: счёт кольцом, разбор ошибок, что делать дальше. */
export function ResultScreen({
  lesson,
  progress,
  stats,
  canRepeat,
  onRepeat,
  onAgain,
}: {
  lesson: LessonState;
  progress: Progress;
  stats: Stats;
  canRepeat: boolean;
  onRepeat: () => void;
  onAgain: () => void;
}) {
  const total = lesson.cards.length;
  const mistakes = lessonMistakes(lesson);
  const correct = total - mistakes.length;
  const streak = currentStreak(stats);

  return (
    <Screen
      footer={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {canRepeat && (
            <PrimaryButton onClick={onRepeat}>Повторить ошибки</PrimaryButton>
          )}
          <PrimaryButton tone={canRepeat ? 'quiet' : 'accent'} onClick={onAgain}>
            Ещё урок
          </PrimaryButton>
        </div>
      }
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
        <ScoreRing correct={correct} total={total} />
      </div>

      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <div style={{ fontSize: 15, color: colors.ink2 }}>
          {correct === total
            ? 'Урок пройден без единой ошибки'
            : `С первого раза — ${correct} из ${total}`}
        </div>
        {streak > 0 && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              marginTop: 8,
              color: colors.warm,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <IconFlame size={17} />
            {streak} {plural(streak, 'день', 'дня', 'дней')} подряд
          </div>
        )}
      </div>

      {mistakes.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <SectionTitle>Разбор ошибок</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mistakes.map((word) => (
              <MistakeRow
                key={word.id}
                word={word}
                box={progress[word.level]?.[word.id]?.box ?? 1}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{ height: 8 }} />
    </Screen>
  );
}

/** Кольцо счёта: дуга по доле верных с первого раза. */
function ScoreRing({ correct, total }: { correct: number; total: number }) {
  const size = 168;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const share = total > 0 ? correct / total : 0;
  const tone = share >= 0.8 ? colors.ok : share >= 0.5 ? colors.accent : colors.warm;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors.sunken}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * share} ${circumference}`}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 46,
            fontWeight: 500,
            lineHeight: 1,
            color: tone,
          }}
        >
          {correct}
        </span>
        <span style={{ fontSize: 13, color: colors.muted, marginTop: 6 }}>из {total}</span>
      </div>
    </div>
  );
}

function MistakeRow({ word, box }: { word: Word; box: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: colors.surface,
        border: `1px solid ${colors.line}`,
        borderRadius: radius.row,
        padding: '12px 14px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500 }}>
            {word.en}
          </span>
          {word.ipa && (
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: colors.ink2 }}>
              {word.ipa}
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, color: colors.ink2, marginTop: 3 }}>
          {word.ru.join(', ')}
          <span style={{ color: colors.muted }}> · {POS_LABEL[word.pos]}</span>
        </div>
        <div style={{ marginTop: 8 }}>
          <ProgressDots box={box} />
        </div>
      </div>
      <SoundButton text={word.en} size={36} />
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = n % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
