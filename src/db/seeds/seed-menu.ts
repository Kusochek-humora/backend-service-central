import "reflect-metadata";
import { AppDataSource } from "../data-source";
import { MenuCategory } from "../entities/menu.entity";
import { MenuItem } from "../entities/menu.entity";

const run = async () => {
  await AppDataSource.initialize();
  const catRepo = AppDataSource.getRepository(MenuCategory);
  const itemRepo = AppDataSource.getRepository(MenuItem);

  const existing = await itemRepo.count();
  if (existing > 0) {
    console.log(`Menu items already exist (${existing}), skipping.`);
    await AppDataSource.destroy();
    return;
  }

  const cat = async (name_ru: string, name_kz: string, name_en: string, order: number) => {
    const c = catRepo.create({ name_ru, name_kz, name_en, order, isPublic: true });
    return catRepo.save(c);
  };

  const item = async (
    categoryId: number,
    order: number,
    name_ru: string,
    name_kz: string,
    price: number,
    opts: { description_ru?: string; description_kz?: string; volume?: string; weight?: string; name_en?: string } = {}
  ) => {
    const i = itemRepo.create({
      categoryId,
      order,
      name_ru,
      name_kz,
      name_en: opts.name_en,
      description_ru: opts.description_ru,
      description_kz: opts.description_kz,
      volume: opts.volume,
      weight: opts.weight,
      price,
      photo: "",
      isAvailable: true,
      isNew: false,
    });
    await itemRepo.save(i);
    console.log(`  + ${name_ru}`);
  };

  console.log("Seeding categories...");

  const zakuski   = await cat("Закуски и салаты",        "Салаттар мен тағамдар",      "Starters & Salads",     1);
  const pizza     = await cat("Римская пицца",            "Рим пиццасы",                "Roman Pizza",           2);
  const burgers   = await cat("Бургеры и сэндвичи",       "Бургерлер мен сэндвичтер",   "Burgers & Sandwiches",  3);
  const hot       = await cat("Горячее",                  "Ыстық тағамдар",             "Mains",                 4);
  const desserts  = await cat("Десерты",                  "Десерттер",                  "Desserts",              5);
  const drinks    = await cat("Безалкогольные напитки",   "Алкогольсіз сусындар",       "Non-Alcoholic Drinks",  6);
  const lemonades = await cat("Лимонады",                 "Лимонадтар",                 "Lemonades",             7);
  const teas      = await cat("Горячие напитки",          "Ыстық сусындар",             "Hot Drinks",            8);
  const snacks    = await cat("Снеки",                    "Снектер",                    "Snacks",                9);

  console.log("Seeding Закуски и салаты...");
  await item(zakuski.id, 1, "Фри с посыпкой из копченого курта", "Ысталған құрт тозаңымен фри", 2500,
    { description_ru: "сырный соус", description_kz: "ірімшік соусы", name_en: "Fries with smoked kurt crumbs" });
  await item(zakuski.id, 2, "Пирожки с томленым цыпленком и сыром", "Пісірілген тауық еті мен ірімшікті пирожки", 2600,
    { description_ru: "соус ранч", description_kz: "ранч соусы", name_en: "Chicken & cheese pirozhki" });
  await item(zakuski.id, 3, "Пирожки с говядиной", "Сиыр етімен пирожки", 3200,
    { description_ru: "сырный соус", description_kz: "ірімшік соусы", name_en: "Beef pirozhki" });
  await item(zakuski.id, 4, "Куриный попкорн", "Тауық попкорны", 2800,
    { description_ru: "соус свит чили ранч", description_kz: "свит чили ранч соусы", name_en: "Chicken popcorn" });
  await item(zakuski.id, 5, "Сет брускетт", "Брускетта сеті", 2800,
    { description_ru: "лосось, печеные перцы, томат конфи", description_kz: "лосось, пісірілген бұрыш, томат конфи", name_en: "Bruschetta set" });
  await item(zakuski.id, 6, "Деревенский салат", "Ауыл салаты", 2400,
    { description_ru: "со сметаной и зеленью", description_kz: "қаймақ және жасылшамен", name_en: "Village salad" });

  console.log("Seeding Римская пицца...");
  await item(pizza.id, 1, "Пепперони", "Пепперони", 2900,
    { description_ru: "копченая колбаса пепперони", description_kz: "ысталған пепперони", name_en: "Pepperoni", volume: "Половина" });
  await item(pizza.id, 2, "Пепперони", "Пепперони", 5400,
    { description_ru: "копченая колбаса пепперони", description_kz: "ысталған пепперони", name_en: "Pepperoni", volume: "Целая" });
  await item(pizza.id, 3, "Жая и грибы", "Жая мен саңырауқұлақ", 2900,
    { description_ru: "копченый курт", description_kz: "ысталған құрт", name_en: "Zhaya & mushrooms", volume: "Половина" });
  await item(pizza.id, 4, "Жая и грибы", "Жая мен саңырауқұлақ", 5400,
    { description_ru: "копченый курт", description_kz: "ысталған құрт", name_en: "Zhaya & mushrooms", volume: "Целая" });
  await item(pizza.id, 5, "4 сыра", "4 ірімшік", 2600,
    { name_en: "4 cheeses", volume: "Половина" });
  await item(pizza.id, 6, "4 сыра", "4 ірімшік", 4900,
    { name_en: "4 cheeses", volume: "Целая" });
  await item(pizza.id, 7, "Маргарита", "Маргарита", 2500,
    { name_en: "Margherita", volume: "Половина" });
  await item(pizza.id, 8, "Маргарита", "Маргарита", 4900,
    { name_en: "Margherita", volume: "Целая" });

  console.log("Seeding Бургеры и сэндвичи...");
  await item(burgers.id, 1, "Мини-бургеры", "Мини-бургерлер", 3900,
    { description_ru: "сет из 3 шт на выбор: чизбургер / лук карамель барбекю", description_kz: "3 дана жиыны: чизбургер / карамельді пияз барбекю", name_en: "Mini burgers" });
  await item(burgers.id, 2, "Чизбургер", "Чизбургер", 4600,
    { description_ru: "фри, кетчуп", description_kz: "фри, кетчуп", name_en: "Cheeseburger" });
  await item(burgers.id, 3, "Сэндвич с копченой жая и сыром", "Ысталған жая мен ірімшікті сэндвич", 3600,
    { name_en: "Smoked zhaya & cheese sandwich" });
  await item(burgers.id, 4, "Клаб-сэндвич с курицей", "Тауықты клаб-сэндвич", 3900,
    { description_ru: "фри, сырный соус", description_kz: "фри, ірімшік соусы", name_en: "Chicken club sandwich" });

  console.log("Seeding Горячее...");
  await item(hot.id, 1, "Куриная котлета", "Тауық котлеті", 3600,
    { description_ru: "картофельное пюре, сливочный шпинат, зеленый горошек", description_kz: "картоп пюресі, кремді шпинат, жасыл бұршақ", name_en: "Chicken cutlet" });
  await item(hot.id, 2, "Шашлычок из цыпленка", "Тауықша шашлығы", 4600,
    { description_ru: "йогуртовая лепешка, соус дзадзыки", description_kz: "йогурт нанша, дзадзыки соусы", name_en: "Chicken skewer" });
  await item(hot.id, 3, "Спагетти болоньезе", "Спагетти болоньезе", 3600,
    { name_en: "Spaghetti Bolognese" });
  await item(hot.id, 4, "Паста с курицей", "Тауықты паста", 4200,
    { description_ru: "сливочный соус", description_kz: "кремді соус", name_en: "Chicken pasta" });

  console.log("Seeding Десерты...");
  await item(desserts.id, 1, "Баскский чизкейк", "Баск чизкейгі", 3200,
    { description_ru: "соленая мисо карамель", description_kz: "тұзды мисо карамель", name_en: "Basque cheesecake" });
  await item(desserts.id, 2, "Яблочный крамбл", "Алмалы крамбл", 3500,
    { description_ru: "мороженое", description_kz: "балмұздақ", name_en: "Apple crumble" });

  console.log("Seeding Безалкогольные напитки...");
  await item(drinks.id, 1, "Cola", "Cola", 890,
    { volume: "0.25 л", name_en: "Cola" });
  await item(drinks.id, 2, "CENTRAL Cola", "CENTRAL Cola", 890,
    { description_ru: "добавляем кислинку", description_kz: "қышқылдық қосамыз", volume: "0.25 л", name_en: "CENTRAL Cola" });
  await item(drinks.id, 3, "CENTRAL Cola Intergalactic", "CENTRAL Cola Intergalactic", 890,
    { description_ru: "космическая кола", description_kz: "ғарыштық кола", volume: "0.25 л", name_en: "CENTRAL Cola Intergalactic" });
  await item(drinks.id, 4, "CENTRAL Spicy Orange Cola", "CENTRAL Spicy Orange Cola", 890,
    { description_ru: "пряная кола с гвоздикой и корицей", description_kz: "қалампыр мен дарчынды ащы кола", volume: "0.25 л", name_en: "CENTRAL Spicy Orange Cola" });
  await item(drinks.id, 5, "Pago", "Pago", 1590,
    { volume: "0.2 л", name_en: "Pago" });
  await item(drinks.id, 6, "Набеглави", "Набеглави", 1490,
    { volume: "0.5 л", name_en: "Nabeghlavi" });
  await item(drinks.id, 7, "Miglior", "Miglior", 940,
    { description_ru: "без газа / с газом", description_kz: "газсыз / газды", volume: "0.5 л", name_en: "Miglior" });
  await item(drinks.id, 8, "Miglior Pearl", "Miglior Pearl", 1990,
    { volume: "0.75 л", name_en: "Miglior Pearl" });
  await item(drinks.id, 9, "Miglior Perfection", "Miglior Perfection", 1990,
    { volume: "0.75 л", name_en: "Miglior Perfection" });

  console.log("Seeding Лимонады...");
  await item(lemonades.id, 1, "Матча-Юдзу-Кокос", "Матча-Юдзу-Кокос", 1490,
    { description_ru: "фирменный лимонад Green Room, подаётся без газа", description_kz: "Green Room фирмалық лимонады, газсыз беріледі", volume: "0.25 л", name_en: "Matcha-Yuzu-Coconut" });
  await item(lemonades.id, 2, "Матча-Юдзу-Кокос", "Матча-Юдзу-Кокос", 3490,
    { description_ru: "фирменный лимонад Green Room, подаётся без газа", description_kz: "Green Room фирмалық лимонады, газсыз беріледі", volume: "0.8 л", name_en: "Matcha-Yuzu-Coconut" });
  await item(lemonades.id, 3, "Манго-Маракуйя", "Манго-Маракуйя", 1490,
    { description_ru: "натуральный лимонад без добавления сиропов", description_kz: "сироп қоспаған табиғи лимонад", volume: "0.25 л", name_en: "Mango-Passion Fruit" });
  await item(lemonades.id, 4, "Манго-Маракуйя", "Манго-Маракуйя", 3490,
    { description_ru: "натуральный лимонад без добавления сиропов", description_kz: "сироп қоспаған табиғи лимонад", volume: "0.8 л", name_en: "Mango-Passion Fruit" });
  await item(lemonades.id, 5, "Имбирь-Цитрус", "Имбирь-Цитрус", 1490,
    { description_ru: "натуральный лимонад без добавления сиропов", description_kz: "сироп қоспаған табиғи лимонад", volume: "0.25 л", name_en: "Ginger-Citrus" });
  await item(lemonades.id, 6, "Имбирь-Цитрус", "Имбирь-Цитрус", 3490,
    { description_ru: "натуральный лимонад без добавления сиропов", description_kz: "сироп қоспаған табиғи лимонад", volume: "0.8 л", name_en: "Ginger-Citrus" });
  await item(lemonades.id, 7, "Вишня-Ромашка", "Шие-Ромашка", 1490,
    { description_ru: "натуральный лимонад без добавления сиропов", description_kz: "сироп қоспаған табиғи лимонад", volume: "0.25 л", name_en: "Cherry-Chamomile" });
  await item(lemonades.id, 8, "Вишня-Ромашка", "Шие-Ромашка", 3490,
    { description_ru: "натуральный лимонад без добавления сиропов", description_kz: "сироп қоспаған табиғи лимонад", volume: "0.8 л", name_en: "Cherry-Chamomile" });

  console.log("Seeding Горячие напитки...");
  await item(teas.id, 1, "Облепиха-мёд-апельсин", "Шырғанақ-бал-апельсин", 990,
    { description_ru: "натуральный чай без добавления сиропов", description_kz: "сироп қоспаған табиғи шай", volume: "0.3 л", name_en: "Sea buckthorn-honey-orange" });
  await item(teas.id, 2, "Облепиха-мёд-апельсин", "Шырғанақ-бал-апельсин", 2790,
    { description_ru: "натуральный чай без добавления сиропов", description_kz: "сироп қоспаған табиғи шай", volume: "0.8 л", name_en: "Sea buckthorn-honey-orange" });
  await item(teas.id, 3, "Ташкентский чай", "Ташкент шайы", 990,
    { description_ru: "натуральный чай без добавления сиропов", description_kz: "сироп қоспаған табиғи шай", volume: "0.3 л", name_en: "Tashkent tea" });
  await item(teas.id, 4, "Ташкентский чай", "Ташкент шайы", 2790,
    { description_ru: "натуральный чай без добавления сиропов", description_kz: "сироп қоспаған табиғи шай", volume: "0.8 л", name_en: "Tashkent tea" });
  await item(teas.id, 5, "Таёжный ягодный", "Тайга жидегі", 990,
    { description_ru: "натуральный чай без добавления сиропов", description_kz: "сироп қоспаған табиғи шай", volume: "0.3 л", name_en: "Taiga berry tea" });
  await item(teas.id, 6, "Таёжный ягодный", "Тайга жидегі", 2790,
    { description_ru: "натуральный чай без добавления сиропов", description_kz: "сироп қоспаған табиғи шай", volume: "0.8 л", name_en: "Taiga berry tea" });
  await item(teas.id, 7, "Травы-мёд-специи", "Шөп-бал-дәмдеуіш", 990,
    { description_ru: "натуральный чай без добавления сиропов", description_kz: "сироп қоспаған табиғи шай", volume: "0.3 л", name_en: "Herbs-honey-spices" });
  await item(teas.id, 8, "Травы-мёд-специи", "Шөп-бал-дәмдеуіш", 2790,
    { description_ru: "натуральный чай без добавления сиропов", description_kz: "сироп қоспаған табиғи шай", volume: "0.8 л", name_en: "Herbs-honey-spices" });
  await item(teas.id, 9, "Чаочин Люй Ча Сенча", "Чаочин Люй Ча Сенча", 990,
    { description_ru: "классический зелёный чай из Китая с мягким, сбалансированным вкусом и травянистым ароматом", description_kz: "жұмсақ, теңгерімді дәмі мен шөп хош иісі бар Қытайдың классикалық жасыл шайы", name_en: "Chaoqing Lv Cha Sencha" });
  await item(teas.id, 10, "Молочный улун", "Сүтті улун", 990,
    { description_ru: "ароматизированный улун с мягким сливочным ароматом", description_kz: "жұмсақ кремді хош иісі бар ароматтандырылған улун", name_en: "Milk oolong" });
  await item(teas.id, 11, "Кения", "Кения", 990,
    { description_ru: "классический чёрный чай с плотным вкусом и оттенками мёда, карамели и сухофруктов", description_kz: "бал, карамель мен кептірілген жемістің реңктері бар тығыз дәмді классикалық қара шай", name_en: "Kenya" });
  await item(teas.id, 12, "Эрл Грэй", "Эрл Грэй", 990,
    { description_ru: "индийский чёрный чай с натуральным эфирным маслом бергамота", description_kz: "табиғи бергамот эфир майы бар үнді қара шайы", name_en: "Earl Grey" });

  console.log("Seeding Снеки...");
  await item(snacks.id, 1, "Фисташки", "Фисташки", 2290,
    { name_en: "Pistachios" });
  await item(snacks.id, 2, "Арахис солёный", "Тұзды жержаңғақ", 1490,
    { name_en: "Salted peanuts" });
  await item(snacks.id, 3, "Жареный кешью", "Қуырылған кешью", 2290,
    { name_en: "Roasted cashews" });
  await item(snacks.id, 4, "Сет оливок", "Зәйтүн сеті", 2290,
    { name_en: "Olive set" });
  await item(snacks.id, 5, "Чечил солёный", "Тұзды чечил", 1590,
    { name_en: "Salted chechil" });

  console.log("All menu items seeded.");
  await AppDataSource.destroy();
};

run().catch(console.error);
