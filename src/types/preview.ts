import type { JikanAnime } from './anime';

/** A related anime found on the preview page (via AniList or Tenrai), keyed by its MAL ID. */
export interface RelatedEntry {
  mal_id: number;
  title: string;
  coverUrl: string | null;
  format: string | null;
  relationType: string;
  relatedTo: string;
  airingStatus: 'airing' | 'upcoming' | 'past';
  season: string | null;
  year: number | null;
  /** Full data when already known (Tenrai season lists); otherwise loaded on demand. */
  details?: JikanAnime;
}
