/**
 * Единственный источник цвета. Тема фиксированно светлая:
 * themeParams телеграма намеренно игнорируются.
 *
 * accent / ok / bad построены в oklch с одной светлотой (L ≈ 0.54),
 * поэтому на бумажном фоне звучат как один голос. Не заменять
 * на стандартные синий / зелёный / красный.
 */
export const colors = {
  bg: '#FAF9F5',
  surface: '#FFFFFF',
  sunken: '#F4F2ED',
  line: '#E2DFD8',
  ink: '#221F19',
  ink2: '#5B5752',
  muted: '#888681',
  accent: '#007C99',
  accentBg: '#D8F0F8',
  ok: '#328053',
  okBg: '#DDF4E4',
  bad: '#B14B41',
  badBg: '#FFE7E3',
  warm: '#C77F3E',
  /** текст неактивного варианта после ответа */
  inkDisabled: '#B4B1AA',
} as const;

export type ColorToken = keyof typeof colors;

/** Радиусы — единый ритм форм. */
export const radius = {
  chip: 8,
  segment: 12,
  row: 14,
  button: 16,
  card: 18,
  pill: 999,
} as const;

/** Шаг отступов — 4. */
export const space = (n: number) => n * 4;

export const font = {
  serif: "'Literata', Georgia, 'Times New Roman', serif",
  sans: "'Golos Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
} as const;

/** Раскладывает токены в CSS-переменные на :root. */
export function applyCssVariables(root: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(colors)) {
    root.style.setProperty(`--c-${kebab(name)}`, value);
  }
  for (const [name, value] of Object.entries(radius)) {
    root.style.setProperty(`--r-${kebab(name)}`, `${value}px`);
  }
  root.style.setProperty('--font-serif', font.serif);
  root.style.setProperty('--font-sans', font.sans);
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
