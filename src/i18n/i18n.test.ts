import { describe, expect, it } from 'vitest';
import { createTranslator, type MessageKey } from './I18nContext';
import { normalizeLanguage } from './config';
import { relationLabel, seasonLabel, statusLabel, typeLabel } from './labels';
import { en } from './messages/en';
import { de } from './messages/de';

type Leaf = string | { one: string; other: string };

/** All leaf entries keyed "a.b.c"; plural objects ({ one, other }) count as one leaf. */
function leaves(node: unknown, prefix = ''): Map<string, Leaf> {
  const result = new Map<string, Leaf>();
  const record = node as Record<string, unknown>;
  if (typeof node === 'string' || ('one' in record && 'other' in record)) {
    result.set(prefix, node as Leaf);
    return result;
  }
  for (const [key, value] of Object.entries(record)) {
    for (const [leafKey, leaf] of leaves(value, prefix ? `${prefix}.${key}` : key)) result.set(leafKey, leaf);
  }
  return result;
}

const texts = (leaf: Leaf) => (typeof leaf === 'string' ? [leaf] : [leaf.one, leaf.other]);
const placeholders = (leaf: Leaf) => [...new Set(texts(leaf).join(' ').match(/\{\w+\}/g) ?? [])].sort().join();

describe('message catalogs', () => {
  const enLeaves = leaves(en);
  const deLeaves = leaves(de);

  it('German has exactly the English keys', () => {
    expect([...deLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort());
  });

  it('German uses the same placeholders as English', () => {
    const mismatches = [...enLeaves].filter(([key, leaf]) => placeholders(leaf) !== placeholders(deLeaves.get(key)!)).map(([key]) => key);
    expect(mismatches).toEqual([]);
  });

  it('has no empty texts', () => {
    const empty = (catalog: Map<string, Leaf>) => [...catalog].filter(([, leaf]) => texts(leaf).some(text => !text.trim())).map(([key]) => key);
    expect(empty(enLeaves)).toEqual([]);
    expect(empty(deLeaves)).toEqual([]);
  });
});

describe('createTranslator', () => {
  const tEn = createTranslator('en');
  const tDe = createTranslator('de');

  it('falls back to the key for unknown keys', () => {
    expect(tEn('does.not.exist' as MessageKey)).toBe('does.not.exist');
  });

  it('replaces placeholders and keeps unknown ones', () => {
    expect(tEn('preview.hiddenToastDescription', { title: 'Frieren' })).toContain('"Frieren"');
    expect(tEn('preview.hiddenToastDescription')).toContain('{title}');
  });

  it('chooses plural forms by count', () => {
    expect(tEn('common.episodes', { count: 1 })).toBe('1 episode');
    expect(tEn('common.episodes', { count: 12 })).toBe('12 episodes');
    expect(tDe('common.episodes', { count: 1 })).not.toBe(tDe('common.episodes', { count: 2 }).replace('2', '1'));
  });
});

describe('normalizeLanguage', () => {
  it.each([
    ['de', 'de'],
    ['en', 'en'],
    ['fr', 'en'],
    [null, 'en'],
    [undefined, 'en'],
    ['', 'en'],
  ])('%j -> %s', (input, expected) => {
    expect(normalizeLanguage(input)).toBe(expected);
  });
});

describe('labels', () => {
  const tDe = createTranslator('de');
  const tEn = createTranslator('en');

  it('translates stored status values', () => {
    expect(statusLabel(tEn, 'plan_to_watch')).not.toBe('plan_to_watch');
    expect(statusLabel(tDe, 'completed')).not.toBe(statusLabel(tEn, 'completed'));
  });

  it('falls back to "unknown" for empty values', () => {
    expect(statusLabel(tDe, null)).toBe(tDe('common.unknown'));
    expect(typeLabel(tEn, '')).toBe(tEn('common.unknown'));
  });

  it('shows unknown option values unchanged', () => {
    expect(typeLabel(tDe, 'Some New Type')).toBe('Some New Type');
  });

  it('ignores the case of seasons', () => {
    expect(seasonLabel(tDe, 'Winter')).toBe(seasonLabel(tDe, 'winter'));
  });

  it('handles relation name variants and unknown relations', () => {
    expect(relationLabel(tDe, 'Side Story')).toBe(relationLabel(tDe, 'Side story'));
    expect(relationLabel(tDe, 'Mystery Relation')).toBe('Mystery Relation');
  });
});
