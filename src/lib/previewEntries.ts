import type { AniListRelationEdge } from '@/lib/anilistApi';
import type { JikanAnime, UserAnime } from '@/types/anime';
import type { RelatedEntry } from '@/types/preview';

// Pure helpers for the preview (related anime) logic in PreviewContext.

// Music videos, promotional videos and commercials are not interesting as continuations.
export const IGNORED_TYPES_PREVIEW = ['Music', 'PV', 'CM'];
// Tenrai (MAL) relation names, compared case-insensitively ('Side Story' vs. older 'Side story').
export const TENRAI_RELEVANT_RELATIONS = new Set(['sequel', 'prequel', 'alternative setting', 'alternative version', 'other', 'side story', 'full story', 'parent story']);
// AniList relation types mapped to the same set. CHARACTER, ADAPTATION, SPIN_OFF, SUMMARY etc. are ignored.
const ANILIST_RELATION_LABELS: Record<string, string> = {
  SEQUEL: 'Sequel',
  PREQUEL: 'Prequel',
  SIDE_STORY: 'Side Story',
  ALTERNATIVE: 'Alternative',
  PARENT: 'Parent Story',
  OTHER: 'Other',
};
const ANILIST_FORMAT_LABELS: Record<string, string> = {
  TV: 'TV', TV_SHORT: 'TV', MOVIE: 'Movie', SPECIAL: 'Special', OVA: 'OVA', ONA: 'ONA', MUSIC: 'Music',
};
const SEASON_ORDER = ['winter', 'spring', 'summer', 'fall'];

// Only these shelf entries are checked for continuations: completed ones the user liked (rated > 5)
// or never rated, plus everything currently watched or planned.
export const isPreviewCandidate = (anime: UserAnime): boolean =>
  (anime.user_status === 'completed' && (anime.user_rating === null || anime.user_rating > 5)) ||
  anime.user_status === 'watching' ||
  anime.user_status === 'plan_to_watch';

export const isIgnoredType = (type: string | null | undefined) => !!type && IGNORED_TYPES_PREVIEW.includes(type);

// Airing now first, then upcoming by date; announced entries without a date (TBA) last.
export const sortCurrentUpcoming = (list: RelatedEntry[]) =>
  [...list].sort((a, b) => {
    if (a.airingStatus !== b.airingStatus) return a.airingStatus === 'airing' ? -1 : 1;
    const yearA = a.year ?? Infinity;
    const yearB = b.year ?? Infinity;
    if (yearA !== yearB) return yearA - yearB;
    const seasonA = a.season ? SEASON_ORDER.indexOf(a.season) : Infinity;
    const seasonB = b.season ? SEASON_ORDER.indexOf(b.season) : Infinity;
    return seasonA - seasonB || a.title.localeCompare(b.title);
  });

// Grouped by the shelf anime they belong to, so a franchise's entries stay together.
export const sortPast = (list: RelatedEntry[]) =>
  [...list].sort((a, b) => a.relatedTo.localeCompare(b.relatedTo) || a.title.localeCompare(b.title));

/** Converts an AniList relation edge; entries without MAL ID, other relation types or ignored formats are dropped. */
export function relatedEntryFromAniList(edge: AniListRelationEdge, relatedTo: string): RelatedEntry | null {
  const relationType = ANILIST_RELATION_LABELS[edge.relationType];
  const node = edge.node;
  if (!relationType || node.type !== 'ANIME' || node.idMal === null) return null;
  const format = node.format ? ANILIST_FORMAT_LABELS[node.format] ?? node.format : null;
  if (isIgnoredType(format)) return null;

  let airingStatus: RelatedEntry['airingStatus'];
  switch (node.status) {
    case 'NOT_YET_RELEASED': airingStatus = 'upcoming'; break;
    case 'RELEASING':
    case 'HIATUS': airingStatus = 'airing'; break;
    case 'FINISHED': airingStatus = 'past'; break;
    default: return null; // cancelled or unknown
  }

  return {
    mal_id: node.idMal,
    title: node.title.romaji ?? node.title.english ?? `MAL #${node.idMal}`,
    coverUrl: node.coverImage.large,
    format,
    relationType,
    relatedTo,
    airingStatus,
    season: node.season?.toLowerCase() ?? null,
    year: node.seasonYear ?? node.startDate.year ?? null,
  };
}

export function relatedEntryFromSeasonList(anime: JikanAnime, airingStatus: 'airing' | 'upcoming', relationType: string, relatedTo: string): RelatedEntry {
  return {
    mal_id: anime.mal_id,
    title: anime.title,
    coverUrl: anime.images.webp?.large_image_url || anime.images.jpg.large_image_url || anime.images.jpg.image_url,
    format: anime.type ?? null,
    relationType,
    relatedTo,
    airingStatus,
    season: anime.season?.toLowerCase() ?? null,
    year: anime.year ?? null,
    details: anime,
  };
}
