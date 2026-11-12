import { useEffect, useState } from 'react';
import { colors } from '../theme/colors';
import { PrimaryButton, Screen } from '../components/ui';

/**
 * Пока прогресс не прочитан из облака, учить нельзя: урок на пустом
 * прогрессе перезаписал бы сохранённый. Не прочиталось — честно говорим
 * и даём повторить.
 */
export function LoadScreen({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  // Короткую загрузку не показываем, чтобы экран не мигал.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 400);
    return () => window.clearTimeout(t);
  }, []);

  if (!failed) {
    return (
      <Screen>
        {slow && (
          <div style={{ paddingTop: 40, color: colors.muted, fontSize: 15 }}>Загружаю прогресс…</div>
        )}
      </Screen>
    );
  }

  return (
    <Screen footer={<PrimaryButton onClick={onRetry}>Повторить</PrimaryButton>}>
      <div style={{ paddingTop: 40 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 500 }}>
          Не удалось загрузить прогресс
        </div>
        <div style={{ marginTop: 10, color: colors.ink2, fontSize: 15, lineHeight: 1.45 }}>
          Похоже, пропала связь с Telegram. Прогресс не потерян — он в облаке. Проверьте
          интернет и попробуйте ещё раз.
        </div>
      </div>
    </Screen>
  );
}
