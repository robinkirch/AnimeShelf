
import { app, BrowserWindow, shell, Menu, ipcMain } from 'electron';
import * as path from 'path';
import { fileURLToPath, parse } from 'url';
import { createServer } from 'http';
import nextServer from 'next';
import * as database from './database.js';
import { mainLogger, logFromRenderer } from './logger.js'; // Import logger


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine the correct directory for the Next.js app
const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Determine if the app is in development or production mode
const nextApp = nextServer({ dev: !app.isPackaged , dir: appDir });
const handle = nextApp.getRequestHandler();
const nextJsPort = 9002; 

let mainWindow: BrowserWindow | null;

mainLogger.info('Application starting...', { pid: process.pid });

function createWindow() {
  mainLogger.info('Creating main window...');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false, 
      contextIsolation: true, 
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(appDir, 'public', 'favicon.ico') 
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    mainLogger.info('Opening external URL', { url });
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  Menu.setApplicationMenu(null);
  mainLogger.info('Application menu removed.');

  mainWindow.loadURL(`http://localhost:${nextJsPort}`);
  mainLogger.info(`Main window loading URL: http://localhost:${nextJsPort}`);

  mainWindow.on('closed', () => {
    mainLogger.info('Main window closed.');
    mainWindow = null;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainLogger.info('Main window content finished loading.');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    mainLogger.error('Main window content failed to load.', { errorCode, errorDescription });
  });

  mainWindow.on('unresponsive', () => {
    mainLogger.warn('Main window is unresponsive.');
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    mainLogger.error('Render process gone unexpectedly.', { details });
  });


}

app.on('ready', async () => {
  mainLogger.info('Electron app is ready.');
  // Initialize database
  console.log('App onReady triggered');
  try {
    mainLogger.info('Initializing database...');
    database.initDb();
    mainLogger.info('Database initialized successfully.');
  } catch (err: any) {
    mainLogger.error('Failed to initialize database:', { error: err.message, stack: err.stack });
    app.quit(); // Quit if DB fails to initialize
    return;
  }

  // Setup IPC Handlers
  ipcMain.handle('db:getShelf', async () => { mainLogger.debug('IPC: db:getShelf invoked'); return database.getShelf(); });
  ipcMain.handle('db:addAnimeToShelf', async (event, anime) => { mainLogger.debug('IPC: db:addAnimeToShelf invoked', { animeTitle: anime?.title }); return database.addAnimeToShelf(anime); });
  ipcMain.handle('db:updateAnimeOnShelf', async (event, mal_id, updates) => { mainLogger.debug('IPC: db:updateAnimeOnShelf invoked', { mal_id, updatesCount: Object.keys(updates || {}).length }); return database.updateAnimeOnShelf(mal_id, updates); });
  ipcMain.handle('db:removeAnimeFromShelf', async (event, mal_id) => { mainLogger.debug('IPC: db:removeAnimeFromShelf invoked', { mal_id }); return database.removeAnimeFromShelf(mal_id); });
  ipcMain.handle('db:getEpisodeWatchHistory', async () => { mainLogger.debug('IPC: db:getEpisodeWatchHistory invoked'); return database.getEpisodeWatchHistory(); });
  ipcMain.handle('db:addEpisodeWatchEvents', async (event, events) => { mainLogger.debug('IPC: db:addEpisodeWatchEvents invoked', { eventsCount: events?.length }); return database.addEpisodeWatchEvents(events); });
  ipcMain.handle('db:getIgnoredPreviewMalIds', async () => { mainLogger.debug('IPC: db:getIgnoredPreviewMalIds invoked'); return database.getIgnoredPreviewMalIds(); });
  ipcMain.handle('db:addIgnoredPreviewMalId', async (event, mal_id) => { mainLogger.debug('IPC: db:addIgnoredPreviewMalId invoked', { mal_id }); return database.addIgnoredPreviewMalId(mal_id); });
  ipcMain.handle('db:removeIgnoredPreviewMalId', async (event, mal_id) => { mainLogger.debug('IPC: db:removeIgnoredPreviewMalId invoked', { mal_id }); return database.removeIgnoredPreviewMalId(mal_id); });
  ipcMain.handle('db:importAnimeBatch', async(event, animeList) => { mainLogger.debug('IPC: db:importAnimeBatch invoked', { animeListCount: animeList?.length }); return database.importAnimeBatch(animeList); });
  ipcMain.handle('db:getUserProfile', async () => { mainLogger.debug('IPC: db:getUserProfile invoked'); return database.getUserProfile(); });
  ipcMain.handle('db:updateUserProfile', async (event, profile) => { mainLogger.debug('IPC: db:updateUserProfile invoked for user', { username: profile?.username } ); return database.updateUserProfile(profile); });
  
  // IPC Handler for logs from renderer
  ipcMain.on('log-to-main', (event, level: string, category: string, message: string, metadata?: any) => {
    logFromRenderer(level, category, message, metadata);
  });
  mainLogger.info('IPC handlers registered.');


  if (!app.isPackaged) {
    mainLogger.info('Development mode detected. Creating window and opening dev tools.');
    createWindow();
    if (mainWindow) {
      mainWindow.webContents.openDevTools();
      mainLogger.info('Dev tools opened.');
    }
  } else {
    mainLogger.info('Production mode detected. Preparing Next.js app.');
    try {
      await nextApp.prepare();
      const server = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
      });
      server.listen(nextJsPort, (err?: any) => {
        if (err) {
          mainLogger.error("Failed to start Next.js server:", { error: err.message, stack: err.stack });
          app.quit(); 
          return;
        }
        mainLogger.info(`Next.js server ready on http://localhost:${nextJsPort}`);
        createWindow(); 
      });
      server.on('error', (err) => {
        mainLogger.error("HTTP Server error:", { error: err.message, stack: err.stack });
      });
    } catch (err: any) {
        mainLogger.error("Error preparing Next.js app:", { error: err.message, stack: err.stack });
        app.quit();
    }
  }
});

app.on('window-all-closed', () => {
  mainLogger.info('All windows closed.');
  if (process.platform !== 'darwin') {
    mainLogger.info('Quitting application (not macOS).');
    app.quit();
  }
});

app.on('activate', () => {
  mainLogger.info('Application activated.');
  if (mainWindow === null) {
    mainLogger.info('Main window is null, creating new window.');
    createWindow();
  }
});

app.on('will-quit', () => {
  mainLogger.info('Application will quit. Closing database.');
  database.closeDb(); // Close DB connection when app quits
  mainLogger.info('Database closed. Exiting.');
});
