import "reflect-metadata";
import { AppDataSource } from "../data-source";
import { Rule } from "../entities/rule.entity";

const rules = [
  {
    order: 1,
    title_ru: "Курение", title_kz: "Темекі шегу", title_en: "Smoking",
    content_ru: "Курить нельзя, включая электронные устройства и системы нагревания.",
    content_kz: "Электрондық құрылғылар мен қыздыру жүйелерін қоса алғанда, темекі шегуге тыйым салынады.",
    content_en: "Smoking is prohibited, including e-cigarettes and heat-not-burn devices.",
  },
  {
    order: 2,
    title_ru: "Не кричи", title_kz: "Айқайлама", title_en: "Don't shout",
    content_ru: "Не выкрикиваем реплики и не комментируем артистов. Разговариваем тихо.",
    content_kz: "Артистерге реплика айтпаңыз және пікір білдірмеңіз. Тыныш сөйлесіңіз.",
    content_en: "Please don't shout comments at the performers. Keep conversations quiet.",
  },
  {
    order: 3,
    title_ru: "Телефон", title_kz: "Телефон", title_en: "Phone",
    content_ru: "Пожалуйста, отключите звук и уберите яркость, чтобы не отвлекать соседей.",
    content_kz: "Көршілеріңізді алаңдатпау үшін дыбысты өшіріп, экран жарықтығын азайтыңыз.",
    content_en: "Please silence your phone and lower the screen brightness so as not to disturb others.",
  },
  {
    order: 4,
    title_ru: "Опоздания", title_kz: "Кешігу", title_en: "Late arrival",
    content_ru: "На большинство шоу можно не спешить. На съёмках двери закрываются через 15 минут после начала шоу.",
    content_kz: "Көптеген шоуларға асықпай келуге болады. Түсірілім кезінде есіктер шоу басталғаннан 15 минут өткен соң жабылады.",
    content_en: "For most shows, there's no rush. During filmed events, doors close 15 minutes after the show starts.",
  },
  {
    order: 5,
    title_ru: "Запись в зале", title_kz: "Залда жазу", title_en: "Recording",
    content_ru: "Фото, видео и аудиозапись запрещены без согласия клуба.",
    content_kz: "Клубтың рұқсатынсыз фото, видео және аудио жазуға тыйым салынады.",
    content_en: "Photo, video, and audio recording is prohibited without the club's permission.",
  },
  {
    order: 6,
    title_ru: "18+ на съёмках", title_kz: "Түсірілімде 18+", title_en: "18+ at filmed events",
    content_ru: "На мероприятия с профессиональной съёмкой вход только 18+.",
    content_kz: "Кәсіби түсірілім жүргізілетін іс-шараларға тек 18 жастан кіруге болады.",
    content_en: "Only guests aged 18 and over are admitted to professionally filmed events.",
  },
  {
    order: 7,
    title_ru: "Младше 18", title_kz: "18 жасқа толмағандар", title_en: "Under 18",
    content_ru: "До 18 лет допускаются только с родителями или законными представителями.",
    content_kz: "18 жасқа толмағандар тек ата-анасымен немесе заңды өкілдерімен кіре алады.",
    content_en: "Guests under 18 are admitted only when accompanied by a parent or legal guardian.",
  },
  {
    order: 8,
    title_ru: "Паспорт", title_kz: "Құжат", title_en: "ID",
    content_ru: "По запросу персонала покажите удостоверение личности, чтобы подтвердить свой возраст.",
    content_kz: "Қызметкерлердің сұрауы бойынша жасыңызды растау үшін жеке куәлігіңізді көрсетіңіз.",
    content_en: "Please present a valid ID upon staff request to verify your age.",
  },
  {
    order: 9,
    title_ru: "Бар и кухня", title_kz: "Бар және ас үй", title_en: "Bar & kitchen",
    content_ru: "В клубе можно заказать еду и напитки.",
    content_kz: "Клубта тамақ пен сусындарға тапсырыс беруге болады.",
    content_en: "Food and drinks are available to order at the club.",
  },
  {
    order: 10,
    title_ru: "Оплата", title_kz: "Төлем", title_en: "Payment",
    content_ru: "Счёт оплачивается при оформлении заказа, наличными или картой, Kaspi QR.",
    content_kz: "Тапсырыс берген кезде қолма-қол ақшамен, картамен немесе Kaspi QR арқылы төленеді.",
    content_en: "Payment is made when placing an order — cash, card, or Kaspi QR accepted.",
  },
  {
    order: 11,
    title_ru: "Своя еда", title_kz: "Өз тағамы", title_en: "Outside food",
    content_ru: "Употреблять свою еду и напитки в концертном зале нельзя.",
    content_kz: "Концерт залына өз тамағыңыз бен сусындарыңызды әкелуге тыйым салынады.",
    content_en: "Bringing your own food and drinks into the venue is not allowed.",
  },
  {
    order: 12,
    title_ru: "Алкоголь 21+", title_kz: "Алкоголь 21+", title_en: "Alcohol 21+",
    content_ru: "Алкоголь продаём только гостям от 21 года.",
    content_kz: "Алкоголь тек 21 жастан асқан қонақтарға сатылады.",
    content_en: "Alcohol is sold only to guests aged 21 and over.",
  },
];

const run = async () => {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Rule);

  const existing = await repo.count();
  if (existing > 0) {
    console.log(`Rules already exist (${existing}), skipping.`);
    await AppDataSource.destroy();
    return;
  }

  for (const data of rules) {
    const rule = repo.create(data);
    await repo.save(rule);
    console.log(`Saved: ${data.title_ru}`);
  }

  console.log("All rules seeded.");
  await AppDataSource.destroy();
};

run().catch(console.error);
