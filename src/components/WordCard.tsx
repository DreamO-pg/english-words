import type { ReactNode } from 'react';
import { POS_LABEL, type Word } from '../data/words';
import { colors, radius } from '../theme/colors';
import { Chip } from './ui';
import { IconWarn } from './icons';
import { SoundButton } from './SoundButton';
import { isCustom } from '../lib/customWords';

/**
 * Карточка слова — ядро приложения. Четыре слоя:
 * слово и звук · значение и часть речи · живой пример · сочетаемость.
 * Пятый слой, предупреждение про ложного друга, появляется только
 * у слов с заполненным falseFriend.
 */
export function WordCard({ word }: { word: Word }) {
  return (
    <div>
      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.line}`,
          borderRadius: radius.card,
          padding: 18,
        }}
      >
        {/* 1. слово, транскрипция, звук */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 30,
                fontWeight: 500,
                lineHeight: 1.15,
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
                  marginTop: 3,
                }}
              >
                {word.ipa}
              </div>
            )}
          </div>
          <SoundButton text={word.en} />
        </div>

        {/* 2. значение и часть речи */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: colors.ink, lineHeight: 1.35 }}>
            {word.ru.join(', ')}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <Chip>{POS_LABEL[word.pos]}</Chip>
            <Chip>{word.level}</Chip>
            {isCustom(word) && <Chip tone="accent">своё</Chip>}
          </div>
        </div>

        {/* 3. живой пример */}
        {word.exampleEn && (
          <>
            <Divider />
            <div style={{ fontSize: 14, lineHeight: 1.5, color: colors.ink }}>
              {highlight(word.exampleEn, word.en)}
            </div>
            {word.exampleRu && (
              <div style={{ fontSize: 13, fontWeight: 400, color: colors.muted, marginTop: 4 }}>
                {word.exampleRu}
              </div>
            )}
          </>
        )}

        {/* 4. сочетаемость и близкие слова */}
        {(word.collocations.length > 0 || word.synonyms?.length) && <Divider />}
        {word.collocations.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {word.collocations.map((c) => (
              <span
                key={c}
                style={{
                  background: colors.sunken,
                  borderRadius: radius.chip,
                  padding: '5px 9px',
                  fontSize: 13,
                  color: colors.ink2,
                }}
              >
                {c}
              </span>
            ))}
          </div>
        )}
        {word.synonyms?.length ? (
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 10 }}>
            Близкие: {word.synonyms.join(' · ')}
          </div>
        ) : null}
      </div>

      {/* 5. ложный друг */}
      {word.falseFriend && (
        <div
          style={{
            marginTop: 10,
            background: colors.surface,
            border: `1px solid ${colors.warm}`,
            borderRadius: radius.card,
            padding: 14,
            display: 'flex',
            gap: 10,
          }}
        >
          <IconWarn size={20} color={colors.warm} style={{ flex: '0 0 20px', marginTop: 1 }} />
          <div style={{ fontSize: 14, lineHeight: 1.45, color: colors.ink }}>{word.falseFriend}</div>
        </div>
      )}
    </div>
  );
}

const Divider = () => (
  <div style={{ height: 1, background: colors.line, margin: '16px 0 14px' }} />
);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Подсвечиваем слово в примере. Формы отличаются от словарной
 * (achieve → achieved), поэтому длинные слова ищем по основе.
 * Не нашли — просто оставляем предложение как есть.
 */
function highlight(sentence: string, en: string): ReactNode {
  const patterns = en
    .split(/\s+/)
    .map((part) => (part.length > 4 ? `${escapeRe(part.slice(0, -2))}\\w*` : escapeRe(part)));

  let re: RegExp;
  try {
    re = new RegExp(`\\b(${patterns.join('|')})\\b`, 'gi');
  } catch {
    return sentence;
  }

  const out: ReactNode[] = [];
  let last = 0;
  for (const match of sentence.matchAll(re)) {
    const at = match.index ?? 0;
    if (at > last) out.push(sentence.slice(last, at));
    out.push(
      <b key={`${at}-${match[0]}`} style={{ color: colors.accent, fontWeight: 700 }}>
        {match[0]}
      </b>,
    );
    last = at + match[0].length;
  }
  if (out.length === 0) return sentence;
  if (last < sentence.length) out.push(sentence.slice(last));
  return out;
}
