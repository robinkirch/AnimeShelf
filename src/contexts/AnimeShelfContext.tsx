"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { JikanAnime, UserAnime, UserAnimeStatus } from '@/types/anime';

interface AnimeShelfContextType {
  shelf: UserAnime[];
  addAnimeToShelf: (anime: JikanAnime, initialDetails: { user_status: UserAnimeStatus; current_episode: number; user_rating: number | null }) => void;
  updateAnimeOnShelf: (
    mal_id: number, 
    updates: Partial<Omit<UserAnime, 'mal_id' | 'title' | 'cover_image' | 'total_episodes' | 'genres' | 'studios' | 'type'>>,
    currentJikanTotalEpisodes?: number | null
  ) => void;
  removeAnimeFromShelf: (mal_id: number) => void;
  isAnimeOnShelf: (mal_id: number) => boolean;
  getAnimeFromShelf: (mal_id: number) => UserAnime | undefined;
  isInitialized: boolean;
  upcomingSequels: JikanAnime[];
  setUpcomingSequels: (animeList: JikanAnime[]) => void;
}

const AnimeShelfContext = createContext<AnimeShelfContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'animeShelf';

export const AnimeShelfProvider = ({ children }: { children: ReactNode }) => {
  const [shelf, setShelf] = useState<UserAnime[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [upcomingSequels, setUpcomingSequelsState] = useState<JikanAnime[]>([]);

  useEffect(() => {
    try {
      const storedShelf = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedShelf) {
        // Ensure new fields have default values if loading old data
        const parsedShelf: UserAnime[] = JSON.parse(storedShelf);
        const migratedShelf = parsedShelf.map(anime => ({
          ...anime,
          type: anime.type ?? null, // Add default for 'type' if missing
        }));
        setShelf(migratedShelf);
      }
    } catch (error) {
      console.error("Failed to load anime shelf from localStorage:", error);
      setShelf([]);
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(shelf));
      } catch (error) {
        console.error("Failed to save anime shelf to localStorage:", error);
      }
    }
  }, [shelf, isInitialized]);

  const setUpcomingSequels = useCallback((animeList: JikanAnime[]) => {
    setUpcomingSequelsState(animeList);
  }, []);

  const addAnimeToShelf = useCallback((anime: JikanAnime, initialDetails: { user_status: UserAnimeStatus; current_episode: number; user_rating: number | null }) => {
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
        type: anime.type || null, // Store the anime type
      };
      return [...prevShelf, newAnime];
    });
    setUpcomingSequelsState(prevUpcoming => prevUpcoming.filter(seq => seq.mal_id !== anime.mal_id));
  }, []);

  const updateAnimeOnShelf = useCallback((
    mal_id: number,
    updates: Partial<Omit<UserAnime, 'mal_id' | 'title' | 'cover_image' | 'total_episodes' | 'genres' | 'studios' | 'type'>>,
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
        setUpcomingSequels
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
