# Public API — backend.test-standup.ru

**Base URL:** `https://backend.test-standup.ru`  
**Auth:** не требуется на публичных роутах  
**Файлы:** `https://backend.test-standup.ru/uploads/<filename>`  
**Языки:** большинство сущностей имеют поля `*_ru`, `*_kz`, `*_en`

---

## SITE INFO

### GET /site-info
```json
{
  "id": 1,
  "address_ru": "г. Алматы, ул. Панфилова 115",
  "address_kz": "Алматы қ., Панфилов к-сі 115",
  "address_en": "Almaty, Panfilov st. 115",
  "phone": "+7 700 000 0000",
  "work_hours": "Пн–Вс: 12:00–23:00"
}
```

### GET /social-links
```json
[
  { "id": 1, "type": "instagram", "url": "https://instagram.com/...", "label": "Instagram", "icon": "instagram", "order": 1 },
  { "id": 2, "type": "telegram",  "url": "https://t.me/...",          "label": "Telegram",  "icon": "telegram",  "order": 2 }
]
```

### GET /email-links
```json
[
  { "id": 1, "type": "booking", "email": "booking@test-standup.ru", "label": "Бронирование", "icon": "mail", "order": 1 }
]
```

---

## SEO

### GET /seo/:page
`page` — строка-идентификатор страницы (`home`, `events`, `blog`, ...)
```json
{
  "id": 1,
  "page": "home",
  "title_ru": "Стендап клуб — Алматы",
  "title_kz": "Стендап клубы — Алматы",
  "description_ru": "Лучший стендап в Алматы",
  "description_kz": "Алматыдағы үздік стендап",
  "og_image": "/uploads/og-home.jpg",
  "robots": "index, follow"
}
```

---

## EVENTS

### GET /events
Query params (все опциональные): `date`, `period`, `hall` (`big`|`small`), `language` (`ru`|`kz`|`en`), `isOnMainPage`, `categoryId`
```json
[
  {
    "id": 42,
    "title": "Вечер открытых микрофонов",
    "photo": "/uploads/event-42.jpg",
    "photoStories": "/uploads/event-42-stories.jpg",
    "hall": "big",
    "language": "ru",
    "link": "https://...",
    "date": "2026-06-10",
    "time": "20:00:00",
    "isDonation": false,
    "isSoldOut": false,
    "isOnMainPage": true,
    "notion": "Камерный вечер",
    "description": "Описание события...",
    "comedians": "Иванов, Петров",
    "subtext": "18+",
    "category": { "id": 2, "name": "Открытый микрофон" },
    "categoryId": 2,
    "createdAt": "2026-05-01T10:00:00.000Z",
    "updatedAt": "2026-05-15T12:00:00.000Z"
  }
]
```

### GET /events/:id
→ Тот же объект или `404 { "message": "Not found" }`

### GET /events/past?page=1&limit=10
```json
{
  "data": [ ],
  "total": 47,
  "page": 1,
  "limit": 10,
  "pages": 5
}
```

---

## CATEGORIES (для событий)

### GET /categories
```json
[
  { "id": 1, "name": "Стендап шоу", "createdAt": "...", "updatedAt": "..." },
  { "id": 2, "name": "Открытый микрофон", "createdAt": "...", "updatedAt": "..." }
]
```

---

## FAQ

### GET /faq
```json
[
  {
    "id": 1,
    "question_ru": "Где вы находитесь?",
    "answer_ru": "г. Алматы, ул. Панфилова 115",
    "question_kz": "Сіз қайда орналасқансыз?",
    "answer_kz": "Алматы қ., Панфилов к-сі 115",
    "question_en": "Where are you located?",
    "answer_en": "Almaty, Panfilov st. 115",
    "order": 1
  }
]
```

---

## BLOG

### GET /blog?page=1&limit=10&year=2026&month=5&onMainPage=true
```json
{
  "data": [
    {
      "id": 7,
      "title_ru": "Итоги сезона",
      "title_kz": "Маусым қорытындылары",
      "title_en": "Season results",
      "preview_ru": "Краткое превью...",
      "photo": "/uploads/blog-7.jpg",
      "onMainPage": true,
      "createdAt": "2026-05-20T09:00:00.000Z"
    }
  ],
  "total": 23,
  "page": 1,
  "limit": 10,
  "pages": 3
}
```

### GET /blog/:id
→ Полный объект поста + поля `content_ru`, `content_kz`, `content_en`

---

## MENU

### GET /menu/categories
Только категории с `isPublic: true`. Возвращает дерево.
```json
[
  {
    "id": 1,
    "name_ru": "Напитки",
    "name_kz": "Сусындар",
    "name_en": "Drinks",
    "order": 1,
    "children": [
      { "id": 3, "name_ru": "Алкоголь", "name_kz": "Алкоголь", "name_en": "Alcohol", "order": 1, "children": [] }
    ]
  }
]
```

### GET /menu?categoryId=3
```json
[
  {
    "id": 15,
    "name_ru": "Виски Jack Daniel's",
    "name_kz": "Виски Jack Daniel's",
    "name_en": "Jack Daniel's Whiskey",
    "description_ru": "50 мл",
    "price": 2500,
    "discount": 0,
    "alcoholType": "whiskey",
    "photo": "/uploads/menu-15.jpg",
    "isPublished": true,
    "order": 1,
    "categoryId": 3
  }
]
```

---

## MERCH

### GET /merch/categories
```json
[
  { "id": 1, "name_ru": "Футболки", "name_kz": "Футболкалар", "name_en": "T-shirts", "order": 1 }
]
```

### GET /merch?categoryId=1&page=1&limit=12
```json
{
  "data": [
    {
      "id": 3,
      "name_ru": "Футболка Standup Club",
      "name_kz": "Standup Club футболкасы",
      "name_en": "Standup Club T-shirt",
      "description_ru": "100% хлопок",
      "price": 5990,
      "photo": "/uploads/merch-3.jpg",
      "categoryId": 1,
      "isPublished": true
    }
  ],
  "total": 8,
  "page": 1,
  "limit": 12,
  "pages": 1
}
```

### POST /merch/order
```json
// body (application/json):
{
  "name": "Алексей",
  "phone": "+7 700 123 4567",
  "socialLink": "https://instagram.com/user",
  "comment": "Размер M",
  "items": [
    { "merchId": 3, "quantity": 2, "size": "M" }
  ],
  "totalPrice": 11980
}

// response 201:
{ "id": 55, "message": "Заказ принят" }
```

---

## TOURS

### GET /tours
```json
[
  {
    "id": 2,
    "title_ru": "Летний тур 2026",
    "title_kz": "Жазғы тур 2026",
    "title_en": "Summer Tour 2026",
    "description_ru": "...",
    "photo": "/uploads/tour-2.jpg",
    "isPublished": true
  }
]
```

### GET /tours/:id
→ Тот же объект или `404`

### GET /tours/:id/shows?page=1&limit=10
```json
{
  "data": [
    {
      "id": 11,
      "city_ru": "Алматы",
      "city_kz": "Алматы",
      "city_en": "Almaty",
      "venue_ru": "Standup Club",
      "date": "2026-07-15",
      "time": "19:00:00",
      "ticketLink": "https://...",
      "photo": "/uploads/show-11.jpg"
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 10,
  "pages": 1
}
```

---

## RULES

### GET /rules
```json
[
  {
    "id": 1,
    "title_ru": "Правила посещения",
    "title_kz": "Келу ережелері",
    "title_en": "Visit rules",
    "content_ru": "<p>Текст правил...</p>",
    "content_kz": "...",
    "content_en": "...",
    "order": 1
  }
]
```

---

## VACANCIES

### GET /vacancies
```json
[
  {
    "id": 4,
    "title_ru": "Официант",
    "title_kz": "Даяшы",
    "title_en": "Waiter",
    "description_ru": "Требования...",
    "description_kz": "...",
    "description_en": "...",
    "salary": "от 200 000 тг",
    "isPublished": true,
    "order": 1
  }
]
```

### POST /vacancies/:id/apply
`Content-Type: multipart/form-data`
```
Fields:
  name        string (required)
  phone       string (required)
  socialLink  string (optional)
  message     string (optional)
  file        file   (optional — резюме)

Response 200:
{ "message": "Отклик отправлен" }
```
