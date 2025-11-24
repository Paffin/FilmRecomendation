export type WeightVariant = 'A' | 'B';

export interface RecommendationWeights {
  popularity: number;
  rating: number;
  genre: number;
  country: number;
  decade: number;
  people: number;
  runtime: number;
  mood: number;
  mindset: number;
  company: number;
  novelty: number;
  language: number;
  freshness: number;
  typePreference: number;
  similarity: number;
  diversity: number;
  anti: number;
  recency: number;
  contextPace: number;
}

export const weightVariants: Record<WeightVariant, RecommendationWeights> = {
  A: {
    popularity: 0.2,
    rating: 0.14,
    genre: 0.2,
    country: 0.1,
    decade: 0.08,
    people: 0.12,
    runtime: 0.12,
    mood: 0.1,
    mindset: 0.05,
    company: 0.05,
    novelty: 0.08,
    language: 0.05,
    freshness: 0.08,
    typePreference: 0.08,
    similarity: 0.1,
    diversity: 0.06,
    anti: 0.14,
    recency: 0.07,
    contextPace: 0.06,
  },
  B: {
    popularity: 0.15,
    rating: 0.16,
    genre: 0.22,
    country: 0.08,
    decade: 0.1,
    people: 0.14,
    runtime: 0.1,
    mood: 0.1,
    mindset: 0.06,
    company: 0.05,
    novelty: 0.12,
    language: 0.06,
    freshness: 0.1,
    typePreference: 0.07,
    similarity: 0.12,
    diversity: 0.08,
    anti: 0.16,
    recency: 0.08,
    contextPace: 0.06,
  },
};
