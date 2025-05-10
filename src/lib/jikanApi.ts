
import axios from 'axios';
import type { JikanAPISearchResponse, JikanAPIByIdResponse, JikanAPISeasonsResponse, JikanAnime, JikanAPIRelationsResponse, JikanAnimeRelation } from '@/types/anime';

const JIKAN_API_BASE = 'https://api.jikan.moe/v4';

// Helper to delay execution, to respect API rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const API_REQUEST_DELAY = 550; // ms, aiming for <2 requests per second

export const jikanApi = {
  searchAnime: async (query: string, limit: number = 20): Promise<JikanAnime[]> => {
    try {
      await delay(API_REQUEST_DELAY); // Jikan API rate limit: ~1-2 requests per second allowed for sustained use
      const response = await axios.get<JikanAPISearchResponse>(`${JIKAN_API_BASE}/anime`, {
        params: { q: query, limit },
      });
      return response.data.data;
    } catch (error) {
      console.error('Error searching anime:', error);
      return []; 
    }
  },

  getAnimeById: async (id: number): Promise<JikanAnime | null> => {
    try {
      await delay(API_REQUEST_DELAY);
      const response = await axios.get<JikanAPIByIdResponse>(`${JIKAN_API_BASE}/anime/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching anime with ID ${id}:`, error);
      return null;
    }
  },

  getCurrentSeason: async (): Promise<JikanAnime[]> => {
    try {
      await delay(API_REQUEST_DELAY);
      const response = await axios.get<JikanAPISeasonsResponse>(`${JIKAN_API_BASE}/seasons/now`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching current season:', error);
      return [];
    }
  },

  getSeason: async (year: number, season: string): Promise<JikanAnime[]> => {
    try {
      await delay(API_REQUEST_DELAY);
      const response = await axios.get<JikanAPISeasonsResponse>(`${JIKAN_API_BASE}/seasons/${year}/${season}`);
      // De-duplicate data based on mal_id to prevent React key errors, Jikan sometimes returns duplicates here
      const uniqueData = Array.from(new Map(response.data.data.map(anime => [anime.mal_id, anime])).values());
      return uniqueData;
    } catch (error) {
      console.error(`Error fetching ${season} ${year} season:`, error);
      return [];
    }
  },

  getAnimeRelations: async (id: number): Promise<JikanAnimeRelation[]> => {
    try {
      await delay(API_REQUEST_DELAY);
      const response = await axios.get<JikanAPIRelationsResponse>(`${JIKAN_API_BASE}/anime/${id}/relations`);
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching relations for anime ID ${id}:`, error);
      return [];
    }
  },
};

