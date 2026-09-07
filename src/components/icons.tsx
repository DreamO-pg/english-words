/** Контурные иконки 24×24, штрих 1.7, скруглённые концы. Эмодзи в интерфейсе нет. */
import type { CSSProperties } from 'react';

type Props = { size?: number; color?: string; style?: CSSProperties };

const base = (size: number, color: string, style?: CSSProperties) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: color,
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  style,
});

export const IconSound = ({ size = 24, color = 'currentColor', style }: Props) => (
  <svg {...base(size, color, style)}>
    <path d="M4 9.5h3L11 6v12l-4-3.5H4z" />
    <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
    <path d="M18 6.7a7.5 7.5 0 0 1 0 10.6" />
  </svg>
);

export const IconCheck = ({ size = 24, color = 'currentColor', style }: Props) => (
  <svg {...base(size, color, style)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const IconCross = ({ size = 24, color = 'currentColor', style }: Props) => (
  <svg {...base(size, color, style)}>
    <path d="M7 7l10 10M17 7L7 17" />
  </svg>
);

export const IconSearch = ({ size = 24, color = 'currentColor', style }: Props) => (
  <svg {...base(size, color, style)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </svg>
);

export const IconPlus = ({ size = 24, color = 'currentColor', style }: Props) => (
  <svg {...base(size, color, style)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconWarn = ({ size = 24, color = 'currentColor', style }: Props) => (
  <svg {...base(size, color, style)}>
    <path d="M12 4.5L21 19.5H3z" />
    <path d="M12 10v4" />
    <path d="M12 17h.01" />
  </svg>
);

export const IconFlame = ({ size = 24, color = 'currentColor', style }: Props) => (
  <svg {...base(size, color, style)}>
    <path d="M12.5 3c.6 3.2-1.4 4.6-3.2 6.6C7.9 11 7 12.6 7 14.3a5 5 0 0 0 10 0c0-2.3-1-4-2.6-5.4.3 1.9-.3 3-1.3 3.6.8-3.4-1.6-5.6-.6-9.5z" />
  </svg>
);

export const IconList = ({ size = 24, color = 'currentColor', style }: Props) => (
  <svg {...base(size, color, style)}>
    <path d="M8 7h12M8 12h12M8 17h12" />
    <path d="M4 7h.01M4 12h.01M4 17h.01" />
  </svg>
);

export const IconArrowRight = ({ size = 24, color = 'currentColor', style }: Props) => (
  <svg {...base(size, color, style)}>
    <path d="M5 12h13" />
    <path d="M13 6.5L18.5 12 13 17.5" />
  </svg>
);

export const IconHome = ({ size = 24, color = 'currentColor', style }: Props) => (
  <svg {...base(size, color, style)}>
    <path d="M4 10.5L12 4l8 6.5V20H4z" />
    <path d="M9.5 20v-5h5v5" />
  </svg>
);
