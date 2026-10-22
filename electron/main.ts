
import { app, BrowserWindow, shell, Menu, ipcMain, dialog, session, safeStorage } from 'electron';
import * as path from 'path';
import { fileURLToPath, parse } from 'url';
import { createServer } from 'http';
import nextServer from 'next';
import * as database from './database.js';
import { mainLogger, logFromRenderer } from './logger.js'; // Import logger


// Bundled by esbuild into electron/dist/ (main.js as ESM, preload.cjs as CommonJS).
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Project root in development, resources/app in the packaged app (contains .next, public, package.json).
const appDir = app.getAppPath();

const nextJsPort = 9002;
// Only bind to loopback so the embedded Next.js server (incl. server actions) isn't reachable from the network.
const nextJsHost = '127.0.0.1';

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
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: path.join(appDir, 'public', 'AnimeShelf.ico')
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

  // Settings stored as cookies (e.g. the UI language) must survive a crash or forced quit. Electron writes
  // cookies to disk lazily, so flush right after every change.
  session.defaultSession.cookies.on('changed', () => {
    session.defaultSession.cookies.flushStore().catch((err: Error) => {
      mainLogger.warn('Failed to flush cookie store.', { error: err.message });
    });
  });
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

  // Secrets (AI API keys): encrypted with safeStorage before they are stored, never written in plain text.
  // Values are never logged.
  const SECRET_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
  ipcMain.handle('secrets:get', async (event, name: string) => {
    if (!SECRET_NAME_PATTERN.test(name)) throw new Error('Invalid secret name');
    const encrypted = database.getSecret(name);
    if (!encrypted) return null;
    if (!safeStorage.isEncryptionAvailable()) {
      mainLogger.warn('safeStorage is not available; stored secret cannot be decrypted.', { name });
      return null;
    }
    try {
      return safeStorage.decryptString(encrypted);
    } catch (err: any) {
      mainLogger.error('Failed to decrypt secret.', { name, error: err.message });
      return null;
    }
  });
  ipcMain.handle('secrets:set', async (event, name: string, value: string) => {
    if (!SECRET_NAME_PATTERN.test(name)) throw new Error('Invalid secret name');
    if (!value) {
      database.deleteSecret(name);
      return;
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system');
    }
    database.setSecret(name, safeStorage.encryptString(value));
    mainLogger.info('Secret stored (encrypted).', { name });
  });
  
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
      // In development `next dev` runs separately (see electron:dev), so the server is only created here.
      const nextApp = nextServer({ dev: false, dir: appDir });
      const handle = nextApp.getRequestHandler();
      await nextApp.prepare();
      const server = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
      });
      server.on('error', (err: NodeJS.ErrnoException) => {
        mainLogger.error("HTTP Server error:", { error: err.message, code: err.code, stack: err.stack });
        if (err.code === 'EADDRINUSE') {
          dialog.showErrorBox('AnimeShelf', `Port ${nextJsPort} is already in use. Please close the other application (or another AnimeShelf instance) and try again.`);
          app.quit();
        }
      });
      server.listen(nextJsPort, nextJsHost, () => {
        mainLogger.info(`Next.js server ready on http://localhost:${nextJsPort}`);
        createWindow();
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
