
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { AnimeCard } from "@/components/anime/AnimeCard";
import { jikanApi } from '@/lib/jikanApi';
import type { JikanAnime, JikanMALItem } from '@/types/anime';
import { ANIME_TYPE_FILTER_OPTIONS } from '@/types/anime';
import { Loader2, ListFilter, ChevronDown, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from "@/components/ui/label";

const ALL_FILTER_VALUE = "_all_"; // Still used by studio filter

export default function SeasonalPage() {
  const [seasonalAnime, setSeasonalAnime] = useState<JikanAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [season, setSeason] = useState<string>(getCurrentSeasonName());

  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [studioFilter, setStudioFilter] = useState<string>(ALL_FILTER_VALUE);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);


  function getCurrentSeasonName(): string {
    const month = new Date().getMonth();
    if (month < 3) return 'winter'; 
    if (month < 6) return 'spring'; 
    if (month < 9) return 'summer'; 
    return 'fall';   
  }
  
  const availableYears = useMemo(() => {
    const currentYr = new Date().getFullYear();
    const years = [];
    for (let y = currentYr + 1; y >= 1980; y--) { 
      years.push(y);
    }
    return years;
  }, []);
  const seasons = ['winter', 'spring', 'summer', 'fall'];


  useEffect(() => {
    const fetchSeasonalData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await jikanApi.getSeason(year, season);
        setSeasonalAnime(data);
      } catch (e) {
        console.error(e);
        setError('Failed to fetch seasonal anime. Please try again later.');
      }
      setIsLoading(false);
    };

    fetchSeasonalData();
  }, [year, season]);

  const uniqueGenres = useMemo(() => {
    const allGenres = new Set<string>();
    seasonalAnime.forEach(anime => {
      anime.genres?.forEach(genre => allGenres.add(genre.name));
    });
    return Array.from(allGenres).sort();
  }, [seasonalAnime]);

  const uniqueStudios = useMemo(() => {
    const allStudios = new Set<string>();
    seasonalAnime.forEach(anime => {
      anime.studios?.forEach(studio => allStudios.add(studio.name));
    });
    return Array.from(allStudios).sort();
  }, [seasonalAnime]);

  const filteredAnime = useMemo(() => {
    return seasonalAnime.filter(anime => {
      const genreMatch = genreFilter.length === 0 ? true : anime.genres?.some(animeGenre => genreFilter.includes(animeGenre.name));
      const studioMatch = studioFilter === ALL_FILTER_VALUE ? true : anime.studios?.some(s => s.name === studioFilter);
      const typeMatch = typeFilter.length === 0 ? true : (anime.type ? typeFilter.includes(anime.type) : false);
      return genreMatch && studioMatch && typeMatch;
    });
  }, [seasonalAnime, genreFilter, studioFilter, typeFilter]);

  const clearFilters = () => {
    setGenreFilter([]);
    setStudioFilter(ALL_FILTER_VALUE);
    setTypeFilter([]);
  };

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
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-primary">Seasonal Anime</h1>
          <div className="flex gap-2 flex-wrap justify-center md:justify-end">
            <Select value={year.toString()} onValueChange={(val) => setYear(parseInt(val))}>
              <SelectTrigger className="w-[120px] text-sm">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={season} onValueChange={setSeason}>
              <SelectTrigger className="w-[120px] text-sm">
                <SelectValue placeholder="Season" />
              </SelectTrigger>
              <SelectContent>
                {seasons.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
          <div>
            <Label htmlFor="genre-filter-seasonal" className="text-sm font-medium mb-1 block">Genre</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" id="genre-filter-seasonal" className="w-full justify-between text-left font-normal">
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
            <Label htmlFor="studio-filter-seasonal" className="text-sm font-medium mb-1 block">Studio</Label>
            <Select value={studioFilter} onValueChange={setStudioFilter}>
              <SelectTrigger id="studio-filter-seasonal"><SelectValue placeholder="All Studios" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>All Studios</SelectItem>
                {uniqueStudios.map(studio => <SelectItem key={studio} value={studio}>{studio}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="type-filter-seasonal" className="text-sm font-medium mb-1 block">Type</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" id="type-filter-seasonal" className="w-full justify-between text-left font-normal">
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
           <Button variant="outline" onClick={clearFilters} className="self-end mt-auto sm:mt-0"> 
              <X className="mr-2 h-4 w-4" /> Clear Filters
            </Button>
        </div>
      </section>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {renderSkeletons(12)}
        </div>
      )}

      {!isLoading && error && (
        <div className="text-center py-10 text-destructive">
          <p>{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">Try Again</Button>
        </div>
      )}

      {!isLoading && !error && filteredAnime.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredAnime.map(anime => (
            <AnimeCard key={`${anime.mal_id}-${anime.title}`} anime={anime} />
          ))}
        </div>
      )}
      
      {!isLoading && !error && filteredAnime.length === 0 && seasonalAnime.length > 0 && (
        <div className="text-center py-10">
          <ListFilter className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">No Anime Match Filters</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your filters for {season.charAt(0).toUpperCase() + season.slice(1)} {year}.
          </p>
        </div>
      )}

      {!isLoading && !error && seasonalAnime.length === 0 && (
         <div className="text-center py-10">
          <ListFilter className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">No Anime Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            There appears to be no anime data for {season.charAt(0).toUpperCase() + season.slice(1)} {year}. Try a different season or year.
          </p>
        </div>
      )}
    </div>
  );
}
