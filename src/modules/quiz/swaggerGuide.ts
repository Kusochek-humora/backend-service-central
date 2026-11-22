// Руководство по Quiz API для главного Swagger (/docs): описания тегов поддерживают markdown.
// Полная версия: QUIZ_API.md в корне репозитория.

export const quizSwaggerTags = [
  {
    name: "Quiz: общее",
    description: `
## Quiz API «Своя игра»: общие правила

- **REST:** \`/api/...\` · **WebSocket:** \`/ws/sessions/:id\` · **Файлы:** \`/uploads/quiz/<файл>\` (без авторизации, \`Range\` для видео).
- **Авторизация:** только \`Authorization: Bearer <jwt>\` (\`POST /api/auth/login\` → \`{ token, user }\`, токен живёт 12 часов, cookie нет). Токены сайта и квиза не взаимозаменяемы.
- **Роли:** \`admin\` — всё; \`host\` — \`/api/sessions/*\` и чтение (\`GET /games\`, \`/games/:id\`, \`/participants\`, \`/kinds\`).
- **Ошибки:** \`{ "error": { "code", "message", "details?" } }\`. Валидация: \`422 VALIDATION_ERROR\`, \`details = [{ path, message }]\`.
- **Списки:** \`?limit=&offset=\` (limit до 1000) → \`{ items, total }\`. Логин: 5 попыток в минуту (\`429 RATE_LIMITED\`).
- **Типы для фронта** генерируются из \`/docs/json\`: схемы \`QuizSnapshot\`, \`QuizCommand\`, а в теле вопроса и раунда перечислены \`settings\` всех механик. Подробная документация: \`QUIZ_API.md\`.

### Медиа и фото игроков
Файл загружается один раз через \`POST /api/media\` (картинка до 15 МБ → WebP, mp3 до 50 МБ, mp4/webm до 200 МБ; тип проверяется по содержимому), дальше на него ссылаются по \`id\`:
блоки \`{ type: image|audio|video, mediaId }\` в \`content\`/\`answerContent\` вопроса, \`mediaId\` в \`settings\` механик, \`photoMediaId\` у игрока.
**Видео- и аудио-вопросы** — это просто блоки \`video\`/\`audio\` в содержимом любой механики. Файл, который используется, удалить нельзя (\`409 MEDIA_IN_USE\`).

**Фото игрока:** загрузить картинку → \`PATCH /api/participants/:id { photoMediaId }\` (\`null\` — убрать). В снимке фото приходит как \`players[].photo\`.

### Игроки
Число игроков не ограничено. У игрока есть \`defaultStartScore\`; в сессии стартовый балл (\`startScore\`) оператор правит в любой момент: \`PATCH /api/sessions/:id/participants/:participantId\`.
`,
  },
  {
    name: "Quiz: механики",
    description: `
## Механики вопросов (\`kind\`) и раунды

Общая настройка любой механики: \`settings.noPenalty\` («без риска»: неверный ответ даёт 0). Схемы \`settings\` всех механик — в теле \`POST /api/themes/:id/questions\` и в \`GET /api/kinds\`.

| kind | Команды | Что на экране |
|---|---|---|
| \`standard\` | — | содержимое; ответ после \`reveal_answer\` |
| \`options\` (\`choice\` / \`odd_one_out\`) | — | варианты; верные после \`reveal_answer\` |
| \`true_false\` | — | «верю / не верю»; ответ и пояснение после reveal |
| \`hints\` | \`reveal_hint\` | открытые подсказки; цена = \`price − n·penaltyPerHint\` |
| \`cat_in_bag\` | \`choose_recipient\`, \`begin_play\` | заставка, затем вопрос; отвечает выбранный игрок |
| \`auction\` | \`place_bid\`, \`close_bidding\`, \`begin_play\` | таблица ставок; цена = ставка победителя |
| \`stake\` | \`set_stake\`, \`begin_play\` | ставка отвечающего; \`±ставка\` |
| \`blitz\` | \`blitz_next\`, \`blitz_back\` | текущий пункт и прогресс |
| \`reveal_image\` | \`reveal_step\` | картинка открывается по шагам |
| \`ordering\` | — | перемешанные элементы; порядок после reveal |
| \`matching\` | — | две колонки; пары после reveal |
| \`fill_blank\` | — | текст с пропусками; ответы после reveal |
| \`word_guess\` | \`reveal_letter\` | маска слова с открытыми буквами |

**Фаза подготовки.** \`cat_in_bag\`, \`auction\`, \`stake\` и любой вопрос раунда \`final\` после \`open_question\` попадают в \`question.phase = "prepare"\`: экран показывает заставку без содержимого, \`start_timer\` запрещён. \`begin_play\` переводит в \`play\`. Статус сессии остаётся \`question_shown\`.

**Раунды.** \`standard\` — сетка тем и цен (командный раунд — обычный standard). \`final\` — супер-игра: \`settings.finalists\` (\`"leader"\` или число N), \`settings.mode\` (\`single_question\` | \`elimination\`).
Финалисты выбираются автоматически или командой \`select_finalists\`; каждый финалист делает ставку \`set_stake\` (не больше своего счёта); экран до \`answer_revealed\` видит только факт ставки. В режиме \`elimination\` темы вычёркиваются \`eliminate_theme\`, последняя играется как \`single_question\`.
`,
  },
  {
    name: "Quiz: ход игры и WebSocket",
    description: `
## Ход игры

**Статусы:** \`idle → intro → round_intro → board → question_shown → timer_running → answer_revealed → board\` (или \`round_intro\` следующего раунда / \`finished\`). Статуса «табло» нет: очки видны всегда.

**Команды** (\`POST /api/sessions/:id/commands\`, тело — схема \`QuizCommand\`): \`start\`, \`next_round\`, \`show_board\`, \`open_question {questionId}\`, \`start_timer\`, \`reveal_answer\`, \`set_active {participantId|null}\`, \`finish\`, \`back\` и команды механик. Недопустимая команда — \`409 INVALID_TRANSITION\`. Повторное открытие сыгранного вопроса — \`409 ALREADY_PLAYED\`.

**Версии.** Каждое изменение (команда, очки, правка игроков) увеличивает \`version\`. \`expectedVersion\` защищает от двойного клика и двух пультов (\`409 VERSION_MISMATCH\`, \`details.currentVersion\`). Команды одной сессии выполняются строго последовательно.

**Таймер** считает только бэк (\`timerEndsAt\`). Когда время вышло, сервер ничего не переключает: оператор нажимает \`reveal_answer\`. Остаток на экране: \`offset = Date.parse(serverTime) − Date.now()\`, остаток = \`timerEndsAt − (Date.now() + offset)\`.

**\`back\`** откатывает последнее изменение: статус, вопрос и его состояние, сыгранные вопросы, активного игрока, игроков сессии и стартовые баллы. Начисления очков помечаются \`voided\`, а не удаляются.

**Очки.** Оценка всегда ручная. \`POST /scores\` \`{ participantId, kind: correct|wrong|bonus|penalty|manual, delta (≠ 0, любая сумма), reason?, questionId? }\`;
\`POST /scores/set { participantId, total }\` создаёт событие \`manual\` с \`delta = total − счёт\`; \`POST /scores/:eventId/void\` отменяет. Подсказка для кнопок «засчитать / не засчитать» — \`question.pointsIfCorrect\` / \`pointsIfWrong\` в снимке для пульта.

## Снимок состояния и роли

| | screen | host |
|---|---|---|
| \`answerContent\`, ответ механики в \`view\` | только при \`answer_revealed\` | всегда |
| \`comment\` | никогда | всегда |
| \`content\` в фазе \`prepare\` | пусто | есть |
| ячейки сетки | цена и \`played\` | + содержимое вопроса |
| \`pointsIfCorrect/Wrong\`, \`canBack\`, \`nextRoundAvailable\` | нет | есть |

Файлы в снимке указаны как \`mediaId\`: URL — в \`snapshot.media[mediaId]\`.

## WebSocket (в OpenAPI не описывается)

\`wss://<бэк>/ws/sessions/:id?role=screen&token=<screenToken>\` — экран · \`?role=host&token=<jwt>\` — пульт.

Сообщения сервера: \`snapshot\` (сразу после подключения), \`update\` (после любого изменения, снимок целиком), \`session_closed\` (\`payload.reason\`: \`token_rotated\` | \`session_deleted\`), \`pong\`. Клиент шлёт только \`{"type":"ping"}\` (примерно раз в 20 с); команды идут через REST.
Коды закрытия: \`4401\` — неверный токен, \`4404\` — сессия не найдена, \`4410\` — сессия закрыта. Клиент **отбрасывает сообщения с \`version\` меньше уже показанной**. После \`finish\` соединение не закрывается.
`,
  },
  { name: "Quiz Auth", description: "Вход, текущий пользователь, управление пользователями квиза (admin)." },
  { name: "Quiz Media", description: "Загрузка и удаление картинок, аудио и видео." },
  { name: "Quiz Participants", description: "Справочник игроков: имя, цвет, фото (photoMediaId), стартовый балл по умолчанию." },
  { name: "Quiz Games", description: "Игры целиком и справочник механик (`/kinds`)." },
  { name: "Quiz Rounds", description: "Раунды: `standard` и `final`." },
  { name: "Quiz Themes", description: "Темы раунда — строки сетки." },
  { name: "Quiz Questions", description: "Вопросы: `kind`, `settings`, блоки `content` и `answerContent`." },
  { name: "Quiz Sessions", description: "Сессии: создание, снимок, команды, игроки на ходу, токен экрана." },
  { name: "Quiz Scores", description: "Ручное начисление очков, установка итога, отмена, журнал." },
];
