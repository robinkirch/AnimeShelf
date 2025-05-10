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
}

const AnimeShelfContext = createContext<AnimeShelfContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'animeShelf';

export const AnimeShelfProvider = ({ children }: { children: ReactNode }) => {
  const [shelf, setShelf] = useState<UserAnime[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const storedShelf = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedShelf) {
        setShelf(JSON.parse(storedShelf));
      }
    } catch (error) {
      console.error("Failed to load anime shelf from localStorage:", error);
      // Initialize with empty array in case of parsing error
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
  }, []);

  const updateAnimeOnShelf = useCallback((mal_id: number, updates: Partial<Omit<UserAnime, 'mal_id' | 'title' | 'cover_image' | 'total_episodes' | 'genres' | 'studios'>>) => {
    setShelf(prevShelf =>
      prevShelf.map(anime =>
        anime.mal_id === mal_id ? { ...anime, ...updates, current_episode: Math.max(0, updates.current_episode ?? anime.current_episode) } : anime
      )
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
    <AnimeShelfContext.Provider value={{ shelf, addAnimeToShelf, updateAnimeOnShelf, removeAnimeFromShelf, isAnimeOnShelf, getAnimeFromShelf, isInitialized }}>
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
