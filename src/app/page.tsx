"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/anime/AnimeCard";
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { jikanApi } from '@/lib/jikanApi';
import type { JikanAnime, UserAnimeStatus, UserAnime } from '@/types/anime';
import { USER_ANIME_STATUS_OPTIONS, RATING_OPTIONS } from '@/types/anime';
import { Loader2, Search, ListFilter, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyShelfPage() {
  const { shelf, isInitialized: shelfInitialized } = useAnimeShelf();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<JikanAnime[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [isLoadingShelf, setIsLoadingShelf] = useState(true);
  
  const [genreFilter, setGenreFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<UserAnimeStatus | ''>('');
  const [ratingFilter, setRatingFilter] = useState<string>(''); // Store as string for select compatibility

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
      const genreMatch = genreFilter ? anime.genres.includes(genreFilter) : true;
      const statusMatch = statusFilter ? anime.user_status === statusFilter : true;
      const ratingMatch = ratingFilter ? anime.user_rating === parseInt(ratingFilter) : true;
      return genreMatch && statusMatch && ratingMatch;
    });
  }, [shelf, genreFilter, statusFilter, ratingFilter, shelfInitialized]);

  const clearFilters = () => {
    setGenreFilter('');
    setStatusFilter('');
    setRatingFilter('');
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
            <Label htmlFor="genre-filter" className="text-sm font-medium">Genre</Label>
            <Select value={genreFilter} onValueChange={setGenreFilter}>
              <SelectTrigger id="genre-filter"><SelectValue placeholder="All Genres" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Genres</SelectItem>
                {uniqueGenres.map(genre => <SelectItem key={genre} value={genre}>{genre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="status-filter" className="text-sm font-medium">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as UserAnimeStatus | '')}>
              <SelectTrigger id="status-filter"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                {USER_ANIME_STATUS_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rating-filter" className="text-sm font-medium">Rating</Label>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger id="rating-filter"><SelectValue placeholder="All Ratings" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Ratings</SelectItem>
                {RATING_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
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
              // We need a JikanAnime object for AnimeCard.
              // This means we either store it in UserAnime, or we need to fetch it.
              // For simplicity here, we'll assume AnimeCard can partially function with UserAnime data or we would fetch.
              // Let's construct a partial JikanAnime from UserAnime for now for display.
              // A more robust solution would fetch full data if needed or store more in UserAnime.
              const partialJikanAnime: JikanAnime = {
                mal_id: userAnime.mal_id,
                title: userAnime.title,
                images: { jpg: { image_url: userAnime.cover_image, large_image_url: userAnime.cover_image }, webp: { image_url: userAnime.cover_image, large_image_url: userAnime.cover_image } },
                episodes: userAnime.total_episodes,
                // These are placeholders or would need to be fetched/stored
                genres: userAnime.genres.map(g => ({ name: g, mal_id: 0, type: '', url: ''})), 
                studios: userAnime.studios.map(s => ({ name: s, mal_id: 0, type: '', url: ''})),
                // Add other required JikanAnime fields with default/empty values
                url: '', approved: true, titles: [{type: 'Default', title: userAnime.title}], type: 'TV', source: 'Unknown', status: 'Unknown', airing: false, score: null, scored_by: null, synopsis: null, producers: [], licensors: [],
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
