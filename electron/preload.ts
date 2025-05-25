
import { contextBridge, ipcRenderer } from 'electron';
import type { UserAnime, EpisodeWatchEvent, UserProfile } from '@/types/anime';

contextBridge.exposeInMainWorld('electronStore', {
  // Anime Shelf
  getShelf: (): Promise<UserAnime[]> => ipcRenderer.invoke('db:getShelf'),
  addAnimeToShelf: (anime: UserAnime): Promise<void> => ipcRenderer.invoke('db:addAnimeToShelf', anime),
  updateAnimeOnShelf: (mal_id: number, updates: Partial<UserAnime>): Promise<void> => ipcRenderer.invoke('db:updateAnimeOnShelf', mal_id, updates),
  removeAnimeFromShelf: (mal_id: number): Promise<void> => ipcRenderer.invoke('db:removeAnimeFromShelf', mal_id),
  
  // Episode Watch History
  getEpisodeWatchHistory: (): Promise<EpisodeWatchEvent[]> => ipcRenderer.invoke('db:getEpisodeWatchHistory'),
  addEpisodeWatchEvents: (events: EpisodeWatchEvent[]): Promise<void> => ipcRenderer.invoke('db:addEpisodeWatchEvents', events),
  
  // Ignored Preview MAL IDs
  getIgnoredPreviewMalIds: (): Promise<number[]> => ipcRenderer.invoke('db:getIgnoredPreviewMalIds'),
  addIgnoredPreviewMalId: (mal_id: number): Promise<void> => ipcRenderer.invoke('db:addIgnoredPreviewMalId', mal_id),
  removeIgnoredPreviewMalId: (mal_id: number): Promise<void> => ipcRenderer.invoke('db:removeIgnoredPreviewMalId', mal_id),

  // Batch Import
  importAnimeBatch: (animeList: UserAnime[]): Promise<{ successCount: number; errors: Array<{ animeTitle?: string; malId?: number; error: string }> }> => ipcRenderer.invoke('db:importAnimeBatch', animeList),

  // User Profile
  getUserProfile: (): Promise<UserProfile | null> => ipcRenderer.invoke('db:getUserProfile'),
  updateUserProfile: (profile: Partial<UserProfile>): Promise<void> => ipcRenderer.invoke('db:updateUserProfile', profile),
});
