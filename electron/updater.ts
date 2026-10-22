import { app, ipcMain, type BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';
import type { UpdateStatus } from '../src/types/update';
import { mainLogger } from './logger';

// electron-updater is CommonJS; named ESM imports don't work in the bundled main process.
const { autoUpdater } = electronUpdater;

/**
 * Checks GitHub Releases (build.publish in package.json) for a newer version once at startup (and when the user
 * clicks "Check for updates"). Nothing is downloaded or installed automatically: only when the user clicks
 * "Update" in the settings, the update is downloaded and then installed right away (the app restarts).
 *
 * Only active in the installed app. ANIMESHELF_UPDATE_URL switches to a generic feed (a folder with latest.yml
 * and the installer) to test checking/downloading locally; installing is blocked then.
 */
export function setupAutoUpdater(getWindow: () => BrowserWindow | null, options: { enabled: boolean }) {
  let status: UpdateStatus = options.enabled ? { state: 'idle' } : { state: 'disabled' };
  const isTestFeed = !!process.env.ANIMESHELF_UPDATE_URL;

  const setStatus = (next: UpdateStatus) => {
    status = next;
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send('update:status', status);
  };

  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('update:getStatus', () => status);
  ipcMain.handle('update:check', async () => {
    if (status.state !== 'disabled') await check();
    return status;
  });
  ipcMain.handle('update:install', async () => {
    if (status.state !== 'available') return;
    mainLogger.info('Downloading update on user request.', { version: status.version });
    setStatus({ state: 'downloading', version: status.version, percent: 0 });
    try {
      await autoUpdater.downloadUpdate();
    } catch {
      // Reported through the 'error' event.
    }
  });

  if (!options.enabled) {
    mainLogger.info('Auto-update disabled (development or test run).');
    return;
  }

  autoUpdater.logger = mainLogger;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  if (isTestFeed) {
    autoUpdater.setFeedURL({ provider: 'generic', url: process.env.ANIMESHELF_UPDATE_URL! });
    mainLogger.warn('Using custom update feed; installing is disabled.', { feedUrl: process.env.ANIMESHELF_UPDATE_URL });
  }

  autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking' }));
  autoUpdater.on('update-not-available', () => setStatus({ state: 'not-available' }));
  autoUpdater.on('update-available', info => setStatus({ state: 'available', version: info.version }));
  autoUpdater.on('download-progress', progress => {
    const version = status.state === 'downloading' ? status.version : '';
    setStatus({ state: 'downloading', version, percent: Math.round(progress.percent) });
  });
  autoUpdater.on('update-downloaded', info => {
    // A test feed must never install anything: the NSIS installer would replace the user's real installation.
    if (isTestFeed) {
      mainLogger.warn('Update downloaded from test feed; install skipped.', { version: info.version });
      setStatus({ state: 'installing', version: info.version });
      return;
    }
    mainLogger.info('Update downloaded, installing.', { version: info.version });
    setStatus({ state: 'installing', version: info.version });
    // Silent NSIS install, then start the new version.
    autoUpdater.quitAndInstall(true, true);
  });
  autoUpdater.on('error', error => {
    // Offline or GitHub not reachable: only shown in the settings, the next start tries again.
    mainLogger.warn('Auto-update failed.', { error: error.message });
    setStatus({ state: 'error', message: error.message });
  });

  async function check() {
    if (status.state === 'checking' || status.state === 'downloading' || status.state === 'installing') return;
    try {
      await autoUpdater.checkForUpdates();
    } catch {
      // Already reported through the 'error' event.
    }
  }

  void check();
}
