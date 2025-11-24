import api from './client';
import type { RecommendationResponse } from './types';

export interface RecommendationQuery {
  limit?: number;
  mood?: string;
  mindset?: string;
  company?: string;
  timeAvailable?: string;
  noveltyBias?: 'safe' | 'mix' | 'surprise';
  pace?: 'calm' | 'balanced' | 'dynamic';
  freshness?: 'trending' | 'classic' | 'any';
}

export async function fetchRecommendations(params: RecommendationQuery = {}) {
  const { data } = await api.get<RecommendationResponse>('/recommendations', { params });
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
