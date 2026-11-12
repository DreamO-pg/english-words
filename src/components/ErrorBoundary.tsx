import { Component, type ReactNode } from 'react';
import { colors } from '../theme/colors';

/**
 * Последний рубеж: исключение при рендере не должно оставлять белый экран.
 * Законченные уроки к этому моменту уже в облаке или в очереди на
 * устройстве, поэтому перезагрузка их не теряет.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[app] ошибка рендера', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ padding: '58px 24px', background: colors.bg, height: '100%' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 500 }}>
          Что-то сломалось
        </div>
        <div style={{ marginTop: 10, color: colors.ink2, fontSize: 15, lineHeight: 1.45 }}>
          Сохранённый прогресс не пострадал. Перезапустите приложение.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 24,
            width: '100%',
            height: 56,
            borderRadius: 16,
            background: colors.accent,
            color: '#FFFFFF',
            fontSize: 17,
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          Перезапустить
        </button>
      </div>
    );
  }
}
