# 12. Конфигурация

## Переменные окружения

**Их нет.** Ни приложение, ни сборка, ни CI не читают переменных окружения:
- `grep -rn "import.meta.env\|process.env" src vite.config.ts scripts` — 0 совпадений;
- файлов `.env*` в репозитории нет (`*.local` в `.gitignore` — стандартная заготовка Vite);
- в workflow нет `env:` и `secrets.*`.

| Имя | Обязательна | Назначение | Формат |
|---|---|---|---|
| — | — | Переменных нет | — |

Всё, что в других проектах настраивается окружением, здесь зашито в код:

| Настройка | Где | Значение |
|---|---|---|
| Базовый путь сайта | [`vite.config.ts`](../../vite.config.ts) `base` | `'/english-words/'` |
| Каталог сборки | `vite.config.ts` `build.outDir`, `assetsDir` | `dist`, `assets` |
| Минимальная версия Mini Apps | [`src/telegram/webapp.ts`](../../src/telegram/webapp.ts) `MIN_VERSION` | `'6.9'` |
| Таймаут и попытки хранилища | `webapp.ts` `TIMEOUT_MS`, `ATTEMPTS` | 8000 мс, 3 |
| Повтор синхронизации | [`src/App.tsx`](../../src/App.tsx) `RETRY_MS` | 20 000 мс |
| Префикс `localStorage` | `webapp.ts` `LS_PREFIX` | `ew:` |
| Ключ очереди | [`src/lib/sync.ts`](../../src/lib/sync.ts) `PENDING_KEY` | `ew-sync:pending` |
| Интервалы Лейтнера | [`src/lib/leitner.ts`](../../src/lib/leitner.ts) `INTERVALS` | `[1, 3, 7, 16, 35]` |
| Порог переворота пропорции | [`src/lib/lesson.ts`](../../src/lib/lesson.ts) `REVIEW_FLIP` | 30 |
| Настройки по умолчанию | [`src/lib/settings.ts`](../../src/lib/settings.ts) `DEFAULT_SETTINGS` | `level`, `B1`, 20 |
| Цвета | [`src/theme/colors.ts`](../../src/theme/colors.ts) | см. [06](06-mini-app-screens.md#цвета-colors) |
| Язык и скорость озвучки | [`src/lib/speech.ts`](../../src/lib/speech.ts) | `en-US`, 0.95 |
| Версия Node в CI | `.github/workflows/*.yml` | 22 |

Если появится сервер, первыми переменными станут токен бота и секрет для проверки `initData`. Их нельзя будет класть ни в код Mini App (он публичный), ни в репозиторий.

## Конфигурационные файлы

| Файл | Что настраивает |
|---|---|
| `package.json` | Скрипты (`dev`, `build`, `preview`, `check:*`, `lint`, `check`), зависимости, `engines.node >= 20`, `type: module` |
| `vite.config.ts` | Плагин React, `base`, `outDir`, `assetsDir` |
| `tsconfig.json` | Строгий TypeScript, `include: ["src", "vite.config.ts"]` (скрипты `scripts/*.ts` типами не проверяются в `build`, но проверяются линтером) |
| `eslint.config.js` | Правила для `src`, `scripts/*.ts`, `vite.config.ts` (TS) и `scripts/*.mjs`, `eslint.config.js` (Node) |
| `index.html` | `lang="ru"`, viewport с `viewport-fit=cover`, `color-scheme: light`, заголовок «Слова», фавикон data-URI, скрипт SDK |
| `.github/workflows/check.yml`, `deploy.yml` | CI/CD ([11](11-infrastructure.md#cicd-github-actions)) |
| `.gitignore` | `node_modules`, `dist`, `.DS_Store`, `*.local`, `.cache` |

## Скрипты npm

| Скрипт | Команда | Что делает |
|---|---|---|
| `dev` | `vite` | Dev-сервер на `http://localhost:5173/english-words/` |
| `build` | `tsc --noEmit && vite build` | Проверка типов и сборка в `dist/` |
| `preview` | `vite preview` | Отдаёт `dist/` на `http://localhost:4173/english-words/` |
| `check:words` | esbuild `src/data/words.ts` → `.cache/words.mjs`, `node scripts/check-words.mjs` | Проверка словаря |
| `check:engine` | esbuild `scripts/engine-entry.ts` → `.cache/engine.mjs`, `node scripts/check-engine.mjs` | Проверка движка |
| `check:storage` | esbuild `scripts/storage-entry.ts` → `.cache/storage.mjs`, `node scripts/check-storage.mjs` | Проверка хранения |
| `lint` | `eslint .` | Линтер |
| `check` | `lint && check:words && check:engine && check:storage` | Всё сразу, как в CI |

## BotFather

Бот настраивается только в @BotFather. Шаги по README, дополненные тем, что известно из кода.

### Создание и Mini App

1. `/newbot` → имя и username (если бота ещё нет).
2. `/mybots` → бот → **Bot Settings → Menu Button → Configure menu button**.
3. Прислать URL: `https://<логин>.github.io/english-words/` — **обязательно со слэшем на конце**. Для этого репозитория: `https://dreamo-pg.github.io/english-words/`.
4. Прислать подпись кнопки: `Слова`.

Отдельно регистрировать Mini App через `/newapp` не требуется: README его не упоминает, приложение открывается через Menu Button. Зарегистрирован ли у боевого бота Mini App через `/newapp` или Main Mini App (кнопка «Открыть» в профиле), **не проверено**.

### Домен

Отдельной привязки домена для Menu Button не нужно: Telegram открывает тот URL, который задан. `/setdomain` нужен только для Telegram Login Widget, здесь он не используется.

### Внешний вид

5. Иконка: `/mybots` → **Edit Bot → Edit Botpic** → `assets/bot-icon.png` (512×512).
6. Описание: `/setdescription` — README предлагает: «Тренажёр английских слов B1–B2. Нажмите кнопку «Слова» внизу, чтобы начать.»
7. Строка профиля: `/setabouttext`.

### Команды

`/setcommands` не нужен: обработчика команд нет ([04](04-bot-in-telegram.md#команды)). Если команды заданы, пользователь увидит их в меню, но бот на них не ответит. Лучше их не задавать.

### Что проверить после настройки

- Кнопка меню открывает приложение без «белого экрана».
- Главная показывает «0 знаю» и т. д. у нового пользователя, а на втором устройстве после урока — тот же прогресс.
- Тот же URL открывается в обычном браузере (без Telegram он работает на `localStorage`).

Какие значения сейчас стоят в BotFather у боевого бота, **не проверено** (доступа нет).
