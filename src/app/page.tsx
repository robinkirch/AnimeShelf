
"use client";

import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/anime/AnimeCard";
import { AnimeGroupCard } from "@/components/anime/AnimeGroupCard";
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { jikanApi, isAbortError } from '@/lib/jikanApi';
import type { JikanAnime, UserAnimeStatus, UserAnime, JikanAnimeRelation } from '@/types/anime';
import { USER_ANIME_STATUS_OPTIONS, RATING_OPTIONS, ANIME_TYPE_FILTER_OPTIONS } from '@/types/anime';
import { Loader2, Search, ListFilter, X, ChevronDown, Info, ArrowUpAZ, ArrowDownAZ, Sparkles, SearchCheck } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { searchAnimeWithAi, type AiSearchInput } from '@/ai/flows/anime-search-flow';
import { readStoredAiSettings } from '@/ai/models';
import { StatusDistributionBar } from '@/components/shelf/StatusDistributionBar';
import { rendererLogger } from '@/lib/logger';
import { useI18n, type MessageKey, type TranslationParams } from '@/i18n/I18nContext';
import { ratingLabel, statusLabel, typeLabel } from '@/i18n/labels';


const ALL_FILTER_VALUE = "_all_";
const INITIAL_LOAD_COUNT = 12;
const SUBSEQUENT_LOAD_COUNT = 8;


interface GroupedShelfItem {
  id: string;
  isGroup: boolean;
  items: UserAnime[];
  representativeAnime: UserAnime;
}

type SortOption = 'title' | 'rating' | 'year' | 'completion';
// Errors are stored as message keys so they are shown in the current UI language.
type UiMessage = { key: MessageKey; params?: TranslationParams };

const AI_ERROR_KEYS: Record<'invalidApiKey' | 'overloaded' | 'failed', MessageKey> = {
  invalidApiKey: 'search.aiInvalidApiKey',
  overloaded: 'search.aiOverloaded',
  failed: 'search.aiFailed',
};
type SortOrder = 'asc' | 'desc';

export default function MyShelfPage() {
  const { shelf, isInitialized: shelfInitialized } = useAnimeShelf();
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<JikanAnime[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);

  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [aiSearchResults, setAiSearchResults] = useState<JikanAnime[]>([]);
  const [isLoadingAiSearch, setIsLoadingAiSearch] = useState(false);
  const [aiSearchError, setAiSearchError] = useState<UiMessage | null>(null);

  const [isLoadingShelf, setIsLoadingShelf] = useState(true); 
  const [isLoadingRelations, setIsLoadingRelations] = useState(false); 

  const [localShelfSearchQuery, setLocalShelfSearchQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<UserAnimeStatus | typeof ALL_FILTER_VALUE>(ALL_FILTER_VALUE);
  const [ratingFilter, setRatingFilter] = useState<string>(ALL_FILTER_VALUE);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  const [sortOption, setSortOption] = useState<SortOption>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const [relationsMap, setRelationsMap] = useState<Map<number, JikanAnimeRelation[]>>(new Map());
  const [apiError, setApiError] = useState<UiMessage | null>(null);

  const [displayedShelfItems, setDisplayedShelfItems] = useState<GroupedShelfItem[]>([]);
  const [hasMoreShelfItems, setHasMoreShelfItems] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    rendererLogger.info("MyShelfPage mounted or dependencies changed.", { category: 'ui-lifecycle' });
    return () => {
        rendererLogger.info("MyShelfPage unmounted.", { category: 'ui-lifecycle' });
    };
  }, []);


  const relationsMapRef = useRef(relationsMap);
  useEffect(() => {
    relationsMapRef.current = relationsMap;
  }, [relationsMap]);
  const [relationsRetryToken, setRelationsRetryToken] = useState(0);
  // mal_id -> position in the current shelf view, so relations for visible cards are fetched first.
  const displayOrderRef = useRef(new Map<number, number>());

  // Loads relations (for series grouping) for every shelf entry that doesn't have them yet.
  // Runs at low priority so user-triggered Jikan requests go first, and is aborted on unmount
  // or when the shelf changes (already fetched relations are served from the Jikan cache).
  useEffect(() => {
    if (!shelfInitialized) return;
    setIsLoadingShelf(false);

    if (shelf.length === 0) {
      setRelationsMap(prev => (prev.size > 0 ? new Map() : prev));
      setIsLoadingRelations(false);
      return;
    }

    const order = displayOrderRef.current;
    const missing = shelf
      .filter(anime => !relationsMapRef.current.has(anime.mal_id))
      .sort((a, b) => (order.get(a.mal_id) ?? Infinity) - (order.get(b.mal_id) ?? Infinity));
    if (missing.length === 0) {
      setIsLoadingRelations(false);
      return;
    }

    const controller = new AbortController();
    const fetchMissingRelations = async () => {
      rendererLogger.info("Fetching relations for shelf items.", { category: 'data-fetch', missingCount: missing.length });
      setIsLoadingRelations(true);
      setApiError(null);

      let batch = new Map<number, JikanAnimeRelation[]>();
      const flush = () => {
        if (batch.size === 0) return;
        const fetched = batch;
        batch = new Map();
        setRelationsMap(prev => {
          const updatedMap = new Map(prev);
          fetched.forEach((value, key) => updatedMap.set(key, value));
          return updatedMap;
        });
      };

      let failedCount = 0;
      for (const anime of missing) {
        try {
          const relations = await jikanApi.getAnimeRelations(anime.mal_id, { signal: controller.signal });
          batch.set(anime.mal_id, relations);
          if (batch.size >= 10) flush();
        } catch (e: any) {
          if (isAbortError(e)) {
            flush();
            return;
          }
          failedCount++;
          rendererLogger.warn(`Could not fetch relations for ${anime.title} (ID: ${anime.mal_id}).`, { category: 'data-fetch-error', error: e.message });
        }
      }
      flush();
      if (failedCount > 0) {
        setApiError({ key: 'shelf.relationsFailed', params: { count: failedCount } });
      }
      setIsLoadingRelations(false);
      rendererLogger.info("Finished fetching relations for shelf items.", { category: 'data-fetch', failedCount });
    };

    fetchMissingRelations();
    return () => controller.abort();
  }, [shelfInitialized, shelf, relationsRetryToken]);


  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    rendererLogger.info(`Performing standard Jikan search for: "${searchQuery}"`, { category: 'user-action', action: 'search-standard' });
    setIsLoadingSearch(true);
    setApiError(null);
    try {
        const results = await jikanApi.searchAnime(searchQuery);
        const uniqueResults = Array.from(new Map(results.map(item => [item.mal_id, item])).values());
        setSearchResults(uniqueResults);
        rendererLogger.info(`Standard search for "${searchQuery}" returned ${uniqueResults.length} results.`, { category: 'user-action', action: 'search-standard-result' });
    } catch (e: any) {
        rendererLogger.error("Error searching anime with standard search.", { category: 'user-action-error', action: 'search-standard', query: searchQuery, error: e.message });
        setApiError({ key: 'search.searchFailed' });
        setSearchResults([]);
    }
    setIsLoadingSearch(false);
  };

  const handleAiSearch = async () => {
    if (!aiSearchQuery.trim()) {
      setAiSearchResults([]);
      return;
    }
    rendererLogger.info(`Performing AI search for: "${aiSearchQuery}"`, { category: 'user-action', action: 'search-ai' });
    setIsLoadingAiSearch(true);
    setAiSearchError(null);
    try {
      const { model, apiKey } = await readStoredAiSettings();
      const input: AiSearchInput = { query: aiSearchQuery, modelId: model.id, apiKey: apiKey || undefined };
      const response = await searchAnimeWithAi(input);
      if ('error' in response) {
        rendererLogger.warn("AI search returned an error.", { category: 'user-action-error', action: 'search-ai', error: response.error });
        setAiSearchError({ key: AI_ERROR_KEYS[response.error], params: { provider: response.provider } });
        setAiSearchResults([]);
        setIsLoadingAiSearch(false);
        return;
      }
      const results = response.results;
      const uniqueResults = Array.from(new Map(results.map(item => [item.mal_id, item])).values());
      setAiSearchResults(uniqueResults);
      rendererLogger.info(`AI search for "${aiSearchQuery}" returned ${uniqueResults.length} results.`, { category: 'user-action', action: 'search-ai-result' });
    } catch (e: any) {
      rendererLogger.error("Error searching anime with AI.", { category: 'user-action-error', action: 'search-ai', query: aiSearchQuery, error: e.message });
      setAiSearchError({ key: 'search.aiFailed' });
      setAiSearchResults([]);
    }
    setIsLoadingAiSearch(false);
  };

  const uniqueGenres = useMemo(() => {
    if (!shelfInitialized) return [];
    const allGenres = shelf.reduce((acc, anime) => {
      anime.genres.forEach(genre => acc.add(genre));
      return acc;
    }, new Set<string>());
    return Array.from(allGenres).sort();
  }, [shelf, shelfInitialized]);

  const itemsPassingOtherFilters = useMemo(() => {
    if (!shelfInitialized) return [];
    return shelf.filter(anime => {
      const genreMatch = genreFilter.length === 0 ? true : genreFilter.some(selectedGenre => anime.genres.includes(selectedGenre));
      const ratingMatch = ratingFilter === ALL_FILTER_VALUE ? true : anime.user_rating === parseInt(ratingFilter);
      const typeMatch = typeFilter.length === 0 ? true : (anime.type ? typeFilter.includes(anime.type) : false);
      const localSearchMatch = localShelfSearchQuery.trim() === '' ? true : anime.title.toLowerCase().includes(localShelfSearchQuery.toLowerCase().trim());

      return genreMatch && ratingMatch && typeMatch && localSearchMatch;
    });
  }, [shelf, genreFilter, ratingFilter, typeFilter, localShelfSearchQuery, shelfInitialized]);

  const statusCounts = useMemo(() => {
    if (!shelfInitialized) return {};

    const counts: Record<string, number> = {
      [ALL_FILTER_VALUE]: itemsPassingOtherFilters.length
    };

    USER_ANIME_STATUS_OPTIONS.forEach(opt => {
      counts[opt.value] = itemsPassingOtherFilters.filter(anime => anime.user_status === opt.value).length;
    });

    return counts;
  }, [itemsPassingOtherFilters, shelfInitialized]);


  const groupedAndFilteredShelf = useMemo((): GroupedShelfItem[] => {
    if (!shelfInitialized) { 
        return [];
    }

    const fullyFilteredAnime = itemsPassingOtherFilters.filter(anime => {
        const statusMatch = statusFilter === ALL_FILTER_VALUE ? true : anime.user_status === statusFilter;
        return statusMatch;
    });

    if (fullyFilteredAnime.length === 0) return [];

    const shelfItemsMap = new Map(fullyFilteredAnime.map(item => [item.mal_id, item]));
    const visited = new Set<number>();
    const finalGroupedItems: GroupedShelfItem[] = [];

    const sortedShelfForGrouping = [...fullyFilteredAnime].sort((a, b) => {
        const yearA = a.year ?? Infinity;
        const yearB = b.year ?? Infinity;
        if (yearA !== yearB) return yearA - yearB;
        return (a.mal_id) - (b.mal_id);
    });


    for (const anime of sortedShelfForGrouping) {
        if (visited.has(anime.mal_id)) continue;

        const currentSeriesMalIds = new Set<number>();
        const queue: number[] = [anime.mal_id];
        visited.add(anime.mal_id);
        currentSeriesMalIds.add(anime.mal_id);

        let head = 0;
        while(head < queue.length) {
            const currentMalId = queue[head++];
            const itemRelations = relationsMap.get(currentMalId); 

            if (itemRelations) {
                for (const relation of itemRelations) {
                    // Case-insensitive: Tenrai returns e.g. 'Side Story', older Jikan data 'Side story'.
                    if (['sequel', 'prequel', 'parent story', 'full story', 'side story', 'alternative version', 'other'].includes(relation.relation.toLowerCase())) {
                        for (const entry of relation.entry) {
                            if (entry.type === 'anime' && shelfItemsMap.has(entry.mal_id) && !currentSeriesMalIds.has(entry.mal_id)) {
                                visited.add(entry.mal_id);
                                currentSeriesMalIds.add(entry.mal_id);
                                queue.push(entry.mal_id);
                            }
                        }
                    }
                }
            }
        }

        const groupItems = Array.from(currentSeriesMalIds)
            .map(id => shelfItemsMap.get(id)!)
            .filter(Boolean) 
            .sort((a,b) => (a.year ?? Infinity) - (b.year ?? Infinity) || (a.mal_id) - (b.mal_id)); 

        if (groupItems.length > 0) {
            const representative = groupItems[0]; 
            finalGroupedItems.push({
                id: representative.mal_id.toString() + (groupItems.length > 1 ? `_group_${groupItems.map(gi=>gi.mal_id).join('_')}` : "_single"),
                isGroup: groupItems.length > 1,
                items: groupItems,
                representativeAnime: representative
            });
        }
    }

    const sortedFinalItems = [...finalGroupedItems].sort((a, b) => {
      const repA = a.representativeAnime;
      const repB = b.representativeAnime;
      let valA: string | number | null = null;
      let valB: string | number | null = null;
      switch (sortOption) {
        case 'title': valA = repA.title; valB = repB.title; break;
        case 'rating':
          const getGroupAvgRating = (items: UserAnime[]): number => {
            const ratedItems = items.filter(item => item.user_rating !== null);
            if (ratedItems.length === 0) return sortOrder === 'asc' ? Infinity : -Infinity;
            return ratedItems.reduce((sum, item) => sum + item.user_rating!, 0) / ratedItems.length;
          };
          valA = a.isGroup ? getGroupAvgRating(a.items) : (a.items[0].user_rating ?? (sortOrder === 'asc' ? Infinity : -Infinity));
          valB = b.isGroup ? getGroupAvgRating(b.items) : (b.items[0].user_rating ?? (sortOrder === 'asc' ? Infinity : -Infinity));
          break;
        case 'year':
          valA = repA.year ?? (sortOrder === 'asc' ? Infinity : -Infinity);
          valB = repB.year ?? (sortOrder === 'asc' ? Infinity : -Infinity);
          break;
        case 'completion':
          const getCompletion = (items: UserAnime[], isGroup: boolean): number => {
            if (isGroup) {
              let current = 0; let total = 0; let hasValidTotalForAll = true; let allAreMoviesOrUnknown = true;
              items.forEach(item => {
                current += item.current_episode;
                if (item.total_episodes !== null && item.total_episodes > 0) { total += item.total_episodes; allAreMoviesOrUnknown = false; }
                else if (item.total_episodes === 0) { /* Movie logic handled below or by current_episode > 0 for completion */ }
                else { hasValidTotalForAll = false; allAreMoviesOrUnknown = false; }
              });
              if (!hasValidTotalForAll) return -1; 
              if (allAreMoviesOrUnknown) { const completedMovies = items.filter(item => item.current_episode > 0).length; return items.length > 0 ? completedMovies / items.length : 0; }
              if (total === 0 && current === 0) return 1; 
              return total === 0 ? -1 : current / total;
            } else {
              const item = items[0];
              if (item.total_episodes === null) return -1;
              if (item.total_episodes === 0) return item.current_episode > 0 ? 1 : 0;
              return item.current_episode / item.total_episodes;
            }
          };
          valA = getCompletion(a.items, a.isGroup); valB = getCompletion(b.items, b.isGroup);
          break;
        default: valA = repA.title; valB = repB.title;
      }
      let comparison = 0;
      if (valA === null || valA === undefined || valA === Infinity || valA === -Infinity) valA = sortOrder === 'asc' ? Infinity : -Infinity;
      if (valB === null || valB === undefined || valB === Infinity || valB === -Infinity) valB = sortOrder === 'asc' ? Infinity : -Infinity;
      if (typeof valA === 'string' && typeof valB === 'string') { comparison = valA.localeCompare(valB); }
      else if (typeof valA === 'number' && typeof valB === 'number') {
        if (valA === Infinity && valB === Infinity) comparison = 0; else if (valA === Infinity) comparison = 1; else if (valB === Infinity) comparison = -1;
        else if (valA === -Infinity && valB === -Infinity) comparison = 0; else if (valA === -Infinity) comparison = -1; else if (valB === -Infinity) comparison = 1;
        else comparison = valA - valB;
      } else { const strA = String(valA); const strB = String(valB); comparison = strA.localeCompare(strB); }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return sortedFinalItems;
  }, [itemsPassingOtherFilters, statusFilter, relationsMap, shelfInitialized, sortOption, sortOrder]);

  // Layout effect: runs before the relations effect above, so its first run already sees the display order.
  useLayoutEffect(() => {
    const order = new Map<number, number>();
    groupedAndFilteredShelf.forEach(group => group.items.forEach(item => {
      if (!order.has(item.mal_id)) order.set(item.mal_id, order.size);
    }));
    displayOrderRef.current = order;
  }, [groupedAndFilteredShelf]);

  const relationsLoadedCount = useMemo(
    () => shelf.filter(anime => relationsMap.has(anime.mal_id)).length,
    [shelf, relationsMap]
  );


  useEffect(() => {
    if (!shelfInitialized) {
        setDisplayedShelfItems([]);
        setHasMoreShelfItems(true); 
        return;
    }
    if (groupedAndFilteredShelf.length > 0) {
        const currentDisplayLength = displayedShelfItems.length;
        const newSliceEnd = currentDisplayLength > 0 ? Math.max(currentDisplayLength, INITIAL_LOAD_COUNT) : INITIAL_LOAD_COUNT;
        
        setDisplayedShelfItems(groupedAndFilteredShelf.slice(0, newSliceEnd));
        setHasMoreShelfItems(groupedAndFilteredShelf.length > newSliceEnd);
    } else {
        setDisplayedShelfItems([]);
        setHasMoreShelfItems(false);
    }
  }, [groupedAndFilteredShelf, shelfInitialized]);


  const handleLoadMoreShelfItems = useCallback(() => {
    if (displayedShelfItems.length >= groupedAndFilteredShelf.length) {
      setHasMoreShelfItems(false);
      return;
    }
    rendererLogger.debug(`Loading more shelf items. Current: ${displayedShelfItems.length}, Total potential: ${groupedAndFilteredShelf.length}`, { category: 'ui-interaction', action: 'load-more' });
    const currentLength = displayedShelfItems.length;
    const nextItems = groupedAndFilteredShelf.slice(currentLength, currentLength + SUBSEQUENT_LOAD_COUNT);
    setDisplayedShelfItems(prevItems => [...prevItems, ...nextItems]);
    setHasMoreShelfItems((currentLength + SUBSEQUENT_LOAD_COUNT) < groupedAndFilteredShelf.length);
  }, [displayedShelfItems, groupedAndFilteredShelf]);

  useEffect(() => {
    const currentRef = loadMoreRef.current;
    if (!currentRef || !hasMoreShelfItems || !shelfInitialized || isLoadingShelf) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          handleLoadMoreShelfItems();
        }
      },
      { threshold: 0.1 } 
    );
    observer.observe(currentRef);
    return () => { if (currentRef) { observer.unobserve(currentRef); } observer.disconnect(); };
  }, [loadMoreRef, hasMoreShelfItems, handleLoadMoreShelfItems, isLoadingShelf, shelfInitialized]);


  const clearFilters = () => {
    rendererLogger.info("Clearing all shelf filters.", { category: 'user-action', action: 'clear-filters' });
    setGenreFilter([]);
    setStatusFilter(ALL_FILTER_VALUE);
    setRatingFilter(ALL_FILTER_VALUE);
    setTypeFilter([]);
    setLocalShelfSearchQuery('');
  };

  const renderSkeletons = (count: number) => (
    Array.from({ length: count }).map((_, index) => (
      <div key={index} className="border rounded-lg p-4 space-y-3">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-10 w-full" />
      </div>
    ))
  );

  const getGenreFilterDisplayValue = () => {
    if (genreFilter.length === 0) return t('shelf.allGenres');
    if (uniqueGenres.length > 0 && genreFilter.length === uniqueGenres.length) return t('shelf.allGenres');
    if (genreFilter.length > 2) return `${genreFilter.slice(0, 2).join(', ')}, ${t('common.moreCount', { count: genreFilter.length - 2 })}`;
    return genreFilter.join(', ');
  };

  const getTypeFilterDisplayValue = () => {
    if (typeFilter.length === 0) return t('shelf.allTypes');
    if (ANIME_TYPE_FILTER_OPTIONS.length > 0 && typeFilter.length === ANIME_TYPE_FILTER_OPTIONS.length) return t('shelf.allTypes');
    if (typeFilter.length > 2) {
      const displayedTypes = typeFilter.slice(0, 2).map(val => typeLabel(t, val));
      return `${displayedTypes.join(', ')}, ${t('common.moreCount', { count: typeFilter.length - 2 })}`;
    }
    return typeFilter.map(val => typeLabel(t, val)).join(', ');
  };

  const showInitialLoadingSkeletons = isLoadingShelf || 
                                     (shelfInitialized && 
                                      itemsPassingOtherFilters.length > 0 && 
                                      displayedShelfItems.length === 0 &&
                                      groupedAndFilteredShelf.length === 0); 

  return (
    <div className="space-y-8">
      <section className="bg-card p-6 rounded-lg shadow-xs">
        <h1 className="text-3xl font-bold mb-2 text-primary">{t('search.title')}</h1>
        <p className="text-muted-foreground mb-6">{t('search.subtitle')}</p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="standard-search-input" className="text-sm font-medium mb-1 block">{t('search.standardLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="standard-search-input"
                type="search"
                placeholder={t('search.standardPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="grow"
              />
              <Button onClick={handleSearch} disabled={isLoadingSearch}>
                {isLoadingSearch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                {t('search.searchButton')}
</Button>
            </div>
          </div>

          <div>
            <Label htmlFor="ai-search-input" className="text-sm font-medium mb-1 block">{t('search.aiLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="ai-search-input"
                type="search"
                placeholder={t('search.aiPlaceholder')}
                value={aiSearchQuery}
                onChange={(e) => setAiSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAiSearch()}
                className="grow"
              />
              <Button onClick={handleAiSearch} disabled={isLoadingAiSearch} variant="outline">
                {isLoadingAiSearch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-yellow-500" />}
                {t('search.aiButton')}
</Button>
            </div>
          </div>
        </div>

        {apiError && (searchResults.length === 0 && aiSearchResults.length === 0) && ( 
          <Alert variant="destructive" className="mt-4">
            <Info className="h-4 w-4" />
            <AlertTitle>{t('search.apiErrorTitle')}</AlertTitle>
            <AlertDescription>{t(apiError.key, apiError.params)}</AlertDescription>
          </Alert>
        )}
        {aiSearchError && (
          <Alert variant="destructive" className="mt-4">
            <Info className="h-4 w-4" />
            <AlertTitle>{t('search.aiErrorTitle')}</AlertTitle>
            <AlertDescription>{t(aiSearchError.key, aiSearchError.params)}</AlertDescription>
          </Alert>
        )}


        {(isLoadingSearch || isLoadingAiSearch) && (
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
            {renderSkeletons(4)}
          </div>
        )}

        {!isLoadingSearch && searchResults.length > 0 && (
          <div className="mt-6">
            <h2 className="text-2xl font-semibold mb-4">{t('search.resultsTitle')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {searchResults.map(anime => (
                <AnimeCard key={`search-${anime.mal_id}`} anime={anime} />
              ))}
            </div>
          </div>
        )}
        {!isLoadingSearch && searchQuery && searchResults.length === 0 && !apiError && !isLoadingAiSearch && aiSearchResults.length === 0 && (
          <p className="text-center text-muted-foreground py-4 mt-4">{t('search.noResults', { query: searchQuery })}</p>
        )}

        {!isLoadingAiSearch && aiSearchResults.length > 0 && (
          <div className="mt-6">
            <h2 className="text-2xl font-semibold mb-4">{t('search.aiResultsTitle')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {aiSearchResults.map(anime => (
                <AnimeCard key={`ai-search-${anime.mal_id}`} anime={anime} />
              ))}
            </div>
          </div>
        )}
        {!isLoadingAiSearch && aiSearchQuery && aiSearchResults.length === 0 && !aiSearchError && !isLoadingSearch && searchResults.length === 0 && (
          <p className="text-center text-muted-foreground py-4 mt-4">{t('search.aiNoResults', { query: aiSearchQuery })}</p>
        )}
      </section>

      <Separator />

      <section>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-3xl font-bold text-primary">{t('shelf.title')}</h2>
          <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={clearFilters} className="text-sm">
                <X className="mr-2 h-4 w-4" /> {t('shelf.clearAllFilters')}
              </Button>
          </div>
        </div>

        {shelfInitialized && shelf.length > 0 && (
          <StatusDistributionBar shelf={shelf} />
        )}

        <div className="mb-6 p-4 bg-card rounded-lg shadow-xs">
            <Label htmlFor="local-shelf-search" className="text-sm font-medium mb-1 block">{t('shelf.searchLabel')}</Label>
            <div className="relative">
                <SearchCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    id="local-shelf-search"
                    type="search"
                    placeholder={t('shelf.searchPlaceholder')}
                    value={localShelfSearchQuery}
                    onChange={(e) => setLocalShelfSearchQuery(e.target.value)}
                    className="pl-10 w-full"
                />
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-card rounded-lg shadow-xs">
          <div>
            <Label htmlFor="genre-filter-shelf" className="text-sm font-medium mb-1 block">{t('shelf.genre')}</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" id="genre-filter-shelf" className="w-full justify-between text-left font-normal">
                  <span className="truncate grow">{getGenreFilterDisplayValue()}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
                {uniqueGenres.map((genre) => (
                  <DropdownMenuCheckboxItem
                    key={genre}
                    checked={genreFilter.includes(genre)}
                    onCheckedChange={(checked) => {
                      rendererLogger.debug(`Genre filter changed: ${genre}, checked: ${checked}`, { category: 'ui-filter', filterType: 'genre' });
                      setGenreFilter(prev =>
                        checked ? [...prev, genre] : prev.filter(g => g !== genre)
                      );
                    }}
                    onSelect={(e) => e.preventDefault()} 
                  >
                    {genre}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div>
            <Label htmlFor="status-filter" className="text-sm font-medium mb-1 block">{t('shelf.status')}</Label>
            <Select value={statusFilter} onValueChange={(v) => { rendererLogger.debug(`Status filter changed: ${v}`, { category: 'ui-filter', filterType: 'status' }); setStatusFilter(v as UserAnimeStatus | typeof ALL_FILTER_VALUE)}}>
              <SelectTrigger id="status-filter"><SelectValue placeholder={t('shelf.allStatuses')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>{t('shelf.allStatuses')} ({statusCounts[ALL_FILTER_VALUE] ?? 0})</SelectItem>
                {USER_ANIME_STATUS_OPTIONS.map(opt =>
                  <SelectItem key={opt.value} value={opt.value}>
                    {statusLabel(t, opt.value)} ({statusCounts[opt.value] ?? 0})
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rating-filter" className="text-sm font-medium mb-1 block">{t('shelf.rating')}</Label>
            <Select value={ratingFilter} onValueChange={(v) => {rendererLogger.debug(`Rating filter changed: ${v}`, { category: 'ui-filter', filterType: 'rating' }); setRatingFilter(v)}}>
              <SelectTrigger id="rating-filter"><SelectValue placeholder={t('shelf.allRatings')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>{t('shelf.allRatings')}</SelectItem>
                {RATING_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value.toString()}>{ratingLabel(t, opt.value)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="type-filter-shelf" className="text-sm font-medium mb-1 block">{t('shelf.type')}</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" id="type-filter-shelf" className="w-full justify-between text-left font-normal">
                  <span className="truncate grow">{getTypeFilterDisplayValue()}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
                {ANIME_TYPE_FILTER_OPTIONS.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={typeFilter.includes(option.value)}
                    onCheckedChange={(checked) => {
                      rendererLogger.debug(`Type filter changed: ${option.value}, checked: ${checked}`, { category: 'ui-filter', filterType: 'type' });
                      setTypeFilter(prev =>
                        checked ? [...prev, option.value] : prev.filter(v => v !== option.value)
                      );
                    }}
                    onSelect={(e) => e.preventDefault()} 
                  >
                    {typeLabel(t, option.value)}
</DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-card rounded-lg shadow-xs items-end">
            <div className="grow w-full sm:w-auto">
                <Label htmlFor="sort-option" className="text-sm font-medium mb-1 block">{t('shelf.sortBy')}</Label>
                <Select value={sortOption} onValueChange={(value) => { rendererLogger.debug(`Sort option changed: ${value}`, { category: 'ui-sort', sortOption: value }); setSortOption(value as SortOption)}}>
                    <SelectTrigger id="sort-option" className="w-full">
                        <SelectValue placeholder={t('shelf.sortByPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="title">{t('shelf.sort.title')}</SelectItem>
                        <SelectItem value="rating">{t('shelf.sort.rating')}</SelectItem>
                        <SelectItem value="year">{t('shelf.sort.year')}</SelectItem>
                        <SelectItem value="completion">{t('shelf.sort.completion')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="w-full sm:w-auto">
                <Label className="text-sm font-medium mb-1 block sm:invisible">{t('shelf.order')}</Label> 
                <Button
                    variant="outline"
                    onClick={() => { const newOrder = sortOrder === 'asc' ? 'desc' : 'asc'; rendererLogger.debug(`Sort order changed: ${newOrder}`, { category: 'ui-sort', sortOrder: newOrder }); setSortOrder(newOrder);}}
                    className="w-full"
                    aria-label={t('shelf.sortOrderLabel', { order: sortOrder === 'asc' ? t('shelf.ascending') : t('shelf.descending') })}
                >
                    {sortOrder === 'asc' ? <ArrowUpAZ className="mr-2 h-4 w-4" /> : <ArrowDownAZ className="mr-2 h-4 w-4" />}
                    {sortOrder === 'asc' ? t('shelf.ascending') : t('shelf.descending')}
                </Button>
            </div>
        </div>

        {apiError && shelf.length > 0 && !isLoadingRelations && ( 
          <Alert variant="destructive" className="mb-6">
            <Info className="h-4 w-4" />
            <AlertTitle>{t('shelf.relationsErrorTitle')}</AlertTitle>
            <AlertDescription>
              {t(apiError.key, apiError.params)} {t('shelf.relationsFailedHint')}
              <Button variant="link" size="sm" onClick={() => setRelationsRetryToken(t => t + 1)} className="p-0 h-auto ml-2 text-destructive-foreground hover:underline">
                {t('shelf.retryRelations')}
</Button>
            </AlertDescription>
          </Alert>
        )}

        {showInitialLoadingSkeletons && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
           {renderSkeletons(INITIAL_LOAD_COUNT)}
          </div>
        )}

        {!showInitialLoadingSkeletons && displayedShelfItems.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {displayedShelfItems.map(groupedItem => {
                if (groupedItem.isGroup) {
                  return <AnimeGroupCard key={groupedItem.id} group={groupedItem.items} relationsMap={relationsMap} />;
                } else {
                  const userAnime = groupedItem.items[0];
                  const partialJikanAnime: Partial<JikanAnime> = {
                      mal_id: userAnime.mal_id, title: userAnime.title,
                      images: { jpg: { image_url: userAnime.cover_image, large_image_url: userAnime.cover_image }, webp: { image_url: userAnime.cover_image, large_image_url: userAnime.cover_image } },
                      episodes: userAnime.total_episodes,
                      genres: userAnime.genres.map(g => ({ name: g, mal_id: 0, type: 'genre', url: ''})), 
                      studios: userAnime.studios.map(s => ({ name: s, mal_id: 0, type: 'studio', url: ''})),
                      type: userAnime.type, year: userAnime.year, season: userAnime.season,
                  };
                  return <AnimeCard key={`shelf-${userAnime.mal_id}`} anime={partialJikanAnime as JikanAnime} shelfItem={userAnime} />;
                }
              })}
            </div>
            {hasMoreShelfItems && (
              <div ref={loadMoreRef} className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">{t('shelf.loadingMore')}</span>
              </div>
            )}
            {isLoadingRelations && shelf.length > 0 && displayedShelfItems.length > 0 && ( 
                 <div className="text-center py-4 text-sm text-muted-foreground">
                    <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />
                    {t('shelf.updatingSeries', { loaded: relationsLoadedCount, total: shelf.length })}
                </div>
            )}
          </>
        )}

        {!showInitialLoadingSkeletons && shelfInitialized && itemsPassingOtherFilters.length > 0 && displayedShelfItems.length === 0 && !isLoadingRelations &&(
           <div className="text-center py-10">
            <ListFilter className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-xl font-semibold">{t('shelf.noMatchTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('shelf.noMatchHint')}
            </p>
          </div>
        )}
        
        {!showInitialLoadingSkeletons && shelfInitialized && itemsPassingOtherFilters.length === 0 && shelf.length > 0 && !isLoadingRelations &&(
           <div className="text-center py-10">
            <ListFilter className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-xl font-semibold">{t('shelf.noMatchTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('shelf.noMatchHint')}
            </p>
          </div>
        )}

        {!showInitialLoadingSkeletons && shelfInitialized && shelf.length === 0 && (
          <div className="text-center py-10">
            <Search className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-xl font-semibold">{t('shelf.emptyTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('shelf.emptyHint')}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
