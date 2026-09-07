import { useEffect, useState } from 'react';
import { POS_LABEL } from '../data/words';
import { colors, radius } from '../theme/colors';
import { Chip, LessonProgress, PrimaryButton, Screen } from '../components/ui';
import { IconCheck, IconCross } from '../components/icons';
import { SoundButton } from '../components/SoundButton';
import { WordCard } from '../components/WordCard';
import { currentCard, type LessonState } from '../lib/lesson';
import { haptic } from '../telegram/webapp';
import { speak } from '../lib/speech';

/**
 * Один экран, две фазы: вопрос и ответ.
 * Подсветка выбранного варианта мгновенная, карточка слова выезжает снизу.
 */
export function LessonScreen({
  lesson,
  onNext,
}: {
  lesson: LessonState;
  onNext: (correct: boolean) => void;
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [pressed, setPressed] = useState<number | null>(null);
  // Кнопка «Дальше» живёт в DOM до перерисовки: без защёлки второе быстрое
  // нажатие проматывает следующее слово, не показав его.
  const [sent, setSent] = useState(false);
  const card = currentCard(lesson);

  useEffect(() => {
    setChosen(null);
    setPressed(null);
    setSent(false);
  }, [lesson.position]);

  const answered = chosen !== null;
  const word = card?.word;

  // Карточка появилась — один раз произносим слово.
  useEffect(() => {
    if (answered && word) speak(word.en);
  }, [answered, word]);

  if (!card || !word) return null;

  const isCorrect = chosen === card.correctIndex;

  const choose = (index: number) => {
    if (answered) return;
    setChosen(index);
    if (index === card.correctIndex) haptic.success();
    else haptic.error();
  };

  const header = <LessonProgress done={lesson.done} total={lesson.cards.length} />;

  if (!answered) {
    return (
      <Screen header={header}>
        <div className="step-in" key={lesson.position}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 18 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: wordSize(word.en),
                  fontWeight: 500,
                  lineHeight: 1.06,
                  letterSpacing: '-0.01em',
                  color: colors.ink,
                  wordBreak: 'break-word',
                }}
              >
                {word.en}
              </div>
              {word.ipa && (
                <div
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 15,
                    color: colors.ink2,
                    marginTop: 8,
                  }}
                >
                  {word.ipa}
                </div>
              )}
            </div>
            <SoundButton text={word.en} />
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            <Chip>{POS_LABEL[word.pos]}</Chip>
            <Chip>{word.level}</Chip>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 26 }}>
            {card.options.map((option, i) => (
              <Option
                key={option}
                label={option}
                height={62}
                state={pressed === i ? 'pressed' : 'idle'}
                onPress={() => setPressed(i)}
                onRelease={() => setPressed(null)}
                onClick={() => choose(i)}
              />
            ))}
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      header={header}
      footer={
        <PrimaryButton
          onClick={() => {
            if (sent) return;
            setSent(true);
            onNext(isCorrect);
          }}
        >
          Дальше
        </PrimaryButton>
      }
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 14,
          color: isCorrect ? colors.ok : colors.bad,
        }}
      >
        {isCorrect ? <IconCheck size={22} /> : <IconCross size={22} />}
        <span style={{ fontSize: 17, fontWeight: 600 }}>{isCorrect ? 'Верно' : 'Не угадал'}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
        {card.options.map((option, i) => (
          <Option
            key={option}
            label={option}
            height={47}
            state={
              i === card.correctIndex ? 'correct' : i === chosen ? 'wrong' : 'dim'
            }
          />
        ))}
      </div>

      <div className="card-in" style={{ marginTop: 18 }}>
        <WordCard word={word} />
      </div>
    </Screen>
  );
}

/** 46 для коротких слов, для длинных уменьшаем — иначе не влезает в 375. */
function wordSize(en: string): number {
  if (en.length <= 8) return 46;
  if (en.length <= 12) return 38;
  if (en.length <= 16) return 32;
  return 27;
}

type OptionState = 'idle' | 'pressed' | 'correct' | 'wrong' | 'dim';

function Option({
  label,
  height,
  state,
  onPress,
  onRelease,
  onClick,
}: {
  label: string;
  height: number;
  state: OptionState;
  onPress?: () => void;
  onRelease?: () => void;
  onClick?: () => void;
}) {
  const skin = {
    idle: { bg: colors.surface, border: colors.line, text: colors.ink },
    pressed: { bg: colors.surface, border: colors.accent, text: colors.ink },
    correct: { bg: colors.okBg, border: colors.ok, text: colors.ink },
    wrong: { bg: colors.badBg, border: colors.bad, text: colors.ink },
    dim: { bg: colors.surface, border: colors.line, text: colors.inkDisabled },
  }[state];

  return (
    <button
      onClick={onClick}
      onPointerDown={onPress}
      onPointerUp={onRelease}
      onPointerLeave={onRelease}
      onPointerCancel={onRelease}
      disabled={!onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        minHeight: height,
        padding: '10px 16px',
        borderRadius: radius.row,
        background: skin.bg,
        border: `1px solid ${skin.border}`,
        color: skin.text,
        fontSize: 17,
        fontWeight: 500,
        lineHeight: 1.3,
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {state === 'correct' && <IconCheck size={20} color={colors.ok} />}
      {state === 'wrong' && <IconCross size={20} color={colors.bad} />}
    </button>
  );
}
