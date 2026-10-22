"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronStore', {
    // Anime Shelf
    getShelf: () => {
        return electron_1.ipcRenderer.invoke('db:getShelf');
    },
    addAnimeToShelf: (anime) => {
        return electron_1.ipcRenderer.invoke('db:addAnimeToShelf', anime);
    },
    updateAnimeOnShelf: (mal_id, updates) => {
        return electron_1.ipcRenderer.invoke('db:updateAnimeOnShelf', mal_id, updates);
    },
    removeAnimeFromShelf: (mal_id) => {
        return electron_1.ipcRenderer.invoke('db:removeAnimeFromShelf', mal_id);
    },
    // Episode Watch History
    getEpisodeWatchHistory: () => {
        return electron_1.ipcRenderer.invoke('db:getEpisodeWatchHistory');
    },
    addEpisodeWatchEvents: (events) => {
        return electron_1.ipcRenderer.invoke('db:addEpisodeWatchEvents', events);
    },
    // Ignored Preview MAL IDs
    getIgnoredPreviewMalIds: () => {
        return electron_1.ipcRenderer.invoke('db:getIgnoredPreviewMalIds');
    },
    addIgnoredPreviewMalId: (mal_id) => {
        return electron_1.ipcRenderer.invoke('db:addIgnoredPreviewMalId', mal_id);
    },
    removeIgnoredPreviewMalId: (mal_id) => {
        return electron_1.ipcRenderer.invoke('db:removeIgnoredPreviewMalId', mal_id);
    },
    // Batch Import
    importAnimeBatch: (animeList) => {
        return electron_1.ipcRenderer.invoke('db:importAnimeBatch', animeList);
    },
    // User Profile
    getUserProfile: () => {
        return electron_1.ipcRenderer.invoke('db:getUserProfile');
    },
    updateUserProfile: (profile) => {
        return electron_1.ipcRenderer.invoke('db:updateUserProfile', profile);
    },
    logToMain: (level, category, message, metadata) => {
        electron_1.ipcRenderer.send('log-to-main', level, category, message, metadata);
    },
});
