import { colors, radius } from '../theme/colors';
import { SETS } from '../data/words';
import { PrimaryButton, Screen, SectionTitle, Segmented } from '../components/ui';
import { IconFlame, IconHome, IconList } from '../components/icons';
import type { Settings } from '../lib/settings';
import { haptic } from '../telegram/webapp';

type Props = {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onStart: () => void;
  onOpenWords: () => void;
  summary: { known: number; learning: number; due: number; streak: number };
  /** показываем, только если телеграм говорит, что приложения на экране нет */
  homeScreen?: { onAdd: () => void; onDismiss: () => void };
};

export function HomeScreen({
  settings,
  onChange,
  onStart,
  onOpenWords,
  summary,
  homeScreen,
}: Props) {
  return (
    <Screen footer={<PrimaryButton onClick={onStart}>Учить</PrimaryButton>}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 500, margin: 0 }}>
          Слова
        </h1>
        <button
          onClick={() => {
            haptic.tap();
            onOpenWords();
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: colors.accent, fontSize: 15, fontWeight: 500 }}
        >
          <IconList size={20} />
          Мои слова
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
        <Stat value={summary.known} label="знаю" tone={colors.ok} />
        <Stat value={summary.due} label="на повторе" tone={colors.accent} />
        <Stat value={summary.streak} label="дней подряд" tone={colors.warm} flame />
      </div>

      {homeScreen && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 16,
            background: colors.surface,
            border: `1px solid ${colors.line}`,
            borderRadius: radius.card,
            padding: '13px 14px',
          }}
        >
          <IconHome size={22} color={colors.accent} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>На домашний экран</div>
            <div style={{ fontSize: 13, color: colors.muted, marginTop: 1 }}>
              Открывать сразу, не ища бота
            </div>
          </div>
          <button
            onClick={() => {
              haptic.tap();
              homeScreen.onAdd();
            }}
            style={{ color: colors.accent, fontSize: 15, fontWeight: 600, padding: '6px 2px' }}
          >
            Добавить
          </button>
          <button
            onClick={homeScreen.onDismiss}
            aria-label="Не сейчас"
            style={{ color: colors.muted, fontSize: 20, padding: '4px 6px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      <SectionTitle style={{ marginTop: 26 }}>Набор</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {SETS.map((set) => {
          const active = set.id === settings.set;
          return (
            <button
              key={set.id}
              onClick={() => {
                if (!active) haptic.select();
                onChange({ set: set.id });
              }}
              style={{
                padding: '13px 16px',
                borderRadius: radius.row,
                background: colors.surface,
                border: `1px solid ${active ? colors.accent : colors.line}`,
                boxShadow: active ? '0 2px 10px rgba(34,31,25,0.06)' : 'none',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 600, color: colors.ink }}>{set.title}</div>
              <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>{set.subtitle}</div>
            </button>
          );
        })}
      </div>

      <SectionTitle style={{ marginTop: 26 }}>Уровень</SectionTitle>
      <Segmented
        value={settings.level}
        onChange={(level) => onChange({ level })}
        options={[
          { value: 'A1', label: 'A1' },
          { value: 'A2', label: 'A2' },
          { value: 'B1', label: 'B1' },
          { value: 'B2', label: 'B2' },
          { value: 'C1', label: 'C1' },
        ]}
      />

      <SectionTitle style={{ marginTop: 26 }}>Слов в уроке</SectionTitle>
      <Segmented
        value={settings.lessonSize}
        onChange={(lessonSize) => onChange({ lessonSize })}
        options={[
          { value: 10, label: '10' },
          { value: 20, label: '20' },
          { value: 30, label: '30' },
        ]}
      />

      <div style={{ height: 8 }} />
    </Screen>
  );
}

function Stat({
  value,
  label,
  tone,
  flame,
}: {
  value: number;
  label: string;
  tone: string;
  flame?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: colors.surface,
        border: `1px solid ${colors.line}`,
        borderRadius: radius.card,
        padding: '14px 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {flame && <IconFlame size={18} color={tone} />}
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 500, color: tone }}>
          {value}
        </span>
      </div>
      <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{label}</div>
    </div>
  );
}
