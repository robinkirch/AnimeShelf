
import { app, BrowserWindow, shell, Menu, ipcMain } from 'electron';
import * as path from 'path';
import { fileURLToPath, parse } from 'url';
import { createServer } from 'http';
// Correct import for Next.js
import nextServer from 'next';
import * as database from './database'; // Import database module

// Determine the correct directory for the Next.js app
const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Determine if the app is in development or production mode
const nextApp = nextServer({ dev: !app.isPackaged , dir: appDir });
const handle = nextApp.getRequestHandler();
const nextJsPort = 9002; 

let mainWindow: BrowserWindow | null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false, 
      contextIsolation: true, 
      preload: path.join(__dirname, 'preload.js'), // Enable preload script
    },
    icon: path.join(appDir, 'public', 'favicon.ico') 
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadURL(`http://localhost:${nextJsPort}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', async () => {
  // Initialize database
  try {
    database.initDb();
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize database:', err);
    app.quit(); // Quit if DB fails to initialize
    return;
  }

  // Setup IPC Handlers
  ipcMain.handle('db:getShelf', async () => database.getShelf());
  ipcMain.handle('db:addAnimeToShelf', async (event, anime) => database.addAnimeToShelf(anime));
  ipcMain.handle('db:updateAnimeOnShelf', async (event, mal_id, updates) => database.updateAnimeOnShelf(mal_id, updates));
  ipcMain.handle('db:removeAnimeFromShelf', async (event, mal_id) => database.removeAnimeFromShelf(mal_id));
  ipcMain.handle('db:getEpisodeWatchHistory', async () => database.getEpisodeWatchHistory());
  ipcMain.handle('db:addEpisodeWatchEvents', async (event, events) => database.addEpisodeWatchEvents(events));
  ipcMain.handle('db:getIgnoredPreviewMalIds', async () => database.getIgnoredPreviewMalIds());
  ipcMain.handle('db:addIgnoredPreviewMalId', async (event, mal_id) => database.addIgnoredPreviewMalId(mal_id));
  ipcMain.handle('db:removeIgnoredPreviewMalId', async (event, mal_id) => database.removeIgnoredPreviewMalId(mal_id));
  ipcMain.handle('db:importAnimeBatch', async(event, animeList) => database.importAnimeBatch(animeList));


  if (!app.isPackaged) {
    createWindow();
    if (mainWindow) {
      mainWindow.webContents.openDevTools();
    }
  } else {
    try {
      await nextApp.prepare();
      const server = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
      });
      server.listen(nextJsPort, (err?: any) => {
        if (err) {
          console.error("Failed to start Next.js server:", err);
          app.quit(); 
          return;
        }
        console.log(`> Next.js server ready on http://localhost:${nextJsPort}`);
        createWindow(); 
      });
      server.on('error', (err) => {
        console.error("HTTP Server error:", err);
      });
    } catch (err) {
        console.error("Error preparing Next.js app:", err);
        app.quit();
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  database.closeDb(); // Close DB connection when app quits
});
