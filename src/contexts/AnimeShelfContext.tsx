
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { JikanAnime, UserAnime, UserAnimeStatus, EpisodeWatchEvent, UserProfile } from '@/types/anime';
import { USER_ANIME_STATUS_OPTIONS } from '@/types/anime'; 
import { rendererLogger } from '@/lib/logger'; // Import renderer logger

declare global {
  interface Window {
    electronStore?: {
      getShelf: () => Promise<UserAnime[]>;
      addAnimeToShelf: (anime: UserAnime) => Promise<void>;
      updateAnimeOnShelf: (mal_id: number, updates: Partial<UserAnime>) => Promise<void>;
      removeAnimeFromShelf: (mal_id: number) => Promise<void>;
      getEpisodeWatchHistory: () => Promise<EpisodeWatchEvent[]>;
      addEpisodeWatchEvents: (events: EpisodeWatchEvent[]) => Promise<void>;
      getIgnoredPreviewMalIds: () => Promise<number[]>;
      addIgnoredPreviewMalId: (mal_id: number) => Promise<void>;
      removeIgnoredPreviewMalId: (mal_id: number) => Promise<void>;
      importAnimeBatch: (animeList: UserAnime[]) => Promise<{ successCount: number, errors: Array<{ animeTitle?: string; malId?: number; error: string }> }>;
      getUserProfile: () => Promise<UserProfile | null>;
      updateUserProfile: (profile: Partial<UserProfile>) => Promise<void>;
      logToMain: (level: string, category: string, message: string, metadata?: any) => void; // Added for logger
    };
  }
}


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
  isElectronStoreReady: boolean;
  upcomingSequels: JikanAnime[]; 
  setUpcomingSequels: (animeList: JikanAnime[]) => void; 
  getFilteredUpcomingSequelsCount: () => number; 
  ignoredPreviewAnimeMalIds: number[];
  addIgnoredPreviewAnime: (mal_id: number) => void;
  removeIgnoredPreviewAnime: (mal_id: number) => void; 
  isPreviewAnimeIgnored: (mal_id: number) => boolean;
  ignoredPreviewAnimeMalIdsInitialized: boolean;
  importAnimeBatch: (importedAnimeList: UserAnime[]) => Promise<{ successCount: number, errors: Array<{ animeTitle?: string; malId?: number; error: string }> }>;
  episodeWatchHistory: EpisodeWatchEvent[];
  userProfile: UserProfile | null;
  userProfileInitialized: boolean;
  updateUserProfile: (profileUpdates: Partial<Omit<UserProfile, 'profileSetupComplete'>>) => Promise<void>;
  markProfileSetupComplete: () => Promise<void>;
}

const AnimeShelfContext = createContext<AnimeShelfContextType | undefined>(undefined);

const IGNORED_TYPES_CONTEXT = ['Music'];

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
  const [isInitialized, setIsInitialized] = useState(false); // For general shelf data
  const [upcomingSequels, setUpcomingSequelsState] = useState<JikanAnime[]>([]);
  const [ignoredPreviewAnimeMalIds, setIgnoredPreviewAnimeMalIds] = useState<number[]>([]);
  const [ignoredPreviewAnimeMalIdsInitialized, setIgnoredPreviewAnimeMalIdsInitialized] = useState(false);
  const [episodeWatchHistory, setEpisodeWatchHistory] = useState<EpisodeWatchEvent[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userProfileInitialized, setUserProfileInitialized] = useState(false);
  
  const [electronStore, setElectronStore] = useState<typeof window.electronStore | undefined>(undefined);
  const [isElectronStoreReady, setIsElectronStoreReady] = useState(false);

  useEffect(() => {
    console.warn("starting first render.");
    if (typeof window !== 'undefined' && window.electronStore) {
      setElectronStore(window.electronStore);
      setIsElectronStoreReady(true);
      rendererLogger.info('AnimeShelfContext mounted, Electron store reference set.', { category: 'system-lifecycle'});
    } else {
      rendererLogger.warn('window.electronStore is not available. Be sure preload.js is loaded correct', { category: 'system-lifecycle'});
    }
  }, []);

  useEffect(() => {
    async function loadInitialData() {
      rendererLogger.info('Attempting to load initial data from Electron store.', { category: 'system-lifecycle' });
      if (!isElectronStoreReady || !electronStore) {
        rendererLogger.warn("Electron store not available for initial data load (Context).", { category: 'system-error' });
        setIsInitialized(false); 
        setIgnoredPreviewAnimeMalIdsInitialized(false);
        setUserProfileInitialized(false);
        return;
      }
      try {
        rendererLogger.debug('Fetching data from electronStore...', { category: 'db-operation'});
        const [dbShelf, dbHistory, dbIgnoredIds, dbProfile] = await Promise.all([
          electronStore.getShelf(),
          electronStore.getEpisodeWatchHistory(),
          electronStore.getIgnoredPreviewMalIds(),
          electronStore.getUserProfile()
        ]);
        setShelf(dbShelf || []);
        setEpisodeWatchHistory(dbHistory || []);
        setIgnoredPreviewAnimeMalIds(dbIgnoredIds || []);
        setUserProfile(dbProfile || { username: null, profilePictureDataUri: null, profileSetupComplete: false });
        rendererLogger.info('Initial data loaded successfully.', { 
            category: 'db-operation', 
            shelfSize: dbShelf?.length, 
            historySize: dbHistory?.length,
            ignoredIdsSize: dbIgnoredIds?.length,
            profileLoaded: !!dbProfile
        });
      } catch (error) {
        console.error("Failed to load data from SQLite:", error);
        setUserProfile({ username: null, profilePictureDataUri: null, profileSetupComplete: false });
      } finally {
        setIsInitialized(true);
        setIgnoredPreviewAnimeMalIdsInitialized(true);
        setUserProfileInitialized(true);
      }
    }
    if (isElectronStoreReady) { 
      loadInitialData();
    }
  }, [isElectronStoreReady, electronStore]);


  const setUpcomingSequels = useCallback((animeList: JikanAnime[]) => {
    rendererLogger.debug(`Setting upcoming sequels, count: ${animeList.length}`, { category: 'data-update' });
    setUpcomingSequelsState(animeList);
  }, []);

  const addAnimeToShelf = useCallback(async (anime: JikanAnime, initialDetails: { user_status: UserAnimeStatus; current_episode: number; user_rating: number | null; streaming_platforms: string[]; broadcast_day: string | null; }) => {
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

    rendererLogger.info(`Adding anime to shelf: "${newAnime.title}" (ID: ${newAnime.mal_id})`, { category: 'user-action', action: 'add-anime', details: initialDetails});
    if (currentElectronStore) {
      await currentElectronStore.addAnimeToShelf(newAnime);
    }
    setShelf(prevShelf => {
      if (prevShelf.some(item => item.mal_id === anime.mal_id)) return prevShelf;
      return [...prevShelf, newAnime];
    });
    setUpcomingSequelsState(prevUpcoming => prevUpcoming.filter(seq => seq.mal_id !== anime.mal_id));
  }, [currentElectronStore]);

  const updateAnimeOnShelf = useCallback(async (
    mal_id: number,
    updates: Partial<Omit<UserAnime, 'mal_id' | 'title' | 'cover_image' | 'total_episodes' | 'genres' | 'studios' | 'type' | 'year' | 'season' | 'duration_minutes'>>,
    currentJikanTotalEpisodes?: number | null
  ) => {
    let animeToUpdate = shelf.find(a => a.mal_id === mal_id);
    if (!animeToUpdate) {
      rendererLogger.warn(`Attempted to update non-existent anime on shelf: ID ${mal_id}`, { category: 'user-action-error', action: 'update-anime'});
      return;
    }
    rendererLogger.info(`Updating anime on shelf: ID ${mal_id}`, { category: 'user-action', action: 'update-anime', updatesCount: Object.keys(updates).length });

    const oldCurrentEpisode = animeToUpdate.current_episode;
    
    let mostReliableTotalEpisodes = animeToUpdate.total_episodes;
    if (typeof currentJikanTotalEpisodes === 'number' && currentJikanTotalEpisodes !== animeToUpdate.total_episodes) {
        mostReliableTotalEpisodes = currentJikanTotalEpisodes;
    }
    
    let finalStatus = updates.user_status ?? animeToUpdate.user_status;
    let finalEpisodeCount = updates.current_episode ?? animeToUpdate.current_episode;

    if (updates.user_status) {
      finalStatus = updates.user_status;
      if (finalStatus === 'completed') {
        if (typeof mostReliableTotalEpisodes === 'number' && mostReliableTotalEpisodes > 0) {
          finalEpisodeCount = mostReliableTotalEpisodes;
        } else if (mostReliableTotalEpisodes === 0) { 
           finalEpisodeCount = Math.max(1, finalEpisodeCount);
        }
      }
    } else if (updates.current_episode !== undefined) {
      finalEpisodeCount = Math.max(0, updates.current_episode);
      if (typeof mostReliableTotalEpisodes === 'number' && mostReliableTotalEpisodes > 0) {
        finalEpisodeCount = Math.min(finalEpisodeCount, mostReliableTotalEpisodes);
      }

      if (typeof mostReliableTotalEpisodes === 'number' && mostReliableTotalEpisodes > 0) {
        if (finalEpisodeCount === 0) finalStatus = 'plan_to_watch';
        else if (finalEpisodeCount >= mostReliableTotalEpisodes) finalStatus = 'completed';
        else finalStatus = 'watching';
      } else if (mostReliableTotalEpisodes === 0) { 
        finalStatus = (finalEpisodeCount > 0) ? 'completed' : 'plan_to_watch';
      } else { 
        finalStatus = (finalEpisodeCount > 0) ? 'watching' : 'plan_to_watch';
      }
    } else { 
        let cappedEpisode = Math.max(0, animeToUpdate.current_episode);
        if (typeof mostReliableTotalEpisodes === 'number' && mostReliableTotalEpisodes > 0) {
            cappedEpisode = Math.min(cappedEpisode, mostReliableTotalEpisodes);
        }
        if (cappedEpisode !== animeToUpdate.current_episode) {
            finalEpisodeCount = cappedEpisode;
             if (typeof mostReliableTotalEpisodes === 'number' && mostReliableTotalEpisodes > 0) {
                if (finalEpisodeCount === 0) finalStatus = 'plan_to_watch';
                else if (finalEpisodeCount >= mostReliableTotalEpisodes) finalStatus = 'completed';
                else finalStatus = 'watching';
              } else if (mostReliableTotalEpisodes === 0) { 
                finalStatus = (finalEpisodeCount > 0) ? 'completed' : 'plan_to_watch';
              } else { 
                finalStatus = (finalEpisodeCount > 0) ? 'watching' : 'plan_to_watch';
              }
        } else { 
            finalEpisodeCount = cappedEpisode;
        }
    }

    const updatedAnimeFields: Partial<UserAnime> = {
        ...updates,
        user_status: finalStatus,
        current_episode: finalEpisodeCount,
        total_episodes: mostReliableTotalEpisodes, 
    };

    if (currentElectronStore) {
      await currentElectronStore.updateAnimeOnShelf(mal_id, updatedAnimeFields);
    }

    setShelf(prevShelf =>
      prevShelf.map(item =>
        item.mal_id === mal_id ? { ...item, ...updatedAnimeFields } : item
      )
    );

    if (finalEpisodeCount > oldCurrentEpisode) {
      const newEvents: EpisodeWatchEvent[] = [];
      for (let i = oldCurrentEpisode + 1; i <= finalEpisodeCount; i++) {
        newEvents.push({
          mal_id: mal_id,
          episode_number_watched: i,
          watched_at: new Date().toISOString(),
        });
      }
      if (newEvents.length > 0) {
        rendererLogger.info(`Adding ${newEvents.length} episode watch events for anime ID ${mal_id}`, { category: 'user-action', action: 'watch-episode'});
        if (currentElectronStore) {
          await currentElectronStore.addEpisodeWatchEvents(newEvents);
        }
        setEpisodeWatchHistory(prevHistory => [...prevHistory, ...newEvents]);
      }
    }
  }, [shelf, currentElectronStore]);

  const removeAnimeFromShelf = useCallback(async (mal_id: number) => {
    rendererLogger.info(`Removing anime from shelf: ID ${mal_id}`, { category: 'user-action', action: 'remove-anime'});
    if (currentElectronStore) {
      await currentElectronStore.removeAnimeFromShelf(mal_id);
    }
    setShelf(prevShelf => prevShelf.filter(anime => anime.mal_id !== mal_id));
  }, [currentElectronStore]);

  const isAnimeOnShelf = useCallback((mal_id: number) => {
    return shelf.some(anime => anime.mal_id === mal_id);
  }, [shelf]);

  const getAnimeFromShelf = useCallback((mal_id: number) => {
    return shelf.find(anime => anime.mal_id === mal_id);
  }, [shelf]);

  const addIgnoredPreviewAnime = useCallback(async (mal_id: number) => {
    rendererLogger.info(`Ignoring anime in preview: ID ${mal_id}`, { category: 'user-action', action: 'ignore-preview'});
    if (currentElectronStore) {
      await currentElectronStore.addIgnoredPreviewMalId(mal_id);
    }
    setIgnoredPreviewAnimeMalIds(prev => {
      if (prev.includes(mal_id)) return prev;
      return [...prev, mal_id];
    });
  }, [currentElectronStore]);

  const removeIgnoredPreviewAnime = useCallback(async (mal_id: number) => {
    rendererLogger.info(`Restoring anime to preview: ID ${mal_id}`, { category: 'user-action', action: 'restore-preview'});
    if (currentElectronStore) {
      await currentElectronStore.removeIgnoredPreviewMalId(mal_id);
    }
    setIgnoredPreviewAnimeMalIds(prev => prev.filter(id => id !== mal_id));
  }, [currentElectronStore]);

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
  
  const importAnimeBatch = useCallback(async (importedAnimeList: UserAnime[]): Promise<{ successCount: number, errors: Array<{ animeTitle?: string; malId?: number; error: string }> }> => {
    rendererLogger.info(`Starting batch import of ${importedAnimeList.length} anime. electronStore is ${electronStore ? "available" : "undefined"}`, { category: 'user-action', action: 'import-batch'});
    if (electronStore) {
      const result = await electronStore.importAnimeBatch(importedAnimeList);
      const dbShelf = await electronStore.getShelf();
      setShelf(dbShelf || []);
      return result;
    }
    // Fallback if no electronStore - This part is mostly for type consistency, real imports need DB.
    let successCount = 0;
    const errors: Array<{ animeTitle?: string; malId?: number; error: string }> = [];
    setShelf(prevShelf => {
        const newShelf = [...prevShelf];
        importedAnimeList.forEach(importedAnime => {
             const existingIndex = newShelf.findIndex(item => item.mal_id === importedAnime.mal_id);
              if (existingIndex !== -1) {
                newShelf[existingIndex] = { ...newShelf[existingIndex], ...importedAnime }; 
              } else {
                newShelf.push(importedAnime);
              }
              successCount++;
        });
        return newShelf;
    });
    rendererLogger.warn('Batch import processed without Electron store (simulated).', { category: 'user-action-error', action: 'import-batch-no-store'});
    return { successCount, errors };
  }, [electronStore]);

  const updateUserProfile = useCallback(async (profileUpdates: Partial<Omit<UserProfile, 'profileSetupComplete'>>) => {
    rendererLogger.info(`Updating user profile.`, { category: 'user-action', action: 'update-profile', updates: Object.keys(profileUpdates) });
    if (!electronStore) {
        rendererLogger.error('Cannot update user profile, Electron store not available.', { category: 'user-action-error', action: 'update-profile-no-store' });
        return;
    }
    await electronStore.updateUserProfile(profileUpdates);
    setUserProfile(prev => ({ ...(prev || { username: null, profilePictureDataUri: null, profileSetupComplete: false }), ...profileUpdates }));
  }, [electronStore]);

  const markProfileSetupComplete = useCallback(async () => {
    rendererLogger.info(`Marking profile setup as complete.`, { category: 'user-action', action: 'profile-setup-complete'});
    if (!electronStore) {
        rendererLogger.error('Cannot mark profile setup complete, Electron store not available.', { category: 'user-action-error', action: 'profile-setup-no-store'});
        return;
    }
    await electronStore.updateUserProfile({ profileSetupComplete: true });
    setUserProfile(prev => ({ ...(prev || { username: null, profilePictureDataUri: null, profileSetupComplete: false }), profileSetupComplete: true }));
  }, [electronStore]);

  return (
    <AnimeShelfContext.Provider value={{ 
        shelf, 
        addAnimeToShelf, 
        updateAnimeOnShelf, 
        removeAnimeFromShelf, 
        isAnimeOnShelf, 
        getAnimeFromShelf, 
        isInitialized,
        isElectronStoreReady,
        upcomingSequels,
        setUpcomingSequels,
        getFilteredUpcomingSequelsCount,
        ignoredPreviewAnimeMalIds,
        addIgnoredPreviewAnime,
        removeIgnoredPreviewAnime,
        isPreviewAnimeIgnored,
        ignoredPreviewAnimeMalIdsInitialized,
        importAnimeBatch,
        episodeWatchHistory,
        userProfile,
        userProfileInitialized,
        updateUserProfile,
        markProfileSetupComplete
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
