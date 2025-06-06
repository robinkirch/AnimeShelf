"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
console.log('Preload script started'); // Log beim Start des Preload-Skripts
electron_1.contextBridge.exposeInMainWorld('electronStore', {
    // Anime Shelf
    getShelf: () => {
        console.log('Preload: Calling db:getShelf'); // Log für getShelf
        return electron_1.ipcRenderer.invoke('db:getShelf');
    },
    addAnimeToShelf: (anime) => {
        console.log('Preload: Calling db:addAnimeToShelf', anime.mal_id); // Log für addAnimeToShelf
        return electron_1.ipcRenderer.invoke('db:addAnimeToShelf', anime);
    },
    updateAnimeOnShelf: (mal_id, updates) => {
        console.log('Preload: Calling db:updateAnimeOnShelf', mal_id, updates); // Log für updateAnimeOnShelf
        return electron_1.ipcRenderer.invoke('db:updateAnimeOnShelf', mal_id, updates);
    },
    removeAnimeFromShelf: (mal_id) => {
        console.log('Preload: Calling db:removeAnimeFromShelf', mal_id); // Log für removeAnimeFromShelf
        return electron_1.ipcRenderer.invoke('db:removeAnimeFromShelf', mal_id);
    },
    // Episode Watch History
    getEpisodeWatchHistory: () => {
        console.log('Preload: Calling db:getEpisodeWatchHistory'); // Log für getEpisodeWatchHistory
        return electron_1.ipcRenderer.invoke('db:getEpisodeWatchHistory');
    },
    addEpisodeWatchEvents: (events) => {
        console.log('Preload: Calling db:addEpisodeWatchEvents', events.length, 'events'); // Log für addEpisodeWatchEvents
        return electron_1.ipcRenderer.invoke('db:addEpisodeWatchEvents', events);
    },
    // Ignored Preview MAL IDs
    getIgnoredPreviewMalIds: () => {
        console.log('Preload: Calling db:getIgnoredPreviewMalIds'); // Log für getIgnoredPreviewMalIds
        return electron_1.ipcRenderer.invoke('db:getIgnoredPreviewMalIds');
    },
    addIgnoredPreviewMalId: (mal_id) => {
        console.log('Preload: Calling db:addIgnoredPreviewMalId', mal_id); // Log für addIgnoredPreviewMalId
        return electron_1.ipcRenderer.invoke('db:addIgnoredPreviewMalId', mal_id);
    },
    removeIgnoredPreviewMalId: (mal_id) => {
        console.log('Preload: Calling db:removeIgnoredPreviewMalId', mal_id); // Log für removeIgnoredPreviewMalId
        return electron_1.ipcRenderer.invoke('db:removeIgnoredPreviewMalId', mal_id);
    },
    // Batch Import
    importAnimeBatch: (animeList) => {
        console.log('Preload: Calling db:importAnimeBatch', animeList.length, 'items'); // Log für importAnimeBatch
        return electron_1.ipcRenderer.invoke('db:importAnimeBatch', animeList);
    },
    // User Profile
    getUserProfile: () => {
        console.log('Preload: Calling db:getUserProfile'); // Log für getUserProfile
        return electron_1.ipcRenderer.invoke('db:getUserProfile');
    },
    updateUserProfile: (profile) => {
        console.log('Preload: Calling db:updateUserProfile', profile); // Log für updateUserProfile
        return electron_1.ipcRenderer.invoke('db:updateUserProfile', profile);
    },
});
console.log('Preload script finished exposing API');
