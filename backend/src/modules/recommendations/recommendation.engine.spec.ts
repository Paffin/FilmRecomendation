import { RecommendationEngine } from './recommendation.engine';
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
  releaseDate: new Date('2021-01-01'),
  runtime: 100,
  tmdbRating: 7,
  genres: [],
  countries: [],
  originalLanguage: 'en',
  rawTmdbJson: { popularity: 120 },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const profileStub = () => ({
  schemaVersion: 2,
  genrePositive: {},
  genreNegative: {},
  countryWeights: {},
  decadeWeights: {},
  languageWeights: {},
  peopleWeights: {},
  runtimeAvg: 100,
  runtimeMedian: 100,
  preferredTypes: new Set<MediaType>(['movie']),
  likedTitleIds: new Set<string>(),
  dislikedTitleIds: new Set<string>(),
  seenTitleIds: new Set<string>(),
  anchorTitles: [],
  moodVector: { light: 0, neutral: 0, heavy: 0 },
  freshnessTilt: 0,
  languageDiversity: 1,
  updatedAt: new Date().toISOString(),
});

describe('RecommendationEngine', () => {
  const prismaMock = {
    userTitleState: { findMany: jest.fn() },
    title: { findMany: jest.fn() },
    recommendationItem: { findMany: jest.fn() },
    userTasteProfile: { findUnique: jest.fn(), upsert: jest.fn() },
  } as any;

  const titlesServiceMock = {
    getOrCreateFromTmdb: jest.fn(),
  } as any;

  const tmdbMock = {
    trending: jest.fn(),
    similar: jest.fn(),
    popular: jest.fn(),
  } as any;

  const engine = new RecommendationEngine(prismaMock, titlesServiceMock, tmdbMock);

  beforeEach(() => {
    jest.resetAllMocks();
    prismaMock.userTasteProfile.findUnique.mockResolvedValue(null);
    prismaMock.userTasteProfile.upsert.mockResolvedValue(null);
    prismaMock.recommendationItem.findMany.mockResolvedValue([]);
  });

  it('ranks titles with liked genres higher', async () => {
    const profile = {
      ...profileStub(),
      genrePositive: { драма: 3 },
    };

    const titleDrama = baseTitle({ id: 't1', tmdbId: 1, genres: ['драма'], tmdbRating: 8 });
    const titleComedy = baseTitle({ id: 't2', tmdbId: 2, genres: ['комедия'], tmdbRating: 8 });

    jest.spyOn(engine as any, 'loadUserProfile').mockResolvedValue(profile);
    jest.spyOn(engine as any, 'buildCandidatePool').mockResolvedValue([titleDrama, titleComedy]);

    const result = await engine.recommend('user-1', 1, { mood: 'neutral' });

    expect(result[0].title.id).toBe('t1');
    expect(result[0].signals['genre:драма']).toBeGreaterThan(result[0].signals['genre:комедия'] ?? -1);
    expect(result[0].explanation.some((r) => r.toLowerCase().includes('жанр'))).toBe(true);
  });

  it('considers runtime and novelty bias', async () => {
    const profile = profileStub();
    const shortTitle = baseTitle({ id: 's1', tmdbId: 3, runtime: 60, tmdbRating: 7 });
    const longTitle = baseTitle({ id: 'l1', tmdbId: 4, runtime: 140, tmdbRating: 7 });

    jest.spyOn(engine as any, 'loadUserProfile').mockResolvedValue(profile);
    jest.spyOn(engine as any, 'buildCandidatePool').mockResolvedValue([shortTitle, longTitle]);

    const recs = await engine.recommend('user-2', 2, {
      timeAvailable: '70',
      noveltyBias: 'surprise',
    });

    const shortRec = recs.find((r) => r.title.id === 's1');
    const longRec = recs.find((r) => r.title.id === 'l1');

    expect(shortRec).toBeDefined();
    expect(longRec).toBeDefined();
    expect(shortRec!.signals.runtimeFit).toBeGreaterThan(longRec!.signals.runtimeFit ?? 0);
    expect(shortRec!.signals.novelty).toBeGreaterThan(0);
  });
});
