import api from './client';
import { MediaType, TitleStatus, TitleSource, UserTitleStateResponse } from './types';

export async function listUserTitles(params: { status?: TitleStatus; mediaType?: MediaType } = {}) {
  const { data } = await api.get<UserTitleStateResponse[]>('/user-titles', { params });
  return data;
}

export async function createUserTitle(payload: {
  tmdbId: number;
  mediaType: MediaType;
  status: TitleStatus;
  source?: TitleSource;
  liked?: boolean;
  disliked?: boolean;
  rating?: number;
}) {
  const { data } = await api.post<UserTitleStateResponse>('/user-titles', payload);
  return data;
}

export async function updateUserTitle(id: string, payload: Partial<Omit<UserTitleStateResponse, 'id' | 'title'>>) {
  const { data } = await api.patch<UserTitleStateResponse>(`/user-titles/${id}`, payload);
  return data;
}

export async function getUserTitleByTitleId(titleId: string) {
  const { data } = await api.get<UserTitleStateResponse | null>(`/user-titles/title/${titleId}`);
  return data;
}
