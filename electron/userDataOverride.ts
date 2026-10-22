import path from 'path';
import { app } from 'electron';

// Imported first in main.ts: ES modules run in import order, so this must happen before logger.ts and database.ts
// read app.getPath('userData').
//
// Tests start the app with their own data folder (database, cookies, localStorage, logs in the installed app), so the
// user's real data is never touched. Without it the app uses %APPDATA%\nextn (from the package name "nextn"),
// both in development and in the installed app.
const userDataOverride = process.env.ANIMESHELF_USER_DATA;
if (userDataOverride) {
  app.setPath('userData', path.resolve(userDataOverride));
  app.setPath('sessionData', path.resolve(userDataOverride));
}
