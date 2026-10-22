import { renameSync, rmSync } from 'node:fs';
import type Database from 'better-sqlite3';

// Database schema versions, stored in SQLite's `PRAGMA user_version`.
// Never edit a migration that has been released; add a new one with the next version number instead.
// Each migration runs in a transaction together with the version update, so it is applied completely or not at all.

export interface Migration {
  version: number;
  description: string;
  up: (db: Database.Database) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    // Schema of all versions before 1.0.0 (they had no user_version, i.e. 0). IF NOT EXISTS keeps existing data.
    version: 1,
    description: 'Initial schema',
    up: db => db.exec(`
      CREATE TABLE IF NOT EXISTS anime_shelf (
        mal_id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        cover_image TEXT,
        total_episodes INTEGER,
        user_status TEXT NOT NULL,
        current_episode INTEGER NOT NULL DEFAULT 0,
        user_rating INTEGER,
        genres TEXT,
        studios TEXT,
        type TEXT,
        year INTEGER,
        season TEXT,
        streaming_platforms TEXT,
        broadcast_day TEXT,
        duration_minutes INTEGER
      );

      CREATE TABLE IF NOT EXISTS episode_watch_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mal_id INTEGER NOT NULL,
        episode_number_watched INTEGER NOT NULL,
        watched_at TEXT NOT NULL,
        FOREIGN KEY (mal_id) REFERENCES anime_shelf(mal_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ignored_preview_mal_ids (
        mal_id INTEGER PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY DEFAULT 1, -- Ensures only one row for profile
        username TEXT,
        profile_picture_data_uri TEXT,
        profile_setup_complete INTEGER DEFAULT 0 -- 0 for false, 1 for true
      );

      -- Values encrypted with Electron safeStorage (OS keychain / DPAPI), e.g. AI API keys.
      CREATE TABLE IF NOT EXISTS secrets (
        name TEXT PRIMARY KEY,
        value BLOB NOT NULL
      );
    `),
  },
];

/** Thrown when the database was written by a newer app version (after a downgrade). */
export class DatabaseTooNewError extends Error {
  constructor(public dbVersion: number, public appVersion: number) {
    super(`The database has schema version ${dbVersion}, but this app only supports up to ${appVersion}. Please install the latest AnimeShelf version.`);
    this.name = 'DatabaseTooNewError';
  }
}

export interface MigrationResult {
  from: number;
  to: number;
  /** Copy of the database taken before migrating existing data. */
  backupPath?: string;
}

/**
 * Brings the database to the latest schema version. Before existing data is migrated, a copy is written to
 * `<dbPath>.bak-v<from>` (overwritten by the next migration from the same version).
 */
export function migrate(db: Database.Database, dbPath: string | null, migrations: Migration[] = MIGRATIONS): MigrationResult {
  const target = Math.max(0, ...migrations.map(m => m.version));
  const from = db.pragma('user_version', { simple: true }) as number;
  if (from > target) throw new DatabaseTooNewError(from, target);
  if (from === target) return { from, to: from };

  let backupPath: string | undefined;
  const hasData = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' LIMIT 1").get() !== undefined;
  if (dbPath && hasData) {
    backupPath = `${dbPath}.bak-v${from}`;
    // VACUUM INTO refuses to overwrite a file, so write to a temp file and replace an older backup with it.
    const tempPath = `${backupPath}.tmp`;
    rmSync(tempPath, { force: true });
    db.prepare('VACUUM INTO ?').run(tempPath);
    rmSync(backupPath, { force: true });
    renameSync(tempPath, backupPath);
  }

  for (const migration of migrations.filter(m => m.version > from).sort((a, b) => a.version - b.version)) {
    db.transaction(() => {
      migration.up(db);
      db.pragma(`user_version = ${migration.version}`);
    })();
  }
  return { from, to: target, backupPath };
}

