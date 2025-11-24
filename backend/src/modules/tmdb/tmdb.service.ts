import { HttpException, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import qs from 'qs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TmdbService {
  private readonly http: AxiosInstance;
  private readonly logger = new Logger(TmdbService.name);
  private readonly language: string;
  private readonly cache = new Map<string, { expires: number; value: any; at: number }>();
  private readonly defaultTtl = 5 * 60 * 1000; // 5 минут
  private readonly maxCacheEntries = 250;
  private readonly apiKey?: string;

  constructor(private readonly config: ConfigService) {
    const accessToken = this.config.get<string>('tmdb.accessToken');
    this.apiKey = this.config.get<string>('tmdb.apiKey');
    this.language = this.config.get<string>('tmdb.language') ?? 'ru-RU';
    this.http = axios.create({
      baseURL: 'https://api.themoviedb.org/3',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      timeout: 6500,
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
      {
        language: this.language,
        append_to_response:
          'external_ids,credits,similar,keywords,release_dates,content_ratings',
      },
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

  async videos(tmdbId: number, mediaType: string) {
    return this.cachedGet(
      `videos:${mediaType}:${tmdbId}`,
      `/${mediaType}/${tmdbId}/videos`,
      { language: this.language, include_video_language: this.language },
      60 * 60 * 1000,
    );
  }

  private async cachedGet(
    cacheKey: string,
    path: string,
    params: Record<string, any>,
    ttl = this.defaultTtl,
  ) {
    const now = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > now) {
      return cached.value;
    }

    try {
      const data = await this.requestWithRetry(path, params);
      this.setCache(cacheKey, data, ttl);
      return data;
    } catch (error: any) {
      this.handleError(path, error);
    }
  }

  private setCache(key: string, value: any, ttl: number) {
    const now = Date.now();
    this.cache.set(key, { value, expires: now + ttl, at: now });
    if (this.cache.size > this.maxCacheEntries) {
      const oldestKey = Array.from(this.cache.entries()).sort((a, b) => a[1].at - b[1].at)[0]?.[0];
      if (oldestKey) this.cache.delete(oldestKey);
    }
  }

  private async requestWithRetry(
    path: string,
    params: Record<string, any>,
    attempt = 1,
    useBearer = true,
  ): Promise<any> {
    try {
      const res = await this.http.get(path, {
        params: useBearer || !this.apiKey ? params : { ...params, api_key: this.apiKey },
        paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
        validateStatus: (status) => status < 500 || status === 503 || status === 429,
      });

      if (res.status >= 200 && res.status < 300) return res.data;

      if ((res.status === 401 || res.status === 403) && this.apiKey && useBearer) {
        this.logger.warn(`Bearer token rejected for ${path}, retry with api_key`);
        return this.requestWithRetry(path, params, attempt + 1, false);
      }

      if ((res.status === 429 || res.status === 503) && attempt < 3) {
        const delay = 200 * attempt * attempt;
        await this.sleep(delay);
        return this.requestWithRetry(path, params, attempt + 1, useBearer);
      }

      throw res;
    } catch (error: any) {
      if ((error?.code === 'ECONNABORTED' || error?.response?.status === 429) && attempt < 3) {
        await this.sleep(180 * attempt * attempt);
        return this.requestWithRetry(path, params, attempt + 1, useBearer);
      }
      throw error;
    }
  }

  private handleError(operation: string, error: any): never {
    const status = error?.response?.status;
    const message = error?.response?.data?.status_message || error.message;
    this.logger.error(`${operation} TMDB failed: ${message}`);
    throw new HttpException(message ?? 'TMDB error', status ?? 502);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
