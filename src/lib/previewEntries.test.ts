import { describe, expect, it } from 'vitest';
import type { AniListRelationEdge, AniListRelatedNode } from './anilistApi';
import type { UserAnime } from '@/types/anime';
import type { RelatedEntry } from '@/types/preview';
import { isPreviewCandidate, relatedEntryFromAniList, sortCurrentUpcoming, sortPast } from './previewEntries';

const shelfAnime = (overrides: Partial<UserAnime>): UserAnime => ({
  mal_id: 1,
  title: 'Test',
  cover_image: '',
  total_episodes: 12,
  user_status: 'completed',
  current_episode: 12,
  user_rating: null,
  genres: [],
  studios: [],
  type: 'TV',
  year: 2024,
  season: 'winter',
  streaming_platforms: [],
  broadcast_day: null,
  duration_minutes: 24,
  ...overrides,
});

describe('isPreviewCandidate', () => {
  it.each<[Partial<UserAnime>, boolean]>([
    [{ user_status: 'completed', user_rating: null }, true],
    [{ user_status: 'completed', user_rating: 6 }, true],
    [{ user_status: 'completed', user_rating: 5 }, false],
    [{ user_status: 'completed', user_rating: 1 }, false],
    [{ user_status: 'watching', user_rating: 1 }, true],
    [{ user_status: 'plan_to_watch' }, true],
    [{ user_status: 'on_hold' }, false],
    [{ user_status: 'dropped' }, false],
  ])('%j -> %s', (overrides, expected) => {
    expect(isPreviewCandidate(shelfAnime(overrides))).toBe(expected);
  });
});

const node = (overrides: Partial<AniListRelatedNode>): AniListRelatedNode => ({
  idMal: 100,
  type: 'ANIME',
  format: 'TV',
  status: 'FINISHED',
  season: 'FALL',
  seasonYear: 2025,
  startDate: { year: 2025, month: 10, day: 1 },
  title: { romaji: 'Romaji Title', english: 'English Title' },
  coverImage: { large: 'https://s4.anilist.co/cover.jpg' },
  ...overrides,
});
const edge = (relationType: string, nodeOverrides: Partial<AniListRelatedNode> = {}): AniListRelationEdge =>
  ({ relationType, node: node(nodeOverrides) }) as AniListRelationEdge;

describe('relatedEntryFromAniList', () => {
  it('converts a sequel', () => {
    expect(relatedEntryFromAniList(edge('SEQUEL'), 'Shelf Anime')).toEqual({
      mal_id: 100,
      title: 'Romaji Title',
      coverUrl: 'https://s4.anilist.co/cover.jpg',
      format: 'TV',
      relationType: 'Sequel',
      relatedTo: 'Shelf Anime',
      airingStatus: 'past',
      season: 'fall',
      year: 2025,
    });
  });

  it.each([
    ['NOT_YET_RELEASED', 'upcoming'],
    ['RELEASING', 'airing'],
    ['HIATUS', 'airing'],
    ['FINISHED', 'past'],
  ] as const)('maps status %s to %s', (status, airingStatus) => {
    expect(relatedEntryFromAniList(edge('SEQUEL', { status }), 'x')?.airingStatus).toBe(airingStatus);
  });

  it('drops entries without MAL ID, cancelled ones, manga, music and irrelevant relations', () => {
    expect(relatedEntryFromAniList(edge('SEQUEL', { idMal: null }), 'x')).toBeNull();
    expect(relatedEntryFromAniList(edge('SEQUEL', { status: 'CANCELLED' }), 'x')).toBeNull();
    expect(relatedEntryFromAniList(edge('SEQUEL', { type: 'MANGA' }), 'x')).toBeNull();
    expect(relatedEntryFromAniList(edge('SEQUEL', { format: 'MUSIC' }), 'x')).toBeNull();
    expect(relatedEntryFromAniList(edge('ADAPTATION'), 'x')).toBeNull();
    expect(relatedEntryFromAniList(edge('CHARACTER'), 'x')).toBeNull();
  });

  it('falls back to the English title and the start year', () => {
    const entry = relatedEntryFromAniList(edge('PREQUEL', { title: { romaji: null, english: 'English Title' }, seasonYear: null, startDate: { year: 2019, month: null, day: null } }), 'x');
    expect(entry?.title).toBe('English Title');
    expect(entry?.year).toBe(2019);
  });
});

const related = (overrides: Partial<RelatedEntry>): RelatedEntry => ({
  mal_id: 1, title: 'A', coverUrl: null, format: 'TV', relationType: 'Sequel', relatedTo: 'X',
  airingStatus: 'upcoming', season: null, year: null,
  ...overrides,
});

describe('sorting', () => {
  it('puts airing first, then upcoming by year and season, TBA last', () => {
    const list = [
      related({ title: 'TBA', airingStatus: 'upcoming' }),
      related({ title: 'Fall 26', year: 2026, season: 'fall' }),
      related({ title: 'Airing', airingStatus: 'airing', year: 2026, season: 'fall' }),
      related({ title: 'Spring 26', year: 2026, season: 'spring' }),
      related({ title: 'Winter 27', year: 2027, season: 'winter' }),
    ];
    expect(sortCurrentUpcoming(list).map(e => e.title)).toEqual(['Airing', 'Spring 26', 'Fall 26', 'Winter 27', 'TBA']);
  });

  it('groups past entries by the shelf anime, then title', () => {
    const list = [
      related({ title: 'B', relatedTo: 'Two' }),
      related({ title: 'Z', relatedTo: 'One' }),
      related({ title: 'A', relatedTo: 'Two' }),
    ];
    expect(sortPast(list).map(e => `${e.relatedTo}/${e.title}`)).toEqual(['One/Z', 'Two/A', 'Two/B']);
  });

  it('does not mutate the input', () => {
    const list = [related({ title: 'B' }), related({ title: 'A' })];
    sortPast(list);
    expect(list.map(e => e.title)).toEqual(['B', 'A']);
  });
});
