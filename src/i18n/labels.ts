import type { MessageKey, TranslateFn } from './I18nContext';

// Translated labels for option values stored in the data (status, rating, type, broadcast day, season).
// Unknown values (e.g. a MyAnimeList type the app has no label for) are shown as they are.

function translateKey(t: TranslateFn, prefix: string, value: string | number | null | undefined, fallback: string): string {
  if (value === null || value === undefined || value === '') return fallback;
  const key = `${prefix}.${value}` as MessageKey;
  const label = t(key);
  return label === key ? String(value) : label;
}

const translateOption = (t: TranslateFn, group: string, value: string | number | null | undefined, fallback: string) =>
  translateKey(t, `options.${group}`, value, fallback);

/** Relation names from AniList/MAL ("Side Story", "Side story", "Alternative version", ...). */
export const relationLabel = (t: TranslateFn, relation: string) => {
  const normalized = relation.toLowerCase().replace(/\s+/g, '_');
  const label = translateKey(t, 'relationTypes', normalized, relation);
  // Unknown relation names come back as the normalized key; show the original name instead.
  return label === normalized ? relation : label;
};

export const statusLabel = (t: TranslateFn, status: string | null | undefined) =>
  translateOption(t, 'status', status, t('common.unknown'));

export const ratingLabel = (t: TranslateFn, rating: number | null | undefined) =>
  translateOption(t, 'rating', rating, t('common.unknown'));

export const typeLabel = (t: TranslateFn, type: string | null | undefined) =>
  translateOption(t, 'type', type, t('common.unknown'));

export const broadcastDayLabel = (t: TranslateFn, day: string | null | undefined) =>
  translateOption(t, 'broadcastDay', day, t('common.unknown'));

export const seasonLabel = (t: TranslateFn, season: string | null | undefined) =>
  translateOption(t, 'season', season?.toLowerCase(), t('common.unknown'));
