import api from './client';
import { UserTitleStateResponse } from './types';

export interface OverviewResponse {
  watchedCount: number;
  likedCount: number;
  plannedCount: number;
  totalRuntimeHours: number;
  byType: Record<string, number>;
  topGenre: string | null;
  topCountry: string | null;
  averageRating: number | null;
}

export interface TasteMapResponse {
  genres: Record<string, number>;
  countries: Record<string, number>;
  years: number[];
  decades: Record<string, number>;
  antiList: { id: string; title: string }[];
}

export async function getOverview() {
  const { data } = await api.get<OverviewResponse>('/analytics/overview');
  return data;
}

export async function getTasteMap() {
  const { data } = await api.get<TasteMapResponse>('/analytics/taste-map');
  return data;
}

export async function getHistory() {
  const { data } = await api.get<UserTitleStateResponse[]>('/analytics/history');
  return data;
}
