
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { JikanAnime, UserAnime, UserAnimeStatus } from '@/types/anime';

interface AnimeShelfContextType {
  shelf: UserAnime[];
  addAnimeToShelf: (anime: JikanAnime, initialDetails: { user_status: UserAnimeStatus; current_episode: number; user_rating: number | null }) => void;
  updateAnimeOnShelf: (mal_id: number, updates: Partial<Omit<UserAnime, 'mal_id' | 'title' | 'cover_image' | 'total_episodes' | 'genres' | 'studios'>>) => void;
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
        setShelf(JSON.parse(storedShelf));
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
      };
      return [...prevShelf, newAnime];
    });
    // If an anime added to shelf was in upcoming sequels, remove it from there
    setUpcomingSequelsState(prevUpcoming => prevUpcoming.filter(seq => seq.mal_id !== anime.mal_id));
  }, []);

  const updateAnimeOnShelf = useCallback((mal_id: number, updates: Partial<Omit<UserAnime, 'mal_id' | 'title' | 'cover_image' | 'total_episodes' | 'genres' | 'studios'>>) => {
    setShelf(prevShelf =>
      prevShelf.map(animeItem => {
        if (animeItem.mal_id === mal_id) {
          const updatedAnime = { ...animeItem, ...updates };

          // If status is being updated to 'completed' and total_episodes is known,
          // set current_episode to total_episodes.
          if (updates.user_status === 'completed' && typeof animeItem.total_episodes === 'number') {
            updatedAnime.current_episode = animeItem.total_episodes;
          } else if (updates.current_episode !== undefined) {
            // If current_episode is being explicitly updated (and status is not 'completed' or total_episodes unknown)
            let newCurrentEpisode = Math.max(0, updates.current_episode);
            if (typeof animeItem.total_episodes === 'number') {
              newCurrentEpisode = Math.min(newCurrentEpisode, animeItem.total_episodes);
            }
            updatedAnime.current_episode = newCurrentEpisode;
          }
          // If only other fields are updated, current_episode remains as is from { ...animeItem, ...updates }
          // or if updates.current_episode was undefined, it remains animeItem.current_episode.
          // Ensure it's still valid if not touched by 'completed' logic.
          else if (updatedAnime.user_status !== 'completed' || typeof animeItem.total_episodes !== 'number') {
             updatedAnime.current_episode = Math.max(0, updatedAnime.current_episode);
             if(typeof animeItem.total_episodes === 'number') {
                updatedAnime.current_episode = Math.min(updatedAnime.current_episode, animeItem.total_episodes);
             }
          }


          return updatedAnime;
        }
        return animeItem;
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

