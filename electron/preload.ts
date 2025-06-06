import { contextBridge, ipcRenderer } from 'electron';
import type { UserAnime, EpisodeWatchEvent, UserProfile } from './animeDB';

console.log('Preload script started'); // Log beim Start des Preload-Skripts

contextBridge.exposeInMainWorld('electronStore', {
  // Anime Shelf
  getShelf: (): Promise<UserAnime[]> => {
    console.log('Preload: Calling db:getShelf'); // Log für getShelf
    return ipcRenderer.invoke('db:getShelf');
  },
  addAnimeToShelf: (anime: UserAnime): Promise<void> => {
    console.log('Preload: Calling db:addAnimeToShelf', anime.mal_id); // Log für addAnimeToShelf
    return ipcRenderer.invoke('db:addAnimeToShelf', anime);
  },
  updateAnimeOnShelf: (mal_id: number, updates: Partial<UserAnime>): Promise<void> => {
    console.log('Preload: Calling db:updateAnimeOnShelf', mal_id, updates); // Log für updateAnimeOnShelf
    return ipcRenderer.invoke('db:updateAnimeOnShelf', mal_id, updates);
  },
  removeAnimeFromShelf: (mal_id: number): Promise<void> => {
    console.log('Preload: Calling db:removeAnimeFromShelf', mal_id); // Log für removeAnimeFromShelf
    return ipcRenderer.invoke('db:removeAnimeFromShelf', mal_id);
  },

  // Episode Watch History
  getEpisodeWatchHistory: (): Promise<EpisodeWatchEvent[]> => {
    console.log('Preload: Calling db:getEpisodeWatchHistory'); // Log für getEpisodeWatchHistory
    return ipcRenderer.invoke('db:getEpisodeWatchHistory');
  },
  addEpisodeWatchEvents: (events: EpisodeWatchEvent[]): Promise<void> => {
    console.log('Preload: Calling db:addEpisodeWatchEvents', events.length, 'events'); // Log für addEpisodeWatchEvents
    return ipcRenderer.invoke('db:addEpisodeWatchEvents', events);
  },

  // Ignored Preview MAL IDs
  getIgnoredPreviewMalIds: (): Promise<number[]> => {
    console.log('Preload: Calling db:getIgnoredPreviewMalIds'); // Log für getIgnoredPreviewMalIds
    return ipcRenderer.invoke('db:getIgnoredPreviewMalIds');
  },
  addIgnoredPreviewMalId: (mal_id: number): Promise<void> => {
    console.log('Preload: Calling db:addIgnoredPreviewMalId', mal_id); // Log für addIgnoredPreviewMalId
    return ipcRenderer.invoke('db:addIgnoredPreviewMalId', mal_id);
  },
  removeIgnoredPreviewMalId: (mal_id: number): Promise<void> => {
    console.log('Preload: Calling db:removeIgnoredPreviewMalId', mal_id); // Log für removeIgnoredPreviewMalId
    return ipcRenderer.invoke('db:removeIgnoredPreviewMalId', mal_id);
  },

  // Batch Import
  importAnimeBatch: (animeList: UserAnime[]): Promise<{ successCount: number; errors: Array<{ animeTitle?: string; malId?: number; error: string }> }> => {
    console.log('Preload: Calling db:importAnimeBatch', animeList.length, 'items'); // Log für importAnimeBatch
    return ipcRenderer.invoke('db:importAnimeBatch', animeList);
  },

  // User Profile
  getUserProfile: (): Promise<UserProfile | null> => {
    console.log('Preload: Calling db:getUserProfile'); // Log für getUserProfile
    return ipcRenderer.invoke('db:getUserProfile');
  },
  updateUserProfile: (profile: Partial<UserProfile>): Promise<void> => {
    console.log('Preload: Calling db:updateUserProfile', profile); // Log für updateUserProfile
    return ipcRenderer.invoke('db:updateUserProfile', profile);
  },
});

console.log('Preload script finished exposing API');
