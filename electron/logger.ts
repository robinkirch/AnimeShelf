
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

// Read app version from package.json
// Note: In a packaged app, package.json might not be easily accessible this way.
// Consider alternative methods for packaged apps if this fails, e.g., embedding version during build.
let appVersion = 'unknown';
try {
  const packageJsonPath = path.join(app.getAppPath(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    appVersion = packageJson.version || 'unknown';
  } else {
     // Fallback for development when app.getAppPath() might be different
     const devPackageJsonPath = path.join(__dirname, '..', 'package.json');
     if (fs.existsSync(devPackageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(devPackageJsonPath, 'utf-8'));
        appVersion = packageJson.version || 'unknown';
     }
  }
} catch (error) {
  console.error('Failed to read app version from package.json for logging:', error);
}


const isDevelopment = process.env.NODE_ENV === 'development' || !app.isPackaged;

const logDirectory = isDevelopment
  ? path.join(app.getAppPath(), '..', 'logs') // Project root /logs in dev
  : path.join(app.getPath('userData'), 'logs'); // App data logs in prod

// Ensure log directory exists
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

const logLevel = process.env.LOG_LEVEL || 'info';

const { combine, timestamp, json, printf, errors } = winston.format;

// Custom format to ensure metadata is included nicely in JSON
const customFormat = combine(
  errors({ stack: true }), // Log stack traces for errors
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  json(), // Outputs log in JSON format
  // Example of a custom printf if you wanted human-readable console output AND JSON file output.
  // For JSON only, the json() formatter is sufficient for files.
  // printf(({ level, message, timestamp, category, processType, stack, ...metadata }) => {
  //   let log = `${timestamp} [${processType || 'main'}] [${category || 'general'}] ${level}: ${message}`;
  //   if (stack) {
  //     log += `\n${stack}`;
  //   } else if (Object.keys(metadata).length) {
  //     // Only append metadata if it's not an error stack and metadata exists
  //     try {
  //       const metadataString = JSON.stringify(metadata, null, 2);
  //       if (metadataString !== '{}') {
  //         log += `\n${metadataString}`;
  //       }
  //     } catch (e) {
  //       //
  //     }
  //   }
  //   return log;
  // })
);


const transports: winston.transport[] = [];

// File transport for all logs (main and renderer through IPC)
const fileTransport = new DailyRotateFile({
  filename: path.join(logDirectory, 'anime-shelf-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '10m', // 10MB
  maxFiles: '30d', // Keep logs for 30 days
  level: logLevel,
  format: customFormat, // JSON format for files
});
transports.push(fileTransport);

// Console transport (only in development)
if (isDevelopment) {
  transports.push(
    new winston.transports.Console({
      level: logLevel,
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.colorize(),
        printf(({ level, message, timestamp, category, processType, stack, ...metadata }) => {
          let log = `${timestamp} [${processType || 'main'}] [${category || 'general'}] ${level}: ${message}`;
          if (stack) {
            log += `\n${stack}`;
          } else if (Object.keys(metadata).length && JSON.stringify(metadata) !== '{}') {
             // Only append metadata if it's not an error stack and metadata is not empty
            try {
              log += ` ${JSON.stringify(metadata, (key, value) => 
                typeof value === 'bigint' ? value.toString() : value // BigInt serialization
              )}`;
            } catch (e) { /* ignore serialization errors for console */ }
          }
          return log;
        })
      ),
    })
  );
}

const logger = winston.createLogger({
  level: logLevel,
  format: customFormat, // Default format for the logger itself
  defaultMeta: { appVersion, processType: 'main' }, // Default metadata for all logs from this logger
  transports: transports,
});

export const mainLogger = logger;

// Wrapper for renderer logs to add processType
export function logFromRenderer(level: string, category: string, message: string, metadata?: any) {
  mainLogger.child({ processType: 'renderer', category }).log(level, message, metadata);
}

mainLogger.info(`Logger initialized. Level: ${logLevel}. Log directory: ${logDirectory}. App Version: ${appVersion}. DevMode: ${isDevelopment}`);

// Handle uncaught exceptions for the main process
process.on('uncaughtException', (error) => {
  mainLogger.error('Uncaught Main Process Exception:', { errorName: error.name, errorMessage: error.message, stack: error.stack });
  // Optionally, exit or attempt recovery
  // app.quit(); // Example: quit on unhandled error
});

process.on('unhandledRejection', (reason, promise) => {
  mainLogger.error('Unhandled Main Process Rejection:', { reason, promise });
});
