import { useState } from 'react';
import { POS_LABEL, type Level, type Pos } from '../data/words';
import { colors, radius } from '../theme/colors';
import { PrimaryButton, Screen, SectionTitle } from '../components/ui';
import type { CustomDraft } from '../lib/customWords';
import { haptic } from '../telegram/webapp';

const POS_ORDER: Pos[] = ['noun', 'verb', 'adj', 'adv', 'phrasal', 'phrase'];

/** Форма своего слова. Уровень берём из настроек — он же решает, с кем слово встретится в уроке. */
export function AddWordScreen({
  level,
  onSave,
  onCancel,
}: {
  level: Level;
  onSave: (draft: CustomDraft) => void;
  onCancel: () => void;
}) {
  const [en, setEn] = useState('');
  const [ru, setRu] = useState('');
  const [exampleEn, setExampleEn] = useState('');
  const [exampleRu, setExampleRu] = useState('');
  const [pos, setPos] = useState<Pos>('noun');

  const valid = en.trim().length > 0 && ru.trim().length > 0;

  return (
    <Screen
      footer={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PrimaryButton
            disabled={!valid}
            onClick={() => onSave({ en, ru, exampleEn, exampleRu, pos, level })}
          >
            Сохранить
          </PrimaryButton>
          <PrimaryButton tone="quiet" onClick={onCancel}>
            Отмена
          </PrimaryButton>
        </div>
      }
    >
      <h1
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 26,
          fontWeight: 500,
          margin: '12px 0 22px',
        }}
      >
        Своё слово
      </h1>

      <Field label="Слово" value={en} onChange={setEn} placeholder="diligent" serif />
      <Field
        label="Перевод"
        value={ru}
        onChange={setRu}
        placeholder="прилежный, старательный"
        hint="Несколько значений — через запятую, до трёх"
      />

      <SectionTitle style={{ marginTop: 22 }}>Часть речи</SectionTitle>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {POS_ORDER.map((value) => {
          const active = value === pos;
          return (
            <button
              key={value}
              onClick={() => {
                if (!active) haptic.select();
                setPos(value);
              }}
              style={{
                height: 34,
                padding: '0 14px',
                borderRadius: radius.pill,
                background: active ? colors.accentBg : colors.sunken,
                color: active ? colors.accent : colors.ink2,
                fontSize: 14,
                fontWeight: active ? 600 : 500,
              }}
            >
              {POS_LABEL[value]}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>
        Неправильные варианты в уроке подбираются той же части речи, поэтому её и спрашиваем.
      </div>

      <div style={{ marginTop: 22 }}>
        <Field
          label="Пример"
          value={exampleEn}
          onChange={setExampleEn}
          placeholder="She is a diligent student."
          multiline
        />
        <Field
          label="Перевод примера"
          value={exampleRu}
          onChange={setExampleRu}
          placeholder="Она прилежная студентка."
          hint="Необязательно"
          multiline
        />
      </div>

      <div style={{ fontSize: 13, color: colors.muted, marginTop: 18 }}>
        Уровень — {level}, как в настройках. Слово попадёт в уроки этого уровня наравне с
        остальными и будет помечено как своё.
      </div>

      <div style={{ height: 8 }} />
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  serif,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  serif?: boolean;
  multiline?: boolean;
}) {
  const style = {
    width: '100%',
    minHeight: multiline ? 62 : 48,
    padding: '12px 14px',
    background: colors.surface,
    border: `1px solid ${colors.line}`,
    borderRadius: radius.row,
    fontSize: 16,
    fontFamily: serif ? 'var(--font-serif)' : 'var(--font-sans)',
    color: colors.ink,
    outline: 'none',
    resize: 'none' as const,
    lineHeight: 1.4,
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <SectionTitle style={{ marginBottom: 8 }}>{label}</SectionTitle>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          style={style}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={style}
        />
      )}
      {hint && <div style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>{hint}</div>}
    </div>
  );
}
