"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const electron_is_dev_1 = __importDefault(require("electron-is-dev"));
const http_1 = require("http");
const url_1 = require("url");
// Correct import for Next.js
const next_1 = __importDefault(require("next"));
// Determine the correct directory for the Next.js app
// In development, __dirname is electron/main.ts -> electron/
// In production (packaged app), __dirname is usually resources/app.asar/electron/
// So, `path.join(__dirname, '..')` should correctly point to the project root where .next/ and package.json are.
const appDir = path.join(__dirname, '..');
const nextApp = (0, next_1.default)({ dev: electron_is_dev_1.default, dir: appDir });
const handle = nextApp.getRequestHandler();
const nextJsPort = 9002; // Ensure this matches your Next.js dev port and can be used in prod
let mainWindow;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
            electron_1.shell.openExternal(url);
        }
        return { action: 'deny' };
    });
    if (electron_is_dev_1.default) {
        mainWindow.loadURL(`http://localhost:${nextJsPort}`);
        mainWindow.webContents.openDevTools();
    }
    else {
        // Production: Next.js server is started by Electron main process
        // The URL will be loaded once the server is ready (see app.on('ready'))
        mainWindow.loadURL(`http://localhost:${nextJsPort}`);
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.on('ready', async () => {
    if (electron_is_dev_1.default) {
        // In development, Next.js dev server is started by `yarn dev` (concurrently)
        // We just need to create the window.
        createWindow();
    }
    else {
        // In production, start the Next.js server from the main process
        try {
            await nextApp.prepare();
            const server = (0, http_1.createServer)((req, res) => {
                const parsedUrl = (0, url_1.parse)(req.url, true);
                handle(req, res, parsedUrl);
            });
            server.listen(nextJsPort, (err) => {
                if (err) {
                    console.error("Failed to start Next.js server:", err);
                    electron_1.app.quit(); // Quit if server fails to start
                    return;
                }
                console.log(`> Next.js server ready on http://localhost:${nextJsPort}`);
                createWindow(); // Create window after server is ready
            });
            server.on('error', (err) => {
                console.error("HTTP Server error:", err);
                // Potentially quit app or try to recover
            });
        }
        catch (err) {
            console.error("Error preparing Next.js app:", err);
            electron_1.app.quit();
        }
    }
});
electron_1.app.on('window-all-closed', () => {
    // On macOS it's common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
electron_1.app.on('will-quit', () => {
    // Clean up any resources if necessary
});
//# sourceMappingURL=main.js.map