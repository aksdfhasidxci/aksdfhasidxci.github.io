# 🚀 SeedAim Cloud — Инструкция по запуску

## Шаг 1: Создать Supabase проект (5 минут)

1. Зайди на **[supabase.com](https://supabase.com)** → Sign up (бесплатно)
2. Нажми **"New Project"**
3. Введи название, пароль БД, выбери регион (EU West ближе всего)
4. Подожди ~2 минуты пока проект создаётся

---

## Шаг 2: Скопировать ключи

1. В проекте Supabase: **Settings → API**
2. Скопируй:
   - **Project URL** (выглядит как `https://abcdefgh.supabase.co`)
   - **anon public** key (длинная строка)
3. Открой файл [`js/supabase-config.js`](js/supabase-config.js) и вставь:

```js
const SUPABASE_URL = 'https://ТВОЙ_REF.supabase.co';
const SUPABASE_ANON_KEY = 'ТВОЙ_ANON_KEY';
```

---

## Шаг 3: Создать таблицы в БД

1. В Supabase: **SQL Editor → New query**
2. Скопируй всё содержимое файла [`supabase-setup.sql`](supabase-setup.sql) и вставь в редактор
3. Нажми **"Run"**

---

## Шаг 4: Настроить Email подтверждение

1. В Supabase: **Authentication → URL Configuration**
2. В поле **"Site URL"** введи URL твоего GitHub Pages сайта:
   `https://ВАШ_USERNAME.github.io/ВАШ_РЕПОЗИТОРИЙ`
3. В **"Redirect URLs"** добавь:
   `https://ВАШ_USERNAME.github.io/ВАШ_РЕПОЗИТОРИЙ/dashboard.html`

---

## Шаг 5: Деплой на GitHub Pages

1. Создай новый репозиторий на [github.com](https://github.com)
2. Загрузи все файлы проекта (можно перетащить в браузере)
3. В репозитории: **Settings → Pages**
4. В "Branch" выбери `main`, папку `/ (root)`
5. Нажми **Save**
6. Через ~2 минуты сайт будет доступен по адресу:
   `https://ВАШ_USERNAME.github.io/ВАШ_РЕПОЗИТОРИЙ`

---

## Что работает после настройки

| Функция | Статус |
|---|---|
| ✅ Регистрация через email + пароль | Работает |
| ✅ Email подтверждение при регистрации | Работает (Supabase отправляет) |
| ✅ Вход в аккаунт | Работает |
| ✅ Защита страниц (dashboard, scanner и др.) | Работает |
| ✅ База данных пользователей | Работает (PostgreSQL в Supabase) |
| ✅ Профиль пользователя с планом | Работает |
| ✅ Автовыход при истечении сессии | Работает |
| ⏳ Отображение данных сканера из БД | В разработке |

---

## Бесплатные лимиты Supabase

| Ресурс | Бесплатный лимит |
|---|---|
| Активных пользователей/мес | 50,000 |
| Размер БД | 500 MB |
| Хранилище файлов | 1 GB |
| Email (Auth) | Без ограничений |
| API запросов | 500,000 / мес |

> Для небольшого проекта этого более чем достаточно.

---

## Структура файлов

```
seedaim_site/
├── index.html          ← Страница входа/регистрации (с Supabase Auth)
├── dashboard.html      ← Дашборд (защищён, загружает данные из БД)
├── scanner.html        ← Сканер (защищён)
├── tariffs.html        ← Тарифы (защищён)
├── upgrade.html        ← Апгрейд (защищён)
├── payment.html        ← Оплата (защищён)
├── js/
│   ├── supabase-config.js  ← ← ← СЮДА ВСТАВИТЬ КЛЮЧИ!
│   └── auth.js             ← Общий модуль авторизации
└── supabase-setup.sql  ← SQL скрипт для создания таблиц
```
