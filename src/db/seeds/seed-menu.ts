import "reflect-metadata";
import { AppDataSource } from "../data-source";
import { MenuCategory } from "../entities/menu.entity";
import { MenuItem } from "../entities/menu.entity";

const run = async () => {
  await AppDataSource.initialize();
  const catRepo = AppDataSource.getRepository(MenuCategory);
  const itemRepo = AppDataSource.getRepository(MenuItem);

  const cat = async (name_ru: string, name_kz: string, name_en: string, order: number) => {
    const existing = await catRepo.findOneBy({ name_ru });
    if (existing) {
      catRepo.merge(existing, { name_kz, name_en, order, isPublic: true });
      return catRepo.save(existing);
    }
    return catRepo.save(catRepo.create({ name_ru, name_kz, name_en, order, isPublic: true }));
  };

  const item = async (
    categoryId: number,
    order: number,
    name_ru: string,
    name_kz: string,
    price: number,
    opts: {
      description_ru?: string;
      description_kz?: string;
      description_en?: string;
      volume?: string;
      weight?: string;
      name_en?: string;
      discountId?: number;
    } = {}
  ) => {
    const existing = opts.volume
      ? await itemRepo.findOneBy({ categoryId, name_ru, volume: opts.volume })
      : await itemRepo.createQueryBuilder("i")
          .where("i.categoryId = :c AND i.name_ru = :n AND i.volume IS NULL", { c: categoryId, n: name_ru })
          .getOne();

    if (existing) {
      existing.description_ru = opts.description_ru ?? existing.description_ru;
      existing.description_kz = opts.description_kz ?? existing.description_kz;
      existing.description_en = opts.description_en ?? existing.description_en;
      existing.name_en = opts.name_en ?? existing.name_en;
      if (opts.discountId !== undefined) existing.discountId = opts.discountId;
      await itemRepo.save(existing);
      console.log(`  ~ ${name_ru}`);
      return;
    }

    const i = itemRepo.create({
      categoryId,
      order,
      name_ru,
      name_kz,
      name_en: opts.name_en,
      description_ru: opts.description_ru,
      description_kz: opts.description_kz,
      description_en: opts.description_en,
      volume: opts.volume,
      weight: opts.weight,
      price,
      discountId: opts.discountId,
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
  await item(zakuski.id, 1, "Фри с посыпкой из копченого курта", "Ысталған құрт тозаңымен фри", 2500, {
    name_en: "Fries with smoked kurt crumbs",
    description_ru: "Хрустящий картофель фри щедро посыпан крошкой копчёного курта — казахского сыра с дымным характером. Подаётся с домашним сырным соусом.",
    description_kz: "Хрустящий картоп фри ысталған құрт ұнтағымен мол себілген — тұздықты, дымды дәммен. Үй ірімшік соусымен беріледі.",
    description_en: "Crispy fries generously topped with smoked kurt crumbs — a Kazakh cheese with a smoky, salty kick. Served with homemade cheese sauce.",
    discountId: 10,
  });
  await item(zakuski.id, 2, "Пирожки с томленым цыпленком и сыром", "Пісірілген тауық еті мен ірімшікті пирожки", 2600, {
    name_en: "Chicken & cheese pirozhki",
    description_ru: "Мягкие пирожки из воздушного теста с начинкой из медленно томлёного цыплёнка и плавленого сыра. Соус ранч добавляет свежести и лёгкой пикантности.",
    description_kz: "Жұмсақ қамырдан жасалған пирожки, баяу пісірілген тауық еті мен балқыма ірімшік толтырылған. Ранч соусы жаңалық пен жеңіл өткірлік қосады.",
    description_en: "Soft fluffy dough stuffed with slow-braised chicken and melted cheese. Ranch sauce adds a cool, tangy finish.",
  });
  await item(zakuski.id, 3, "Пирожки с говядиной", "Сиыр етімен пирожки", 3200, {
    name_en: "Beef pirozhki",
    description_ru: "Сочные пирожки с рубленой говядиной, луком и специями в золотистой корочке. Подаются с насыщенным сырным соусом — простой вкус, который не надоедает.",
    description_kz: "Туралған сиыр еті, пияз және дәмдеуіштер толтырылған шырынды пирожки, алтын қабықша ішінде. Қанық ірімшік соусымен беріледі.",
    description_en: "Juicy pirozhki filled with minced beef, onion and spices in a golden crust. Served with a rich cheese sauce.",
    discountId: 15,
  });
  await item(zakuski.id, 4, "Куриный попкорн", "Тауық попкорны", 2800, {
    name_en: "Chicken popcorn",
    description_ru: "Нежные кусочки куриного филе в хрустящей панировке — идеальная закуска под шоу. Соус свит чили ранч: сладко, остро, освежающе.",
    description_kz: "Хрустящий панировкадағы нәзік тауық филесі бөліктері — шоу кезіндегі керемет тағам. Свит чили ранч соусы: тәтті, ащы, сергітетін.",
    description_en: "Tender chicken bites in a crunchy coating — perfect snack for the show. Sweet chili ranch sauce: sweet, spicy and refreshing.",
  });
  await item(zakuski.id, 5, "Сет брускетт", "Брускетта сеті", 2800, {
    name_en: "Bruschetta set",
    description_ru: "Три поджаренных тоста на выбор: с лососем и каперсами, с печёными перцами и рикоттой и с томатом конфи и базиликом. Элегантная закуска в итальянском стиле.",
    description_kz: "Үш қуырылған тост таңдауға: лосось пен каперспен, пісірілген бұрыш пен рикоттамен және томат конфи мен базиликпен. Итальяндық стильдегі нәзік тағам.",
    description_en: "Three toasted crostini: salmon & capers, roasted peppers & ricotta, and tomato confit & basil. An elegant Italian-style starter.",
    discountId: 10,
  });
  await item(zakuski.id, 6, "Деревенский салат", "Ауыл салаты", 2400, {
    name_en: "Village salad",
    description_ru: "Свежие овощи, зелень и хрустящие гренки заправлены домашней сметаной. Лёгкий, сытный и без лишнего — такой салат ешь и не замечаешь.",
    description_kz: "Жаңа көкөністер, жасылша және хрустящий гренкилер үй қаймағымен дәмделген. Жеңіл, қанықтырушы және артық нәрсесіз.",
    description_en: "Fresh vegetables, herbs and crunchy croutons dressed with homemade sour cream. Light, satisfying and unpretentious.",
  });

  console.log("Seeding Римская пицца...");
  await item(pizza.id, 1, "Пепперони", "Пепперони", 2900, {
    name_en: "Pepperoni",
    description_ru: "Тонкое хрустящее тесто, щедрый слой томатного соуса, моцарелла и пряная копчёная колбаса пепперони. Классика, которую любят все.",
    description_kz: "Жұқа хрустящий қамыр, қызанақ соусы, моцарелла және ысталған пепперони шұжығы. Барлығы жақсы көретін классика.",
    description_en: "Thin crispy dough, rich tomato sauce, mozzarella and spiced smoked pepperoni. A classic everyone loves.",
    volume: "Половина",
  });
  await item(pizza.id, 2, "Пепперони", "Пепперони", 5400, {
    name_en: "Pepperoni",
    description_ru: "Тонкое хрустящее тесто, щедрый слой томатного соуса, моцарелла и пряная копчёная колбаса пепперони. Классика, которую любят все.",
    description_kz: "Жұқа хрустящий қамыр, қызанақ соусы, моцарелла және ысталған пепперони шұжығы. Барлығы жақсы көретін классика.",
    description_en: "Thin crispy dough, rich tomato sauce, mozzarella and spiced smoked pepperoni. A classic everyone loves.",
    volume: "Целая",
  });
  await item(pizza.id, 3, "Жая и грибы", "Жая мен саңырауқұлақ", 2900, {
    name_en: "Zhaya & mushrooms",
    description_ru: "Копчёная конина жая, лесные грибы и ароматная крошка копчёного курта на тонком тесте. Необычное сочетание с глубоким казахским характером.",
    description_kz: "Ысталған жылқы еті жая, орман саңырауқұлақтары және ысталған құрт ұнтағы жұқа қамырда. Терең қазақстандық сипаттағы ерекше үйлесім.",
    description_en: "Smoked horse meat zhaya, forest mushrooms and smoked kurt crumbs on thin dough. An unusual combination with a deep Kazakh character.",
    volume: "Половина",
    discountId: 10,
  });
  await item(pizza.id, 4, "Жая и грибы", "Жая мен саңырауқұлақ", 5400, {
    name_en: "Zhaya & mushrooms",
    description_ru: "Копчёная конина жая, лесные грибы и ароматная крошка копчёного курта на тонком тесте. Необычное сочетание с глубоким казахским характером.",
    description_kz: "Ысталған жылқы еті жая, орман саңырауқұлақтары және ысталған құрт ұнтағы жұқа қамырда. Терең қазақстандық сипаттағы ерекше үйлесім.",
    description_en: "Smoked horse meat zhaya, forest mushrooms and smoked kurt crumbs on thin dough. An unusual combination with a deep Kazakh character.",
    volume: "Целая",
    discountId: 10,
  });
  await item(pizza.id, 5, "4 сыра", "4 ірімшік", 2600, {
    name_en: "4 cheeses",
    description_ru: "Моцарелла, горгонзола, пармезан и рикотта — четыре сыра тают на хрустящем тесте, создавая насыщенный сливочный вкус без лишних отвлечений.",
    description_kz: "Моцарелла, горгонзола, пармезан және рикотта — төрт ірімшік хрустящий қамырда ериді, артық нәрсесіз қанық кремді дәм жасайды.",
    description_en: "Mozzarella, gorgonzola, parmesan and ricotta — four cheeses melt on crispy dough, creating a rich, creamy flavour without distraction.",
    volume: "Половина",
  });
  await item(pizza.id, 6, "4 сыра", "4 ірімшік", 4900, {
    name_en: "4 cheeses",
    description_ru: "Моцарелла, горгонзола, пармезан и рикотта — четыре сыра тают на хрустящем тесте, создавая насыщенный сливочный вкус без лишних отвлечений.",
    description_kz: "Моцарелла, горгонзола, пармезан және рикотта — төрт ірімшік хрустящий қамырда ериді, артық нәрсесіз қанық кремді дәм жасайды.",
    description_en: "Mozzarella, gorgonzola, parmesan and ricotta — four cheeses melt on crispy dough, creating a rich, creamy flavour without distraction.",
    volume: "Целая",
  });
  await item(pizza.id, 7, "Маргарита", "Маргарита", 2500, {
    name_en: "Margherita",
    description_ru: "Томатный соус, свежая моцарелла, листья базилика — всё. Идеальная маргарита не нуждается в оправданиях.",
    description_kz: "Қызанақ соусы, жаңа моцарелла, базилик жапырақтары — бәрі осы. Мінсіз маргаритаға ешқандай түсіндірме қажет емес.",
    description_en: "Tomato sauce, fresh mozzarella, basil leaves — that's it. A perfect margherita needs no justification.",
    volume: "Половина",
  });
  await item(pizza.id, 8, "Маргарита", "Маргарита", 4900, {
    name_en: "Margherita",
    description_ru: "Томатный соус, свежая моцарелла, листья базилика — всё. Идеальная маргарита не нуждается в оправданиях.",
    description_kz: "Қызанақ соусы, жаңа моцарелла, базилик жапырақтары — бәрі осы. Мінсіз маргаритаға ешқандай түсіндірме қажет емес.",
    description_en: "Tomato sauce, fresh mozzarella, basil leaves — that's it. A perfect margherita needs no justification.",
    volume: "Целая",
  });

  console.log("Seeding Бургеры и сэндвичи...");
  await item(burgers.id, 1, "Мини-бургеры", "Мини-бургерлер", 3900, {
    name_en: "Mini burgers",
    description_ru: "Сет из трёх мини-бургеров на выбор: классический чизбургер или с карамелизованным луком и соусом барбекю. Хорошая компания для любого напитка.",
    description_kz: "Үш мини-бургер жиыны таңдауға: классикалық чизбургер немесе карамельді пиязбен және барбекю соусымен. Кез келген сусынға жақсы серік.",
    description_en: "A set of three mini burgers of your choice: classic cheeseburger or caramelised onion with BBQ sauce. Great company for any drink.",
  });
  await item(burgers.id, 2, "Чизбургер", "Чизбургер", 4600, {
    name_en: "Cheeseburger",
    description_ru: "Сочная говяжья котлета, плавленый чеддер, свежие овощи и кетчуп в мягкой булке. Подаётся с золотистым фри. Не нужно придумывать ничего лучше.",
    description_kz: "Шырынды сиыр еті котлеті, балқыма чеддер, жаңа көкөністер және кетчуп жұмсақ бөлкеде. Алтын фримен беріледі. Одан жақсыны ойлап табудың қажеті жоқ.",
    description_en: "Juicy beef patty, melted cheddar, fresh vegetables and ketchup in a soft bun. Served with golden fries. You don't need to imagine anything better.",
    discountId: 10,
  });
  await item(burgers.id, 3, "Сэндвич с копченой жая и сыром", "Ысталған жая мен ірімшікті сэндвич", 3600, {
    name_en: "Smoked zhaya & cheese sandwich",
    description_ru: "Тонко нарезанная копчёная конина жая с плавленым сыром на поджаренном хлебе. Неожиданно знакомый вкус с казахским акцентом.",
    description_kz: "Жұқа туралған ысталған жылқы еті жая балқыма ірімшікпен қуырылған нанда. Қазақстандық акцентпен күтпеген таныс дәм.",
    description_en: "Thinly sliced smoked horse meat zhaya with melted cheese on toasted bread. An unexpectedly familiar taste with a Kazakh accent.",
  });
  await item(burgers.id, 4, "Клаб-сэндвич с курицей", "Тауықты клаб-сэндвич", 3900, {
    name_en: "Chicken club sandwich",
    description_ru: "Куриное филе гриль, хрустящий бекон, свежие томаты, листья салата и сырный соус между тремя слоями тоста. Подаётся с фри.",
    description_kz: "Гриль тауық филесі, хрустящий бекон, жаңа қызанақтар, салат жапырақтары және ірімшік соусы үш тост қабаты арасында. Фримен беріледі.",
    description_en: "Grilled chicken fillet, crispy bacon, fresh tomatoes, lettuce and cheese sauce between three layers of toast. Served with fries.",
  });

  console.log("Seeding Горячее...");
  await item(hot.id, 1, "Куриная котлета", "Тауық котлеті", 3600, {
    name_en: "Chicken cutlet",
    description_ru: "Сочная котлета из куриного фарша с хрустящей корочкой на нежном картофельном пюре со сливочным шпинатом и зелёным горошком. Домашний уют в ресторанном исполнении.",
    description_kz: "Хрустящий қабықшадағы шырынды тауық котлеті нәзік картоп пюресінде кремді шпинат пен жасыл бұршақпен. Мейрамхана орындауындағы үй жылуы.",
    description_en: "Juicy chicken patty with a crunchy crust on creamy mashed potatoes with buttery spinach and green peas. Home comfort in restaurant style.",
  });
  await item(hot.id, 2, "Шашлычок из цыпленка", "Тауықша шашлығы", 4600, {
    name_en: "Chicken skewer",
    description_ru: "Маринованный цыплёнок на шпажке, запечённый до румяной корочки. Подаётся на пышной йогуртовой лепёшке с соусом дзадзыки — свежим, с огурцом и мятой.",
    description_kz: "Маринадталған тауықша сауықта алтын қабықшаға дейін пісірілген. Қияр мен жалбыздан жасалған дзадзыки соусымен пышпақ йогурт нанында беріледі.",
    description_en: "Marinated chicken skewer roasted to a golden crust. Served on a fluffy yogurt flatbread with tzatziki sauce — fresh, with cucumber and mint.",
    discountId: 15,
  });
  await item(hot.id, 3, "Спагетти болоньезе", "Спагетти болоньезе", 3600, {
    name_en: "Spaghetti Bolognese",
    description_ru: "Спагетти al dente с насыщенным соусом из томлёного мясного рагу, томатов и ароматных трав. Щедро посыпано пармезаном.",
    description_kz: "Томлёный ет рагусынан, қызанақтардан және хош иісті шөптерден жасалған қанық соуспен спагетти al dente. Пармезанмен мол себілген.",
    description_en: "Al dente spaghetti with a rich braised meat ragù, tomatoes and aromatic herbs. Generously topped with parmesan.",
  });
  await item(hot.id, 4, "Паста с курицей", "Тауықты паста", 4200, {
    name_en: "Chicken pasta",
    description_ru: "Паста с нежными кусочками куриного филе в бархатистом сливочном соусе с чесноком и пармезаном. Согревает и насыщает.",
    description_kz: "Сарымсақ пен пармезанмен жасалған бархатты кремді соустағы нәзік тауық филесі бөліктерімен паста. Жылытады және қанықтырады.",
    description_en: "Pasta with tender chicken fillet pieces in a velvety cream sauce with garlic and parmesan. Warming and satisfying.",
    discountId: 10,
  });

  console.log("Seeding Десерты...");
  await item(desserts.id, 1, "Баскский чизкейк", "Баск чизкейгі", 3200, {
    name_en: "Basque cheesecake",
    description_ru: "Нежный сливочный чизкейк с карамелизованной верхушкой и тающей серединой. Соленая мисо карамель добавляет глубину и неожиданную пикантность.",
    description_kz: "Карамельденген үстімен және балқитын ортасымен нәзік кремді чизкейк. Тұзды мисо карамель тереңдік пен күтпеген дәм қосады.",
    description_en: "Creamy cheesecake with a caramelised top and a melting centre. Salted miso caramel adds depth and an unexpected savoury note.",
    discountId: 10,
  });
  await item(desserts.id, 2, "Яблочный крамбл", "Алмалы крамбл", 3500, {
    name_en: "Apple crumble",
    description_ru: "Запечённые яблоки с корицей под хрустящей крамбловой корочкой из масляного теста с овсянкой. Подаётся тёплым с шариком ванильного мороженого.",
    description_kz: "Дарчынмен пісірілген алмалар сары маймен жасалған хрустящий крамбл қабықшасының астында. Ванильді балмұздақ добымен жылы беріледі.",
    description_en: "Baked cinnamon apples under a buttery oat crumble crust. Served warm with a scoop of vanilla ice cream.",
  });

  console.log("Seeding Безалкогольные напитки...");
  await item(drinks.id, 1, "Cola", "Cola", 890, {
    name_en: "Cola",
    description_ru: "Классическая кола со знакомым вкусом. Холодная, игристая, без лишних слов.",
    description_kz: "Таныс дәмі бар классикалық кола. Суық, көпіршікті, артық сөзсіз.",
    description_en: "Classic cola with a familiar taste. Cold, fizzy, no words needed.",
    volume: "0.25 л",
  });
  await item(drinks.id, 2, "CENTRAL Cola", "CENTRAL Cola", 890, {
    name_en: "CENTRAL Cola",
    description_ru: "Наш авторский вариант колы с добавлением лёгкой кислинки — освежает сильнее, пьётся легче.",
    description_kz: "Жеңіл қышқылдық қосылған біздің авторлық кола нұсқамыз — күштірек сергітеді, жеңілірек ішіледі.",
    description_en: "Our signature cola with a touch of sourness — more refreshing, goes down easier.",
    volume: "0.25 л",
  });
  await item(drinks.id, 3, "CENTRAL Cola Intergalactic", "CENTRAL Cola Intergalactic", 890, {
    name_en: "CENTRAL Cola Intergalactic",
    description_ru: "Космическая кола с неожиданным профилем вкуса. Что именно — лучше попробовать самому.",
    description_kz: "Күтпеген дәм профилі бар ғарыштық кола. Нақты не екенін өзіңіз татып көрген жақсы.",
    description_en: "Space cola with an unexpected flavour profile. Best discovered for yourself.",
    volume: "0.25 л",
  });
  await item(drinks.id, 4, "CENTRAL Spicy Orange Cola", "CENTRAL Spicy Orange Cola", 890, {
    name_en: "CENTRAL Spicy Orange Cola",
    description_ru: "Кола с апельсиновыми нотками, гвоздикой и корицей. Пряная, тёплая, немного зимняя — даже летом.",
    description_kz: "Апельсин, қалампыр және дарчын ноталары бар кола. Дәмді, жылы, қысқаша — жазда да.",
    description_en: "Cola with orange notes, clove and cinnamon. Spiced, warm and slightly wintry — even in summer.",
    volume: "0.25 л",
  });
  await item(drinks.id, 5, "Pago", "Pago", 1590, {
    name_en: "Pago",
    description_ru: "Натуральный фруктовый сок без добавок. Плотный, насыщенный, как будто только что выжатый.",
    description_kz: "Қоспасыз табиғи жеміс шырыны. Тығыз, қанық, жаңа ғана сығылған сияқты.",
    description_en: "Natural fruit juice with no additives. Dense and rich, as if freshly squeezed.",
    volume: "0.2 л",
  });
  await item(drinks.id, 6, "Набеглави", "Набеглави", 1490, {
    name_en: "Nabeghlavi",
    description_ru: "Грузинская минеральная вода с мягкой минерализацией. Хорошо очищает вкус и подходит ко всему меню.",
    description_kz: "Жұмсақ минералдануы бар Грузин минерал суы. Дәмді жақсы тазартады және барлық мәзірге сай келеді.",
    description_en: "Georgian mineral water with a gentle mineral profile. Cleanses the palate and pairs with everything.",
    volume: "0.5 л",
  });
  await item(drinks.id, 7, "Miglior", "Miglior", 940, {
    name_en: "Miglior",
    description_ru: "Итальянская питьевая вода — без газа для тех, кто ценит тишину, с газом для тех, кто любит пузырьки.",
    description_kz: "Итальяндық ауыз суы — тыныштықты бағалайтындар үшін газсыз, көпіршіктерді жақсы көретіндер үшін газды.",
    description_en: "Italian still or sparkling water — for those who appreciate quiet, and those who love bubbles.",
    volume: "0.5 л",
  });
  await item(drinks.id, 8, "Miglior Pearl", "Miglior Pearl", 1990, {
    name_en: "Miglior Pearl",
    description_ru: "Итальянская вода премиум-класса в элегантной бутылке. Мягкая, чистая, нейтральная.",
    description_kz: "Элегантты бөтелкедегі премиум класстағы итальяндық су. Жұмсақ, таза, бейтарап.",
    description_en: "Premium Italian water in an elegant bottle. Soft, clean and neutral.",
    volume: "0.75 л",
  });
  await item(drinks.id, 9, "Miglior Perfection", "Miglior Perfection", 1990, {
    name_en: "Miglior Perfection",
    description_ru: "Итальянская газированная вода с мелкими пузырьками. Деликатная игристость, которая не перебивает вкус еды.",
    description_kz: "Ұсақ көпіршіктері бар итальяндық газды су. Тамақтың дәмін бұзбайтын нәзік шипучесть.",
    description_en: "Italian sparkling water with fine bubbles. Delicate fizz that doesn't overpower your food.",
    volume: "0.75 л",
  });

  console.log("Seeding Лимонады...");
  await item(lemonades.id, 1, "Матча-Юдзу-Кокос", "Матча-Юдзу-Кокос", 1490, {
    name_en: "Matcha-Yuzu-Coconut",
    description_ru: "Фирменный лимонад Green Room: землистая матча, цитрусовый юдзу и нежный кокос. Подаётся без газа, чтобы сохранить деликатный баланс.",
    description_kz: "Green Room фирмалық лимонады: жер дәмді матча, цитрусты юдзу және нәзік кокос. Нәзік тепе-теңдікті сақтау үшін газсыз беріледі.",
    description_en: "Green Room signature lemonade: earthy matcha, citrusy yuzu and gentle coconut. Served still to preserve the delicate balance.",
    volume: "0.25 л",
    discountId: 10,
  });
  await item(lemonades.id, 2, "Матча-Юдзу-Кокос", "Матча-Юдзу-Кокос", 3490, {
    name_en: "Matcha-Yuzu-Coconut",
    description_ru: "Фирменный лимонад Green Room: землистая матча, цитрусовый юдзу и нежный кокос. Подаётся без газа, чтобы сохранить деликатный баланс.",
    description_kz: "Green Room фирмалық лимонады: жер дәмді матча, цитрусты юдзу және нәзік кокос. Нәзік тепе-теңдікті сақтау үшін газсыз беріледі.",
    description_en: "Green Room signature lemonade: earthy matcha, citrusy yuzu and gentle coconut. Served still to preserve the delicate balance.",
    volume: "0.8 л",
    discountId: 10,
  });
  await item(lemonades.id, 3, "Манго-Маракуйя", "Манго-Маракуйя", 1490, {
    name_en: "Mango-Passion Fruit",
    description_ru: "Натуральный лимонад без сиропов: спелое манго и кислая маракуйя — тропический дуэт, который бодрит.",
    description_kz: "Сиропсыз табиғи лимонад: піскен манго және қышқыл маракуйя — серпілтетін тропикалық дует.",
    description_en: "Natural lemonade without syrups: ripe mango and tart passion fruit — a tropical duo that energises.",
    volume: "0.25 л",
  });
  await item(lemonades.id, 4, "Манго-Маракуйя", "Манго-Маракуйя", 3490, {
    name_en: "Mango-Passion Fruit",
    description_ru: "Натуральный лимонад без сиропов: спелое манго и кислая маракуйя — тропический дуэт, который бодрит.",
    description_kz: "Сиропсыз табиғи лимонад: піскен манго және қышқыл маракуйя — серпілтетін тропикалық дует.",
    description_en: "Natural lemonade without syrups: ripe mango and tart passion fruit — a tropical duo that energises.",
    volume: "0.8 л",
  });
  await item(lemonades.id, 5, "Имбирь-Цитрус", "Имбирь-Цитрус", 1490, {
    name_en: "Ginger-Citrus",
    description_ru: "Натуральный лимонад без сиропов: острый имбирь и яркий цитрус. Освежает и слегка разогревает одновременно.",
    description_kz: "Сиропсыз табиғи лимонад: ащы имбирь мен жарқын цитрус. Бір мезгілде сергітеді де, жылытады да.",
    description_en: "Natural lemonade without syrups: punchy ginger and bright citrus. Refreshes and gently warms at the same time.",
    volume: "0.25 л",
  });
  await item(lemonades.id, 6, "Имбирь-Цитрус", "Имбирь-Цитрус", 3490, {
    name_en: "Ginger-Citrus",
    description_ru: "Натуральный лимонад без сиропов: острый имбирь и яркий цитрус. Освежает и слегка разогревает одновременно.",
    description_kz: "Сиропсыз табиғи лимонад: ащы имбирь мен жарқын цитрус. Бір мезгілде сергітеді де, жылытады да.",
    description_en: "Natural lemonade without syrups: punchy ginger and bright citrus. Refreshes and gently warms at the same time.",
    volume: "0.8 л",
  });
  await item(lemonades.id, 7, "Вишня-Ромашка", "Шие-Ромашка", 1490, {
    name_en: "Cherry-Chamomile",
    description_ru: "Натуральный лимонад без сиропов: сладкая вишня и нежная ромашка. Мягкий, цветочный, чуть ностальгический.",
    description_kz: "Сиропсыз табиғи лимонад: тәтті шие мен нәзік ромашка. Жұмсақ, гүлді, сәл ностальгиялық.",
    description_en: "Natural lemonade without syrups: sweet cherry and gentle chamomile. Soft, floral and slightly nostalgic.",
    volume: "0.25 л",
  });
  await item(lemonades.id, 8, "Вишня-Ромашка", "Шие-Ромашка", 3490, {
    name_en: "Cherry-Chamomile",
    description_ru: "Натуральный лимонад без сиропов: сладкая вишня и нежная ромашка. Мягкий, цветочный, чуть ностальгический.",
    description_kz: "Сиропсыз табиғи лимонад: тәтті шие мен нәзік ромашка. Жұмсақ, гүлді, сәл ностальгиялық.",
    description_en: "Natural lemonade without syrups: sweet cherry and gentle chamomile. Soft, floral and slightly nostalgic.",
    volume: "0.8 л",
  });

  console.log("Seeding Горячие напитки...");
  await item(teas.id, 1, "Облепиха-мёд-апельсин", "Шырғанақ-бал-апельсин", 990, {
    name_en: "Sea buckthorn-honey-orange",
    description_ru: "Ягодный чай без сиропов: кислая облепиха, цветочный мёд и сочный апельсин. Согревает и наполняет витаминами.",
    description_kz: "Сиропсыз жидек шайы: қышқыл шырғанақ, гүлді бал және шырынды апельсин. Жылытады және витаминдермен толтырады.",
    description_en: "Herbal tea without syrups: tart sea buckthorn, floral honey and juicy orange. Warming and full of vitamins.",
    volume: "0.3 л",
  });
  await item(teas.id, 2, "Облепиха-мёд-апельсин", "Шырғанақ-бал-апельсин", 2790, {
    name_en: "Sea buckthorn-honey-orange",
    description_ru: "Ягодный чай без сиропов: кислая облепиха, цветочный мёд и сочный апельсин. Согревает и наполняет витаминами.",
    description_kz: "Сиропсыз жидек шайы: қышқыл шырғанақ, гүлді бал және шырынды апельсин. Жылытады және витаминдермен толтырады.",
    description_en: "Herbal tea without syrups: tart sea buckthorn, floral honey and juicy orange. Warming and full of vitamins.",
    volume: "0.8 л",
  });
  await item(teas.id, 3, "Ташкентский чай", "Ташкент шайы", 990, {
    name_en: "Tashkent tea",
    description_ru: "Традиционный среднеазиатский купаж без добавления сиропов. Тёплый, ароматный, с лёгкой сладостью трав.",
    description_kz: "Сироп қоспаған дәстүрлі Орта Азия купажы. Жылы, хош иісті, шөптердің жеңіл тәттілігімен.",
    description_en: "Traditional Central Asian blend without syrups. Warm, aromatic with a gentle herbal sweetness.",
    volume: "0.3 л",
  });
  await item(teas.id, 4, "Ташкентский чай", "Ташкент шайы", 2790, {
    name_en: "Tashkent tea",
    description_ru: "Традиционный среднеазиатский купаж без добавления сиропов. Тёплый, ароматный, с лёгкой сладостью трав.",
    description_kz: "Сироп қоспаған дәстүрлі Орта Азия купажы. Жылы, хош иісті, шөптердің жеңіл тәттілігімен.",
    description_en: "Traditional Central Asian blend without syrups. Warm, aromatic with a gentle herbal sweetness.",
    volume: "0.8 л",
  });
  await item(teas.id, 5, "Таёжный ягодный", "Тайга жидегі", 990, {
    name_en: "Taiga berry tea",
    description_ru: "Лесные ягоды, хвойные ноты и немного дикого духа тайги. Натуральный, без сиропов, согревает изнутри.",
    description_kz: "Орман жидектері, қылқан жапырақты ноталар және тайганың аздаған жабайы рухы. Табиғи, сиропсыз, іштен жылытады.",
    description_en: "Forest berries, pine notes and a touch of wild taiga spirit. Natural, no syrups, warms from within.",
    volume: "0.3 л",
    discountId: 10,
  });
  await item(teas.id, 6, "Таёжный ягодный", "Тайга жидегі", 2790, {
    name_en: "Taiga berry tea",
    description_ru: "Лесные ягоды, хвойные ноты и немного дикого духа тайги. Натуральный, без сиропов, согревает изнутри.",
    description_kz: "Орман жидектері, қылқан жапырақты ноталар және тайганың аздаған жабайы рухы. Табиғи, сиропсыз, іштен жылытады.",
    description_en: "Forest berries, pine notes and a touch of wild taiga spirit. Natural, no syrups, warms from within.",
    volume: "0.8 л",
    discountId: 10,
  });
  await item(teas.id, 7, "Травы-мёд-специи", "Шөп-бал-дәмдеуіш", 990, {
    name_en: "Herbs-honey-spices",
    description_ru: "Согревающий чай из трав с мёдом и пряными специями. Мягко успокаивает и помогает расслабиться.",
    description_kz: "Бал мен дәмді дәмдеуіштері бар шөптен жасалған жылытатын шай. Жұмсақ тынышталады және демалуға көмектеседі.",
    description_en: "Warming herbal tea with honey and aromatic spices. Gently soothes and helps you unwind.",
    volume: "0.3 л",
  });
  await item(teas.id, 8, "Травы-мёд-специи", "Шөп-бал-дәмдеуіш", 2790, {
    name_en: "Herbs-honey-spices",
    description_ru: "Согревающий чай из трав с мёдом и пряными специями. Мягко успокаивает и помогает расслабиться.",
    description_kz: "Бал мен дәмді дәмдеуіштері бар шөптен жасалған жылытатын шай. Жұмсақ тынышталады және демалуға көмектеседі.",
    description_en: "Warming herbal tea with honey and aromatic spices. Gently soothes and helps you unwind.",
    volume: "0.8 л",
  });
  await item(teas.id, 9, "Чаочин Люй Ча Сенча", "Чаочин Люй Ча Сенча", 990, {
    name_en: "Chaoqing Lv Cha Sencha",
    description_ru: "Классический китайский зелёный чай с мягким, сбалансированным вкусом и травянистым ароматом. Хорошо очищает вкус после еды.",
    description_kz: "Жұмсақ, теңгерімді дәмі мен шөп хош иісі бар классикалық қытай жасыл шайы. Тамақтан кейін дәмді жақсы тазартады.",
    description_en: "Classic Chinese green tea with a soft, balanced flavour and grassy aroma. Excellent palate cleanser after a meal.",
  });
  await item(teas.id, 10, "Молочный улун", "Сүтті улун", 990, {
    name_en: "Milk oolong",
    description_ru: "Ароматизированный улун с нежным, обволакивающим сливочным ароматом. Мягко и ненавязчиво — как лёгкий десерт в чашке.",
    description_kz: "Нәзік, орап алатын кремді хош иісі бар ароматтандырылған улун. Жұмсақ және кедергісіз — кесседегі жеңіл десерт сияқты.",
    description_en: "Flavoured oolong with a gentle, enveloping creamy aroma. Soft and unobtrusive — like a light dessert in a cup.",
  });
  await item(teas.id, 11, "Кения", "Кения", 990, {
    name_en: "Kenya",
    description_ru: "Насыщенный чёрный чай из Кении с плотным, мужественным вкусом и оттенками мёда, карамели и сухофруктов.",
    description_kz: "Бал, карамель мен кептірілген жеміс реңктері бар тығыз, ерлерге лайықты дәмі бар Кениядан келген қанық қара шай.",
    description_en: "Rich Kenyan black tea with a bold, full-bodied flavour and hints of honey, caramel and dried fruit.",
  });
  await item(teas.id, 12, "Эрл Грэй", "Эрл Грэй", 990, {
    name_en: "Earl Grey",
    description_ru: "Индийский чёрный чай с натуральным эфирным маслом бергамота. Ароматный, узнаваемый, без лишних слов.",
    description_kz: "Табиғи бергамот эфир майы бар үнді қара шайы. Хош иісті, танылатын, артық сөзсіз.",
    description_en: "Indian black tea with natural bergamot essential oil. Aromatic, unmistakable, no words needed.",
  });

  console.log("Seeding Снеки...");
  await item(snacks.id, 1, "Фисташки", "Фисташки", 2290, {
    name_en: "Pistachios",
    description_ru: "Солёные фисташки — хрустящая закуска, которую сложно остановить. Идеально под напиток и хорошую компанию.",
    description_kz: "Тұзды фисташки — тоқтату қиын хрустящий тағам. Сусын мен жақсы компанияға өте сай.",
    description_en: "Salted pistachios — a crunchy snack that's hard to stop. Perfect with a drink and good company.",
  });
  await item(snacks.id, 2, "Арахис солёный", "Тұзды жержаңғақ", 1490, {
    name_en: "Salted peanuts",
    description_ru: "Классический жареный арахис с морской солью. Простой, хрустящий, как надо.",
    description_kz: "Теңіз тұзымен классикалық қуырылған жержаңғақ. Қарапайым, хрустящий, керемет.",
    description_en: "Classic roasted peanuts with sea salt. Simple, crunchy, just right.",
    discountId: 10,
  });
  await item(snacks.id, 3, "Жареный кешью", "Қуырылған кешью", 2290, {
    name_en: "Roasted cashews",
    description_ru: "Нежные кешью обжарены до золотистого цвета. Маслянистые, слегка сладковатые — закуска с характером.",
    description_kz: "Нәзік кешью алтын түске дейін қуырылған. Майлы, сәл тәтті — мінезді тағам.",
    description_en: "Tender cashews roasted to a golden colour. Buttery, slightly sweet — a snack with character.",
  });
  await item(snacks.id, 4, "Сет оливок", "Зәйтүн сеті", 2290, {
    name_en: "Olive set",
    description_ru: "Подборка оливок разных сортов — зелёные, чёрные, маринованные с травами. Средиземноморское настроение за столом.",
    description_kz: "Әртүрлі сортты зәйтүн жиыны — жасыл, қара, шөптермен маринадталған. Үстел басында Жерорта теңізі көңіл-күйі.",
    description_en: "A selection of olive varieties — green, black, marinated with herbs. A Mediterranean mood at the table.",
  });
  await item(snacks.id, 5, "Чечил солёный", "Тұзды чечил", 1590, {
    name_en: "Salted chechil",
    description_ru: "Тянутый сырный чечил в косичке с морской солью. Тянется, хрустит, исчезает незаметно.",
    description_kz: "Теңіз тұзымен бұрымды тартылған ірімшік чечил. Созылады, хрустидді, байқатпай жоғалады.",
    description_en: "Pulled string cheese chechil braided with sea salt. Stretchy, crunchy and disappears without notice.",
  });

  console.log("All menu items seeded.");
  await AppDataSource.destroy();
};

run().catch(console.error);
