import api from './client';
import type { RecommendationResponse, EveningProgramResponse } from './types';

export interface RecommendationQuery {
  limit?: number;
  mood?: string;
  mindset?: string;
  company?: string;
  timeAvailable?: string;
  noveltyBias?: 'safe' | 'mix' | 'surprise';
  pace?: 'calm' | 'balanced' | 'dynamic';
  freshness?: 'trending' | 'classic' | 'any';
  diversityLevel?: 'soft' | 'balanced' | 'bold';
  overrideGenre?: number;
  overrideMood?: number;
  overrideNovelty?: number;
  overrideDecade?: number;
  overrideCountry?: number;
  overridePeople?: number;
}

export async function fetchRecommendations(params: RecommendationQuery = {}) {
  const { data } = await api.get<RecommendationResponse>('/recommendations', { params });
  return data;
}

export async function fetchEveningProgram(params: RecommendationQuery = {}) {
  const { data } = await api.get<EveningProgramResponse>('/recommendations/evening-program', {
    params,
  });
  return data;
}

export async function sendRecommendationFeedback(payload: {
  sessionId: string;
  titleId: string;
  feedback: 'like' | 'dislike' | 'watched';
}) {
  const { data } = await api.post('/recommendations/feedback', payload);
  return data;
}

export async function sendRecommendationTweak(payload: {
  sessionId: string;
  titleId: string;
  runtime?: 'shorter' | 'longer';
  tone?: 'lighter' | 'heavier';
}) {
  const { data } = await api.post('/recommendations/tweak', payload);
  return data;
}
