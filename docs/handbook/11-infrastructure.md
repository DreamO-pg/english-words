# 11. Инфраструктура

## Сводка

| Компонент | Где | Кто управляет |
|---|---|---|
| Бот | Telegram, запись в BotFather | Владелец бота через @BotFather |
| Сервер бота | **нет** | — |
| Бэкенд, API | **нет** | — |
| База данных | **нет**; пользовательские данные в Telegram CloudStorage | Telegram |
| Фронтенд (Mini App) | GitHub Pages | GitHub Actions из репозитория |
| Репозиторий | GitHub `DreamO-pg/english-words`, публичный | Владелец (единственный участник с правами admin) |
| CI/CD | GitHub Actions: `check.yml`, `deploy.yml` | В репозитории |
| Домен | `dreamo-pg.github.io` (свой домен не подключён, `cname: null`) | GitHub |
| HTTPS | Сертификат GitHub Pages, `https_enforced: true` | GitHub |
| Telegram SDK | `https://telegram.org/js/telegram-web-app.js` | Telegram |

Данные о Pages, окружениях и секретах получены через `gh api` 2026-11-12.

## Хостинг фронтенда: GitHub Pages

- **Адрес:** `https://dreamo-pg.github.io/english-words/`. Путь `/english-words/` совпадает с именем репозитория и с `base` в [`vite.config.ts`](../../vite.config.ts).
- **Тип сборки:** `build_type: workflow` (Settings → Pages → Source → GitHub Actions). Ветки `gh-pages` нет, артефакт загружается из workflow.
- **`public/.nojekyll`** попадает в `dist/` и отключает обработку Jekyll.
- **Без слэша на конце** (`…/english-words`) Pages отвечает редиректом 301 на адрес со слэшем. Поэтому в BotFather нужен URL **со слэшем** (README, находка T-04). Влияет ли редирект на ограничение Bot API 10.2 (методы Mini App работают только с исходного домена), **не проверено** на живом клиенте.
- **Кэширование:** заголовки задаёт GitHub Pages, проект на них не влияет. Имена JS/CSS/шрифтов содержат хэш, `index.html` — нет. Поэтому после деплоя пользователь может ещё какое-то время получать старый `index.html` из кэша Pages или WebView Telegram. Конкретные заголовки и время жизни кэша **не проверены**: документация не делала запросов к боевому сайту.
- **Ограничения Pages:** публичный сайт, лимиты трафика и размера GitHub (сайт ≈ 1 МБ, далеко от лимитов).

## CI/CD: GitHub Actions

### `check.yml` — проверки на pull request

| Параметр | Значение |
|---|---|
| Триггер | `pull_request` в `main` |
| Права | `contents: read` |
| Конкуренция | `check-${{ github.ref }}`, отмена предыдущего запуска |
| Шаги | `actions/checkout@v4` → `actions/setup-node@v4` (Node 22, кэш npm) → `npm ci` → `npm run check` → `npm run build` |

### `deploy.yml` — деплой

| Параметр | Значение |
|---|---|
| Триггер | `push` в `main` и ручной запуск (`workflow_dispatch`) |
| Права | `contents: read`, `pages: write`, `id-token: write` |
| Конкуренция | группа `pages`, отмена предыдущего |
| Job `build` | checkout → Node 22 → `npm ci` → `npm run check` → `npm run build` → `actions/configure-pages@v5` → `actions/upload-pages-artifact@v3` (`path: dist`) |
| Job `deploy` | `needs: build`, окружение `github-pages` (защищено правилом по веткам) → `actions/deploy-pages@v4` |

Если `npm run check` или сборка падают, деплоя не будет. Исключение — ошибки словаря в `check:words`: скрипт их печатает, но не завершается с ошибкой ([03](03-content.md#правила-словаря-и-проверка-checkwords)).

История запусков (из `gh run list`):

| Дата (UTC) | Workflow | Событие | Итог | Длительность |
|---|---|---|---|---|
| 2026-09-07 17:14 | Deploy to GitHub Pages | push (первый коммит) | success | 40 с |
| 2026-11-12 07:59 | Check | pull_request `docs/audit` | success | 1 мин 4 с |
| 2026-11-12 11:22 | Deploy to GitHub Pages | push (мерж PR #1) | success | 1 мин 9 с |

## Секреты и доступы

- **Секретов в GitHub Actions нет** (`actions/secrets`: 0). Деплой на Pages работает через OIDC (`id-token: write`), без токенов.
- **Токен бота нигде не используется** и не должен попадать в репозиторий. Где он хранится у владельца, документация не знает.
- **Доступ к репозиторию** — один участник с правами администратора.
- **Защиты ветки `main` нет** (`Branch not protected`). Мержить без PR технически можно, принятый процесс — через PR ([13](13-development.md#ветки-и-pr)).
- Окружение `github-pages` ограничено правилом по веткам (стандартная настройка Pages: деплой только из разрешённой ветки).

## Сервер, пользователи, права, логи

Сервера нет, поэтому нет:
- пользователей ОС и прав на файлы;
- systemd-юнитов, Docker, reverse proxy;
- серверных логов. Есть только логи запусков GitHub Actions (вкладка Actions, хранятся по политике GitHub) и консоль браузера у пользователя (`[app] ошибка рендера` из `ErrorBoundary`). Клиентские ошибки никуда не отправляются: Sentry и аналогов нет.

## Бэкапы

- **Код и словарь** — в git на GitHub (и в локальных клонах).
- **Данные пользователей** — только в CloudStorage Telegram. **Бэкапов нет и сделать их снаружи нельзя**: CloudStorage недоступен ни через Bot API, ни через что-либо, кроме Mini App конкретного пользователя. Хранит и реплицирует его Telegram.
- Локальная копия на устройстве — только очередь неотправленного (`ew-sync:pending`), это не бэкап.

Что делать, если нужно «восстановить из бэкапа», — [14](14-runbooks.md#восстановить-из-бэкапа).

## Задачи по расписанию

**Нет.** Напоминаний, рассылок и cron нет: некому их выполнять. GitHub Actions по расписанию (`schedule:`) тоже не настроены.

## Мониторинг и алерты

**Нет.** Uptime-мониторинга, метрик, алертов и аналитики нет. Узнать, что сайт лежит, можно, только открыв его. Падение деплоя видно в Actions, и GitHub пришлёт письмо автору коммита (стандартные уведомления GitHub).

Идеи на будущее — [16](16-issues-backlog.md#идеи).

## Внешние зависимости в рантайме

| Что | Откуда | Если недоступно |
|---|---|---|
| `index.html`, JS, CSS, шрифты | `dreamo-pg.github.io` | Mini App не откроется (ошибка WebView) |
| `telegram-web-app.js` | `telegram.org` | В Telegram — экран «Не удалось подключиться к Telegram»; в браузере — приложение работает на `localStorage` |
| CloudStorage | серверы Telegram через клиент | Экран «Не удалось загрузить прогресс» или плашка «Не всё сохранено в облако» |
| `speechSynthesis` | ОС устройства | Кнопок звука нет |
