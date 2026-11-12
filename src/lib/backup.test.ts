import { describe, expect, it } from 'vitest';
import type { UserAnime } from '@/types/anime';
import { BACKUP_FORMAT, backupFileName, createBackup, parseBackup } from './backup';

const anime: UserAnime = {
  mal_id: 52991,
  title: 'Sousou no Frieren',
  cover_image: 'https://example.com/cover.jpg',
  total_episodes: 28,
  user_status: 'completed',
  current_episode: 28,
  user_rating: 10,
  genres: ['Adventure', 'Fantasy'],
  studios: ['Madhouse'],
  type: 'TV',
  year: 2023,
  season: 'fall',
  streaming_platforms: ['Crunchyroll'],
  broadcast_day: 'Fridays',
  duration_minutes: 24,
};
const event = { mal_id: 52991, episode_number_watched: 1, watched_at: '2026-10-01T20:00:00.000Z' };

describe('createBackup / parseBackup', () => {
  it('round-trips all three data sets', () => {
    const backup = createBackup({ shelf: [anime], watchHistory: [event], ignoredPreviewMalIds: [5, 6] }, '1.0.1', new Date('2026-11-12T10:00:00Z'));
    expect(backup).toMatchObject({ format: BACKUP_FORMAT, version: 1, exportedAt: '2026-11-12T10:00:00.000Z', appVersion: '1.0.1' });
    expect(backup.ignoredPreview).toEqual([{ mal_id: 5 }, { mal_id: 6 }]);

    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.result.backup).toEqual(backup);
    expect(parsed.result.invalid).toEqual({ shelf: 0, watchHistory: 0, ignoredPreview: 0 });
  });

  it.each([
    ['not json', 'invalidJson'],
    ['{"shelf": []}', 'notABackup'],
    ['[1,2]', 'notABackup'],
    [JSON.stringify({ format: BACKUP_FORMAT, version: 99 }), 'unsupportedVersion'],
    [JSON.stringify({ format: BACKUP_FORMAT }), 'unsupportedVersion'],
  ])('rejects %s (%s)', (text, error) => {
    expect(parseBackup(text)).toEqual({ ok: false, error });
  });

  it('drops malformed entries and counts them', () => {
    const parsed = parseBackup(JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      shelf: [anime, { ...anime, mal_id: 0 }, { ...anime, user_status: 'binge' }, { mal_id: 2 }, null],
      watchHistory: [event, { ...event, watched_at: 'yesterday' }, { ...event, episode_number_watched: 0 }],
      ignoredPreview: [{ mal_id: 7 }, 8, { mal_id: 'x' }],
    }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.result.backup.shelf).toEqual([anime]);
    expect(parsed.result.backup.watchHistory).toEqual([event]);
    expect(parsed.result.backup.ignoredPreview).toEqual([{ mal_id: 7 }, { mal_id: 8 }]);
    expect(parsed.result.invalid).toEqual({ shelf: 4, watchHistory: 2, ignoredPreview: 1 });
  });

  it('fills missing optional shelf fields with defaults', () => {
    const parsed = parseBackup(JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      shelf: [{ mal_id: 1, title: 'Minimal', user_status: 'plan_to_watch', user_rating: 42 }],
    }));
    expect(parsed.ok && parsed.result.backup.shelf[0]).toEqual({
      mal_id: 1, title: 'Minimal', cover_image: '', total_episodes: null, user_status: 'plan_to_watch', current_episode: 0,
      user_rating: null, genres: [], studios: [], type: null, year: null, season: null, streaming_platforms: [],
      broadcast_day: null, duration_minutes: null,
    });
  });

  it('treats missing sections as empty', () => {
    const parsed = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1 }));
    expect(parsed.ok && parsed.result.backup).toMatchObject({ shelf: [], watchHistory: [], ignoredPreview: [] });
  });
});

describe('backupFileName', () => {
  it('uses the local date', () => {
    expect(backupFileName(new Date(2026, 10, 2, 23, 30))).toBe('animeshelf_backup_2026-11-02.json');
  });
});
