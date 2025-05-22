
import { app, BrowserWindow, shell } from 'electron';
import * as path from 'path';
import { fileURLToPath, parse } from 'url';
import { createServer } from 'http';
// Correct import for Next.js
import nextServer from 'next';

// Determine the correct directory for the Next.js app
// In development, __dirname is electron/main.ts -> electron/
// In production (packaged app), __dirname is usually resources/app.asar/electron/
// So, `path.join(__dirname, '..')` should correctly point to the project root where .next/ and package.json are.
const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Determine if the app is in development or production mode
const nextApp = nextServer({ dev: app.isPackaged , dir: appDir });
const handle = nextApp.getRequestHandler();
const nextJsPort = 9002; // Ensure this matches your Next.js dev port and can be used in prod

let mainWindow: BrowserWindow | null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false, // Disable Node.js integration in renderer for security
      contextIsolation: true, // Protect against prototype pollution
      // preload: path.join(__dirname, 'preload.js'), // Optional: uncomment if you need a preload script
    },
    icon: path.join(appDir, 'public', 'favicon.ico') // Assuming favicon exists in public
  });

  // Make all links open with the browser, not within the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // The URL will be loaded once the server is ready (see app.on('ready'))
  mainWindow.loadURL(`http://localhost:${nextJsPort}`);

  // Open DevTools in development
  // The `isDevelopment` variable is now loaded asynchronously in the ready handler
  // so we handle DevTools opening there.

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', async () => {
  if (!app.isPackaged) {
    // In development, Next.js dev server is started by `yarn dev` (concurrently)
    // We just need to create the window.
    createWindow();
  } else {
    // In production, start the Next.js server from the main process
    try {
      await nextApp.prepare();
      const server = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
      });
      server.listen(nextJsPort, (err?: any) => {
        if (err) {
          console.error("Failed to start Next.js server:", err);
          app.quit(); // Quit if server fails to start
          return;
        }
        console.log(`> Next.js server ready on http://localhost:${nextJsPort}`);
        createWindow(); // Create window after server is ready
      });
      server.on('error', (err) => {
        console.error("HTTP Server error:", err);
        // Potentially quit app or try to recover
      });
    } catch (err) {
        console.error("Error preparing Next.js app:", err);
        app.quit();
    }
  }
});

app.on('window-all-closed', () => {
  // On macOS it's common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('will-quit', () => {
  // Clean up any resources if necessary
});
