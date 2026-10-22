/** State of the auto-updater, sent from the Electron main process to the UI (IPC `update:status`). */
export type UpdateStatus =
  /** Updates are only checked in the installed app (not in development or tests). */
  | { state: 'disabled' }
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'not-available' }
  /** A newer version exists; nothing is downloaded until the user clicks "Update" in the settings. */
  | { state: 'available'; version: string }
  | { state: 'downloading'; version: string; percent: number }
  /** Downloaded; the app quits and the installer runs. */
  | { state: 'installing'; version: string }
  | { state: 'error'; message: string };
