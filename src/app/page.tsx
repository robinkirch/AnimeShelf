
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/anime/AnimeCard";
import { AnimeGroupCard } from "@/components/anime/AnimeGroupCard";
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { jikanApi } from '@/lib/jikanApi';
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
import { StatusDistributionBar } from '@/components/shelf/StatusDistributionBar';


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
type SortOrder = 'asc' | 'desc';

export default function MyShelfPage() {
  const { shelf, isInitialized: shelfInitialized } = useAnimeShelf();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<JikanAnime[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);

  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [aiSearchResults, setAiSearchResults] = useState<JikanAnime[]>([]);
  const [isLoadingAiSearch, setIsLoadingAiSearch] = useState(false);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);
  
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
  const [apiError, setApiError] = useState<string | null>(null);

  const [displayedShelfItems, setDisplayedShelfItems] = useState<GroupedShelfItem[]>([]);
  const [hasMoreShelfItems, setHasMoreShelfItems] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (shelfInitialized) {
      setIsLoadingShelf(false);
      if (shelf.length > 0) {
        fetchRelationsForAllShelfItems();
      } else {
        setIsLoadingRelations(false); 
      }
    }
  }, [shelfInitialized, shelf]);

  const fetchRelationsForAllShelfItems = useCallback(async () => {
    if (shelf.length === 0) {
        setRelationsMap(new Map());
        setIsLoadingRelations(false);
        return;
    }
    setIsLoadingRelations(true);
    setApiError(null);
    const newRelationsMap = new Map<number, JikanAnimeRelation[]>();
    try {
      for (const anime of shelf) {
        if (!relationsMap.has(anime.mal_id)) { 
          const relations = await jikanApi.getAnimeRelations(anime.mal_id);
          if (relations) { 
            newRelationsMap.set(anime.mal_id, relations);
          } else {
            newRelationsMap.set(anime.mal_id, []);
          }
        } else {
          newRelationsMap.set(anime.mal_id, relationsMap.get(anime.mal_id)!);
        }
      }
    } catch (e) {
        console.error("Error fetching relations for shelf items:", e);
        setApiError("Could not load all series details due to API issues. Some groupings may be incomplete.");
    } finally {
        setIsLoadingRelations(false);
        setRelationsMap(prev => new Map([...Array.from(prev.entries()), ...Array.from(newRelationsMap.entries())]));
    }
  }, [shelf, relationsMap]); 

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsLoadingSearch(true);
    setApiError(null);
    try {
        const results = await jikanApi.searchAnime(searchQuery);
        const uniqueResults = Array.from(new Map(results.map(item => [item.mal_id, item])).values());
        setSearchResults(uniqueResults);
    } catch (e) {
        console.error("Error searching anime:", e);
        setApiError("Failed to perform search due to API issues. Please try again later.");
        setSearchResults([]);
    }
    setIsLoadingSearch(false);
  };

  const handleAiSearch = async () => {
    if (!aiSearchQuery.trim()) {
      setAiSearchResults([]);
      return;
    }
    setIsLoadingAiSearch(true);
    setAiSearchError(null);
    try {
      const input: AiSearchInput = { query: aiSearchQuery };
      const results = await searchAnimeWithAi(input);
      const uniqueResults = Array.from(new Map(results.map(item => [item.mal_id, item])).values());
      setAiSearchResults(uniqueResults);
    } catch (e) {
      console.error("Error searching anime with AI:", e);
      setAiSearchError("Failed to perform AI search. Please try again later.");
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
    if (!shelfInitialized || (shelf.length > 0 && relationsMap.size === 0 && isLoadingRelations) ) { 
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

    const sortedShelfForGrouping = [...fullyFilteredAnime].sort((a, b) => a.title.localeCompare(b.title));

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
                    if (['Sequel', 'Prequel', 'Parent story', 'Full story', 'Side story'].includes(relation.relation)) {
                        for (const entry of relation.entry) {
                            if (shelfItemsMap.has(entry.mal_id) && !currentSeriesMalIds.has(entry.mal_id)) {
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
            .sort((a,b) => (a.mal_id) - (b.mal_id)); 

        if (groupItems.length > 0) {
            const representative = groupItems.find(item => item.mal_id === anime.mal_id) || groupItems[0];
            
            finalGroupedItems.push({
                id: representative.mal_id.toString() + (groupItems.length > 1 ? "_group" : "_single"),
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
        case 'title':
          valA = repA.title;
          valB = repB.title;
          break;
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
              let current = 0;
              let total = 0;
              let hasValidTotal = false;
              items.forEach(item => {
                current += item.current_episode;
                if (item.total_episodes !== null && item.total_episodes > 0) {
                  total += item.total_episodes;
                  hasValidTotal = true;
                } else if (item.total_episodes === 0) { 
                  hasValidTotal = true; 
                }
              });
              if (!hasValidTotal || (total === 0 && current > 0) ) return -1; 
              if (total === 0 && current === 0) return 1; 
              return total === 0 ? -1 : current / total; 
            } else {
              const item = items[0];
              if (item.total_episodes === null) return -1;
              if (item.total_episodes === 0) return item.current_episode >= 0 ? 1 : -1; 
              return item.current_episode / item.total_episodes;
            }
          };
          valA = getCompletion(a.items, a.isGroup);
          valB = getCompletion(b.items, b.isGroup);
          break;
        default:
          valA = repA.title;
          valB = repB.title;
      }

      let comparison = 0;
      if (valA === null || valA === undefined) valA = sortOrder === 'asc' ? Infinity : -Infinity;
      if (valB === null || valB === undefined) valB = sortOrder === 'asc' ? Infinity : -Infinity;

      if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else {
        const strA = String(valA);
        const strB = String(valB);
        comparison = strA.localeCompare(strB);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sortedFinalItems;

  }, [itemsPassingOtherFilters, statusFilter, relationsMap, shelfInitialized, isLoadingRelations, sortOption, sortOrder, shelf.length]);

  useEffect(() => {
    if (groupedAndFilteredShelf.length > 0) {
      setDisplayedShelfItems(groupedAndFilteredShelf.slice(0, INITIAL_LOAD_COUNT));
      setHasMoreShelfItems(groupedAndFilteredShelf.length > INITIAL_LOAD_COUNT);
    } else {
      setDisplayedShelfItems([]);
      setHasMoreShelfItems(false);
    }
  }, [groupedAndFilteredShelf]);

  const handleLoadMoreShelfItems = useCallback(() => {
    if (displayedShelfItems.length >= groupedAndFilteredShelf.length) {
      setHasMoreShelfItems(false);
      return;
    }
    const currentLength = displayedShelfItems.length;
    const nextItems = groupedAndFilteredShelf.slice(currentLength, currentLength + SUBSEQUENT_LOAD_COUNT);
    setDisplayedShelfItems(prevItems => [...prevItems, ...nextItems]);
    setHasMoreShelfItems((currentLength + SUBSEQUENT_LOAD_COUNT) < groupedAndFilteredShelf.length);
  }, [displayedShelfItems, groupedAndFilteredShelf]);

  useEffect(() => {
    const currentRef = loadMoreRef.current;
    if (!currentRef || !hasMoreShelfItems || isLoadingShelf || isLoadingRelations) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          handleLoadMoreShelfItems();
        }
      },
      { threshold: 0.1 } 
    );

    observer.observe(currentRef);

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      observer.disconnect();
    };
  }, [loadMoreRef, hasMoreShelfItems, handleLoadMoreShelfItems, isLoadingShelf, isLoadingRelations]);


  const clearFilters = () => {
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
    if (genreFilter.length === 0) return "All Genres";
    if (uniqueGenres.length > 0 && genreFilter.length === uniqueGenres.length) return "All Genres";
    if (genreFilter.length > 2) return `${genreFilter.slice(0, 2).join(', ')}, +${genreFilter.length - 2} more`;
    return genreFilter.join(', ');
  };

  const getTypeFilterDisplayValue = () => {
    if (typeFilter.length === 0) return "All Types";
    if (ANIME_TYPE_FILTER_OPTIONS.length > 0 && typeFilter.length === ANIME_TYPE_FILTER_OPTIONS.length) return "All Types";
    if (typeFilter.length > 2) {
      const displayedTypes = typeFilter.slice(0, 2).map(val => ANIME_TYPE_FILTER_OPTIONS.find(opt => opt.value === val)?.label || val);
      return `${displayedTypes.join(', ')}, +${typeFilter.length - 2} more`;
    }
    return typeFilter.map(val => ANIME_TYPE_FILTER_OPTIONS.find(opt => opt.value === val)?.label || val).join(', ');
  };


  return (
    <div className="space-y-8">
      <section className="bg-card p-6 rounded-lg shadow-sm">
        <h1 className="text-3xl font-bold mb-2 text-primary">Find Your Next Obsession</h1>
        <p className="text-muted-foreground mb-6">Search for anime by title or use AI to find anime based on description.</p>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="standard-search-input" className="text-sm font-medium mb-1 block">Standard Search</Label>
            <div className="flex gap-2">
              <Input
                id="standard-search-input"
                type="search"
                placeholder="Search for anime by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-grow"
              />
              <Button onClick={handleSearch} disabled={isLoadingSearch}>
                {isLoadingSearch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Search
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="ai-search-input" className="text-sm font-medium mb-1 block">AI-Powered Search</Label>
            <div className="flex gap-2">
              <Input
                id="ai-search-input"
                type="search"
                placeholder="Describe the anime you're looking for..."
                value={aiSearchQuery}
                onChange={(e) => setAiSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAiSearch()}
                className="flex-grow"
              />
              <Button onClick={handleAiSearch} disabled={isLoadingAiSearch} variant="outline">
                {isLoadingAiSearch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-yellow-500" />}
                Search with AI
              </Button>
            </div>
          </div>
        </div>
        
        {apiError && (
          <Alert variant="destructive" className="mt-4">
            <Info className="h-4 w-4" />
            <AlertTitle>API Error</AlertTitle>
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}
        {aiSearchError && (
          <Alert variant="destructive" className="mt-4">
            <Info className="h-4 w-4" />
            <AlertTitle>AI Search Error</AlertTitle>
            <AlertDescription>{aiSearchError}</AlertDescription>
          </Alert>
        )}


        {(isLoadingSearch || isLoadingAiSearch) && (
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
            {renderSkeletons(4)}
          </div>
        )}

        {!isLoadingSearch && searchResults.length > 0 && (
          <div className="mt-6">
            <h2 className="text-2xl font-semibold mb-4">Search Results</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {searchResults.map(anime => (
                <AnimeCard key={`search-${anime.mal_id}`} anime={anime} />
              ))}
            </div>
          </div>
        )}
        {!isLoadingSearch && searchQuery && searchResults.length === 0 && !apiError && !isLoadingAiSearch && aiSearchResults.length === 0 && (
          <p className="text-center text-muted-foreground py-4 mt-4">No results found for "{searchQuery}". Try a different title or use AI search.</p>
        )}

        {!isLoadingAiSearch && aiSearchResults.length > 0 && (
          <div className="mt-6">
            <h2 className="text-2xl font-semibold mb-4">AI Search Results</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {aiSearchResults.map(anime => (
                <AnimeCard key={`ai-search-${anime.mal_id}`} anime={anime} />
              ))}
            </div>
          </div>
        )}
        {!isLoadingAiSearch && aiSearchQuery && aiSearchResults.length === 0 && !aiSearchError && !isLoadingSearch && searchResults.length === 0 && (
          <p className="text-center text-muted-foreground py-4 mt-4">AI search found no results for "{aiSearchQuery}". Try rephrasing your description.</p>
        )}

      </section>

      <Separator />

      <section>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-3xl font-bold text-primary">My Anime Shelf</h2>
          <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={clearFilters} className="text-sm">
                <X className="mr-2 h-4 w-4" /> Clear All Filters
              </Button>
          </div>
        </div>

        {shelfInitialized && shelf.length > 0 && (
          <StatusDistributionBar shelf={shelf} />
        )}
        
        <div className="mb-6 p-4 bg-card rounded-lg shadow-sm">
            <Label htmlFor="local-shelf-search" className="text-sm font-medium mb-1 block">Search My Shelf</Label>
            <div className="relative">
                <SearchCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    id="local-shelf-search"
                    type="search"
                    placeholder="Search by title in your shelf..."
                    value={localShelfSearchQuery}
                    onChange={(e) => setLocalShelfSearchQuery(e.target.value)}
                    className="pl-10 w-full" 
                />
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-card rounded-lg shadow-sm">
          <div>
            <Label htmlFor="genre-filter-shelf" className="text-sm font-medium mb-1 block">Genre</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" id="genre-filter-shelf" className="w-full justify-between text-left font-normal">
                  <span className="truncate flex-grow">{getGenreFilterDisplayValue()}</span>
                  <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                {uniqueGenres.map((genre) => (
                  <DropdownMenuCheckboxItem
                    key={genre}
                    checked={genreFilter.includes(genre)}
                    onCheckedChange={(checked) => {
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
            <Label htmlFor="status-filter" className="text-sm font-medium mb-1 block">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as UserAnimeStatus | typeof ALL_FILTER_VALUE)}>
              <SelectTrigger id="status-filter"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>All Statuses ({statusCounts[ALL_FILTER_VALUE] ?? 0})</SelectItem>
                {USER_ANIME_STATUS_OPTIONS.map(opt => 
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label} ({statusCounts[opt.value] ?? 0})
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rating-filter" className="text-sm font-medium mb-1 block">Rating</Label>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger id="rating-filter"><SelectValue placeholder="All Ratings" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>All Ratings</SelectItem>
                {RATING_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="type-filter-shelf" className="text-sm font-medium mb-1 block">Type</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" id="type-filter-shelf" className="w-full justify-between text-left font-normal">
                  <span className="truncate flex-grow">{getTypeFilterDisplayValue()}</span>
                  <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                {ANIME_TYPE_FILTER_OPTIONS.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={typeFilter.includes(option.value)}
                    onCheckedChange={(checked) => {
                      setTypeFilter(prev =>
                        checked ? [...prev, option.value] : prev.filter(v => v !== option.value)
                      );
                    }}
                    onSelect={(e) => e.preventDefault()} 
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-card rounded-lg shadow-sm items-end">
            <div className="flex-grow w-full sm:w-auto">
                <Label htmlFor="sort-option" className="text-sm font-medium mb-1 block">Sort By</Label>
                <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                    <SelectTrigger id="sort-option" className="w-full">
                        <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="title">Title</SelectItem>
                        <SelectItem value="rating">Rating</SelectItem>
                        <SelectItem value="year">Release Year</SelectItem>
                        <SelectItem value="completion">Completion Ratio</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="w-full sm:w-auto">
                <Label className="text-sm font-medium mb-1 block sm:invisible">Order</Label> {/* Label for spacing */}
                <Button 
                    variant="outline" 
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} 
                    className="w-full"
                >
                    {sortOrder === 'asc' ? <ArrowUpAZ className="mr-2 h-4 w-4" /> : <ArrowDownAZ className="mr-2 h-4 w-4" />}
                    {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                </Button>
            </div>
        </div>


        {apiError && shelf.length > 0 && ( 
          <Alert variant="destructive" className="mb-6">
            <Info className="h-4 w-4" />
            <AlertTitle>API Error Loading Relations</AlertTitle>
            <AlertDescription>
              {apiError} Some anime may not be grouped correctly.
              <Button variant="link" size="sm" onClick={fetchRelationsForAllShelfItems} className="p-0 h-auto ml-2 text-destructive-foreground hover:underline">
                Retry fetching details
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {(isLoadingShelf || (shelf.length > 0 && isLoadingRelations && displayedShelfItems.length === 0)) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
           {renderSkeletons(INITIAL_LOAD_COUNT)}
          </div>
        )}
        
        {!isLoadingShelf && !isLoadingRelations && displayedShelfItems.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {displayedShelfItems.map(groupedItem => {
                if (groupedItem.isGroup) {
                  return <AnimeGroupCard key={groupedItem.id} group={groupedItem.items} relationsMap={relationsMap} />;
                } else {
                  const userAnime = groupedItem.items[0];
                  const partialJikanAnime: Partial<JikanAnime> = { 
                      mal_id: userAnime.mal_id,
                      title: userAnime.title,
                      images: { jpg: { image_url: userAnime.cover_image, large_image_url: userAnime.cover_image }, webp: { image_url: userAnime.cover_image, large_image_url: userAnime.cover_image } },
                      episodes: userAnime.total_episodes,
                      genres: userAnime.genres.map(g => ({ name: g, mal_id: 0, type: '', url: ''})), 
                      studios: userAnime.studios.map(s => ({ name: s, mal_id: 0, type: '', url: ''})),
                      type: userAnime.type,
                      year: userAnime.year,
                      season: userAnime.season,
                  };
                  return <AnimeCard key={`shelf-${userAnime.mal_id}`} anime={partialJikanAnime as JikanAnime} shelfItem={userAnime} />;
                }
              })}
            </div>
            {hasMoreShelfItems && (
              <div ref={loadMoreRef} className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading more...</span>
              </div>
            )}
          </>
        )}

        {!isLoadingShelf && !isLoadingRelations && groupedAndFilteredShelf.length === 0 && shelf.length > 0 && (
           <div className="text-center py-10">
            <ListFilter className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-xl font-semibold">No Anime Match Filters</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your filters or local shelf search, or adding more anime to your shelf.
            </p>
          </div>
        )}
        
        {!isLoadingShelf && !isLoadingRelations && shelf.length === 0 && (
          <div className="text-center py-10">
            <Search className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-xl font-semibold">Your Shelf is Empty</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Search for anime above and add them to start tracking.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

