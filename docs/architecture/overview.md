# Архитектурный обзор

## Монорепозиторий
- `backend` — NestJS (Node.js 20, TypeScript), Prisma, PostgreSQL.
- `frontend` — Vue 3 + Vite + PrimeVue + Pinia + Router + Axios + vue-i18n + Chart.js.
- `infra` — Docker Compose (frontend, backend, postgres, pgadmin optional, nginx), prod nginx конфиг.
- Общие утилиты: ESLint+Prettier (шарим базовый конфиг), Husky/линты по желанию.

## Слоистая архитектура backend
- `modules/*`: `auth`, `users`, `tmdb`, `titles`, `user-titles`, `recommendations`, `feedback`, `analytics`.
- Слои: Controller → Service (бизнес-логика) → Repository/Prisma → Integration (TMDB client) → Domain models/DTOs.
- Общие: `common` (filters, interceptors, DTO helpers), `config` (env validation), `logging`.
- RecommendationEngine отдельным сервисом в модуле `recommendations`, не смешан с контроллерами.

## Данные и кэш
- PostgreSQL основное хранилище.
- Кэш TMDB ответов на стороне backend (in-memory + опционально Redis в будущем; сейчас Layered: короткий in-memory TTL и persisted titles для тех, с кем был контакт пользователя).
- Сырые TMDB payload сохраняем в `Title.rawTmdbJson` (jsonb) для быстрой выборки сигналов.

## API слой
- REST JSON, префикс `/api`. JWT Bearer для приватных маршрутов. Health-check `/health` публичный.
- Единый формат ошибок через Exception Filter; логирование запросов/исключений.

## Рекомендательный контур
- RecommendationEngine получает userId + context (mood/mindset/company/timeAvailable).
- Строит профиль вкуса (UserTasteProfile), извлекает кандидатов из локально сохранённых и TMDB (по жанрам/похожим), скорит >100 сигналов, делает diversity rerank, возвращает 5 топ‑кандидатов с объяснениями.
- RecommendationSession фиксирует показанные тайтлы; FeedbackEvent связывает лайки/дизлайки с session для обучения.

## Frontend
- Vite SPA, темная тема. Структура: `pages`, `components`, `api` (axios), `store` (Pinia), `router`, `styles` (theme tokens).
- Авторизация через токены: backend выставляет httpOnly refresh (опционально), access в памяти/secure storage. Axios интерсепторы обновляют токены через `/auth/refresh`.

## Безопасность и observability
- ENV схема через `@nestjs/config` + Joi для валидации.
- Пароли bcrypt, JWT с refresh ротацией, CORS ограниченный.
- Логи: запросы + бизнес события (recommendation served, feedback accepted). Health и readiness endpoints.
- Rate limit на публичных TMDB прокси эндпоинтах.
