import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseTooNewError, MIGRATIONS, migrate, type Migration } from './migrations';

let dir: string;
let dbPath: string;
const open: Database.Database[] = [];

const openDb = () => {
  const db = new Database(dbPath);
  open.push(db);
  return db;
};
const version = (db: Database.Database) => db.pragma('user_version', { simple: true });
const tables = (db: Database.Database) =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map(t => t.name);

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'animeshelf-migrations-'));
  dbPath = path.join(dir, 'animeshelf.sqlite3');
});

afterEach(() => {
  open.splice(0).forEach(db => db.close());
  rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
});

describe('migrate', () => {
  it('creates the schema in a new database without a backup', () => {
    const db = openDb();
    expect(migrate(db, dbPath)).toEqual({ from: 0, to: 1, backupPath: undefined });
    expect(version(db)).toBe(1);
    expect(tables(db)).toEqual(['anime_shelf', 'episode_watch_history', 'ignored_preview_mal_ids', 'secrets', 'user_profile']);
    expect(existsSync(`${dbPath}.bak-v0`)).toBe(false);
  });

  it('adopts a database of a version before 1.0.0 and keeps its data', () => {
    // Pre-1.0 databases have all tables, but user_version 0.
    const legacy = openDb();
    MIGRATIONS[0].up(legacy);
    legacy.prepare("INSERT INTO anime_shelf (mal_id, title, user_status, current_episode) VALUES (1, 'Kept', 'completed', 12)").run();
    expect(version(legacy)).toBe(0);

    const result = migrate(legacy, dbPath);
    expect(result).toMatchObject({ from: 0, to: 1, backupPath: `${dbPath}.bak-v0` });
    expect(version(legacy)).toBe(1);
    expect(legacy.prepare('SELECT title FROM anime_shelf').all()).toEqual([{ title: 'Kept' }]);

    const backup = new Database(result.backupPath!, { readonly: true });
    open.push(backup);
    expect(backup.prepare('SELECT title FROM anime_shelf').all()).toEqual([{ title: 'Kept' }]);
  });

  it('does nothing when the schema is current', () => {
    const db = openDb();
    migrate(db, dbPath);
    expect(migrate(db, dbPath)).toEqual({ from: 1, to: 1 });
  });

  it('runs only the missing migrations in order', () => {
    const calls: number[] = [];
    const migrations: Migration[] = [
      { version: 1, description: 'one', up: () => calls.push(1) },
      { version: 3, description: 'three', up: db => { calls.push(3); db.exec('CREATE TABLE three (id INTEGER)'); } },
      { version: 2, description: 'two', up: db => { calls.push(2); db.exec('CREATE TABLE two (id INTEGER)'); } },
    ];
    const db = openDb();
    db.pragma('user_version = 1');
    expect(migrate(db, dbPath, migrations)).toMatchObject({ from: 1, to: 3 });
    expect(calls).toEqual([2, 3]);
    expect(version(db)).toBe(3);
  });

  it('rolls a failing migration back completely and keeps the old version', () => {
    const migrations: Migration[] = [
      ...MIGRATIONS,
      { version: 2, description: 'broken', up: db => { db.exec('ALTER TABLE anime_shelf ADD COLUMN notes TEXT'); throw new Error('boom'); } },
    ];
    const db = openDb();
    migrate(db, dbPath);
    expect(() => migrate(db, dbPath, migrations)).toThrow('boom');
    expect(version(db)).toBe(1);
    const columns = (db.prepare('PRAGMA table_info(anime_shelf)').all() as { name: string }[]).map(c => c.name);
    expect(columns).not.toContain('notes');
    expect(existsSync(`${dbPath}.bak-v1`)).toBe(true);
  });

  it('refuses a database from a newer app version', () => {
    const db = openDb();
    db.pragma('user_version = 99');
    expect(() => migrate(db, dbPath)).toThrow(DatabaseTooNewError);
  });
});
