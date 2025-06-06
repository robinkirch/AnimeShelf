
import axios, { type AxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios';
import type { JikanAPISearchResponse, JikanAPIByIdResponse, JikanAPISeasonsResponse, JikanAnime, JikanAPIRelationsResponse, JikanAnimeRelation } from '@/types/anime';
import { rendererLogger } from './logger'; // Import renderer logger

const JIKAN_API_BASE = 'https://api.jikan.moe/v4';

// Helper to delay execution, to respect API rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const API_REQUEST_DELAY = 2000; // ms

// Wrapper for axios requests to include logging and consistent error handling
async function makeJikanRequest<T>(url: string, params?: Record<string, any>, requestConfig?: AxiosRequestConfig): Promise<T | null> {
  const startTime = Date.now();
  const fullUrl = `${JIKAN_API_BASE}${url}`;
  
  rendererLogger.info(`Jikan API Request: ${fullUrl}`, { 
    category: 'jikan-api', 
    method: 'GET',
    params: params ? JSON.stringify(params) : undefined 
  });

  try {
    await delay(API_REQUEST_DELAY);
    const response: AxiosResponse<T> = await axios.get(fullUrl, { ...requestConfig, params });
    const duration = Date.now() - startTime;
    rendererLogger.info(`Jikan API Response: ${fullUrl}`, {
      category: 'jikan-api',
      status: response.status,
      durationMs: duration,
    });
    return response.data;
  } catch (error) {
    const duration = Date.now() - startTime;
    const axiosError = error as AxiosError;
    rendererLogger.error(`Jikan API Error: ${fullUrl}`, {
      category: 'jikan-api',
      status: axiosError.response?.status,
      errorMessage: axiosError.message,
      responseData: axiosError.response?.data,
      durationMs: duration,
    });
    return null; // Return null or throw, depending on desired error handling strategy
  }
}


export const jikanApi = {
  searchAnime: async (query: string, limit: number = 20): Promise<JikanAnime[]> => {
    const response = await makeJikanRequest<JikanAPISearchResponse>('/anime', { q: query, limit });
    return response?.data || [];
  },

  getAnimeById: async (id: number): Promise<JikanAnime | null> => {
    const response = await makeJikanRequest<JikanAPIByIdResponse>(`/anime/${id}`);
    return response?.data || null;
  },

  getCurrentSeason: async (): Promise<JikanAnime[]> => {
    const response = await makeJikanRequest<JikanAPISeasonsResponse>('/seasons/now');
    return response?.data || [];
  },

  getSeason: async (year: number, season: string): Promise<JikanAnime[]> => {
    const response = await makeJikanRequest<JikanAPISeasonsResponse>(`/seasons/${year}/${season}`);
    // De-duplicate data based on mal_id to prevent React key errors, Jikan sometimes returns duplicates here
    const uniqueData = Array.from(new Map( (response?.data || []).map(anime => [anime.mal_id, anime])).values());
    return uniqueData;
  },

  getAnimeRelations: async (id: number): Promise<JikanAnimeRelation[]> => {
    const response = await makeJikanRequest<JikanAPIRelationsResponse>(`/anime/${id}/relations`);
    return response?.data || [];
  },
};
