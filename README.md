# КиноВкус — рекомендации фильмов/сериалов/аниме (monorepo)

## Стек

- Backend: NestJS + Prisma + PostgreSQL
- Frontend: Vue 3 + Vite + PrimeVue + Pinia + Vue Router + Chart.js
- Infra: Docker Compose (frontend + backend + postgres)

## Быстрый старт (dev)

1. Скопируйте `.env.example` в `.env` и заполните ключи TMDB/JWT (не храните реальные ключи в репозитории).
2. Установите зависимости:
   ```bash
   npm install --workspaces
   ```
3. Запустите Postgres (локально или через Docker):
   ```bash
   docker compose -f infra/docker-compose.yml up -d db
   ```
4. Примените Prisma миграции и seed:
   ```bash
   cd backend
   npx prisma migrate dev
   npm run prisma:seed
   ```
5. Запустите backend:
   ```bash
   npm run start:dev
   ```
6. В другом окне запустите frontend:
   ```bash
   cd frontend
   npm run dev
   ```
   Фронт откроется на http://localhost:5173. В dev включён proxy `/api -> http://localhost:3000`, чтобы httpOnly refresh-куки работали без CORS. При необходимости измените `VITE_API_PROXY_TARGET`.

## Запуск всего стека через Docker

```bash
docker compose -f infra/docker-compose.yml up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api
- Postgres: localhost:5432 (user/pass: filmrec/filmrec)

## Структура

- `docs/product` — продуктовые требования и UX‑потоки
- `docs/architecture` — обзор, модель данных, API, рекомендационный движок
- `backend` — NestJS код, Prisma schema, Dockerfile
- `frontend` — Vue 3 UI, PrimeVue тёмная тема, Dockerfile
- `infra` — docker-compose и nginx конфиг

## TODO / Следующие шаги

- Доработать RecommendationEngine: multi‑profile по контексту (evening_solo / family и т.п.), дополнительные сезонные/временные сигналы.
- Добавить e2e‑тесты (Playwright/Cypress) для основного сценария (регистрация → онбординг → рекомендации → список/история).
- Улучшить mobile‑layout: нижний таб‑бар, компактные контролы в истории.
- Настроить Husky и линты на pre-commit (hook `lint` + `test` для критических модулей).
