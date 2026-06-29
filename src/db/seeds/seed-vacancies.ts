import "reflect-metadata";
import { AppDataSource } from "../data-source";
import { Vacancy } from "../entities/vacancy.entity";

const vacancies = [
  {
    order: 1,
    isPublished: true,
    title_ru: "Заукачи",
    title_kz: "Заукашылар",
    title_en: "MCs",
    description_ru: "Ищем энергичных ведущих для разогрева зала перед шоу. Ты умеешь держать внимание аудитории, не теряешься на сцене и любишь живое общение — тогда это твоё. Опыт в стендапе или ивентах приветствуется, но не обязателен.",
    description_kz: "Шоу алдында залды жылыту үшін белсенді жүргізушілерді іздейміз. Сіз аудитория назарын ұстай аласыз, сахнада жоғалып кетпейсіз және тірі қарым-қатынасты жақсы көресіз — онда бұл сіз үшін. Стендап немесе іс-шаралардағы тәжірибе қош келеді, бірақ міндетті емес.",
    description_en: "We're looking for energetic MCs to warm up the crowd before shows. You know how to hold the audience's attention, feel comfortable on stage, and love live interaction. Experience in standup or events is a plus but not required.",
    salary: "Обсуждается",
  },
  {
    order: 2,
    isPublished: true,
    title_ru: "Волонтёры-админы",
    title_kz: "Волонтёр-әкімшілер",
    title_en: "Volunteer Admins",
    description_ru: "Нам нужны ответственные волонтёры для помощи на мероприятиях: встреча гостей, контроль входа, помощь организаторам. Отличная возможность попасть за кулисы клуба и познакомиться с командой. Взамен — бесплатный вход на шоу.",
    description_kz: "Іс-шараларда көмектесетін жауапты волонтёрлер керек: қонақтарды қарсы алу, кіруді бақылау, ұйымдастырушыларға көмек. Клубтың кулисасына кіріп, командамен танысудың тамаша мүмкіндігі. Орнына — шоуларға тегін кіру.",
    description_en: "We need responsible volunteers to help at events: welcoming guests, door control, assisting organizers. A great opportunity to go backstage and meet the team. In return — free entry to shows.",
    salary: "Бесплатный вход на шоу",
  },
  {
    order: 3,
    isPublished: true,
    title_ru: "Фотографы",
    title_kz: "Фотографтар",
    title_en: "Photographers",
    description_ru: "Ищем фотографов для съёмки шоу и мероприятий клуба. Нужно умение снимать в условиях слабого освещения и передавать атмосферу живого выступления. Портфолио обязательно. Сотрудничество на постоянной основе.",
    description_kz: "Клубтың шоулары мен іс-шараларын түсіру үшін фотографтар іздейміз. Нашар жарықта түсіре білу және тірі өнердің атмосферасын жеткізе алу керек. Портфолио міндетті. Тұрақты негізде ынтымақтастық.",
    description_en: "We're looking for photographers to shoot club shows and events. You need to be comfortable shooting in low-light conditions and capturing the energy of live performances. Portfolio required. Ongoing collaboration.",
    salary: "Обсуждается",
  },
  {
    order: 4,
    isPublished: true,
    title_ru: "Видеографы",
    title_kz: "Бейнеграфтар",
    title_en: "Videographers",
    description_ru: "Нужны видеографы для съёмки стендап-шоу, монтажа и подготовки контента для соцсетей. Опыт съёмки концертов или живых выступлений — плюс. Готовы рассматривать как разовое сотрудничество, так и постоянное.",
    description_kz: "Стендап-шоуларды түсіру, монтаж жасау және әлеуметтік желілерге контент дайындау үшін бейнеграфтар керек. Концерттер немесе тірі өнерді түсіру тәжірибесі — артықшылық. Бір реттік немесе тұрақты ынтымақтастыққа дайынбыз.",
    description_en: "We need videographers to film standup shows, edit footage, and prepare content for social media. Experience filming concerts or live performances is a plus. Open to both one-time and ongoing collaboration.",
    salary: "Обсуждается",
  },
];

const run = async () => {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Vacancy);

  const existing = await repo.count();
  if (existing > 0) {
    console.log(`Vacancies already exist (${existing}), skipping.`);
    await AppDataSource.destroy();
    return;
  }

  for (const data of vacancies) {
    const vacancy = repo.create(data);
    await repo.save(vacancy);
    console.log(`Saved: ${data.title_ru}`);
  }

  console.log("All vacancies seeded.");
  await AppDataSource.destroy();
};

run().catch(console.error);
