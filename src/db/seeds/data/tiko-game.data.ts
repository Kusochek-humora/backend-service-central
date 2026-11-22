// Игра «Тіко: Своя игра». Сгенерировано из Google-таблицы + собственные вопросы бонус-раунда.
// Настройки механик уже нормализованы схемами kinds/<kind>.ts. Используется миграцией SeedQuizTikoGame.

export interface SeedQuestion {
  price: number;
  kind: string;
  settings: Record<string, unknown>;
  content: { type: "text" | "image" | "audio" | "video"; text?: string; mediaId?: string }[];
  answerContent: { type: "text" | "image" | "audio" | "video"; text?: string; mediaId?: string }[];
  comment: string;
  timeLimitSec: number | null;
}
export interface SeedTheme { title: string; questions: SeedQuestion[] }
export interface SeedRound { title: string; description: string; type: "standard" | "final"; settings: Record<string, unknown>; themes: SeedTheme[] }
export interface SeedGame { title: string; description: string; rounds: SeedRound[] }

export const TIKO_GAME: SeedGame = {
  "title": "Тіко: Своя игра",
  "description": "Игра по таблице: первый тур, второй тур, бонус-раунд со всеми механиками и суперфинал.",
  "rounds": [
    {
      "title": "Первый тур",
      "description": "",
      "type": "standard",
      "settings": {},
      "themes": [
        {
          "title": "ҰБТ сұрақтары",
          "questions": [
            {
              "price": 100,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Абай Құнанбаевтың екінші әйелінің аты кім?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Әйгерім. (Шын аты Еркежан)"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 200,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Пәкістан мемлекетінің астанасы қандай?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Исламабад"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 300,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "«Қараш-қараш оқиғасы» повесінің авторы кім?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Мұхтар Әуезов"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 400,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "5+7*8=?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "61"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 500,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Менделеев кестесінде «күміс» химиялық элементы қалай белгіленген?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Ag (Argentum)"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            }
          ]
        },
        {
          "title": "Встречай макси чай (кез келген долбаебский сұрақ)",
          "questions": [
            {
              "price": 100,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Шыңғыс ханның неше қолы болған?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "100-130 мың қолы (армиясы) болған. 2 қолы болған."
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 200,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Майкл Джексон америкалық болған соң, оның аты Майкл. Ал егер ол қазақ болғанда оның аты қандай болатын еді?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Базар Джексон"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 300,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Көз қорқақ, қол батыр деген мақалдағы қол конкретно қайсы батыр?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "бұл жерде конкретный батыр туралы айтылмаған, жалпы қол батыр деген мағынада"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 400,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Көбісі айтады \"Нағыз қазақ қазақ емес, нағыз қазақ домбыра\" деген сөзді Қадір Мырза Әлі айтқан деп, ал шын мәнінде бұл сөздердің авторы кім?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Қадір Мырза Әлі"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 500,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Мыналардың ішінде қайсысы артық: африка, банан, су, тонау, баскетбол, білім."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "бұл жай ғана сөздер, бұл жерде сенің расисттік ойларың артық."
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            }
          ]
        },
        {
          "title": "Жетінші түйсік (Интуицияға сұрақтар)",
          "questions": [
            {
              "price": 100,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Үш есік бар, екеуінде ред флаг жігіт (біреуі жұдырық көрсетіп тұр, біреуі компьютер ойнап отыр), біреуінде грин флаг жігіт (посуда жуып тұр), грин флагты табу керек."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Ответа в таблице нет: решает ведущий"
                }
              ],
              "comment": "Ответа в таблице нет, решает ведущий. Подсказка ведущему: если выберут ред флага, то нужно подводить к тому, чтобы оправдать его почему он грин флаг",
              "timeLimitSec": 30
            },
            {
              "price": 200,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Тілеген туралы 3 факт, екеуі өтірік, біреуі шын, қайсысы шын екенін табу керек."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Ответа в таблице нет: решает ведущий"
                }
              ],
              "comment": "Ответа в таблице нет: ведущий сам называет три факта о Тілегене (два ложных, один настоящий).",
              "timeLimitSec": 30
            },
            {
              "price": 300,
              "kind": "options",
              "settings": {
                "variant": "choice",
                "multiple": false,
                "options": [
                  {
                    "id": "a",
                    "text": "Аристотель",
                    "isCorrect": false
                  },
                  {
                    "id": "b",
                    "text": "Гомер",
                    "isCorrect": false
                  },
                  {
                    "id": "c",
                    "text": "Евклид",
                    "isCorrect": false
                  },
                  {
                    "id": "d",
                    "text": "Зевс",
                    "isCorrect": false
                  },
                  {
                    "id": "e",
                    "text": "Архимед",
                    "isCorrect": false
                  },
                  {
                    "id": "f",
                    "text": "Ешқайсысы",
                    "isCorrect": true
                  }
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Мына адамдардың қайсысы Гомер? Гомер деген “Иллиада” және “Одиссей” эпостарының авторы."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "ешқайсысы, себебі Гомердің мүсінін Гомер өлгеннен кейін 300-400 жылдан кейін жасаған, қазіргі интернеттегі барлық Гомердің фотолары ойдан шығарылған. Шын мәнінде Гомердің түрі қандай болғанын ешкім білмейді."
                }
              ],
              "comment": "По таблице на экране фотографии Аристотеля, Гомера, Евклида, Зевса и Архимеда: добавьте их картинками в содержимое вопроса.",
              "timeLimitSec": 30
            },
            {
              "price": 400,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "“3 голосовой бар, үшеуін де қосам, жақсылап тыңдап ал, сосын сұрақты оқимын” деп айтады. Үшеуін де қосып тыңдатып алғаннан кейін сұрақты оқиды. Сұрақ мынандай “осы 3 голосовойдың екеуі 8 секундтық, ал біреуі 7 секундтық. 7 секундтық голосовойды тап”."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Ответа в таблице нет: решает ведущий"
                }
              ],
              "comment": "Нужны 3 голосовых сообщения (аудио, два по 8 секунд и одно на 7): добавьте их в содержимое вопроса. Правильный номер ведущий знает сам.",
              "timeLimitSec": 30
            },
            {
              "price": 500,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Антиприз!"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Интуициясы нашар деген сөз."
                }
              ],
              "comment": "Антиприз: минус 500 очков. Нажмите «не засчитать» (−500) игроку, который выбрал эту ячейку.",
              "timeLimitSec": null
            }
          ]
        },
        {
          "title": "Осыныда білмейсің ба? (қызықты фактілер)",
          "questions": [
            {
              "price": 100,
              "kind": "hints",
              "settings": {
                "penaltyPerHint": 50,
                "hints": [
                  {
                    "text": "ол 4 сағат сайын 15-20 минут ұйықтаған."
                  }
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Леонардо Да Винчи тәулігіне қанша сағат ұйықтайтын болған?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "тәулігіне 1,5-2 сағат ұйықтайтын болған."
                }
              ],
              "comment": "Подсказка открывается командой «Подсказка», каждая открытая стоит −50.",
              "timeLimitSec": 30
            },
            {
              "price": 200,
              "kind": "hints",
              "settings": {
                "penaltyPerHint": 50,
                "hints": [
                  {
                    "text": "ол елдің өзі қызғылт сары түспен ассоциацияланады, мемлекеттік туында да сол түс бар."
                  }
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Қызғылт сары, яғни оранжевый сәбіз негізі табиғатта болмаған. XVI - XVII ғасырларда оны бір ел қолдан жасап шығарған, оған дейін сәбіздер тек сары, ақ, тіпті күлгін түстес болған. Қызғылт сары сәбізді қай ел ойлап тапты?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Нидерланды. Олар сары және ақ түсті сәбізді будандастырып қызғылт сары сәбізді шығарған, нәтижесінде қызғылт сары сәбіз тәттірек болған."
                }
              ],
              "comment": "Подсказка открывается командой «Подсказка», каждая открытая стоит −50.",
              "timeLimitSec": 30
            },
            {
              "price": 300,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "1945 жылы АҚШ Хиросимаға атом бомбасын лақтырған. Бірақ басында ол бомба Хиросимаға емес Киото қаласына түсу керек болған. Неліктен ол Киото қаласынан Хиросимаға ауыстырылды?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Оны ауыстырған АҚШ-тың әскери министрі Генри Стимсон. Ол 1920шы жылдары Киото қаласына саяхаттап барып сол қаланы ұнатып қалған. Сондықтан ол былай айтады “Киото Жапонияның тарихи астанасы, егер біз ол жерге бомба тастасақ бүкіл әлемді өзімізге қарсы қойып аламыз” деп бомба түсетін қаланы Хиросимаға ауыстырған."
                }
              ],
              "comment": "",
              "timeLimitSec": 45
            },
            {
              "price": 400,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Тынық мұхитындағы Мариан шұңғымасы жер бетіндегі ең зерттелмеген және қол жетпейтін жер. Адам баласы бұл жерге қарағанда айға көбірек барған. Бірақ ғалымдар мен зерттеушілер Мариан шұңғымасына арнайы аппараттармен түскен кезде ол жерден бірнеше қоқыстар тапқан. Ол қандай қоқыстар?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Бірнеше полиэтилен пакеті мен кәмпиттің қағаздары."
                }
              ],
              "comment": "",
              "timeLimitSec": 45
            },
            {
              "price": 500,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "1904 жылы Сент-Луис қаласында өткен Олимпиада ойындарында жүгіру марафонында бірінші болып мәреге Фред Лорз келеді. Бірақ ол қалай келгенін айтқанда оны бірден дисквалификация жасап, медалін тартып ап қояды. Ол мәреге қалай бірінші келген?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Ол марафонның көп бөлігін машинамен жүріп өткен. Оны мәреге келіп, медаль алған соң барып мойындаған."
                }
              ],
              "comment": "",
              "timeLimitSec": 45
            }
          ]
        },
        {
          "title": "Сөздерді тап ИИ",
          "questions": [
            {
              "price": 100,
              "kind": "word_guess",
              "settings": {
                "word": "Найзағай",
                "hint": "Суреттегі сөзді тап"
              },
              "content": [
                {
                  "type": "text",
                  "text": "Суреттегі сөзді тап. Фотода мужик найзамен тұрады."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Найзағай"
                }
              ],
              "comment": "Здесь должна быть картинка, сгенерированная ИИ: добавьте её в содержимое вопроса. Описание картинки дано текстом.",
              "timeLimitSec": 45
            },
            {
              "price": 200,
              "kind": "word_guess",
              "settings": {
                "word": "Құлаққап",
                "hint": "Суреттегі сөзді тап"
              },
              "content": [
                {
                  "type": "text",
                  "text": "Суреттегі сөзді тап. Фотода ақ құл, яғни белый раб ақ қапты ұстап тұрады."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Құлаққап"
                }
              ],
              "comment": "Здесь должна быть картинка, сгенерированная ИИ: добавьте её в содержимое вопроса. Описание картинки дано текстом.",
              "timeLimitSec": 45
            },
            {
              "price": 300,
              "kind": "word_guess",
              "settings": {
                "word": "Балмұздақ",
                "hint": "Суреттегі сөзді тап"
              },
              "content": [
                {
                  "type": "text",
                  "text": "Суреттегі сөзді тап. Фотода мёд, лёд и пятно болады."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Балмұздақ"
                }
              ],
              "comment": "Здесь должна быть картинка, сгенерированная ИИ: добавьте её в содержимое вопроса. Описание картинки дано текстом.",
              "timeLimitSec": 45
            },
            {
              "price": 400,
              "kind": "word_guess",
              "settings": {
                "word": "Алтыбақан",
                "hint": "Суреттегі сөзді тап"
              },
              "content": [
                {
                  "type": "text",
                  "text": "Суреттегі сөзді тап. Фотода 6 саны қан қан боп жатқан бақта (cад) жүреді."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Алтыбақан"
                }
              ],
              "comment": "Здесь должна быть картинка, сгенерированная ИИ: добавьте её в содержимое вопроса. Описание картинки дано текстом.",
              "timeLimitSec": 45
            },
            {
              "price": 500,
              "kind": "word_guess",
              "settings": {
                "word": "Тигр",
                "hint": "Суреттегі сөзді тап"
              },
              "content": [
                {
                  "type": "text",
                  "text": "Суреттегі сөзді тап. Фотода Тілеген микрофонмен тұрады."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Тигр"
                }
              ],
              "comment": "Здесь должна быть картинка, сгенерированная ИИ: добавьте её в содержимое вопроса. Описание картинки дано текстом.",
              "timeLimitSec": 45
            }
          ]
        }
      ]
    },
    {
      "title": "Второй тур",
      "description": "",
      "type": "standard",
      "settings": {},
      "themes": [
        {
          "title": "Мемология (мемдерді табу)",
          "questions": [
            {
              "price": 100,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Мына мемнің астындағы ең көп лайк жинаған және ең көп жазылған комментарий қандай?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "аялдама жоқ, адамгершілік бар"
                }
              ],
              "comment": "Здесь должен быть мем: добавьте картинку или видео в содержимое вопроса.",
              "timeLimitSec": 45
            },
            {
              "price": 200,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Мына мемде қандай сумма жайлы айтып жатыр? (мемді без звука қосады, лестница, қыздар ай)"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "1 млн 400 мың теңге."
                }
              ],
              "comment": "Здесь должен быть мем: добавьте картинку или видео в содержимое вопроса.",
              "timeLimitSec": 45
            },
            {
              "price": 300,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Мына мемнің астында қандай жазу болған?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Қайтадан убийство"
                }
              ],
              "comment": "Здесь должен быть мем: добавьте картинку или видео в содержимое вопроса.",
              "timeLimitSec": 45
            },
            {
              "price": 400,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Мына мемде жігіт че тамнан бөлек \"менің ағам жоғарыда істейді\" деп айтады, оның ағасының аты кім?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Ержан"
                }
              ],
              "comment": "Здесь должен быть мем: добавьте картинку или видео в содержимое вопроса.",
              "timeLimitSec": 45
            },
            {
              "price": 500,
              "kind": "stake",
              "settings": {
                "maxStake": 500
              },
              "content": [
                {
                  "type": "text",
                  "text": "Мына мемді соңына дейін қиналмай көрсең 500 ұпай аласың, ал егер соңына дейін шыдай алмасаң 500 ұпайдан айырыласың."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Выдержал до конца: +500 очков. Не выдержал: −500 очков."
                }
              ],
              "comment": "Здесь должен быть мем: добавьте картинку или видео в содержимое вопроса. Ставка фиксированная: нажмите «Ставка 500», затем «Начать».",
              "timeLimitSec": 60
            }
          ]
        },
        {
          "title": "Ашық сұрақ (сұрақ на фантазию, ответ менің көңілімнен шығу керек",
          "questions": [
            {
              "price": 100,
              "kind": "standard",
              "settings": {
                "noPenalty": true
              },
              "content": [
                {
                  "type": "text",
                  "text": "Егер Ернар Айдар сенен келіп маған бір тренд үйретші десе, қандай тренд үйретер едің?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Ответа в таблице нет: решает ведущий"
                }
              ],
              "comment": "Вопрос на фантазию: ответ оценивает ведущий по настроению. Без риска: «не засчитать» даёт 0.",
              "timeLimitSec": 60
            },
            {
              "price": 200,
              "kind": "standard",
              "settings": {
                "noPenalty": true
              },
              "content": [
                {
                  "type": "text",
                  "text": "Су ли фа"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Ответа в таблице нет: решает ведущий"
                }
              ],
              "comment": "Вопрос на фантазию: ответ оценивает ведущий по настроению. Без риска: «не засчитать» даёт 0.",
              "timeLimitSec": 60
            },
            {
              "price": 300,
              "kind": "standard",
              "settings": {
                "noPenalty": true
              },
              "content": [
                {
                  "type": "text",
                  "text": "Дәл қазір уақытты тоқтатып қойса, барлық адамдар үшін уақыт тоқтап қалған, бірақ сен үшін тоқтамаған. Бірінші кезекте не істейтін едің?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Ответа в таблице нет: решает ведущий"
                }
              ],
              "comment": "Вопрос на фантазию: ответ оценивает ведущий по настроению. Без риска: «не засчитать» даёт 0.",
              "timeLimitSec": 60
            },
            {
              "price": 400,
              "kind": "standard",
              "settings": {
                "noPenalty": true
              },
              "content": [
                {
                  "type": "text",
                  "text": "Жаңа септік ойлап тап, және ол қандай сұрақтарға жауап беруі керек?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Ответа в таблице нет: решает ведущий"
                }
              ],
              "comment": "Вопрос на фантазию: ответ оценивает ведущий по настроению. Без риска: «не засчитать» даёт 0.",
              "timeLimitSec": 60
            },
            {
              "price": 500,
              "kind": "stake",
              "settings": {
                "maxStake": "score"
              },
              "content": [
                {
                  "type": "text",
                  "text": "Егер үшеуіңнің ішінен тек бір адаммен өміріңнің соңына дейін араласпай кетесің десе, қай адамды таңдар едің? Таңдамасаң барлық ұпайларың алынып тасталынады."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Ответа в таблице нет: решает ведущий"
                }
              ],
              "comment": "Ответа нет, решает ведущий. Ставка всем счётом игрока: верно +счёт, неверно −счёт.",
              "timeLimitSec": 60
            }
          ]
        },
        {
          "title": "Цитатаны жалғастыр",
          "questions": [
            {
              "price": 100,
              "kind": "fill_blank",
              "settings": {
                "template": "Меруерт Түсіпбаева: Ол – Баян ба, Саян ба, Қоян ба, ол бай ма, кедей ме, танымал ма, танымал емес пе... ___",
                "blanks": [
                  "маған бәрібір"
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Цитатаны жалғастыр"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "маған бәрібір"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 200,
              "kind": "fill_blank",
              "settings": {
                "template": "Жан Ахмадиев: Әйел затына қолымды көтермеймін, тек қана... ___",
                "blanks": [
                  "Қамшы"
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Цитатаны жалғастыр"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Қамшы"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 300,
              "kind": "fill_blank",
              "settings": {
                "template": "Шиза: Мойындаймын... ___",
                "blanks": [
                  "ішіп алдым мал құсап"
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Цитатаны жалғастыр"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "ішіп алдым мал құсап"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 400,
              "kind": "fill_blank",
              "settings": {
                "template": "Төреғали Төреәлі: мен арақ ішкен жоқпын, тек... ___",
                "blanks": [
                  "дәмін көрдім"
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Цитатаны жалғастыр"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "дәмін көрдім"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 500,
              "kind": "fill_blank",
              "settings": {
                "template": "Қайрат Нұртас: Кто такой Қайрат Нұртас дид, көрсетем мен оған Қайрат Нұртас кім еке... ___",
                "blanks": [
                  "нін"
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Цитатаны жалғастыр"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "нін"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            }
          ]
        },
        {
          "title": "Комментарий кімдікі",
          "questions": [
            {
              "price": 100,
              "kind": "options",
              "settings": {
                "variant": "choice",
                "multiple": false,
                "options": [
                  {
                    "id": "a",
                    "text": "Аңсаған",
                    "isCorrect": true
                  },
                  {
                    "id": "b",
                    "text": "Руслан Тай",
                    "isCorrect": false
                  },
                  {
                    "id": "c",
                    "text": "Жека Фатбелли",
                    "isCorrect": false
                  },
                  {
                    "id": "d",
                    "text": "Тілеген Еркінбек",
                    "isCorrect": false
                  }
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Мына комментарийды кімге жазған: Мектепте толық болғаным үшін \"пончик\" деп мазактайтын. Сол кезде ренжіп, жылайтынмын. Сосын студент кезімде қалаға келіп сгущенкамен пончиктің дәмін көрдім. Сөйтсем еш ренжудің қажеті жоқ екен. Содан бері ренжімеймін."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Аңсаған"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 200,
              "kind": "options",
              "settings": {
                "variant": "choice",
                "multiple": false,
                "options": [
                  {
                    "id": "a",
                    "text": "Аңсаған",
                    "isCorrect": false
                  },
                  {
                    "id": "b",
                    "text": "Руслан Тай",
                    "isCorrect": true
                  },
                  {
                    "id": "c",
                    "text": "Жека Фатбелли",
                    "isCorrect": false
                  },
                  {
                    "id": "d",
                    "text": "Тілеген Еркінбек",
                    "isCorrect": false
                  }
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Мына комментарийды кімге жазған: Әкесі туралы айтқанда көзге еріксіз жас келеді екен."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Руслан Тай"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 300,
              "kind": "options",
              "settings": {
                "variant": "choice",
                "multiple": false,
                "options": [
                  {
                    "id": "a",
                    "text": "Аңсаған",
                    "isCorrect": true
                  },
                  {
                    "id": "b",
                    "text": "Руслан Тай",
                    "isCorrect": false
                  },
                  {
                    "id": "c",
                    "text": "Жека Фатбелли",
                    "isCorrect": false
                  },
                  {
                    "id": "d",
                    "text": "Тілеген Еркінбек",
                    "isCorrect": false
                  }
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Мына комментарийды кімге жазған: Осындай комик барына ШҮКІР."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Аңсаған"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 400,
              "kind": "options",
              "settings": {
                "variant": "choice",
                "multiple": false,
                "options": [
                  {
                    "id": "a",
                    "text": "Аңсаған",
                    "isCorrect": false
                  },
                  {
                    "id": "b",
                    "text": "Руслан Тай",
                    "isCorrect": false
                  },
                  {
                    "id": "c",
                    "text": "Жека Фатбелли",
                    "isCorrect": true
                  },
                  {
                    "id": "d",
                    "text": "Тілеген Еркінбек",
                    "isCorrect": false
                  }
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Мына комментарийды кімге жазған: Мен сені ерекше сыйлаймын, бірақ мен әйелмін."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Жека Фатбелли"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 500,
              "kind": "options",
              "settings": {
                "variant": "choice",
                "multiple": false,
                "options": [
                  {
                    "id": "a",
                    "text": "Аңсаған",
                    "isCorrect": false
                  },
                  {
                    "id": "b",
                    "text": "Руслан Тай",
                    "isCorrect": false
                  },
                  {
                    "id": "c",
                    "text": "Жека Фатбелли",
                    "isCorrect": false
                  },
                  {
                    "id": "d",
                    "text": "Тілеген Еркінбек",
                    "isCorrect": true
                  }
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Мына комментарийды кімге жазған: Өте мықты комик, әзілдері бөлек, әр шыққанда күлкіден өлеміз, қазақ юморының жаңа толқыны."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Тілеген Еркінбек"
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            }
          ]
        },
        {
          "title": "Өлеңді тап (орысша)",
          "questions": [
            {
              "price": 100,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Мое внутреннее переживание как чеп черный нефть."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Ішімдегі уайым қап қара мұнайдай"
                }
              ],
              "comment": "",
              "timeLimitSec": 45
            },
            {
              "price": 200,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Қазір мен өлеңнің орысшасын айтам, сен қазақшасын табуың керек, жарай ма? Орысшасы мынандай: Ай ай ай чип чип чип, чип чип чип, аха. Бұл қандай өлең?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Мария Магдалена - Асхат Тарғын."
                }
              ],
              "comment": "",
              "timeLimitSec": 45
            },
            {
              "price": 300,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Талисман-бусина, что ты держала в руке, он лопнул и рассыпался,\nО, эти твои глаза, тёмные, как смородина, те, кто их никогда не видел, тоскуют по ним."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Көзмоншағың қолыңдағы,\nКөзмоншағың үзіліпті,\nЭх, қарақат көздеріңе,\nКөрмегендер қызығыпты."
                }
              ],
              "comment": "",
              "timeLimitSec": 45
            },
            {
              "price": 400,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Мынау қай өлең: ай твою мать, ай твою мать, ай твой мамин брат приходится тебе дядькой по матери."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "ай шешеңнің, ай шешеңнің, ай шешеңнің ағасы, болады саған нағашы."
                }
              ],
              "comment": "",
              "timeLimitSec": 45
            },
            {
              "price": 500,
              "kind": "standard",
              "settings": {},
              "content": [
                {
                  "type": "text",
                  "text": "Мынау қай өлең: Скажи мне, жизнь! Скажи мне, судьба!\nВ какой же момент по-настоящему обитает счастье?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "хайот айт, тағдыр айт, қайсы пайт бахт яшар фақат."
                }
              ],
              "comment": "",
              "timeLimitSec": 45
            }
          ]
        }
      ]
    },
    {
      "title": "Бонус-раунд: механики",
      "description": "Свои вопросы, которых нет в таблице: кот в мешке, аукцион, блиц, и т. д.",
      "type": "standard",
      "settings": {},
      "themes": [
        {
          "title": "Механики: часть 1",
          "questions": [
            {
              "price": 100,
              "kind": "cat_in_bag",
              "settings": {
                "allowSelf": false,
                "teaser": "Кот в мешке! Передайте вопрос другому игроку"
              },
              "content": [
                {
                  "type": "text",
                  "text": "Сколько океанов на Земле?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Пять: Тихий, Атлантический, Индийский, Северный Ледовитый и Южный."
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 200,
              "kind": "auction",
              "settings": {
                "startBid": 100,
                "step": 50
              },
              "content": [
                {
                  "type": "text",
                  "text": "Какой химический элемент обозначается символом Au?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Золото (Aurum)."
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 300,
              "kind": "true_false",
              "settings": {
                "correct": false,
                "explanation": "Великая Китайская стена не видна из космоса невооружённым глазом: она слишком узкая."
              },
              "content": [
                {
                  "type": "text",
                  "text": "Великую Китайскую стену видно из космоса невооружённым глазом."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Нет, это миф."
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 400,
              "kind": "ordering",
              "settings": {
                "items": [
                  {
                    "id": "1",
                    "text": "Меркурий"
                  },
                  {
                    "id": "2",
                    "text": "Венера"
                  },
                  {
                    "id": "3",
                    "text": "Земля"
                  },
                  {
                    "id": "4",
                    "text": "Марс"
                  }
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Расставьте планеты по удалённости от Солнца: от ближней к дальней."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Меркурий, Венера, Земля, Марс."
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 500,
              "kind": "blitz",
              "settings": {
                "items": [
                  {
                    "content": [
                      {
                        "type": "text",
                        "text": "Столица Казахстана"
                      }
                    ],
                    "answerContent": [
                      {
                        "type": "text",
                        "text": "Астана"
                      }
                    ]
                  },
                  {
                    "content": [
                      {
                        "type": "text",
                        "text": "Столица Узбекистана"
                      }
                    ],
                    "answerContent": [
                      {
                        "type": "text",
                        "text": "Ташкент"
                      }
                    ]
                  },
                  {
                    "content": [
                      {
                        "type": "text",
                        "text": "Столица Кыргызстана"
                      }
                    ],
                    "answerContent": [
                      {
                        "type": "text",
                        "text": "Бишкек"
                      }
                    ]
                  }
                ],
                "perItemSec": 15,
                "totalSec": 60,
                "pointsPerItem": 50
              },
              "content": [
                {
                  "type": "text",
                  "text": "Блиц: назовите столицы."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Астана, Ташкент, Бишкек."
                }
              ],
              "comment": "Очки за каждый верный пункт начисляйте вручную (по 50).",
              "timeLimitSec": null
            }
          ]
        },
        {
          "title": "Механики: часть 2",
          "questions": [
            {
              "price": 100,
              "kind": "matching",
              "settings": {
                "pairs": [
                  {
                    "left": {
                      "text": "Франция"
                    },
                    "right": {
                      "text": "Париж"
                    }
                  },
                  {
                    "left": {
                      "text": "Италия"
                    },
                    "right": {
                      "text": "Рим"
                    }
                  },
                  {
                    "left": {
                      "text": "Испания"
                    },
                    "right": {
                      "text": "Мадрид"
                    }
                  },
                  {
                    "left": {
                      "text": "Германия"
                    },
                    "right": {
                      "text": "Берлин"
                    }
                  }
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Соедините страны и столицы."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Франция: Париж, Италия: Рим, Испания: Мадрид, Германия: Берлин."
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 200,
              "kind": "options",
              "settings": {
                "variant": "odd_one_out",
                "multiple": false,
                "options": [
                  {
                    "id": "a",
                    "text": "Алматы",
                    "isCorrect": false
                  },
                  {
                    "id": "b",
                    "text": "Астана",
                    "isCorrect": false
                  },
                  {
                    "id": "c",
                    "text": "Шымкент",
                    "isCorrect": false
                  },
                  {
                    "id": "d",
                    "text": "Баку",
                    "isCorrect": true
                  }
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Найдите лишнее: какой город не находится в Казахстане?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Баку: он в Азербайджане."
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 300,
              "kind": "hints",
              "settings": {
                "penaltyPerHint": 50,
                "hints": [
                  {
                    "text": "Живёт в пустыне"
                  },
                  {
                    "text": "Может долго обходиться без воды"
                  },
                  {
                    "text": "У него один или два горба"
                  }
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Что это за животное?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Верблюд."
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 400,
              "kind": "stake",
              "settings": {
                "maxStake": "score"
              },
              "content": [
                {
                  "type": "text",
                  "text": "Сколько хромосом у здорового человека?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "46 (23 пары)."
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            },
            {
              "price": 500,
              "kind": "word_guess",
              "settings": {
                "word": "Домбыра",
                "hint": "Казахский народный инструмент"
              },
              "content": [
                {
                  "type": "text",
                  "text": "Угадайте слово по подсказке."
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Домбыра."
                }
              ],
              "comment": "",
              "timeLimitSec": 30
            }
          ]
        }
      ]
    },
    {
      "title": "СУПЕРФИНАЛ",
      "description": "Вопрос для лидера табло",
      "type": "final",
      "settings": {
        "finalists": "leader",
        "mode": "single_question"
      },
      "themes": [
        {
          "title": "Бір сұрақ, төрт вариант жауап",
          "questions": [
            {
              "price": 1000,
              "kind": "options",
              "settings": {
                "variant": "choice",
                "multiple": false,
                "options": [
                  {
                    "id": "a",
                    "text": "Дүйсенбі",
                    "isCorrect": true
                  },
                  {
                    "id": "b",
                    "text": "Сейсенбі",
                    "isCorrect": false
                  },
                  {
                    "id": "c",
                    "text": "Жұма",
                    "isCorrect": false
                  },
                  {
                    "id": "d",
                    "text": "Жексенбі.",
                    "isCorrect": false
                  }
                ]
              },
              "content": [
                {
                  "type": "text",
                  "text": "Аптаның қай күнінде адамдада жүрек талмасы, яғни сердечный приступ жиірек болады?"
                }
              ],
              "answerContent": [
                {
                  "type": "text",
                  "text": "Дүйсенбі"
                }
              ],
              "comment": "Финалисты делают ставки перед вопросом.",
              "timeLimitSec": 45
            }
          ]
        }
      ]
    }
  ]
};
