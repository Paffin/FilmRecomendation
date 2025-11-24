import api from './client';
import type { UserTitleStateResponse } from './types';

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

export interface ContextPresetResponse {
  id: string;
  label: string;
  mood?: string | null;
  mindset?: string | null;
  company?: string | null;
  timeAvailable?: string | null;
  noveltyBias?: 'safe' | 'mix' | 'surprise' | null;
  pace?: 'calm' | 'balanced' | 'dynamic' | null;
  freshness?: 'trending' | 'classic' | 'any' | null;
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

export async function getContextPresets() {
  const { data } = await api.get<ContextPresetResponse[]>('/analytics/context-presets');
  return data;
}
