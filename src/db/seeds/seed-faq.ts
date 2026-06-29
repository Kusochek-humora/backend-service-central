import "reflect-metadata";
import { AppDataSource } from "../data-source";
import { Faq } from "../entities/faq.entity";

const faqs = [
  {
    order: 1,
    question_ru: "Как часто обновляется расписание?",
    question_kz: "Кесте қаншалықты жиі жаңартылады?",
    question_en: "How often is the schedule updated?",
    answer_ru: "Новые шоу добавляем почти каждый день. Следите за обновлениями в Инстаграме и на странице «Афиши».",
    answer_kz: "Жаңа шоулар дерлік күн сайын қосылады. Instagram-да және «Афиша» бетінде жаңартуларды қадағалаңыз.",
    answer_en: "We add new shows almost every day. Follow updates on Instagram and the Schedule page.",
  },
  {
    order: 2,
    question_ru: "Как купить билеты?",
    question_kz: "Билеттерді қалай сатып алуға болады?",
    question_en: "How do I buy tickets?",
    answer_ru: "Откройте «Афишу», выберите шоу, нажмите «Билеты» и оформите заказ на сайте билетного сервиса.",
    answer_kz: "«Афишаны» ашыңыз, шоуды таңдаңыз, «Билеттер» батырмасын басыңыз және билет сервисінің сайтында тапсырыс рәсімдеңіз.",
    answer_en: "Open the Schedule, choose a show, click 'Tickets', and complete your order on the ticketing service website.",
  },
  {
    order: 3,
    question_ru: "Во сколько приходить?",
    question_kz: "Қай уақытта келу керек?",
    question_en: "When should I arrive?",
    answer_ru: "Приходите за 15 минут до начала. Этого хватает на гардероб, уборную, заказ и рассадку. Точное время сбора смотрите в билете и в афише.",
    answer_kz: "Басталуға 15 минут бұрын келіңіз. Бұл гардероб, дәретхана, тапсырыс беру және орналасу үшін жеткілікті. Жиналу уақытын билетте және афишада қараңыз.",
    answer_en: "Arrive 15 minutes before the start. That's enough time for coat check, restroom, ordering, and finding your seat. Check the exact arrival time on your ticket and in the schedule.",
  },
  {
    order: 4,
    question_ru: "Можно ли опаздывать?",
    question_kz: "Кешігуге бола ма?",
    question_en: "Is it okay to arrive late?",
    answer_ru: "На большинстве мероприятий можно зайти и позже, но просим делать это тихо. В зале уже темно, заказы на баре принимаются в спокойном режиме. Администратор вас проводит до места.\n\nЕсли мероприятие с профессиональной съёмкой, вход в зал закрывается через 15 минут после начала.",
    answer_kz: "Көптеген іс-шараларда кейінірек кіруге болады, бірақ мұны тыныш жасауды сұраймыз. Залда қазір қараңғы, барда тапсырыстар тыныш режимде қабылданады. Әкімші сізді орныңызға апарады.\n\nЕгер іс-шарада кәсіби түсірілім болса, зал есігі басталғаннан 15 минут өткен соң жабылады.",
    answer_en: "At most events you can come in later, but please do so quietly. The hall is dark, bar orders are taken calmly, and an administrator will escort you to your seat.\n\nIf the event includes professional filming, the hall closes 15 minutes after the start.",
  },
  {
    order: 5,
    question_ru: "Можно ли выходить во время шоу?",
    question_kz: "Шоу кезінде шығуға бола ма?",
    question_en: "Can I leave during the show?",
    answer_ru: "Да, можно выйти в любой момент, если это не мешает другим зрителям.\n\nЕсли идёт профессиональная съёмка, попросите администратора в зале помочь выйти и зайти обратно.",
    answer_kz: "Иә, егер бұл басқа көрермендерге кедергі келтірмесе, кез келген уақытта шығуға болады.\n\nЕгер кәсіби түсірілім жүріп жатса, залдағы әкімшіден шығып, қайта кіруге көмек сұраңыз.",
    answer_en: "Yes, you can leave at any time as long as it doesn't disturb other viewers.\n\nIf professional filming is in progress, ask the hall administrator to help you exit and re-enter.",
  },
  {
    order: 6,
    question_ru: "Съёмка и запись в зале зрителями",
    question_kz: "Көрермендердің залда түсіруі мен жазуы",
    question_en: "Recording by audience members",
    answer_ru: "Фото, видео и аудиозапись запрещены, если со сцены не объявили иное.",
    answer_kz: "Сахнадан өзгеше жарияланбаса, фото, видео және аудио жазуға тыйым салынады.",
    answer_en: "Photo, video, and audio recording are prohibited unless otherwise announced from the stage.",
  },
  {
    order: 7,
    question_ru: "Возрастные ограничения",
    question_kz: "Жас шектеулері",
    question_en: "Age restrictions",
    answer_ru: "Ограничение по возрасту указано в афише и в билете, оно приоритетно. Как правило: большинство мероприятий 18+. Форматы с профессиональной съёмкой только 18+. В сопровождении законных представителей можно с 15 лет (об этом подробнее ниже). Алкоголь продаётся лицам с 21 года.\n\nФормат sezim melodiasy не ограничен возрастом: можно хоть с младенцем. Однако если данный концерт поставлен на временной слот, который закончится после 22:00, обязательно сопровождение взрослого.",
    answer_kz: "Жас шектеуі афишада және билетте көрсетілген, ол басымдықты. Әдетте: іс-шаралардың көпшілігі 18+. Кәсіби түсірілімдегі форматтар тек 18+. Заңды өкілдерімен 15 жастан кіруге болады (бұл туралы төменде толығырақ). Алкоголь 21 жастан сатылады.\n\nsezim melodiasy форматы жасқа шектелмеген: нәрестемен де болады. Алайда бұл концерт 22:00-ден кейін аяқталатын уақыт слотына қойылса, ересектің сүйемелдеуі міндетті.",
    answer_en: "Age restrictions are listed in the schedule and on the ticket — they take priority. In general: most events are 18+. Professionally filmed formats are 18+ only. Guests aged 15+ may attend with a legal guardian (more below). Alcohol is sold to guests 21 and over.\n\nThe sezim melodiasy format has no age restriction — even infants are welcome. However, if the concert ends after 22:00, adult accompaniment is required.",
  },
  {
    order: 8,
    question_ru: "15+. Кто считается законным представителем?",
    question_kz: "15+. Кім заңды өкіл болып есептеледі?",
    question_en: "15+. Who qualifies as a legal guardian?",
    answer_ru: "Законные представители: родители и усыновители.\n\nПопечители должны представить справку по опеке и попечительству.\n\nДругие совершеннолетние родственники (бабушки, дедушки, старшие братья/сёстры) НЕ являются законными представителями по умолчанию. Для допуска им нужна нотариальная доверенность от родителей.",
    answer_kz: "Заңды өкілдер: ата-аналар және асырап алушылар.\n\nҚамқоршылар қамқорлық туралы ресми құжат ұсынуы тиіс.\n\nБасқа кәмелеттік жастағы туыстар (әже, ата, үлкен аға/апалар) әдепкі бойынша заңды өкіл болып есептелмейді. Оларға кіру үшін ата-анасынан нотариалды сенімхат қажет.",
    answer_en: "Legal guardians are: parents and adoptive parents.\n\nGuardians must present official guardianship documentation.\n\nOther adult relatives (grandparents, older siblings) are NOT legal guardians by default. They need a notarized power of attorney from the parents to be admitted.",
  },
  {
    order: 9,
    question_ru: "Бар и кухня",
    question_kz: "Бар және ас үй",
    question_en: "Bar & kitchen",
    answer_ru: "Меню и режим работы кухни и бара смотрите на странице «Кухня и бар».\n\nУпотреблять свои еду и напитки в зале нельзя (исключение: медицинские случаи, по согласованию с администрацией). Напитки в стекле и в открытой таре нельзя.",
    answer_kz: "Мәзір мен жұмыс уақытын «Ас үй және бар» бетінен қараңыз.\n\nЗалда өз тамағыңыз бен сусындарыңызды пайдалануға болмайды (ерекшелік: медициналық жағдайлар, әкімшілікпен келісім бойынша). Шыны ыдыстардағы және ашық ыдыстардағы сусындарға тыйым салынады.",
    answer_en: "See the menu and hours on the 'Kitchen & Bar' page.\n\nBringing your own food and drinks into the hall is not allowed (exception: medical cases, by arrangement with staff). Drinks in glass containers or open vessels are not permitted.",
  },
  {
    order: 10,
    question_ru: "Возврат билетов",
    question_kz: "Билеттерді қайтару",
    question_en: "Ticket refunds",
    answer_ru: "Возврат оформляется через сервис, где покупали билет. Клуб не делает возвраты.\n\nСроки и условия зависят от сервиса и типа мероприятия. Проверьте правила в письме с билетом или обратитесь в поддержку сервиса.",
    answer_kz: "Қайтару билет сатып алынған сервис арқылы рәсімделеді. Клуб қайтаруларды жасамайды.\n\nМерзімдер мен шарттар сервис пен іс-шара түріне байланысты. Ережелерді билеттегі хатта тексеріңіз немесе сервистің қолдау қызметіне хабарласыңыз.",
    answer_en: "Refunds are processed through the service where you bought the ticket. The club does not issue refunds.\n\nTerms and conditions depend on the service and event type. Check the rules in your ticket email or contact the service's support team.",
  },
];

const run = async () => {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Faq);

  const existing = await repo.count();
  if (existing > 0) {
    console.log(`FAQs already exist (${existing}), skipping.`);
    await AppDataSource.destroy();
    return;
  }

  for (const data of faqs) {
    const faq = repo.create(data);
    await repo.save(faq);
    console.log(`Saved: ${data.question_ru}`);
  }

  console.log("All FAQs seeded.");
  await AppDataSource.destroy();
};

run().catch(console.error);
