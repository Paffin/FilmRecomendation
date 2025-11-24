import api from './client';
import type { ApiTitle, MediaType } from './types';

export interface TmdbSearchResult {
  id: number;
  title?: string;
  name?: string;
  media_type?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
}

export interface SearchResponse {
  results: TmdbSearchResult[];
  page: number;
  total_pages: number;
}

export async function discoverTitles(mediaType?: MediaType, page = 1) {
  const { data } = await api.get<SearchResponse>('/titles/discover', {
    params: { mediaType, page },
  });
  return data;
}

export async function searchTitles(query: string, mediaType?: MediaType, page = 1) {
  const { data } = await api.get<SearchResponse>('/titles/search', { params: { q: query, mediaType, page } });
  return data;
}

export async function getTitle(id: string) {
  const { data } = await api.get<ApiTitle>(`/titles/${id}`);
  return data;
}

export async function getTitleByTmdb(tmdbId: number, mediaType: MediaType) {
  const { data } = await api.get<ApiTitle>(`/titles/tmdb/${tmdbId}`, {
    params: { mediaType },
  });
  return data;
}

export async function getSimilar(id: string, page = 1) {
  const { data } = await api.get(`/titles/${id}/similar`, { params: { page } });
  return data;
}

export interface TrailerResponse {
  youtubeKey: string;
  name: string;
  language?: string | null;
}

export async function getTrailer(id: string) {
  const { data } = await api.get<TrailerResponse | null>(`/titles/${id}/trailer`);
  return data;
}
