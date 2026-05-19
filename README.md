# ПИНГ·ТАБЛЕТ

Турниры по настольному теннису — где угодно.

## Технологии

- React + TypeScript + Vite
- Tailwind CSS
- Supabase (база данных + авторизация)
- shadcn/ui компоненты

## Запуск локально

1. Клонируй репозиторий
2. Установи зависимости:
   ```bash
   npm install
   ```
3. Создай файл `.env` из примера:
   ```bash
   cp .env.example .env
   ```
4. Заполни `.env` данными из Supabase Dashboard (Settings → API)
5. Запусти dev-сервер:
   ```bash
   npm run dev
   ```

## Деплой на GitHub Pages

### Автоматически (через GitHub Actions)

1. Создай репозиторий на GitHub и запушь код
2. Перейди: **Settings → Pages → Source → GitHub Actions**
3. Добавь секреты: **Settings → Secrets → Actions**:
   - `VITE_SUPABASE_URL` — URL твоего Supabase проекта
   - `VITE_SUPABASE_ANON_KEY` — анонимный ключ
4. Если репозиторий называется не `username.github.io`, в `vite.config.ts` раскомментируй строку `base` и укажи имя репо:
   ```ts
   base: '/название-репо/',
   ```
5. Запушь в `main` → сборка и деплой запустятся автоматически

### Вручную (Vercel / Netlify — проще всего)

**Vercel:**
1. Зайди на [vercel.com](https://vercel.com), подключи GitHub репо
2. В настройках проекта добавь переменные окружения:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy → готово, автоматически при каждом пуше

**Netlify:**
1. Зайди на [netlify.com](https://netlify.com), подключи GitHub репо
2. Build command: `npm run build`, Publish directory: `dist`
3. Добавь переменные окружения в **Site Settings → Environment variables**

## Supabase

База данных и миграции находятся в папке `supabase/migrations/`.
Для применения миграций используй Supabase CLI:
```bash
npx supabase db push
```
