import { colors } from '../theme/colors';
import { Screen } from '../components/ui';
import { MIN_VERSION, clientVersion } from '../telegram/webapp';

/**
 * Клиент старше 6.9 не умеет CloudStorage: прогресс сохранять некуда.
 * Лучше сказать сразу, чем дать пройти урок и потерять его.
 */
export function UpdateScreen() {
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
