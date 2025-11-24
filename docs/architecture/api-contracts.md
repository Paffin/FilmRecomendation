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

- `GET /recommendations`
  - query:
    - `limit=5`
    - `mood?` (`light|neutral|heavy`)
    - `mindset?` (`relax|balanced|focus`)
    - `company?` (`solo|duo|friends|family`)
    - `timeAvailable?` (строковый minutes, напр. `"60"|"90"|"120"`)
    - `noveltyBias?` (`safe|mix|surprise`)
    - `pace?` (`calm|balanced|dynamic`)
    - `freshness?` (`trending|classic|any`)
    - `diversityLevel?` (`soft|balanced|bold`)
    - live‑overrides: `overrideGenre?`, `overrideMood?`, `overrideNovelty?`, `overrideDecade?`, `overrideCountry?`, `overridePeople?` (0.5–1.5)
  - response: `{ sessionId, items: [{ title, explanation: string[], userState?: {status, liked, disliked} }] }`.
- `GET /recommendations/evening-program` — те же query, но возвращает структурированную программу вечера:
  - response: `{ sessionId, items: [{ role: 'warmup'|'main'|'dessert', title, explanation, userState? }] }`.
- `POST /recommendations/feedback` — основной фидбэк:
  - payload: `{ sessionId, titleId, feedback: 'like'|'dislike'|'watched' }`.
  - response: `{ replacement?: { title, explanation, itemId } } | { ok: true }` — при лайке/просмотре/дизлайке подбирается контекстная замена карточки.
- `POST /recommendations/tweak` — «что‑если»‑режим для одной карточки:
  - payload: `{ sessionId, titleId, runtime?: 'shorter'|'longer', tone?: 'lighter'|'heavier' }`.
  - response: `{ replacement?: { title, explanation, itemId } } | { ok: true }` — возвращает экспериментальную замену без изменения статуса тайтла.

## Analytics

- `GET /analytics/overview` — KPI для профиля (counts, durations, distributions).
- `GET /analytics/taste-map` — данные для карты вкуса (жанры, годы/десятилетия, страны, антисписок).
- `GET /analytics/taste-galaxy` — логический граф вкусов: `{nodes:[{id,kind,label,weight,meta}],edges:[{source,target,kind,strength}]}` для интерактивной «карты‑галактики».
- `GET /analytics/history` — упорядоченный по времени список просмотренного (до 200 элементов).
- `GET /analytics/context-presets` — агрегированные по фидбэку пресеты «режима вечера» (часто удачные комбинации mood/mindset/company/timeAvailable/...).

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
