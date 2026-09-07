import { useMemo, useState } from 'react';
import { POS_LABEL, type Word } from '../data/words';
import { colors, radius } from '../theme/colors';
import { Chip, PrimaryButton, ProgressDots, Screen, Segmented } from '../components/ui';
import { IconPlus, IconSearch } from '../components/icons';
import { WordCard } from '../components/WordCard';
import { isCustom } from '../lib/customWords';
import type { Progress, WordProgress } from '../lib/leitner';
import { haptic } from '../telegram/webapp';

type Filter = 'all' | 'learning' | 'known' | 'hard';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'learning', label: 'Учу' },
  { value: 'known', label: 'Знаю' },
  { value: 'hard', label: 'Трудные' },
];

const PAGE = 40;

/** Список всех слов: поиск, фильтры, точки усвоения, свои слова. */
export function WordsScreen({
  words,
  progress,
  onAdd,
  onDelete,
}: {
  words: Word[];
  progress: Progress;
  onAdd: () => void;
  onDelete: (word: Word) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);

  const recordOf = (word: Word): WordProgress | undefined => progress[word.level]?.[word.id];

  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words.filter((word) => {
      const record = recordOf(word);
      if (filter === 'learning' && !(record && record.box < 5)) return false;
      if (filter === 'known' && !(record && record.box >= 5)) return false;
      if (filter === 'hard' && !(record && record.errors >= 2)) return false;
      if (!q) return true;
      return (
        word.en.toLowerCase().includes(q) ||
        word.ru.some((r) => r.toLowerCase().includes(q))
      );
    });
    // recordOf зависит только от progress
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, progress, query, filter]);

  const visible = found.slice(0, limit);

  return (
    <Screen
      header={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 44,
              padding: '0 14px',
              background: colors.surface,
              border: `1px solid ${colors.line}`,
              borderRadius: radius.row,
            }}
          >
            <IconSearch size={19} color={colors.muted} />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="Поиск по слову или переводу"
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 16,
              }}
            />
          </div>
          <Segmented
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setLimit(PAGE);
            }}
            options={FILTERS}
          />
        </div>
      }
      footer={
        <PrimaryButton onClick={onAdd}>
          <IconPlus size={20} color="#FFFFFF" />
          Добавить слово
        </PrimaryButton>
      }
    >
      <div style={{ fontSize: 12, color: colors.muted, margin: '4px 0 10px' }}>
        {found.length === 0 ? 'Ничего не нашлось' : `${found.length} ${plural(found.length)}`}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((word) => {
          const record = recordOf(word);
          const open = openId === word.id;
          return (
            <div key={word.id}>
              <button
                onClick={() => {
                  haptic.select();
                  setOpenId(open ? null : word.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  background: colors.surface,
                  border: `1px solid ${open ? colors.accent : colors.line}`,
                  borderRadius: radius.row,
                  padding: '11px 14px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500 }}>
                      {word.en}
                    </span>
                    {word.ipa && (
                      <span
                        style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: colors.ink2 }}
                      >
                        {word.ipa}
                      </span>
                    )}
                    {isCustom(word) && <Chip tone="accent">своё</Chip>}
                  </div>
                  <div style={{ fontSize: 14, color: colors.ink2, marginTop: 2 }}>
                    {word.ru.join(', ')}
                    <span style={{ color: colors.muted }}> · {POS_LABEL[word.pos]}</span>
                  </div>
                </div>
                <ProgressDots box={record?.box ?? 0} />
              </button>

              {open && (
                <div className="card-in" style={{ marginTop: 8 }}>
                  <WordCard word={word} />
                  {isCustom(word) && (
                    <button
                      onClick={() => {
                        haptic.tap();
                        onDelete(word);
                      }}
                      style={{
                        marginTop: 8,
                        padding: '8px 4px',
                        color: colors.bad,
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      Удалить слово
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {found.length > visible.length && (
        <button
          onClick={() => {
            haptic.tap();
            setLimit((n) => n + PAGE);
          }}
          style={{
            width: '100%',
            marginTop: 12,
            padding: '14px 0',
            textAlign: 'center',
            color: colors.accent,
            fontSize: 15,
            fontWeight: 500,
          }}
        >
          Показать ещё
        </button>
      )}

      <div style={{ height: 8 }} />
    </Screen>
  );
}

function plural(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'слов';
  const mod10 = n % 10;
  if (mod10 === 1) return 'слово';
  if (mod10 >= 2 && mod10 <= 4) return 'слова';
  return 'слов';
}
