
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { JikanAnime, UserAnime, UserAnimeStatus, EpisodeWatchEvent } from '@/types/anime';
import { USER_ANIME_STATUS_OPTIONS, BROADCAST_DAY_OPTIONS } from '@/types/anime';


interface AnimeShelfContextType {
  shelf: UserAnime[];
  addAnimeToShelf: (anime: JikanAnime, initialDetails: { user_status: UserAnimeStatus; current_episode: number; user_rating: number | null; streaming_platforms: string[]; broadcast_day: string | null; }) => void;
  updateAnimeOnShelf: (
    mal_id: number, 
    updates: Partial<Omit<UserAnime, 'mal_id' | 'title' | 'cover_image' | 'total_episodes' | 'genres' | 'studios' | 'type' | 'year' | 'season' | 'duration_minutes'>>,
    currentJikanTotalEpisodes?: number | null
  ) => void;
  removeAnimeFromShelf: (mal_id: number) => void;
  isAnimeOnShelf: (mal_id: number) => boolean;
  getAnimeFromShelf: (mal_id: number) => UserAnime | undefined;
  isInitialized: boolean;
  upcomingSequels: JikanAnime[]; 
  setUpcomingSequels: (animeList: JikanAnime[]) => void; 
  getFilteredUpcomingSequelsCount: () => number; 
  ignoredPreviewAnimeMalIds: number[];
  addIgnoredPreviewAnime: (mal_id: number) => void;
  removeIgnoredPreviewAnime: (mal_id: number) => void; 
  isPreviewAnimeIgnored: (mal_id: number) => boolean;
  ignoredPreviewAnimeMalIdsInitialized: boolean;
  importAnimeBatch: (importedAnimeList: UserAnime[]) => { successCount: number, errors: Array<{ animeTitle?: string; malId?: number; error: string }> };
  episodeWatchHistory: EpisodeWatchEvent[];
}

const AnimeShelfContext = createContext<AnimeShelfContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_SHELF = 'animeShelf';
const LOCAL_STORAGE_KEY_IGNORED_PREVIEW = 'ignoredPreviewAnimeMalIds';
const LOCAL_STORAGE_KEY_EPISODE_WATCH_HISTORY = 'animeShelfEpisodeWatchHistory';
const IGNORED_TYPES_CONTEXT = ['Music'];

// Helper function to parse Jikan duration string to minutes
export function parseDurationToMinutes(durationStr: string | null | undefined): number | null {
  if (!durationStr) return null;
  
  const perEpMatch = durationStr.match(/(\d+)\s*min(?:s|\.)?\s*(?:per\s*ep)?/i);
  if (perEpMatch && perEpMatch[1]) {
    return parseInt(perEpMatch[1], 10);
  }

  const hrMinMatch = durationStr.match(/(?:(\d+)\s*hr)?\s*(?:(\d+)\s*min)?/i);
  if (hrMinMatch) {
    const hours = hrMinMatch[1] ? parseInt(hrMinMatch[1], 10) : 0;
    const minutes = hrMinMatch[2] ? parseInt(hrMinMatch[2], 10) : 0;
    if (!durationStr.toLowerCase().includes("per ep") && (hours > 0 || minutes > 0) ) {
        return (hours * 60) + minutes;
    }
  }
  return null;
}


export const AnimeShelfProvider = ({ children }: { children: ReactNode }) => {
  const [shelf, setShelf] = useState<UserAnime[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [upcomingSequels, setUpcomingSequelsState] = useState<JikanAnime[]>([]);
  const [ignoredPreviewAnimeMalIds, setIgnoredPreviewAnimeMalIds] = useState<number[]>([]);
  const [ignoredPreviewAnimeMalIdsInitialized, setIgnoredPreviewAnimeMalIdsInitialized] = useState(false);
  const [episodeWatchHistory, setEpisodeWatchHistory] = useState<EpisodeWatchEvent[]>([]);

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
          duration_minutes: anime.duration_minutes === undefined ? null : anime.duration_minutes, 
        }));
        setShelf(migratedShelf);
      }
    } catch (error) {
      console.error("Failed to load anime shelf from localStorage:", error);
      setShelf([]);
    }
    
    try {
      const storedIgnored = localStorage.getItem(LOCAL_STORAGE_KEY_IGNORED_PREVIEW);
      if (storedIgnored) {
        setIgnoredPreviewAnimeMalIds(JSON.parse(storedIgnored));
      }
    } catch (error) {
      console.error("Failed to load ignored preview anime IDs from localStorage:", error);
      setIgnoredPreviewAnimeMalIds([]);
    }

    try {
        const storedWatchHistory = localStorage.getItem(LOCAL_STORAGE_KEY_EPISODE_WATCH_HISTORY);
        if (storedWatchHistory) {
            setEpisodeWatchHistory(JSON.parse(storedWatchHistory));
        }
    } catch (error) {
        console.error("Failed to load episode watch history from localStorage:", error);
        setEpisodeWatchHistory([]);
    }

    setIsInitialized(true); 
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

  useEffect(() => {
    if (isInitialized) { 
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY_EPISODE_WATCH_HISTORY, JSON.stringify(episodeWatchHistory));
        } catch (error) {
            console.error("Failed to save episode watch history from localStorage:", error);
        }
    }
  }, [episodeWatchHistory, isInitialized]);

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
        duration_minutes: parseDurationToMinutes(anime.duration),
      };
      return [...prevShelf, newAnime];
    });
    setUpcomingSequelsState(prevUpcoming => prevUpcoming.filter(seq => seq.mal_id !== anime.mal_id));
  }, []);

  const updateAnimeOnShelf = useCallback((
    mal_id: number,
    updates: Partial<Omit<UserAnime, 'mal_id' | 'title' | 'cover_image' | 'total_episodes' | 'genres' | 'studios' | 'type' | 'year' | 'season' | 'duration_minutes'>>,
    currentJikanTotalEpisodes?: number | null
  ) => {
    setShelf(prevShelf =>
      prevShelf.map(animeItemOnShelf => {
        if (animeItemOnShelf.mal_id === mal_id) {
          const oldCurrentEpisode = animeItemOnShelf.current_episode;
          
          // Start with a copy of the existing item
          let workingItem = { ...animeItemOnShelf };

          // Determine the most reliable total_episodes, updating workingItem if Jikan provides a different value
          let mostReliableTotalEpisodes = workingItem.total_episodes;
          if (typeof currentJikanTotalEpisodes === 'number' && currentJikanTotalEpisodes !== workingItem.total_episodes) {
            mostReliableTotalEpisodes = currentJikanTotalEpisodes;
            workingItem.total_episodes = currentJikanTotalEpisodes;
          }
          
          // Apply explicit updates from the 'updates' object to the working copy
          workingItem = { ...workingItem, ...updates };

          let finalStatus = workingItem.user_status;
          let finalEpisodeCount = workingItem.current_episode;

          // Case 1: Status is explicitly being updated
          if (updates.user_status) {
            finalStatus = updates.user_status;
            if (finalStatus === 'completed') {
              if (typeof mostReliableTotalEpisodes === 'number' && mostReliableTotalEpisodes > 0) {
                finalEpisodeCount = mostReliableTotalEpisodes;
              }
              // If total_episodes is null or 0 for a 'completed' movie/special, episode count could be 1 or remain as is if already >0.
              // For simplicity, if it's a movie (total_episodes: 0 or 1) and completed, current_episode could be 1.
              // This part can be refined if movies need specific handling for current_episode on completion.
              else if (mostReliableTotalEpisodes === 0) { // Typically movies
                 finalEpisodeCount = Math.max(1, finalEpisodeCount); // Assume watching a movie means 1 "episode"
              }
            }
          } 
          // Case 2: Current episode is explicitly being updated (and status was not)
          else if (updates.current_episode !== undefined) {
            finalEpisodeCount = Math.max(0, updates.current_episode);
            if (typeof mostReliableTotalEpisodes === 'number' && mostReliableTotalEpisodes > 0) {
              finalEpisodeCount = Math.min(finalEpisodeCount, mostReliableTotalEpisodes);
            }

            // Auto-calculate status based on the new episode count
            if (typeof mostReliableTotalEpisodes === 'number' && mostReliableTotalEpisodes > 0) {
              if (finalEpisodeCount === 0) finalStatus = 'plan_to_watch';
              else if (finalEpisodeCount >= mostReliableTotalEpisodes) finalStatus = 'completed';
              else finalStatus = 'watching';
            } else if (mostReliableTotalEpisodes === 0) { // Movie or similar
              finalStatus = (finalEpisodeCount > 0) ? 'completed' : 'plan_to_watch';
            } else { // total_episodes is null (unknown)
              if (finalEpisodeCount > 0) finalStatus = 'watching';
              else finalStatus = 'plan_to_watch';
            }
          }
          // Case 3: No explicit status or episode update from user, but total_episodes might have changed (e.g. from API)
          // and current_episode needs capping.
          else {
            let cappedEpisode = Math.max(0, workingItem.current_episode);
            if (typeof mostReliableTotalEpisodes === 'number' && mostReliableTotalEpisodes > 0) {
              cappedEpisode = Math.min(cappedEpisode, mostReliableTotalEpisodes);
            }
            
            if (cappedEpisode !== workingItem.current_episode) { // If capping changed the episode count
              finalEpisodeCount = cappedEpisode;
              // Auto-calculate status based on the new capped episode count
              if (typeof mostReliableTotalEpisodes === 'number' && mostReliableTotalEpisodes > 0) {
                if (finalEpisodeCount === 0) finalStatus = 'plan_to_watch';
                else if (finalEpisodeCount >= mostReliableTotalEpisodes) finalStatus = 'completed';
                else finalStatus = 'watching';
              } else if (mostReliableTotalEpisodes === 0) {
                finalStatus = (finalEpisodeCount > 0) ? 'completed' : 'plan_to_watch';
              } else {
                if (finalEpisodeCount > 0) finalStatus = 'watching';
                else finalStatus = 'plan_to_watch';
              }
            } else {
              finalEpisodeCount = cappedEpisode; // Ensure it's at least capped
            }
          }
          
          // Construct the final state for the item
          const newAnimeState: UserAnime = {
            ...animeItemOnShelf, // Start with original non-progress fields
            ...updates,         // Apply any other direct updates (e.g. rating, streaming_platforms)
            user_status: finalStatus,
            current_episode: finalEpisodeCount,
            total_episodes: mostReliableTotalEpisodes, // Ensure total_episodes is also up-to-date
          };

          // Log episode watch events if current_episode increased
          if (newAnimeState.current_episode > oldCurrentEpisode) {
            const newEvents: EpisodeWatchEvent[] = [];
            for (let i = oldCurrentEpisode + 1; i <= newAnimeState.current_episode; i++) {
              newEvents.push({
                mal_id: mal_id,
                episode_number_watched: i,
                watched_at: new Date().toISOString(),
              });
            }
            if (newEvents.length > 0) {
              setEpisodeWatchHistory(prevHistory => [...prevHistory, ...newEvents]);
            }
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
      !shelfMalIds.has(seq.mal_id) && 
      !ignoredPreviewAnimeMalIds.includes(seq.mal_id) && 
      !(seq.type && IGNORED_TYPES_CONTEXT.includes(seq.type)) 
    ).length;
  }, [upcomingSequels, shelf, ignoredPreviewAnimeMalIds, isInitialized, ignoredPreviewAnimeMalIdsInitialized]);
  
  const importAnimeBatch = useCallback((importedAnimeList: UserAnime[]): { successCount: number, errors: Array<{ animeTitle?: string; malId?: number; error: string }> } => {
    let successCount = 0;
    const errors: Array<{ animeTitle?: string; malId?: number; error: string }> = [];

    setShelf(prevShelf => {
      const newShelf = [...prevShelf]; 

      importedAnimeList.forEach(importedAnime => {
        try {
          if (typeof importedAnime.mal_id !== 'number' || isNaN(importedAnime.mal_id)) {
            errors.push({ malId: importedAnime.mal_id, animeTitle: importedAnime.title, error: "Internal: MAL ID missing or not a number for context processing." });
            return; 
          }
          
          const completeAnime: UserAnime = {
            mal_id: importedAnime.mal_id,
            title: importedAnime.title || 'Unknown Title',
            cover_image: importedAnime.cover_image || '',
            total_episodes: importedAnime.total_episodes === undefined ? null : importedAnime.total_episodes,
            user_status: importedAnime.user_status || 'plan_to_watch',
            current_episode: importedAnime.current_episode || 0,
            user_rating: importedAnime.user_rating === undefined ? null : importedAnime.user_rating,
            genres: Array.isArray(importedAnime.genres) ? importedAnime.genres : [],
            studios: Array.isArray(importedAnime.studios) ? importedAnime.studios : [],
            type: importedAnime.type === undefined ? null : importedAnime.type,
            year: importedAnime.year === undefined ? null : importedAnime.year,
            season: importedAnime.season === undefined ? null : importedAnime.season,
            streaming_platforms: Array.isArray(importedAnime.streaming_platforms) ? importedAnime.streaming_platforms : [],
            broadcast_day: importedAnime.broadcast_day === undefined ? null : importedAnime.broadcast_day,
            duration_minutes: importedAnime.duration_minutes === undefined ? null : importedAnime.duration_minutes,
          };


          const existingIndex = newShelf.findIndex(item => item.mal_id === completeAnime.mal_id);
          if (existingIndex !== -1) {
            newShelf[existingIndex] = { ...newShelf[existingIndex], ...completeAnime }; 
          } else {
            newShelf.push(completeAnime);
          }
          successCount++;
        } catch (e: any) {
          errors.push({ malId: importedAnime.mal_id, animeTitle: importedAnime.title, error: e.message || "Unknown error during import processing in context." });
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
        importAnimeBatch,
        episodeWatchHistory
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

    
