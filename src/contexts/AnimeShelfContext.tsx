
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { JikanAnime, UserAnime, UserAnimeStatus } from '@/types/anime';
import { USER_ANIME_STATUS_OPTIONS, BROADCAST_DAY_OPTIONS } from '@/types/anime';


interface AnimeShelfContextType {
  shelf: UserAnime[];
  addAnimeToShelf: (anime: JikanAnime, initialDetails: { user_status: UserAnimeStatus; current_episode: number; user_rating: number | null; streaming_platforms: string[]; broadcast_day: string | null; }) => void;
  updateAnimeOnShelf: (
    mal_id: number, 
    updates: Partial<Omit<UserAnime, 'mal_id' | 'title' | 'cover_image' | 'total_episodes' | 'genres' | 'studios' | 'type' | 'year' | 'season'>>,
    currentJikanTotalEpisodes?: number | null
  ) => void;
  removeAnimeFromShelf: (mal_id: number) => void;
  isAnimeOnShelf: (mal_id: number) => boolean;
  getAnimeFromShelf: (mal_id: number) => UserAnime | undefined;
  isInitialized: boolean;
  upcomingSequels: JikanAnime[]; // Raw list from PreviewPage
  setUpcomingSequels: (animeList: JikanAnime[]) => void; // Raw list from PreviewPage
  getFilteredUpcomingSequelsCount: () => number; // Filtered count for header badge
  ignoredPreviewAnimeMalIds: number[];
  addIgnoredPreviewAnime: (mal_id: number) => void;
  removeIgnoredPreviewAnime: (mal_id: number) => void; 
  isPreviewAnimeIgnored: (mal_id: number) => boolean;
  ignoredPreviewAnimeMalIdsInitialized: boolean;
  importAnimeBatch: (importedAnimeList: UserAnime[]) => { successCount: number, errors: Array<{ animeTitle?: string; malId?: number; error: string }> };
}

const AnimeShelfContext = createContext<AnimeShelfContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_SHELF = 'animeShelf';
const LOCAL_STORAGE_KEY_IGNORED_PREVIEW = 'ignoredPreviewAnimeMalIds';
const IGNORED_TYPES_CONTEXT = ['Music'];


export const AnimeShelfProvider = ({ children }: { children: ReactNode }) => {
  const [shelf, setShelf] = useState<UserAnime[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [upcomingSequels, setUpcomingSequelsState] = useState<JikanAnime[]>([]);
  const [ignoredPreviewAnimeMalIds, setIgnoredPreviewAnimeMalIds] = useState<number[]>([]);
  const [ignoredPreviewAnimeMalIdsInitialized, setIgnoredPreviewAnimeMalIdsInitialized] = useState(false);

  useEffect(() => {
    try {
      const storedShelf = localStorage.getItem(LOCAL_STORAGE_KEY_SHELF);
      if (storedShelf) {
        const parsedShelf: UserAnime[] = JSON.parse(storedShelf);
        const migratedShelf = parsedShelf.map(anime => ({
          ...anime,
          type: anime.type ?? null,
          year: anime.year ?? null, 
          season: anime.season ?? null,
          streaming_platforms: anime.streaming_platforms ?? [],
          broadcast_day: anime.broadcast_day ?? null,
        }));
        setShelf(migratedShelf);
      }
    } catch (error) {
      console.error("Failed to load anime shelf from localStorage:", error);
      setShelf([]);
    }
    setIsInitialized(true);

    try {
      const storedIgnored = localStorage.getItem(LOCAL_STORAGE_KEY_IGNORED_PREVIEW);
      if (storedIgnored) {
        setIgnoredPreviewAnimeMalIds(JSON.parse(storedIgnored));
      }
    } catch (error) {
      console.error("Failed to load ignored preview anime IDs from localStorage:", error);
      setIgnoredPreviewAnimeMalIds([]);
    }
    setIgnoredPreviewAnimeMalIdsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_SHELF, JSON.stringify(shelf));
      } catch (error) {
        console.error("Failed to save anime shelf to localStorage:", error);
      }
    }
  }, [shelf, isInitialized]);

  useEffect(() => {
    if (ignoredPreviewAnimeMalIdsInitialized) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_IGNORED_PREVIEW, JSON.stringify(ignoredPreviewAnimeMalIds));
      } catch (error) {
        console.error("Failed to save ignored preview anime IDs to localStorage:", error);
      }
    }
  }, [ignoredPreviewAnimeMalIds, ignoredPreviewAnimeMalIdsInitialized]);

  const setUpcomingSequels = useCallback((animeList: JikanAnime[]) => {
    setUpcomingSequelsState(animeList);
  }, []);

  const addAnimeToShelf = useCallback((anime: JikanAnime, initialDetails: { user_status: UserAnimeStatus; current_episode: number; user_rating: number | null; streaming_platforms: string[]; broadcast_day: string | null; }) => {
    setShelf(prevShelf => {
      if (prevShelf.some(item => item.mal_id === anime.mal_id)) return prevShelf; 

      const newAnime: UserAnime = {
        mal_id: anime.mal_id,
        title: anime.title,
        cover_image: anime.images.webp?.large_image_url || anime.images.webp?.image_url || anime.images.jpg.large_image_url || anime.images.jpg.image_url,
        total_episodes: anime.episodes,
        user_status: initialDetails.user_status,
        current_episode: Math.max(0, initialDetails.current_episode),
        user_rating: initialDetails.user_rating,
        genres: anime.genres?.map(g => g.name) || [],
        studios: anime.studios?.map(s => s.name) || [],
        type: anime.type || null,
        year: anime.year || null,
        season: anime.season || null,
        streaming_platforms: initialDetails.streaming_platforms || [],
        broadcast_day: initialDetails.broadcast_day || anime.broadcast?.day || null,
      };
      return [...prevShelf, newAnime];
    });
    // When adding to shelf, it might affect the upcoming sequels list (if it was a sequel)
    setUpcomingSequelsState(prevUpcoming => prevUpcoming.filter(seq => seq.mal_id !== anime.mal_id));
  }, []);

  const updateAnimeOnShelf = useCallback((
    mal_id: number,
    updates: Partial<Omit<UserAnime, 'mal_id' | 'title' | 'cover_image' | 'total_episodes' | 'genres' | 'studios' | 'type' | 'year' | 'season'>>,
    currentJikanTotalEpisodes?: number | null
  ) => {
    setShelf(prevShelf =>
      prevShelf.map(animeItemOnShelf => {
        if (animeItemOnShelf.mal_id === mal_id) {
          let newAnimeState = { ...animeItemOnShelf };

          let mostReliableTotalEpisodes = newAnimeState.total_episodes;
          if (typeof currentJikanTotalEpisodes === 'number') {
            mostReliableTotalEpisodes = currentJikanTotalEpisodes;
            if (newAnimeState.total_episodes !== currentJikanTotalEpisodes) {
              newAnimeState.total_episodes = currentJikanTotalEpisodes;
            }
          }
          
          newAnimeState = { ...newAnimeState, ...updates };

          if (updates.user_status === 'completed' && typeof mostReliableTotalEpisodes === 'number' && mostReliableTotalEpisodes > 0) {
            newAnimeState.current_episode = mostReliableTotalEpisodes;
          } else if (updates.current_episode !== undefined) {
            let ep = Math.max(0, updates.current_episode);
            if (typeof mostReliableTotalEpisodes === 'number' && mostReliableTotalEpisodes > 0) {
              ep = Math.min(ep, mostReliableTotalEpisodes);
            }
            newAnimeState.current_episode = ep;
          } else {
            let ep = Math.max(0, newAnimeState.current_episode);
             if (typeof mostReliableTotalEpisodes === 'number' && mostReliableTotalEpisodes > 0) {
              ep = Math.min(ep, mostReliableTotalEpisodes);
            }
            newAnimeState.current_episode = ep;
          }
          
          return newAnimeState;
        }
        return animeItemOnShelf;
      })
    );
  }, []);

  const removeAnimeFromShelf = useCallback((mal_id: number) => {
    setShelf(prevShelf => prevShelf.filter(anime => anime.mal_id !== mal_id));
  }, []);

  const isAnimeOnShelf = useCallback((mal_id: number) => {
    return shelf.some(anime => anime.mal_id === mal_id);
  }, [shelf]);

  const getAnimeFromShelf = useCallback((mal_id: number) => {
    return shelf.find(anime => anime.mal_id === mal_id);
  }, [shelf]);

  const addIgnoredPreviewAnime = useCallback((mal_id: number) => {
    setIgnoredPreviewAnimeMalIds(prev => {
      if (prev.includes(mal_id)) return prev;
      return [...prev, mal_id];
    });
  }, []);

  const removeIgnoredPreviewAnime = useCallback((mal_id: number) => {
    setIgnoredPreviewAnimeMalIds(prev => prev.filter(id => id !== mal_id));
  }, []);

  const isPreviewAnimeIgnored = useCallback((mal_id: number) => {
    return ignoredPreviewAnimeMalIds.includes(mal_id);
  }, [ignoredPreviewAnimeMalIds]);

  const getFilteredUpcomingSequelsCount = useCallback(() => {
    if (!isInitialized || !ignoredPreviewAnimeMalIdsInitialized) return 0;
    
    const shelfMalIds = new Set(shelf.map(a => a.mal_id));
    
    return upcomingSequels.filter(seq => 
      !shelfMalIds.has(seq.mal_id) && // Not already on shelf
      !ignoredPreviewAnimeMalIds.includes(seq.mal_id) && // Not ignored in preview
      !(seq.type && IGNORED_TYPES_CONTEXT.includes(seq.type)) // Not an ignored type
    ).length;
  }, [upcomingSequels, shelf, ignoredPreviewAnimeMalIds, isInitialized, ignoredPreviewAnimeMalIdsInitialized]);
  
  const importAnimeBatch = useCallback((importedAnimeList: UserAnime[]): { successCount: number, errors: Array<{ animeTitle?: string; malId?: number; error: string }> } => {
    let successCount = 0;
    const errors: Array<{ animeTitle?: string; malId?: number; error: string }> = [];

    setShelf(prevShelf => {
      const newShelf = [...prevShelf]; // Create a mutable copy

      importedAnimeList.forEach(importedAnime => {
        try {
          // Basic validation for core fields
          if (typeof importedAnime.mal_id !== 'number' || isNaN(importedAnime.mal_id)) {
            throw new Error("Field 'mal_id' is missing or invalid.");
          }
          if (!importedAnime.title || typeof importedAnime.title !== 'string') {
            throw new Error("Field 'title' is missing or invalid.");
          }
          if (!importedAnime.user_status || !USER_ANIME_STATUS_OPTIONS.find(opt => opt.value === importedAnime.user_status)) {
            throw new Error(`Field 'user_status' is missing or invalid: ${importedAnime.user_status}.`);
          }
          if (typeof importedAnime.current_episode !== 'number' || isNaN(importedAnime.current_episode) || importedAnime.current_episode < 0) {
             throw new Error(`Field 'current_episode' is missing or invalid: ${importedAnime.current_episode}. Must be a non-negative number.`);
          }

          // Validate optional fields if present
          if (importedAnime.total_episodes !== null && importedAnime.total_episodes !== undefined && (typeof importedAnime.total_episodes !== 'number' || isNaN(importedAnime.total_episodes) || importedAnime.total_episodes < 0)) {
            throw new Error(`Field 'total_episodes' is invalid: ${importedAnime.total_episodes}. Must be a non-negative number or null/empty.`);
          }
          if (importedAnime.user_rating !== null && importedAnime.user_rating !== undefined && (typeof importedAnime.user_rating !== 'number' || isNaN(importedAnime.user_rating) || importedAnime.user_rating < 1 || importedAnime.user_rating > 10)) {
            throw new Error(`Field 'user_rating' is invalid: ${importedAnime.user_rating}. Must be between 1-10 or null/empty.`);
          }
           if (importedAnime.year !== null && importedAnime.year !== undefined && (typeof importedAnime.year !== 'number' || isNaN(importedAnime.year))) {
            throw new Error(`Field 'year' is invalid: ${importedAnime.year}. Must be a number or null/empty.`);
          }
          if (importedAnime.broadcast_day !== null && importedAnime.broadcast_day !== undefined && (typeof importedAnime.broadcast_day !== 'string' || !BROADCAST_DAY_OPTIONS.find(opt => opt.value === importedAnime.broadcast_day))) {
             if (importedAnime.broadcast_day !== null && importedAnime.broadcast_day !== undefined && typeof importedAnime.broadcast_day === 'string' && !BROADCAST_DAY_OPTIONS.map(o => o.value.toLowerCase()).includes(importedAnime.broadcast_day.toLowerCase()) && importedAnime.broadcast_day !== "Other") {
                throw new Error(`Field 'broadcast_day' is invalid: ${importedAnime.broadcast_day}. Must be one of predefined values, 'Other', or null/empty.`);
             }
          }


          const existingIndex = newShelf.findIndex(item => item.mal_id === importedAnime.mal_id);
          
          // Ensure all fields of UserAnime are present, providing defaults for optional ones if not in importedAnime
          const completeAnime: UserAnime = {
            mal_id: importedAnime.mal_id,
            title: importedAnime.title,
            cover_image: importedAnime.cover_image || '', // Default if not provided
            total_episodes: importedAnime.total_episodes === undefined ? null : importedAnime.total_episodes,
            user_status: importedAnime.user_status,
            current_episode: importedAnime.current_episode,
            user_rating: importedAnime.user_rating === undefined ? null : importedAnime.user_rating,
            genres: Array.isArray(importedAnime.genres) ? importedAnime.genres : [],
            studios: Array.isArray(importedAnime.studios) ? importedAnime.studios : [],
            type: importedAnime.type === undefined ? null : importedAnime.type,
            year: importedAnime.year === undefined ? null : importedAnime.year,
            season: importedAnime.season === undefined ? null : importedAnime.season,
            streaming_platforms: Array.isArray(importedAnime.streaming_platforms) ? importedAnime.streaming_platforms : [],
            broadcast_day: importedAnime.broadcast_day === undefined ? null : importedAnime.broadcast_day,
          };


          if (existingIndex !== -1) {
            // Update existing anime: merge, preferring imported values for defined fields
            newShelf[existingIndex] = { ...newShelf[existingIndex], ...completeAnime };
          } else {
            // Add new anime
            newShelf.push(completeAnime);
          }
          successCount++;
        } catch (e: any) {
          errors.push({ malId: importedAnime.mal_id, animeTitle: importedAnime.title, error: e.message || "Unknown error during import processing." });
        }
      });
      return newShelf;
    });
    return { successCount, errors };
  }, []);


  return (
    <AnimeShelfContext.Provider value={{ 
        shelf, 
        addAnimeToShelf, 
        updateAnimeOnShelf, 
        removeAnimeFromShelf, 
        isAnimeOnShelf, 
        getAnimeFromShelf, 
        isInitialized,
        upcomingSequels,
        setUpcomingSequels,
        getFilteredUpcomingSequelsCount,
        ignoredPreviewAnimeMalIds,
        addIgnoredPreviewAnime,
        removeIgnoredPreviewAnime,
        isPreviewAnimeIgnored,
        ignoredPreviewAnimeMalIdsInitialized,
        importAnimeBatch
      }}>
      {children}
    </AnimeShelfContext.Provider>
  );
};

export const useAnimeShelf = () => {
  const context = useContext(AnimeShelfContext);
  if (context === undefined) {
    throw new Error('useAnimeShelf must be used within an AnimeShelfProvider');
  }
  return context;
};

