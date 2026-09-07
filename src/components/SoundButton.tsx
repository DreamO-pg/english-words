import { colors } from '../theme/colors';
import { IconSound } from './icons';
import { canSpeak, speak } from '../lib/speech';
import { haptic } from '../telegram/webapp';

/** Круглая кнопка озвучки 44×44: accentBg и иконка акцентом. */
export function SoundButton({ text, size = 44 }: { text: string; size?: number }) {
  if (!canSpeak) return null;
  return (
    <button
      aria-label="Произнести"
      onClick={() => {
        haptic.tap();
        speak(text);
      }}
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: '50%',
        background: colors.accentBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconSound size={Math.round(size * 0.5)} color={colors.accent} />
    </button>
  );
}
