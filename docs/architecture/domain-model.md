# Доменная модель (черновой дизайн под Prisma/PostgreSQL)

## User

- `id` UUID PK
- `email` (unique)
- `passwordHash`
- `displayName`
- `onboardingCompleted` boolean
- `createdAt`, `updatedAt`

## Title

- `id` UUID PK
- `tmdbId` int (unique)
- `imdbId` string nullable
- `mediaType` enum: movie | tv | anime | cartoon
- `originalTitle` string
- `russianTitle` string
- `overview` text
- `posterPath`, `backdropPath` string nullable
- `releaseDate` date nullable
- `runtime` int nullable (minutes)
- `tmdbRating` float nullable
- `genres` string[] (text[] or jsonb)
- `countries` string[]
- `originalLanguage` string
- `rawTmdbJson` jsonb
- `createdAt`, `updatedAt`

## UserTitleState

- `id` UUID PK
- `userId` FK → User
- `titleId` FK → Title
- `status` enum: planned | watching | watched | dropped
- `source` enum: onboarding | search | recommendation | manual
- `liked` boolean default false
- `disliked` boolean default false
- `rating` int nullable (1–10)
- `lastInteractionAt` datetime
- unique(userId, titleId)

## FeedbackEvent

- `id` UUID
- `userId` FK → User
- `titleId` FK → Title
- `value` int (1=like, -1=dislike)
- `context` enum/json (recommendation_card | title_page | history | onboarding)
- `recommendationSessionId` FK nullable → RecommendationSession
- `createdAt`

## RecommendationSession

- `id` UUID
- `userId` FK → User
- `context` jsonb (mood, mindset, company, timeAvailable, device, timeOfDay)
- `createdAt`

## RecommendationItem

- `id` UUID
- `sessionId` FK → RecommendationSession
- `titleId` FK → Title
- `rank` int
- `score` float
- `signals` jsonb (ключевые вклады сигнальных групп)
- `replaced` boolean default false
- `createdAt`

## UserTasteProfile

- `id` UUID
- `userId` FK → User
- `data` jsonb (агрегаты: жанры, страны, годы, длительность, темп/тон, люди, флаги контекста)
- `updatedAt`

## RecommendationExperiment

- `id` UUID
- `key` string (уникальный ключ эксперимента, напр. `main`)
- `name` string
- `description` string nullable
- `isActive` boolean
- `config` jsonb (описание вариантов и их параметров, напр. дефолтные `diversityLevel`/`noveltyBias`)
- `createdAt`, `updatedAt`

## UserExperimentAssignment

- `id` UUID
- `userId` FK → User
- `experimentId` FK → RecommendationExperiment
- `variantKey` string (идентификатор варианта, напр. `A`, `B`, `high_diversity`)
- `assignedAt` datetime
- `sticky` boolean (закреплён ли вариант за пользователем)

## CatalogSnapshot

- `id` UUID
- `tmdbId` int
- `mediaType` enum
- `kind` enum: trending | popular
- `score` float nullable
- `snapshotDate` datetime
- `createdAt` datetime

## Индексы

- `Title.tmdbId` unique; индекс по `mediaType`+`genres` (GIN для jsonb/array) для быстрых выборок.
- `UserTitleState.userId,status` индекс.
- `FeedbackEvent.userId,createdAt` индекс.
- `RecommendationItem.sessionId` индекс.
