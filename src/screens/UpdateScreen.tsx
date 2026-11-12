import { colors } from '../theme/colors';
import { PrimaryButton, Screen } from '../components/ui';
import { MIN_VERSION, clientVersion } from '../telegram/webapp';

/**
 * Экраны, на которых учить нельзя, потому что прогресс некуда сохранить.
 * Лучше сказать сразу, чем дать пройти урок и потерять его.
 *
 * outdated — клиент старше 6.9 не умеет CloudStorage.
 * sdk — телеграм открыл приложение, но его скрипт не загрузился.
 */
export function UpdateScreen({ reason }: { reason: 'outdated' | 'sdk' }) {
  if (reason === 'sdk') {
    return (
      <Screen
        footer={<PrimaryButton onClick={() => window.location.reload()}>Повторить</PrimaryButton>}
      >
        <div style={{ paddingTop: 40 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 500 }}>
            Не удалось подключиться к Telegram
          </div>
          <div style={{ marginTop: 10, color: colors.ink2, fontSize: 15, lineHeight: 1.45 }}>
            Не загрузился служебный скрипт Telegram, без него прогресс не сохранить в облако.
            Проверьте интернет и попробуйте ещё раз.
          </div>
        </div>
      </Screen>
    );
  }
  return (
    <Screen>
      <div style={{ paddingTop: 40 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 500 }}>
          Обновите Telegram
        </div>
        <div style={{ marginTop: 10, color: colors.ink2, fontSize: 15, lineHeight: 1.45 }}>
          Этой версии Telegram ({clientVersion || 'неизвестна'}) не хватает облачного хранилища —
          прогресс негде сохранить. Нужна версия Mini Apps {MIN_VERSION} или новее: обновите
          приложение и откройте «Слова» снова.
        </div>
      </div>
    </Screen>
  );
}
