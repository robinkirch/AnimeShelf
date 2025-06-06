
// Renderer process logger utility
// This is a basic wrapper to send logs to the main process via IPC.

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogOptions {
  category?: string;
  [key: string]: any; // For additional metadata
}

const log = (level: LogLevel, message: string, options?: LogOptions): void => {
  const { category = 'renderer-general', ...metadata } = options || {};
  if (typeof window !== 'undefined' && window.electronStore && window.electronStore.logToMain) {
    window.electronStore.logToMain(level, category, message, metadata);
  } else {
    // Fallback to console if electronStore is not available (e.g., during SSR or if preload fails)
    const timestamp = new Date().toISOString();
    console[level === 'debug' ? 'log' : level](`${timestamp} [${category}] ${level.toUpperCase()}: ${message}`, metadata || '');
  }
};

export const rendererLogger = {
  error: (message: string, options?: LogOptions) => log('error', message, options),
  warn: (message: string, options?: LogOptions) => log('warn', message, options),
  info: (message: string, options?: LogOptions) => log('info', message, options),
  debug: (message: string, options?: LogOptions) => log('debug', message, options),
};

// Example of a more specific logger if needed:
// export const jikanApiLogger = {
//   info: (message: string, metadata?: any) => log('info', message, { category: 'jikan-api', ...metadata }),
//   error: (message: string, metadata?: any) => log('error', message, { category: 'jikan-api', ...metadata }),
// };
