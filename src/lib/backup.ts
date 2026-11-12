import { USER_ANIME_STATUS_OPTIONS, type EpisodeWatchEvent, type UserAnime, type UserAnimeStatus } from '@/types/anime';

// Full backup of the user's data as one JSON file (Settings → Data Management → Export).
// Contains the shelf, the episode watch history (used by the monthly watch time chart) and the anime ignored on
// the preview page. Not included: profile, settings and API keys (those are bound to the Windows account).

export const BACKUP_FORMAT = 'animeshelf-backup';
export const BACKUP_VERSION = 1;

export interface IgnoredPreviewEntry {
  mal_id: number;
}

export interface AnimeShelfBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  appVersion: string | null;
  shelf: UserAnime[];
  watchHistory: EpisodeWatchEvent[];
  ignoredPreview: IgnoredPreviewEntry[];
}

export function createBackup(
  data: { shelf: UserAnime[]; watchHistory: EpisodeWatchEvent[]; ignoredPreviewMalIds: number[] },
  appVersion: string | null,
  now: Date = new Date(),
): AnimeShelfBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    appVersion,
    shelf: data.shelf,
    watchHistory: data.watchHistory,
    ignoredPreview: data.ignoredPreviewMalIds.map(mal_id => ({ mal_id })),
  };
}

/** e.g. animeshelf_backup_2026-11-12.json (local date). */
export function backupFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `animeshelf_backup_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export type BackupParseError = 'invalidJson' | 'notABackup' | 'unsupportedVersion';

export interface ParsedBackup {
  backup: AnimeShelfBackup;
  /** Entries that were dropped because they are incomplete or malformed, per section. */
  invalid: { shelf: number; watchHistory: number; ignoredPreview: number };
}

const STATUSES = new Set<string>(USER_ANIME_STATUS_OPTIONS.map(option => option.value));

const isPositiveInt = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;
const intOrNull = (value: unknown) => (Number.isInteger(value) ? (value as number) : null);
const stringOrNull = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value : null);
const stringList = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

function toUserAnime(value: unknown): UserAnime | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!isPositiveInt(v.mal_id) || typeof v.title !== 'string' || !v.title.trim()) return null;
  if (typeof v.user_status !== 'string' || !STATUSES.has(v.user_status)) return null;
  const currentEpisode = Number.isInteger(v.current_episode) && (v.current_episode as number) >= 0 ? (v.current_episode as number) : 0;
  const rating = intOrNull(v.user_rating);
  return {
    mal_id: v.mal_id,
    title: v.title,
    cover_image: typeof v.cover_image === 'string' ? v.cover_image : '',
    total_episodes: intOrNull(v.total_episodes),
    user_status: v.user_status as UserAnimeStatus,
    current_episode: currentEpisode,
    user_rating: rating !== null && rating >= 1 && rating <= 10 ? rating : null,
    genres: stringList(v.genres),
    studios: stringList(v.studios),
    type: stringOrNull(v.type),
    year: intOrNull(v.year),
    season: stringOrNull(v.season),
    streaming_platforms: stringList(v.streaming_platforms),
    broadcast_day: stringOrNull(v.broadcast_day),
    duration_minutes: intOrNull(v.duration_minutes),
  };
}

function toWatchEvent(value: unknown): EpisodeWatchEvent | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!isPositiveInt(v.mal_id) || !isPositiveInt(v.episode_number_watched)) return null;
  if (typeof v.watched_at !== 'string' || Number.isNaN(Date.parse(v.watched_at))) return null;
  return { mal_id: v.mal_id, episode_number_watched: v.episode_number_watched, watched_at: v.watched_at };
}

function toIgnoredEntry(value: unknown): IgnoredPreviewEntry | null {
  const malId = value && typeof value === 'object' ? (value as Record<string, unknown>).mal_id : value;
  return isPositiveInt(malId) ? { mal_id: malId } : null;
}

function validList<T>(list: unknown, convert: (value: unknown) => T | null): { items: T[]; invalid: number } {
  if (!Array.isArray(list)) return { items: [], invalid: 0 };
  const items = list.map(convert).filter((item): item is T => item !== null);
  return { items, invalid: list.length - items.length };
}

/** Reads a backup file. Malformed entries are dropped (and counted) instead of failing the whole import. */
export function parseBackup(text: string): { ok: true; result: ParsedBackup } | { ok: false; error: BackupParseError } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalidJson' };
  }
  if (!data || typeof data !== 'object' || (data as Record<string, unknown>).format !== BACKUP_FORMAT) {
    return { ok: false, error: 'notABackup' };
  }
  const raw = data as Record<string, unknown>;
  if (!Number.isInteger(raw.version) || (raw.version as number) < 1 || (raw.version as number) > BACKUP_VERSION) {
    return { ok: false, error: 'unsupportedVersion' };
  }

  const shelf = validList(raw.shelf, toUserAnime);
  const watchHistory = validList(raw.watchHistory, toWatchEvent);
  const ignoredPreview = validList(raw.ignoredPreview, toIgnoredEntry);
  return {
    ok: true,
    result: {
      backup: {
        format: BACKUP_FORMAT,
        version: raw.version as number,
        exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
        appVersion: stringOrNull(raw.appVersion),
        shelf: shelf.items,
        watchHistory: watchHistory.items,
        ignoredPreview: ignoredPreview.items,
      },
      invalid: { shelf: shelf.invalid, watchHistory: watchHistory.invalid, ignoredPreview: ignoredPreview.invalid },
    },
  };
}
