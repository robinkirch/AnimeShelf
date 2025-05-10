import axios from 'axios';
import type { JikanAPISearchResponse, JikanAPIByIdResponse, JikanAPISeasonsResponse, JikanAnime } from '@/types/anime';

const JIKAN_API_BASE = 'https://api.jikan.moe/v4';

export const jikanApi = {
  searchAnime: async (query: string, limit: number = 20): Promise<JikanAnime[]> => {
    try {
      const response = await axios.get<JikanAPISearchResponse>(`${JIKAN_API_BASE}/anime`, {
        params: { q: query, limit },
      });
      return response.data.data;
    } catch (error) {
      console.error('Error searching anime:', error);
      // It's better to throw the error or return a consistent error structure
      // For now, returning empty array on error to prevent app crash
      return []; 
    }
  },

  getAnimeById: async (id: number): Promise<JikanAnime | null> => {
    try {
      const response = await axios.get<JikanAPIByIdResponse>(`${JIKAN_API_BASE}/anime/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching anime with ID ${id}:`, error);
      return null;
    }
  },

  getCurrentSeason: async (): Promise<JikanAnime[]> => {
    try {
      const response = await axios.get<JikanAPISeasonsResponse>(`${JIKAN_API_BASE}/seasons/now`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching current season:', error);
      return [];
    }
  },

  getSeason: async (year: number, season: string): Promise<JikanAnime[]> => {
    try {
      const response = await axios.get<JikanAPISeasonsResponse>(`${JIKAN_API_BASE}/seasons/${year}/${season}`);
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching ${season} ${year} season:`, error);
      return [];
    }
  },
};
