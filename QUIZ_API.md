# Quiz API «Своя игра» — документация для фронта

Бэк живёт в том же сервисе, что и бэк сайта, но полностью изолирован от него: свои таблицы `quiz_*`, свои пользователи, свои токены.

| | |
|---|---|
| REST | `https://<бэк>/api/...` |
| WebSocket | `wss://<бэк>/ws/sessions/:id?...` |
| Файлы | `https://<бэк>/uploads/quiz/<файл>` (без авторизации, поддерживается `Range` для видео) |
| OpenAPI | `https://<бэк>/docs/json` (UI: `/docs`). Типы генерируйте оттуда: схемы `QuizSnapshot` и `QuizCommand`, у вопросов и раундов в теле запроса перечислены `settings` всех механик |

Адрес бэка фронт берёт из `VITE_API_URL`, как сейчас.

---

## 1. Общие правила

**Авторизация.** Только заголовок `Authorization: Bearer <jwt>`, cookie нет. Токен живёт 12 часов, перевыпуска нет (после истечения — снова `/auth/login`). Токены сайта и квиза не взаимозаменяемы.

**Роли.**
- `admin` — всё.
- `host` — только `/sessions/*`, плюс чтение: `GET /games`, `GET /games/:id`, `GET /participants`, `GET /kinds`.

**Ошибки** всегда в одном формате:

```json
{ "error": { "code": "INVALID_TRANSITION", "message": "…", "details": { } } }
```

Ошибка валидации — `422 VALIDATION_ERROR`, `details` — массив `[{ "path": "settings.options", "message": "…" }]`.

**Списки:** `?limit=&offset=` (limit до 1000, по умолчанию 50) → `{ "items": [...], "total": N }`.

**CORS.** Разрешены только перечисленные домены, без `credentials`. Origin — это только схема+домен (`https://<user>.github.io`), путь `/quiz-web/` не учитывается.

**Rate limit:** логин — 5 попыток в минуту с одного IP (`429 RATE_LIMITED`).

---

## 2. Авторизация

| Метод | Путь | Тело → ответ |
|---|---|---|
| POST | `/api/auth/login` | `{ login, password }` → `{ token, user: { id, login, role, createdAt } }` |
| GET | `/api/auth/me` | → `{ id, login, role }` (объект пользователя в корне) |

Ошибки: `401 INVALID_CREDENTIALS`, `401 UNAUTHORIZED`, `403 FORBIDDEN`.

Пользователи (admin): `GET /api/users`, `POST /api/users { login, password(≥8), role }`, `PATCH /api/users/:id { password?, role? }`, `DELETE /api/users/:id`. Открытой регистрации нет. Первый админ создаётся сидом (см. раздел 12).

---

## 3. Медиа (файлы)

Все файлы квиза: картинки, аудио, видео. Загружаются отдельно, а в вопросах, настройках и у игроков на них ссылаются по `id`.

`POST /api/media` (admin), `multipart/form-data`, поле `file`.

| Тип | Форматы | Лимит | Что делает бэк |
|---|---|---|---|
| image | jpeg, png, webp, gif | 15 МБ | конвертирует в WebP (анимация gif сохраняется), уменьшает до 3840 px |
| audio | mp3 | 50 МБ | как есть |
| video | mp4, webm | 200 МБ | как есть |

Тип определяется **по содержимому файла**, а не по расширению: переименованный txt даст `415 UNSUPPORTED_MEDIA_TYPE`. Больше лимита — `413 PAYLOAD_TOO_LARGE`.

Ответ `201`:

```json
{ "id": "uuid", "type": "image|audio|video", "path": "quiz/<uuid>.webp",
  "url": "/uploads/quiz/<uuid>.webp", "originalName": "photo.png",
  "mime": "image/webp", "size": 12345, "createdAt": "…" }
```

`url` относительный (если на бэке не задан `PUBLIC_UPLOADS_URL`): склеивайте `VITE_API_URL + url` или, как сейчас, `VITE_API_URL + '/uploads/' + path`.

- `GET /api/media?type=image|audio|video&limit=&offset=` → `{ items, total }`
- `DELETE /api/media/:id` → `409 MEDIA_IN_USE`, если файл используется в вопросе (в `content`, `answerContent` или `settings`) или как фото игрока.

---

## 4. Игроки (справочник участников)

`participants` — общий справочник. В игру игроки попадают при создании сессии, **их число не ограничено**.

| Поле | |
|---|---|
| `name` | обязательно |
| `color` | `#RRGGBB` |
| `photoMediaId` | **фото игрока**: `id` картинки из `/api/media`, либо `null` |
| `photoUrl` | только в ответе: готовая ссылка на фото |
| `defaultStartScore` | стартовый балл по умолчанию (может быть отрицательным), подставляется в сессию |

`GET /api/participants` (admin, host), `POST`, `PATCH /:id`, `DELETE /:id` (admin).

**Как поставить фото игроку:**
1. `POST /api/media` с картинкой → `id`.
2. `PATCH /api/participants/:id { "photoMediaId": "<id>" }` (или сразу в `POST /api/participants`).
3. Убрать фото: `{ "photoMediaId": null }`.

Фото должно быть изображением (`422`, если передать видео или аудио). Файл с фото нельзя удалить из медиа, пока он привязан (`409 MEDIA_IN_USE`). В снимке состояния фото приходит как `players[].photo` (готовый URL).

`DELETE /participants/:id` → `409 PARTICIPANT_IN_USE`, если игрок есть в какой-либо сессии.

---

## 5. Игры: раунды → темы → вопросы

`GET /api/games/:id` возвращает игру целиком:

```
game { id, title, description, rounds[ { id, order, title, description, type, settings,
  themes[ { id, order, title, questions[ { id, price, kind, settings, content, answerContent, comment, timeLimitSec } ] } ] } ] }
```

Вопросы внутри темы **отсортированы по цене по возрастанию**.

| Метод | Путь |
|---|---|
| GET, POST | `/api/games` (в списке: `roundsCount`, `questionsCount`, `updatedAt`) |
| GET, PATCH, DELETE | `/api/games/:id` |
| POST | `/api/games/:id/duplicate` |
| POST | `/api/games/:id/rounds` · PATCH, DELETE `/api/rounds/:id` · PUT `/api/games/:id/rounds/order` `{ ids }` |
| POST | `/api/rounds/:id/themes` · PATCH, DELETE `/api/themes/:id` · PUT `/api/rounds/:id/themes/order` `{ ids }` |
| POST | `/api/themes/:id/questions` · GET, PATCH, DELETE `/api/questions/:id` |
| GET | `/api/kinds` — JSON-схемы `settings` всех механик и раундов (удобно для генерации форм) |

`PUT .../order` принимает **все** `id` без повторов, иначе `422`.

Пока игра идёт в какой-либо сессии (статус не `idle` и не `finished`), её нельзя править: `409 GAME_IN_USE`.

### Раунд

`type`: `standard` (по умолчанию) или `final`. Отдельного «командного» типа нет: командный раунд — обычный `standard` со своими вопросами.

`settings` раунда `final`: `{ "finalists": "leader" | N, "mode": "single_question" | "elimination" }`, по умолчанию `leader` и `single_question`. Для `standard` — пусто.

### Вопрос

| Поле | |
|---|---|
| `price` | целое > 0 |
| `kind` | механика (раздел 6), по умолчанию `standard` |
| `settings` | зависит от `kind`; валидируется схемой механики, значения по умолчанию подставляются |
| `content` | **блоки вопроса**, минимум один |
| `answerContent` | **блоки ответа**, минимум один |
| `comment` | заметка ведущему, **на экран не попадает никогда** |
| `timeLimitSec` | лимит времени или `null` |

**Блок:** `{ "type": "text" | "image" | "audio" | "video", "text"?: string, "mediaId"?: uuid }`. Для `text` обязателен `text`, для остальных — `mediaId`.

**Видео- и аудио-вопросы** — это просто блоки: добавьте `{ "type": "video", "mediaId": "…" }` в `content` (или в `answerContent`, чтобы показать видео с ответом) для **любой** механики. Воспроизведением управляет экран сам (бэк его не синхронизирует). Браузер блокирует автозапуск со звуком: для экрана эфира нужен один клик или флаг `--autoplay-policy=no-user-gesture-required`.

Общая настройка любой механики: `settings.noPenalty: true` («без риска»: неверный ответ даёт 0 вместо `−цена`).

---

## 6. Механики вопросов (`kind`)

В снимке для механики приходит `question.view` — то, что нужно нарисовать. Для экрана верные ответы скрыты до `answer_revealed`, пульт видит всё сразу.

| kind | settings | Команды | `question.view` |
|---|---|---|---|
| `standard` | — | — | `{}` |
| `options` | `variant: choice\|odd_one_out`, `multiple`, `options: [{id, text?, mediaId?, isCorrect}]` (2–8, минимум один верный) | — | `{variant, multiple, options:[{id,text?,mediaId?}]}`; `isCorrect` у экрана только после `answer_revealed` |
| `true_false` | `correct`, `explanation?` | — | экран: `{}`, после reveal `{correct, explanation?}`; пульт сразу |
| `hints` | `penaltyPerHint`, `hints:[{text?,mediaId?}]` (1–5) | `reveal_hint` | `{hintsShown, hintsTotal, penaltyPerHint, hints}`: экран — только открытые, пульт — все с флагом `shown` |
| `cat_in_bag` | `priceOverride?`, `allowSelf` (false), `teaser?` | `choose_recipient`, `begin_play` | `{teaser, allowSelf, recipientId, price}` |
| `auction` | `startBid`, `step` | `place_bid`, `close_bidding`, `begin_play` | `{startBid, step, bids:[{participantId,amount}], closed, winnerId, winningBid, minNextBid}` |
| `stake` | `maxStake: 'score'\|'price'\|число` | `set_stake`, `begin_play` | `{stake, participantId, maxStake}` |
| `blitz` | `items:[{content,answerContent}]` (≥2), `perItemSec?`, `totalSec?`, `pointsPerItem` | `blitz_next`, `blitz_back` | `{index,total,perItemSec,totalSec,pointsPerItem,item:{content}}`; ответы `answers` экрану после reveal, пульту сразу (`item.answerContent`) |
| `reveal_image` | `mediaId`, `mode: blur\|tiles`, `steps: 2..10`, `penaltyPerStep?` | `reveal_step` | `{mediaId, mode, steps, step}` |
| `ordering` | `items:[{id,text?,mediaId?}]` — в **правильном** порядке | — | `{items}` в перемешанном порядке (фиксирован на вопрос); `correctOrder` — экрану после reveal, пульту сразу |
| `matching` | `pairs:[{left:{…}, right:{…}}]` | — | `{left:[{id,…}], right:[{id,…}]}` перемешаны; `pairs:[{leftId,rightId}]` после reveal |
| `fill_blank` | `template` с маркерами `___`, `blanks: string[]` | — | `{template, blanksCount}`; `blanks` после reveal |
| `word_guess` | `word`, `hint?` | `reveal_letter {letter}` | `{hint, letters, mask:[{char: string\|null}]}`; `word` после reveal |

**Фаза вопроса** (`question.phase`): `cat_in_bag`, `auction`, `stake` и любой вопрос раунда `final` после открытия попадают в `prepare` — экран показывает заставку **без содержимого** (`content` пуст), `start_timer` запрещён. `begin_play` переводит в `play`. Статус сессии при этом остаётся `question_shown`.

**Раунд `final`.** Вопрос финала начинается с `prepare`: каждый финалист делает ставку (`set_stake {participantId, amount}`, не больше его счёта), потом `begin_play`. В `question.view.final` приходит `{ finalists: [id…], stakes: { [id]: число | true } }` — экран до `answer_revealed` видит только факт ставки (`true`).
- `single_question`: одна тема и один вопрос; финалисты по правилу `finalists` подставляются сами при `open_question`, либо задаются командой `select_finalists`.
- `elimination`: оператор вычёркивает темы (`eliminate_theme`), последняя открывается как `single_question`. В `board.themes[]` у темы есть флаг `eliminated`.

---

## 7. Сессии и ведение игры

| Метод | Путь | |
|---|---|---|
| POST | `/api/sessions` | `{ gameId, participantIds: [], hostName? }` → `201 { session, screenToken, screenUrl, snapshot }`. **`screenToken` и `screenUrl` показываются только здесь и при перевыпуске.** |
| GET | `/api/sessions` | история, `?status=` |
| GET | `/api/sessions/:id` | снимок для пульта |
| POST | `/api/sessions/:id/commands` | `{ type, payload?, expectedVersion? }` → новый снимок для host |
| POST | `/api/sessions/:id/screen-token/rotate` | `→ { screenToken, screenUrl }`; подключённые экраны отключаются |
| POST/PATCH/DELETE | `/api/sessions/:id/participants[/:participantId]` | игроки на ходу (раздел 9) |
| POST | `/api/sessions/:id/scores…` | очки (раздел 8) |
| DELETE | `/api/sessions/:id` | admin |

`screenUrl` = `<SCREEN_URL_BASE>/<sessionId>?token=<screenToken>`; если `SCREEN_URL_BASE` на бэке не задан, `screenUrl = null` — собирайте ссылку сами из `session.id` и `screenToken`.

### Статусы

```
idle → intro → round_intro → board → question_shown → timer_running → answer_revealed → board
                                                                                        ↘ round_intro (следующий раунд) / finished
```

Статуса «табло» нет: очки видны всегда (`players[].score`).

### Команды

| type | payload | Откуда → куда |
|---|---|---|
| `start` | — | idle → intro |
| `next_round` | — | intro, board → round_intro. `409 NO_MORE_ROUNDS`, если раундов больше нет |
| `show_board` | — | round_intro, answer_revealed → board |
| `open_question` | `{questionId}` | board → question_shown. Вопрос помечается сыгранным, повторно — `409 ALREADY_PLAYED`. Должен быть в текущем раунде |
| `start_timer` | — | question_shown (фаза `play`) → timer_running. `409 NO_TIMER`, если нет лимита |
| `reveal_answer` | — | question_shown, timer_running → answer_revealed |
| `set_active` | `{participantId \| null}` | board, question_shown, timer_running, answer_revealed (статус не меняется) |
| `finish` | — | любой, кроме idle → finished |
| `back` | — | откат последнего изменения (любой статус, кроме idle) |
| `begin_play` | — | question_shown, фаза `prepare` → `play` |
| `reveal_hint` | — | `hints` |
| `choose_recipient` | `{participantId}` | `cat_in_bag`, фаза prepare; получатель становится активным |
| `place_bid` | `{participantId, amount}` | `auction`, фаза prepare |
| `close_bidding` | — | `auction`; победитель становится активным, цена вопроса = его ставка |
| `set_stake` | `{participantId?, amount}` | `stake` и `final`, фаза prepare |
| `blitz_next`, `blitz_back` | — | `blitz` |
| `reveal_step` | — | `reveal_image` |
| `reveal_letter` | `{letter}` | `word_guess` |
| `select_finalists` | `{participantIds}` | round_intro, board; раунд `final` |
| `eliminate_theme` | `{themeId}` | board; `final` в режиме `elimination` |

Команда механики к вопросу другой механики или в неподходящем статусе/фазе → `409 INVALID_TRANSITION` (в `details.status` текущий статус). `begin_play` без выбранного получателя, закрытых торгов или ставки → `409 NOT_READY`.

**Версии.** Каждое изменение (команда, очки, правка игроков) увеличивает `version` на 1. Передавайте `expectedVersion` — это защита от двойного клика и двух открытых пультов: при несовпадении `409 VERSION_MISMATCH`, в `details` лежит `currentVersion`. Команды одной сессии выполняются строго последовательно.

**Таймер.** Считает только бэк: `timerEndsAt` в снимке. Когда время вышло, сервер сам ничего не переключает: оператор нажимает `reveal_answer`. Экран считает остаток с поправкой на часы: `offset = Date.parse(serverTime) − Date.now()` в момент получения снимка, остаток = `timerEndsAt − (Date.now() + offset)`.

**`back`.** Откатывает последнее изменение: статус, текущий вопрос, состояние вопроса (подсказки, ставки…), «сыгранные» вопросы, активного игрока, игроков сессии и их стартовые баллы. Начисления очков не удаляются, а помечаются `voided` (журнал остаётся полным). `409 NOTHING_TO_UNDO`, если откатывать нечего. Поле `canBack` в снимке для пульта.

---

## 8. Очки

Оценка **всегда ручная**: бэк ответы не проверяет. Счёт игрока = `startScore` в сессии + сумма неотменённых начислений. Может быть отрицательным.

| Метод | Путь | Тело |
|---|---|---|
| POST | `/api/sessions/:id/scores` | `{ participantId, kind, delta, reason?, questionId?, expectedVersion? }` |
| POST | `/api/sessions/:id/scores/set` | `{ participantId, total, reason?, expectedVersion? }` |
| POST | `/api/sessions/:id/scores/:eventId/void` | `{ expectedVersion? }` или пусто |
| GET | `/api/sessions/:id/scores` | журнал, новые сверху |

- `kind`: `correct` · `wrong` · `bonus` · `penalty` · `manual`. `delta` — целое, **не 0**, любая сумма. `participantId` обязателен (общего командного счёта нет).
- Работает в любом статусе, в том числе до старта игры и после `finish`.
- «Засчитать» = `kind: correct, delta: question.pointsIfCorrect`; «не засчитать» = `kind: wrong, delta: question.pointsIfWrong` (`pointsIfWrong` уже учитывает `noPenalty`; если он 0, начислять нечего). Бонус за шутку: `kind: bonus` с любой суммой и `reason`.
- `scores/set`: бэк сам создаёт событие `manual` с `delta = total − текущий счёт`; если счёт уже равен — `409 NO_CHANGE`.
- Ответ `201`: `{ event, snapshot }` (снимок для host). `void` повторно → `409 ALREADY_VOIDED`.

Типичный сценарий оператора: `open_question` → `set_active` (кто отвечает) → `reveal_answer` → `POST /scores` (`correct` или `wrong`) → `show_board`.

---

## 9. Игроки в сессии

Игроков **любое количество**, добавлять и править можно на ходу. Каждый вызов возвращает новый снимок для host, увеличивает `version` и пишется в историю для `back`.

| Метод | Путь | Тело |
|---|---|---|
| POST | `/api/sessions/:id/participants` | `{ participantId, startScore?, expectedVersion? }`: слот в конец; `startScore` по умолчанию = `defaultStartScore` участника. `409 ALREADY_IN_SESSION` |
| PATCH | `/api/sessions/:id/participants/:participantId` | `{ startScore?, order?, expectedVersion? }`. `order` — номер слота (с 0): игрок встаёт на это место, остальные сдвигаются |
| DELETE | `/api/sessions/:id/participants/:participantId` | убрать игрока (его события остаются в журнале; если он был активным или финалистом — снимается) |

---

## 10. Снимок состояния (`SessionSnapshot`)

Один формат для экрана и пульта, разная детализация. Полная схема — `QuizSnapshot` в OpenAPI.

```ts
{
  sessionId, version, status, serverTime, timerEndsAt, hostName,
  round: { id, title, description, order, total, type, settings } | null,
  board: { themes: [{ id, title, eliminated?, cells: [{ questionId, price, played, question? }] }] } | null,
  question: { id, kind, price, timeLimitSec, themeId, themeTitle, phase, content, view,
              answerContent?, pointsIfCorrect?, pointsIfWrong?, comment? } | null,
  finalists: string[] | null,          // только раунд final
  activeParticipantId: string | null,  // подсветить рамкой
  players: [{ id, name, color, photo, score, order }],   // по слотам (order), не по рейтингу
  media: { [mediaId]: { type, url } }, // файлы для всех mediaId, встречающихся в снимке
  // только host:
  canBack, nextRoundAvailable, suggestedFinalists?
}
```

- `board` есть в `round_intro`, `board`, `question_shown`, `timer_running`, `answer_revealed`; иначе `null`. `question` есть только в `question_shown`, `timer_running`, `answer_revealed`.
- Файлы в `content`/`view` указаны как `mediaId`: ищите URL в `snapshot.media[mediaId]`.

| | screen | host |
|---|---|---|
| `answerContent` | только при `answer_revealed` | всегда |
| ответ механики в `view` | только при `answer_revealed` | всегда |
| `comment` | **никогда** | всегда |
| `content` в фазе `prepare` | пусто | есть |
| ячейки сетки | цена и `played` | + `question: { kind, content, answerContent, comment }` |
| `pointsIfCorrect/Wrong`, `canBack`, `nextRoundAvailable`, `suggestedFinalists` | нет | есть |

---

## 11. WebSocket

```
wss://<бэк>/ws/sessions/:id?role=screen&token=<screenToken>   экран
wss://<бэк>/ws/sessions/:id?role=host&token=<jwt>             пульт
```

Сообщения сервера (JSON `{ type, payload }`):

| type | Когда |
|---|---|
| `snapshot` | сразу после подключения; снимок для вашей роли |
| `update` | после любой команды, начисления, правки игроков или отката; снимок целиком |
| `session_closed` | `payload.reason`: `token_rotated` (токен экрана перевыпущен) или `session_deleted`; затем соединение закрывается кодом `4410` |
| `pong` | ответ на `ping` |

Клиент → сервер: только `{ "type": "ping" }`. Все команды идут через REST, WebSocket работает в одну сторону.

**Коды закрытия:** `4401` — неверный токен или роль, `4404` — сессия не найдена, `4410` — сессия закрыта.

Правила клиента:
- **Отбрасывайте сообщение, если его `version` меньше уже показанной**: между подключением и первым снимком может прийти более свежий `update`.
- Присылайте `ping` примерно раз в 20 секунд; сервер тоже шлёт ping каждые 25 секунд и закрывает мёртвые соединения. При обрыве переподключайтесь и ждите новый `snapshot`.
- После `finish` сервер соединение не закрывает: экран остаётся на итоговом табло.
- Токен пульта в query попадает в логи прокси: используйте HTTPS/WSS (обязательно, страница на HTTPS не может открыть `ws://`).

---

## 12. Запуск и конфигурация

Новые миграции создают только таблицы `quiz_*`, существующие таблицы сайта не затрагиваются; деплой накатывает их сам.

**Первый админ создаётся миграцией** `CreateQuizAdmin` при деплое. Логин и пароль берутся из GitHub secrets `QUIZ_ADMIN_LOGIN` (по умолчанию `admin`) и `QUIZ_ADMIN_PASSWORD` (от 8 символов, лучше только буквы и цифры). Если пароль не задан, миграция генерирует случайный и один раз печатает его в логе деплоя (`[quiz] создан админ квиза. login: … password: …`). Если админ с таким логином уже есть, ничего не меняется. Ведущих создаёт админ: `POST /api/users { login, password, role: "host" }`.

**Демо-игра** (по желанию, один раз, на сервере; заодно создаёт админа, если его нет):

```bash
docker compose exec -e QUIZ_ADMIN_LOGIN=admin -e QUIZ_ADMIN_PASSWORD='<пароль от 8 символов>' app npm run seed:quiz
```

Создаёт админа, 4 игроков и демо-игру из трёх раундов (обычный, «Командный раунд», супер-игра) с вопросом на каждую механику. Повторный запуск ничего не дублирует.

Необязательные переменные окружения бэка:

| Переменная | Для чего |
|---|---|
| `ALLOWED_ORIGINS` | дополнительные домены для CORS через запятую (к уже разрешённым доменам сайта) |
| `SCREEN_URL_BASE` | например `https://<user>.github.io/quiz-web/screen/#` → заполняется `screenUrl` |
| `PUBLIC_UPLOADS_URL` | например `https://api.example.com/uploads` → `url` файлов становятся абсолютными |
| `QUIZ_JWT_SECRET` | секрет токенов квиза; по умолчанию выводится из `JWT_SECRET` |

---

## 13. Коды ошибок

| HTTP | code | Когда |
|---|---|---|
| 401 | `UNAUTHORIZED`, `INVALID_CREDENTIALS` | нет/просрочен токен, неверный логин или пароль |
| 403 | `FORBIDDEN` | роль не подходит |
| 404 | `NOT_FOUND` | сущность не найдена |
| 409 | `INVALID_TRANSITION` | команда недопустима в текущем статусе/фазе или не для этой механики. В `details.status` — текущий статус; для «нет больше подсказок/пунктов/шагов» ещё `details.code` (`NO_MORE_HINTS`, `NO_MORE_ITEMS`, `NO_MORE_STEPS`) |
| 409 | `VERSION_MISMATCH` | `expectedVersion` устарел (`details.currentVersion`) |
| 409 | `ALREADY_PLAYED`, `NO_MORE_ROUNDS`, `NO_ROUNDS`, `NO_TIMER`, `NOT_READY`, `NO_FINALISTS`, `NOTHING_TO_UNDO` | правила игры |
| 409 | `NO_CHANGE`, `ALREADY_VOIDED`, `ALREADY_IN_SESSION` | очки и игроки |
| 409 | `GAME_IN_USE`, `MEDIA_IN_USE`, `PARTICIPANT_IN_USE`, `LOGIN_TAKEN` | конфликты при правке и удалении |
| 413 | `PAYLOAD_TOO_LARGE` | файл больше лимита типа |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | недопустимый или подделанный формат |
| 422 | `VALIDATION_ERROR` | поля (`details[].path`); также `QUESTION_NOT_FOUND`, `PARTICIPANT_NOT_FOUND`, `MEDIA_NOT_FOUND` |
| 429 | `RATE_LIMITED` | слишком частый логин |

---

## 14. Что изменилось относительно текущего `apps/control`

Фронт сейчас написан под первую версию контракта. Нужно обновить:
- **Вопрос:** вместо `text`, `mediaId`, `answerText`, `answerMediaId` теперь `content` и `answerContent` (массивы блоков), плюс `kind` и `settings`.
- **Раунд:** добавились `type` (`standard`/`final`) и `settings`.
- **Игрок:** добавились `photoMediaId`/`photoUrl` и `defaultStartScore`; `GET /auth/me` возвращает пользователя в корне.
- **Медиа:** `path` — относительно `/uploads/`; `GET /media?limit=500` работает.
- Новое: `/api/kinds` (формы настроек механик), экран и пульт на WebSocket.
