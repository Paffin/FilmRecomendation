import { RecommendationEngine } from './recommendation.engine';
import { weightVariants } from './recommendation.config';
import { MediaType, Title } from '@prisma/client';

const baseTitle = (overrides: Partial<Title>): Title => ({
  id: 't0',
  tmdbId: 0,
  imdbId: null,
  mediaType: 'movie',
  originalTitle: 'Base',
  russianTitle: 'База',
  overview: '',
  posterPath: null,
  backdropPath: null,
  releaseDate: new Date('2020-01-01'),
  runtime: 100,
  tmdbRating: 7,
  genres: [],
  countries: [],
  originalLanguage: 'en',
  rawTmdbJson: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('RecommendationEngine', () => {
  const prismaMock = {
    userTitleState: { findMany: jest.fn() },
    title: { findMany: jest.fn() },
  } as any;

  const titlesServiceMock = {
    getOrCreateFromTmdb: jest.fn(),
  } as any;

  const tmdbMock = {
    trending: jest.fn(),
    similar: jest.fn(),
  } as any;

  const engine = new RecommendationEngine(prismaMock, titlesServiceMock, tmdbMock);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('ranks titles with liked genres higher', async () => {
    const profile = {
      genreWeights: { драма: 3 },
      countryWeights: {},
      decadeWeights: {},
      peopleWeights: {},
      preferredRuntime: 100,
      likedTitleIds: new Set<string>(),
      dislikedTitleIds: new Set<string>(),
      seenTitleIds: new Set<string>(),
      preferredTypes: new Set<MediaType>(['movie']),
      preferredLanguages: new Set<string>(['en']),
    };

    const titleDrama = baseTitle({ id: 't1', tmdbId: 1, genres: ['драма'], tmdbRating: 8, rawTmdbJson: { popularity: 120 } });
    const titleComedy = baseTitle({ id: 't2', tmdbId: 2, genres: ['комедия'], tmdbRating: 8, rawTmdbJson: { popularity: 120 } });

    jest.spyOn(engine as any, 'buildUserProfile').mockResolvedValue(profile);
    jest.spyOn(engine as any, 'buildCandidatePool').mockResolvedValue([titleDrama, titleComedy]);

    const result = await engine.recommend('user-1', 1, { mood: 'neutral' });

    expect(result[0].title.id).toBe('t1');
    expect(result[0].signals['genre:драма']).toBeGreaterThan(result[0].signals['genre:комедия'] ?? -1);
  });

  it('considers runtime and context timeAvailable', async () => {
    const profile = {
      genreWeights: {},
      countryWeights: {},
      decadeWeights: {},
      peopleWeights: {},
      preferredRuntime: 120,
      likedTitleIds: new Set<string>(),
      dislikedTitleIds: new Set<string>(),
      seenTitleIds: new Set<string>(),
      preferredTypes: new Set<MediaType>(['movie']),
      preferredLanguages: new Set<string>(['en']),
    };

    const shortTitle = baseTitle({ id: 's1', tmdbId: 3, runtime: 60, tmdbRating: 7, rawTmdbJson: { popularity: 80 } });
    const longTitle = baseTitle({ id: 'l1', tmdbId: 4, runtime: 140, tmdbRating: 7, rawTmdbJson: { popularity: 80 } });

    jest.spyOn(engine as any, 'buildUserProfile').mockResolvedValue(profile);
    jest.spyOn(engine as any, 'buildCandidatePool').mockResolvedValue([shortTitle, longTitle]);

    const context = { timeAvailable: '70' };
    const recs = await engine.recommend('user-2', 1, context);

    expect(recs[0].title.id).toBe('s1');
    expect(recs[0].signals.runtimeFit).toBeGreaterThan(0.5);
  });
});
