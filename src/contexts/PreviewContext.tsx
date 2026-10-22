"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { jikanApi, isAbortError } from '@/lib/jikanApi';
import { anilistApi } from '@/lib/anilistApi';
import type { JikanAnime, JikanAnimeRelation } from '@/types/anime';
import type { RelatedEntry } from '@/types/preview';
import {
  TENRAI_RELEVANT_RELATIONS, isPreviewCandidate, isIgnoredType, sortCurrentUpcoming, sortPast,
  relatedEntryFromAniList, relatedEntryFromSeasonList,
} from '@/lib/previewEntries';

/*
 * Finds related anime (sequels, prequels, side stories, ...) for the shelf. Runs globally in the background
 * from app start, independent of the current page; the preview page and the header badge only display it.
 *
 * 1) AniList: relations of all candidates in batches of 50 (~8 s) -> shown immediately.
 * 2) Current & upcoming entries are upgraded automatically with full Tenrai data (season lists, rest one by one).
 * 3) Tenrai cross-check (season lists + relations per candidate, minutes): new entries are only shown after
 *    the user clicks "Update" on the preview page.
 */

// Shelf changes that alter the candidates (e.g. "Add Entire Series") are collected before a new run starts.
const RESTART_DEBOUNCE_MS = 1000;

type SeasonListMap = Map<number, { anime: JikanAnime; airingStatus: 'airing' | 'upcoming' }>;

export type PrimaryState = { status: 'loading' | 'done' | 'error'; doneBatches: number; totalBatches: number };
export type TenraiState = {
  status: 'seasons' | 'running' | 'done' | 'applied' | 'error';
  checked: number;
  total: number;
  newCount: number;
  upgradeCount: number;
  failedCount: number;
};

interface PreviewContextType {
  /** Visible entries (not on the shelf, not ignored), sorted per section. */
  currentUpcoming: RelatedEntry[];
  past: RelatedEntry[];
  airingCount: number;
  primary: PrimaryState;
  tenrai: TenraiState;
  enrichProgress: { done: number; total: number } | null;
  applyTenraiResults: () => void;
  retry: () => void;
}

const PreviewContext = createContext<PreviewContextType | undefined>(undefined);

export const PreviewProvider = ({ children }: { children: ReactNode }) => {
  const { shelf, isInitialized: shelfInitialized, ignoredPreviewAnimeMalIds, ignoredPreviewAnimeMalIdsInitialized } = useAnimeShelf();

  const [retryToken, setRetryToken] = useState(0);
  // Displayed results: AniList results immediately, Tenrai's new entries only after "Update".
  const [entries, setEntries] = useState<RelatedEntry[]>([]);
  const [primary, setPrimary] = useState<PrimaryState>({ status: 'loading', doneBatches: 0, totalBatches: 0 });
  const [tenrai, setTenrai] = useState<TenraiState>({ status: 'seasons', checked: 0, total: 0, newCount: 0, upgradeCount: 0, failedCount: 0 });
  const [enrichProgress, setEnrichProgress] = useState<{ done: number; total: number } | null>(null);

  const entriesRef = useRef<RelatedEntry[]>([]);
  const displayedIdsRef = useRef(new Set<number>());
  const primaryFailedRef = useRef(false);
  const tenraiResultRef = useRef<{ entries: Map<number, RelatedEntry>; seasonListAnime: SeasonListMap } | null>(null);
  const hasStartedRef = useRef(false);
  const shelfRef = useRef(shelf);
  shelfRef.current = shelf;

  const showEntries = useCallback((list: RelatedEntry[]) => {
    entriesRef.current = list;
    displayedIdsRef.current = new Set(list.map(e => e.mal_id));
    setEntries(list);
  }, []);
  const updateEntries = useCallback(
    (updater: (list: RelatedEntry[]) => RelatedEntry[]) => showEntries(updater(entriesRef.current)),
    [showEntries]
  );

  const applyTenraiResults = useCallback(() => {
    const result = tenraiResultRef.current;
    if (!result) return;
    const merged = new Map(entriesRef.current.map(entry => [entry.mal_id, entry]));
    result.entries.forEach((entry, id) => { if (!merged.has(id)) merged.set(id, entry); });
    // Entries airing now or upcoming get the full Tenrai data (and MAL's airing status) from the season lists.
    merged.forEach((entry, id) => {
      const seasonEntry = result.seasonListAnime.get(id);
      if (seasonEntry && !entry.details) {
        merged.set(id, relatedEntryFromSeasonList(seasonEntry.anime, seasonEntry.airingStatus, entry.relationType, entry.relatedTo));
      }
    });
    showEntries(Array.from(merged.values()).filter(entry => !isIgnoredType(entry.details?.type)));
    setTenrai(state => ({ ...state, status: 'applied' }));
  }, [showEntries]);

  const retry = useCallback(() => setRetryToken(t => t + 1), []);

  // Only changes to the checked entries restart the lookup, not e.g. an episode increment on the shelf page.
  const candidateKey = useMemo(
    () => JSON.stringify(shelf.filter(isPreviewCandidate).map(a => [a.mal_id, a.title])),
    [shelf]
  );

  useEffect(() => {
    if (!shelfInitialized || !ignoredPreviewAnimeMalIdsInitialized) return;
    const candidates: Array<[number, string]> = JSON.parse(candidateKey);
    if (candidates.length === 0) {
      showEntries([]);
      setPrimary({ status: 'done', doneBatches: 0, totalBatches: 0 });
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    const run = () => {
      const shelfMalIds = new Set(shelfRef.current.map(a => a.mal_id));
      primaryFailedRef.current = false;
      tenraiResultRef.current = null;
      setEnrichProgress(null);

      // Current & upcoming entries are upgraded to full Tenrai data as soon as both the AniList results and the
      // Tenrai season lists are available: from the season lists without extra requests, the rest one by one.
      let aniListReady = false;
      let seasonLists: SeasonListMap | null = null;
      let enrichStarted = false;
      const enrichCurrentUpcoming = async () => {
        if (!aniListReady || !seasonLists || enrichStarted) return;
        enrichStarted = true;
        const lists = seasonLists;
        // AniList has no PV/CM formats; MAL's type from the full data reveals them, so they are dropped here.
        updateEntries(list => list
          .map(entry => {
            if (entry.airingStatus === 'past' || entry.details) return entry;
            const seasonEntry = lists.get(entry.mal_id);
            return seasonEntry ? relatedEntryFromSeasonList(seasonEntry.anime, seasonEntry.airingStatus, entry.relationType, entry.relatedTo) : entry;
          })
          .filter(entry => !isIgnoredType(entry.details?.type)));

        const remaining = entriesRef.current.filter(entry => entry.airingStatus !== 'past' && !entry.details);
        if (remaining.length === 0) return;
        let done = 0;
        setEnrichProgress({ done, total: remaining.length });
        await Promise.all(remaining.map(async entry => {
          try {
            const anime = await jikanApi.getAnimeById(entry.mal_id, { signal, priority: 'high' });
            if (anime && !signal.aborted) {
              updateEntries(list => isIgnoredType(anime.type)
                ? list.filter(e => e.mal_id !== entry.mal_id)
                : list.map(e => (e.mal_id === entry.mal_id ? { ...e, details: anime } : e)));
            }
          } catch (error) {
            if (isAbortError(error)) return;
          }
          done++;
          if (!signal.aborted) setEnrichProgress({ done, total: remaining.length });
        }));
        if (!signal.aborted) setEnrichProgress(null);
      };

      const runAniList = async () => {
        setPrimary(state => ({ ...state, status: 'loading' }));
        try {
          const relationsByMalId = await anilistApi.getRelationsByMalIds(candidates.map(([id]) => id), {
            signal,
            onProgress: (doneBatches, totalBatches) => setPrimary({ status: 'loading', doneBatches, totalBatches }),
          });
          const found = new Map<number, RelatedEntry>();
          for (const [malId, title] of candidates) {
            for (const edge of relationsByMalId.get(malId) ?? []) {
              const entry = relatedEntryFromAniList(edge, title);
              if (!entry || shelfMalIds.has(entry.mal_id) || found.has(entry.mal_id)) continue;
              found.set(entry.mal_id, entry);
            }
          }
          showEntries(Array.from(found.values()));
          setPrimary(state => ({ ...state, status: 'done' }));
          aniListReady = true;
          enrichCurrentUpcoming();
        } catch (error) {
          if (isAbortError(error)) return;
          console.error('AniList lookup failed:', error);
          primaryFailedRef.current = true;
          setPrimary(state => ({ ...state, status: 'error' }));
        }
      };

      const runTenrai = async () => {
        setTenrai({ status: 'seasons', checked: 0, total: 0, newCount: 0, upgradeCount: 0, failedCount: 0 });
        try {
          const [currentSeasonList, upcomingSeasonList] = await Promise.all([
            jikanApi.getCurrentSeason({ signal }),
            jikanApi.getUpcomingSeason({ signal }),
          ]);
          const seasonListAnime: SeasonListMap = new Map();
          currentSeasonList.forEach(anime => seasonListAnime.set(anime.mal_id, { anime, airingStatus: 'airing' }));
          upcomingSeasonList.forEach(anime => seasonListAnime.set(anime.mal_id, { anime, airingStatus: 'upcoming' }));
          seasonLists = seasonListAnime;
          enrichCurrentUpcoming();

          // Shelf entries that are themselves airing now or upcoming are covered by the season lists.
          const toCheck = candidates.filter(([id]) => !seasonListAnime.has(id));
          const found = new Map<number, RelatedEntry>();
          const countNew = () => Array.from(found.keys()).filter(id => !displayedIdsRef.current.has(id)).length;
          let failedCount = 0;

          for (const [index, [malId, title]] of toCheck.entries()) {
            setTenrai(state => ({ ...state, status: 'running', checked: index, total: toCheck.length, newCount: countNew(), failedCount }));
            let relations: JikanAnimeRelation[];
            try {
              relations = await jikanApi.getAnimeRelations(malId, { signal });
            } catch (relationError) {
              if (isAbortError(relationError)) throw relationError;
              failedCount++;
              continue;
            }
            for (const relation of relations) {
              if (!TENRAI_RELEVANT_RELATIONS.has(relation.relation.toLowerCase())) continue;
              for (const relEntry of relation.entry) {
                if (relEntry.type !== 'anime' || shelfMalIds.has(relEntry.mal_id) || found.has(relEntry.mal_id)) continue;
                const seasonEntry = seasonListAnime.get(relEntry.mal_id);
                if (seasonEntry) {
                  if (isIgnoredType(seasonEntry.anime.type)) continue;
                  found.set(relEntry.mal_id, relatedEntryFromSeasonList(seasonEntry.anime, seasonEntry.airingStatus, relation.relation, title));
                } else {
                  if (isIgnoredType(relEntry.media_type)) continue;
                  found.set(relEntry.mal_id, {
                    mal_id: relEntry.mal_id,
                    title: relEntry.name,
                    coverUrl: relEntry.images?.webp?.large_image_url || relEntry.images?.jpg?.large_image_url || relEntry.images?.jpg?.image_url || null,
                    format: relEntry.media_type ?? null,
                    relationType: relation.relation,
                    relatedTo: title,
                    airingStatus: 'past',
                    season: null,
                    year: null,
                  });
                }
              }
            }
          }

          tenraiResultRef.current = { entries: found, seasonListAnime };
          const upgradeCount = entriesRef.current.filter(entry => !entry.details && seasonListAnime.has(entry.mal_id)).length;
          setTenrai({ status: 'done', checked: toCheck.length, total: toCheck.length, newCount: countNew(), upgradeCount, failedCount });
          // Without AniList results there is nothing to compare against, so show Tenrai's results directly.
          if (primaryFailedRef.current) {
            showEntries(Array.from(found.values()));
            setTenrai(state => ({ ...state, status: 'applied' }));
          }
        } catch (error) {
          if (isAbortError(error)) return;
          console.error('Tenrai cross-check failed:', error);
          setTenrai(state => ({ ...state, status: 'error' }));
        }
      };

      runAniList();
      runTenrai();
    };

    // The first run starts right away; later runs are debounced. Results of the previous run stay visible meanwhile.
    const timer = setTimeout(run, hasStartedRef.current ? RESTART_DEBOUNCE_MS : 0);
    hasStartedRef.current = true;
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [candidateKey, shelfInitialized, ignoredPreviewAnimeMalIdsInitialized, retryToken, showEntries, updateEntries]);

  const { currentUpcoming, past } = useMemo(() => {
    const shelfMalIds = new Set(shelf.map(a => a.mal_id));
    const visible = entries.filter(entry => !shelfMalIds.has(entry.mal_id) && !ignoredPreviewAnimeMalIds.includes(entry.mal_id));
    return {
      currentUpcoming: sortCurrentUpcoming(visible.filter(entry => entry.airingStatus !== 'past')),
      past: sortPast(visible.filter(entry => entry.airingStatus === 'past')),
    };
  }, [entries, shelf, ignoredPreviewAnimeMalIds]);

  const contextValue = useMemo<PreviewContextType>(() => ({
    currentUpcoming,
    past,
    airingCount: currentUpcoming.filter(entry => entry.airingStatus === 'airing').length,
    primary,
    tenrai,
    enrichProgress,
    applyTenraiResults,
    retry,
  }), [currentUpcoming, past, primary, tenrai, enrichProgress, applyTenraiResults, retry]);

  return <PreviewContext.Provider value={contextValue}>{children}</PreviewContext.Provider>;
};

export const usePreview = () => {
  const context = useContext(PreviewContext);
  if (context === undefined) {
    throw new Error('usePreview must be used within a PreviewProvider');
  }
  return context;
};
