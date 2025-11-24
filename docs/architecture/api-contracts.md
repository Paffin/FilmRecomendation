# REST API контракты (v1)
Базовый префикс: `/api`.
Все приватные эндпоинты требуют Bearer access JWT. Refresh токен через cookie httpOnly (опционально) либо тело запроса.

## Auth
- `POST /auth/register` — {email, password, displayName} → {user, accessToken, refreshToken}
- `POST /auth/login` — {email, password} → {user, accessToken, refreshToken}
- `POST /auth/refresh` — {refreshToken?} → {accessToken, refreshToken}
- `POST /auth/logout` — инвалидирует refresh.

## Me/Onboarding
- `GET /me` — текущий пользователь.
- `GET /onboarding/state` — {completed: bool, selectedCount: number}.
- `POST /onboarding/complete` — помечает завершение.

## Titles
- `GET /titles/search` — query: q, mediaType?, page? → {results: TitleSummary[], page, totalPages}.
- `GET /titles/:id` — подробности (из БД + TMDB под капотом при необходимости).
- `GET /titles/:id/similar` — список похожих (кэшируемый).

## User titles (статусы)
- `GET /user-titles` — query: status?, mediaType? → список {title, state}.
- `POST /user-titles` — {tmdbId, mediaType, status, liked?, disliked?, rating?} → {title, state}.
- `PATCH /user-titles/:id` — частичное обновление (status|liked|disliked|rating).

## Recommendations
- `GET /recommendations` — query: limit=5, mood?, mindset?, company?, timeAvailable? → {sessionId, items:[{title, explanation:string[]}]}
- `POST /recommendations/feedback` — {sessionId, titleId, feedback: 'like'|'dislike'} → {replacement?: {title, explanation}} (при дизлайке) или {ok:true} при лайке.

## Analytics
- `GET /analytics/overview` — KPI для профиля (counts, durations, distributions).
- `GET /analytics/taste-map` — данные для карты вкуса (жанры, тон/темп, годы, страны, диверсификация).
- `GET /analytics/history` — агрегированные по времени данные для графиков.
- `GET /analytics/antislist` — список дизлайкнутых; `POST /analytics/antislist/restore` — вернуть тайтл в пул.

## Health
- `GET /health` — {status:'ok', timestamp}.

### Формат ошибок
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["email must be valid"]
}
```
