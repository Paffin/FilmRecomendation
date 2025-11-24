import api from './client';
import type { MediaType } from './types';

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

export async function searchTitles(query: string, mediaType?: MediaType, page = 1) {
  const { data } = await api.get<SearchResponse>('/titles/search', { params: { q: query, mediaType, page } });
  return data;
}

export async function getTitle(id: string) {
  const { data } = await api.get(`/titles/${id}`);
  return data;
}

export async function getSimilar(id: string, page = 1) {
  const { data } = await api.get(`/titles/${id}/similar`, { params: { page } });
  return data;
}
