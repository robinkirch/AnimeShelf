import { contextBridge, ipcRenderer } from 'electron';
import type { UserAnime, EpisodeWatchEvent, UserProfile } from '../src/types/anime';

contextBridge.exposeInMainWorld('electronStore', {
  // Anime Shelf
  getShelf: (): Promise<UserAnime[]> => {
    return ipcRenderer.invoke('db:getShelf');
  },
  addAnimeToShelf: (anime: UserAnime): Promise<void> => {
    return ipcRenderer.invoke('db:addAnimeToShelf', anime);
  },
  updateAnimeOnShelf: (mal_id: number, updates: Partial<UserAnime>): Promise<void> => {
    return ipcRenderer.invoke('db:updateAnimeOnShelf', mal_id, updates);
  },
  removeAnimeFromShelf: (mal_id: number): Promise<void> => {
    return ipcRenderer.invoke('db:removeAnimeFromShelf', mal_id);
  },

  // Episode Watch History
  getEpisodeWatchHistory: (): Promise<EpisodeWatchEvent[]> => {
    return ipcRenderer.invoke('db:getEpisodeWatchHistory');
  },
  addEpisodeWatchEvents: (events: EpisodeWatchEvent[]): Promise<void> => {
    return ipcRenderer.invoke('db:addEpisodeWatchEvents', events);
  },

  // Ignored Preview MAL IDs
  getIgnoredPreviewMalIds: (): Promise<number[]> => {
    return ipcRenderer.invoke('db:getIgnoredPreviewMalIds');
  },
  addIgnoredPreviewMalId: (mal_id: number): Promise<void> => {
    return ipcRenderer.invoke('db:addIgnoredPreviewMalId', mal_id);
  },
  removeIgnoredPreviewMalId: (mal_id: number): Promise<void> => {
    return ipcRenderer.invoke('db:removeIgnoredPreviewMalId', mal_id);
  },

  // Batch Import
  importAnimeBatch: (animeList: UserAnime[]): Promise<{ successCount: number; errors: Array<{ animeTitle?: string; malId?: number; error: string }> }> => {
    return ipcRenderer.invoke('db:importAnimeBatch', animeList);
  },

  // User Profile
  getUserProfile: (): Promise<UserProfile | null> => {
    return ipcRenderer.invoke('db:getUserProfile');
  },
  updateUserProfile: (profile: Partial<UserProfile>): Promise<void> => {
    return ipcRenderer.invoke('db:updateUserProfile', profile);
  },

  // Secrets (encrypted with safeStorage in the main process)
  getSecret: (name: string): Promise<string | null> => {
    return ipcRenderer.invoke('secrets:get', name);
  },
  setSecret: (name: string, value: string): Promise<void> => {
    return ipcRenderer.invoke('secrets:set', name, value);
  },

  logToMain: (level: string, category: string, message: string, metadata?: any): void => {
    ipcRenderer.send('log-to-main', level, category, message, metadata);
  },
});

