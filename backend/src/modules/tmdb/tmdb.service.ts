import { HttpException, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import qs from 'qs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TmdbService {
  private readonly http: AxiosInstance;
  private readonly logger = new Logger(TmdbService.name);
  private readonly language: string;
  private readonly cache = new Map<string, { expires: number; value: any }>();
  private readonly defaultTtl = 5 * 60 * 1000; // 5 минут

  constructor(private readonly config: ConfigService) {
    const accessToken = this.config.get<string>('tmdb.accessToken');
    this.language = this.config.get<string>('tmdb.language') ?? 'ru-RU';
    this.http = axios.create({
      baseURL: 'https://api.themoviedb.org/3',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  async search(query: string, page = 1, mediaType?: string) {
    const typePath = mediaType && mediaType !== 'multi' ? mediaType : 'multi';
    return this.cachedGet(`search:${typePath}:${query}:${page}`, `/search/${typePath}`, {
      query,
      page,
      language: this.language,
      include_adult: false,
    });
  }

  async details(tmdbId: number, mediaType: string) {
    return this.cachedGet(
      `details:${mediaType}:${tmdbId}`,
      `/${mediaType}/${tmdbId}`,
      { language: this.language, append_to_response: 'external_ids,credits,similar' },
      30 * 60 * 1000,
    );
  }

  async similar(tmdbId: number, mediaType: string, page = 1) {
    return this.cachedGet(
      `similar:${mediaType}:${tmdbId}:${page}`,
      `/${mediaType}/${tmdbId}/similar`,
      { language: this.language, page },
      60 * 60 * 1000,
    );
  }

  async trending(mediaType: string, timeWindow: 'day' | 'week' = 'week', page = 1) {
    return this.cachedGet(
      `trending:${mediaType}:${timeWindow}:${page}`,
      `/trending/${mediaType}/${timeWindow}`,
      { language: this.language, page },
      30 * 60 * 1000,
    );
  }

  async popular(mediaType: string, page = 1) {
    return this.cachedGet(
      `popular:${mediaType}:${page}`,
      `/${mediaType}/popular`,
      { language: this.language, page },
      30 * 60 * 1000,
    );
  }

  private async cachedGet(cacheKey: string, path: string, params: Record<string, any>, ttl = this.defaultTtl) {
    const now = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > now) {
      return cached.value;
    }

    try {
      const res = await this.http.get(path, {
        params,
        paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
      });
      this.cache.set(cacheKey, { expires: now + ttl, value: res.data });
      return res.data;
    } catch (error: any) {
      this.handleError(path, error);
    }
  }

  private handleError(operation: string, error: any): never {
    const status = error?.response?.status;
    const message = error?.response?.data?.status_message || error.message;
    this.logger.error(`${operation} TMDB failed: ${message}`);
    throw new HttpException(message ?? 'TMDB error', status ?? 502);
  }
}
