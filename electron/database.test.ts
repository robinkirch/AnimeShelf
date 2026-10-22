import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserAnime } from '../src/types/anime';

// database.ts stores its file in app.getPath('userData'); point that to a fresh temp directory per test.
const userData = vi.hoisted(() => ({ dir: '' }));
vi.mock('electron', () => ({ app: { getPath: () => userData.dir } }));

let db: typeof import('./database');

const anime = (overrides: Partial<UserAnime> = {}): UserAnime => ({
  mal_id: 52991,
  title: 'Sousou no Frieren',
  cover_image: 'https://example.com/frieren.jpg',
  total_episodes: 28,
  user_status: 'watching',
  current_episode: 3,
  user_rating: null,
  genres: ['Adventure', 'Fantasy'],
  studios: ['Madhouse'],
  type: 'TV',
  year: 2023,
  season: 'fall',
  streaming_platforms: ['Crunchyroll'],
  broadcast_day: 'Fridays',
  duration_minutes: 24,
  ...overrides,
});

beforeEach(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  userData.dir = mkdtempSync(path.join(tmpdir(), 'animeshelf-test-'));
  vi.resetModules();
  db = await import('./database');
  db.initDb();
});

afterEach(() => {
  db.closeDb();
  rmSync(userData.dir, { recursive: true, force: true, maxRetries: 5 });
});

describe('anime shelf', () => {
  it('stores and returns an anime including its JSON lists', () => {
    db.addAnimeToShelf(anime());
    expect(db.getShelf()).toEqual([anime()]);
  });

  it('defaults missing lists to empty arrays', () => {
    db.addAnimeToShelf(anime({ genres: undefined as unknown as string[], streaming_platforms: [] }));
    expect(db.getShelf()[0].genres).toEqual([]);
  });

  it('rejects duplicate MAL IDs', () => {
    db.addAnimeToShelf(anime());
    expect(() => db.addAnimeToShelf(anime())).toThrow(/UNIQUE constraint/);
  });

  it('updates only known columns', () => {
    db.addAnimeToShelf(anime());
    db.updateAnimeOnShelf(52991, { current_episode: 10, user_rating: 9, genres: ['Drama'], ['evil; DROP TABLE anime_shelf' as keyof UserAnime]: 1 } as Partial<UserAnime>);
    const [stored] = db.getShelf();
    expect(stored.current_episode).toBe(10);
    expect(stored.user_rating).toBe(9);
    expect(stored.genres).toEqual(['Drama']);
    expect(stored.title).toBe('Sousou no Frieren');
  });

  it('ignores updates of unknown anime', () => {
    expect(() => db.updateAnimeOnShelf(1, { current_episode: 1 })).not.toThrow();
    expect(db.getShelf()).toEqual([]);
  });

  it('removes the anime together with its watch history', () => {
    db.addAnimeToShelf(anime());
    db.addAnimeToShelf(anime({ mal_id: 1, title: 'Other' }));
    db.addEpisodeWatchEvents([
      { mal_id: 52991, episode_number_watched: 1, watched_at: '2026-10-01T20:00:00.000Z' },
      { mal_id: 1, episode_number_watched: 1, watched_at: '2026-10-02T20:00:00.000Z' },
    ]);
    db.removeAnimeFromShelf(52991);
    expect(db.getShelf().map(a => a.mal_id)).toEqual([1]);
    expect(db.getEpisodeWatchHistory().map(e => e.mal_id)).toEqual([1]);
  });
});

describe('importAnimeBatch', () => {
  it('inserts new and updates existing entries', () => {
    db.addAnimeToShelf(anime({ current_episode: 1 }));
    const result = db.importAnimeBatch([anime({ current_episode: 28, user_status: 'completed' }), anime({ mal_id: 2, title: 'New' })]);
    expect(result).toEqual({ successCount: 2, errors: [] });
    const shelf = db.getShelf();
    expect(shelf.find(a => a.mal_id === 52991)).toMatchObject({ current_episode: 28, user_status: 'completed' });
    expect(shelf.find(a => a.mal_id === 2)?.title).toBe('New');
  });

  it('reports invalid rows and keeps the valid ones', () => {
    const result = db.importAnimeBatch([anime({ mal_id: 3 }), anime({ mal_id: 4, title: null as unknown as string })]);
    expect(result.successCount).toBe(1);
    expect(result.errors).toEqual([expect.objectContaining({ malId: 4 })]);
    expect(db.getShelf().map(a => a.mal_id)).toEqual([3]);
  });
});

describe('ignored preview IDs', () => {
  it('adds each ID once and removes it again', () => {
    db.addIgnoredPreviewMalId(5);
    db.addIgnoredPreviewMalId(5);
    db.addIgnoredPreviewMalId(6);
    expect(db.getIgnoredPreviewMalIds().sort()).toEqual([5, 6]);
    db.removeIgnoredPreviewMalId(5);
    expect(db.getIgnoredPreviewMalIds()).toEqual([6]);
  });
});

describe('user profile', () => {
  it('starts with an empty profile', () => {
    expect(db.getUserProfile()).toEqual({ username: null, profilePictureDataUri: null, profileSetupComplete: false });
  });

  it('updates single fields', () => {
    db.updateUserProfile({ username: 'Robin' });
    db.updateUserProfile({ profileSetupComplete: true });
    expect(db.getUserProfile()).toEqual({ username: 'Robin', profilePictureDataUri: null, profileSetupComplete: true });
  });
});

describe('secrets', () => {
  it('stores, overwrites and deletes binary values', () => {
    expect(db.getSecret('geminiApiKey')).toBeNull();
    db.setSecret('geminiApiKey', Buffer.from([1, 2, 3]));
    db.setSecret('geminiApiKey', Buffer.from([4, 5]));
    expect(db.getSecret('geminiApiKey')).toEqual(Buffer.from([4, 5]));
    db.deleteSecret('geminiApiKey');
    expect(db.getSecret('geminiApiKey')).toBeNull();
  });
});

describe('initDb', () => {
  it('keeps existing data when opened again', async () => {
    db.addAnimeToShelf(anime());
    db.closeDb();
    vi.resetModules();
    db = await import('./database');
    db.initDb();
    expect(db.getShelf()).toHaveLength(1);
  });
});
