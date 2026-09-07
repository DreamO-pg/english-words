import type { CSSProperties, ReactNode } from 'react';
import { colors, radius } from '../theme/colors';
import { haptic } from '../telegram/webapp';

/** Экран: поля 24, отступ сверху под шапку телеграма, скролл внутри. */
export function Screen({
  children,
  header,
  footer,
}: {
  children: ReactNode;
  /** остаётся на месте, пока содержимое скроллится */
  header?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: colors.bg }}>
      {header && <div style={{ padding: '14px 24px 10px' }}>{header}</div>}
      <div className="scroll" style={{ flex: 1, padding: header ? '0 24px 24px' : '18px 24px 24px' }}>
        {children}
      </div>
      {footer && (
        <div
          style={{
            padding: '12px 24px calc(20px + env(safe-area-inset-bottom))',
            background: colors.bg,
            borderTop: `1px solid ${colors.line}`,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

/** Подзаголовок секции: 11/600, uppercase, letter-spacing .1em. */
export function SectionTitle({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: colors.muted,
        marginBottom: 10,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  tone = 'accent',
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'accent' | 'quiet';
  style?: CSSProperties;
}) {
  const quiet = tone === 'quiet';
  return (
    <button
      onClick={() => {
        if (disabled) return;
        haptic.tap();
        onClick?.();
      }}
      disabled={disabled}
      style={{
        width: '100%',
        height: 56,
        borderRadius: radius.button,
        background: disabled ? colors.sunken : quiet ? colors.surface : colors.accent,
        color: disabled ? colors.inkDisabled : quiet ? colors.ink : '#FFFFFF',
        border: quiet ? `1px solid ${colors.line}` : 'none',
        fontSize: 17,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Сегментированный переключатель — подложка sunken, радиус 12. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        background: colors.sunken,
        borderRadius: radius.segment,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            onClick={() => {
              if (!active) haptic.select();
              onChange(o.value);
            }}
            style={{
              flex: 1,
              height: 38,
              borderRadius: radius.segment - 3,
              background: active ? colors.surface : 'transparent',
              color: active ? colors.ink : colors.ink2,
              fontSize: 15,
              fontWeight: active ? 600 : 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Пять точек усвоения: 1 красная · 2 тёплых · 3–4 акцентных · 5 зелёных. */
export function ProgressDots({ box, size = 7 }: { box: number; size?: number }) {
  const color =
    box <= 1 ? colors.bad : box === 2 ? colors.warm : box <= 4 ? colors.accent : colors.ok;
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: i <= box ? color : colors.line,
          }}
        />
      ))}
    </div>
  );
}

/** Прогресс урока: тонкая полоса и счётчик. */
export function LessonProgress({ done, total }: { done: number; total: number }) {
  const share = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          flex: 1,
          height: 4,
          borderRadius: radius.pill,
          background: colors.sunken,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${share * 100}%`,
            height: '100%',
            background: colors.accent,
            borderRadius: radius.pill,
            transition: 'width 180ms ease-out',
          }}
        />
      </div>
      <span style={{ fontSize: 12, color: colors.muted, fontVariantNumeric: 'tabular-nums' }}>
        {done} / {total}
      </span>
    </div>
  );
}

/** Пилюля: часть речи, уровень. */
export function Chip({
  children,
  tone = 'sunken',
}: {
  children: ReactNode;
  tone?: 'sunken' | 'accent';
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 26,
        padding: '0 10px',
        borderRadius: radius.pill,
        background: tone === 'accent' ? colors.accentBg : colors.sunken,
        color: tone === 'accent' ? colors.accent : colors.ink2,
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

/** Заглушка на время сборки экранов. */
export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div style={{ paddingTop: 40 }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 500 }}>{title}</div>
      <div style={{ marginTop: 8, color: colors.muted, fontSize: 14 }}>{note}</div>
    </div>
  );
}
