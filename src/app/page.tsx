
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/anime/AnimeCard";
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { jikanApi } from '@/lib/jikanApi';
import type { JikanAnime, UserAnimeStatus, UserAnime } from '@/types/anime';
import { USER_ANIME_STATUS_OPTIONS, RATING_OPTIONS, ANIME_TYPE_FILTER_OPTIONS } from '@/types/anime';
import { Loader2, Search, ListFilter, X, ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from "@/components/ui/label";

const ALL_FILTER_VALUE = "_all_"; // Still used by other filters

export default function MyShelfPage() {
  const { shelf, isInitialized: shelfInitialized } = useAnimeShelf();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<JikanAnime[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [isLoadingShelf, setIsLoadingShelf] = useState(true);
  
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<UserAnimeStatus | typeof ALL_FILTER_VALUE>(ALL_FILTER_VALUE);
  const [ratingFilter, setRatingFilter] = useState<string>(ALL_FILTER_VALUE);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);


  useEffect(() => {
    if (shelfInitialized) {
      setIsLoadingShelf(false);
    }
  }, [shelfInitialized]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsLoadingSearch(true);
    const results = await jikanApi.searchAnime(searchQuery);
    setSearchResults(results);
    setIsLoadingSearch(false);
  };
  
  const uniqueGenres = useMemo(() => {
    if (!shelfInitialized) return [];
    const allGenres = shelf.reduce((acc, anime) => {
      anime.genres.forEach(genre => acc.add(genre));
      return acc;
    }, new Set<string>());
    return Array.from(allGenres).sort();
  }, [shelf, shelfInitialized]);

  const filteredShelf = useMemo(() => {
    if (!shelfInitialized) return [];
    return shelf.filter(anime => {
      const genreMatch = genreFilter.length === 0 ? true : genreFilter.some(selectedGenre => anime.genres.includes(selectedGenre));
      const statusMatch = statusFilter === ALL_FILTER_VALUE ? true : anime.user_status === statusFilter;
      const ratingMatch = ratingFilter === ALL_FILTER_VALUE ? true : anime.user_rating === parseInt(ratingFilter);
      const typeMatch = typeFilter.length === 0 ? true : (anime.type ? typeFilter.includes(anime.type) : false);
      return genreMatch && statusMatch && ratingMatch && typeMatch;
    });
  }, [shelf, genreFilter, statusFilter, ratingFilter, typeFilter, shelfInitialized]);

  const clearFilters = () => {
    setGenreFilter([]);
    setStatusFilter(ALL_FILTER_VALUE);
    setRatingFilter(ALL_FILTER_VALUE);
    setTypeFilter([]);
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
    if (genreFilter.length === 0) {
      return "All Genres";
    }
    if (uniqueGenres.length > 0 && genreFilter.length === uniqueGenres.length) {
       return "All Genres";
    }
    if (genreFilter.length > 2) {
      return `${genreFilter.slice(0, 2).join(', ')}, +${genreFilter.length - 2} more`;
    }
    return genreFilter.join(', ');
  };

  const getTypeFilterDisplayValue = () => {
    if (typeFilter.length === 0) {
      return "All Types";
    }
    if (ANIME_TYPE_FILTER_OPTIONS.length > 0 && typeFilter.length === ANIME_TYPE_FILTER_OPTIONS.length) {
      return "All Types";
    }
    if (typeFilter.length > 2) {
      const displayedTypes = typeFilter
        .slice(0, 2)
        .map(val => ANIME_TYPE_FILTER_OPTIONS.find(opt => opt.value === val)?.label || val);
      return `${displayedTypes.join(', ')}, +${typeFilter.length - 2} more`;
    }
    return typeFilter
      .map(val => ANIME_TYPE_FILTER_OPTIONS.find(opt => opt.value === val)?.label || val)
      .join(', ');
  };


  return (
    <div className="space-y-8">
      <section className="bg-card p-6 rounded-lg shadow-sm">
        <h1 className="text-3xl font-bold mb-2 text-primary">Find Your Next Obsession</h1>
        <p className="text-muted-foreground mb-6">Search for anime and add them to your shelf to track your progress.</p>
        <div className="flex gap-2 mb-4">
          <Input
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

        {isLoadingSearch && (
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {renderSkeletons(4)}
          </div>
        )}

        {!isLoadingSearch && searchResults.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Search Results</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {searchResults.map(anime => (
                <AnimeCard key={anime.mal_id} anime={anime} />
              ))}
            </div>
          </div>
        )}
        {!isLoadingSearch && searchQuery && searchResults.length === 0 && (
          <p className="text-center text-muted-foreground py-4">No results found for "{searchQuery}". Try a different title.</p>
        )}
      </section>

      <Separator />

      <section>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-3xl font-bold text-primary">My Anime Shelf</h2>
          <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={clearFilters} className="text-sm">
                <X className="mr-2 h-4 w-4" /> Clear Filters
              </Button>
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
                <SelectItem value={ALL_FILTER_VALUE}>All Statuses</SelectItem>
                {USER_ANIME_STATUS_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
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

        {isLoadingShelf && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
           {renderSkeletons(8)}
          </div>
        )}
        
        {!isLoadingShelf && filteredShelf.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredShelf.map(userAnime => {
              const partialJikanAnime: JikanAnime = {
                mal_id: userAnime.mal_id,
                title: userAnime.title,
                images: { jpg: { image_url: userAnime.cover_image, large_image_url: userAnime.cover_image }, webp: { image_url: userAnime.cover_image, large_image_url: userAnime.cover_image } },
                episodes: userAnime.total_episodes,
                genres: userAnime.genres.map(g => ({ name: g, mal_id: 0, type: '', url: ''})), 
                studios: userAnime.studios.map(s => ({ name: s, mal_id: 0, type: '', url: ''})),
                type: userAnime.type, 
                url: '', approved: true, titles: [{type: 'Default', title: userAnime.title}], source: 'Unknown', status: 'Unknown', airing: false, score: null, scored_by: null, synopsis: null, producers: [], licensors: [], season: null, year: null,
              };
              return <AnimeCard key={userAnime.mal_id} anime={partialJikanAnime} shelfItem={userAnime} />;
            })}
          </div>
        )}

        {!isLoadingShelf && filteredShelf.length === 0 && shelf.length > 0 && (
           <div className="text-center py-10">
            <ListFilter className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-xl font-semibold">No Anime Match Filters</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your filters or adding more anime to your shelf.
            </p>
          </div>
        )}
        
        {!isLoadingShelf && shelf.length === 0 && (
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
