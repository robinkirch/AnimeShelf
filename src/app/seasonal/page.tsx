"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { AnimeCard } from "@/components/anime/AnimeCard";
import { jikanApi } from '@/lib/jikanApi';
import type { JikanAnime, JikanMALItem } from '@/types/anime';
import { Loader2, ListFilter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';


export default function SeasonalPage() {
  const [seasonalAnime, setSeasonalAnime] = useState<JikanAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [season, setSeason] = useState<string>(getCurrentSeasonName());

  const [genreFilter, setGenreFilter] = useState<string>('');
  const [studioFilter, setStudioFilter] = useState<string>('');

  function getCurrentSeasonName(): string {
    const month = new Date().getMonth();
    if (month < 3) return 'winter'; // Jan, Feb, Mar
    if (month < 6) return 'spring'; // Apr, May, Jun
    if (month < 9) return 'summer'; // Jul, Aug, Sep
    return 'fall';   // Oct, Nov, Dec
  }
  
  const availableYears = useMemo(() => {
    const currentYr = new Date().getFullYear();
    const years = [];
    for (let y = currentYr + 1; y >= 1980; y--) { // Jikan data goes back far
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
      const genreMatch = genreFilter ? anime.genres?.some(g => g.name === genreFilter) : true;
      const studioMatch = studioFilter ? anime.studios?.some(s => s.name === studioFilter) : true;
      return genreMatch && studioMatch;
    });
  }, [seasonalAnime, genreFilter, studioFilter]);

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
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
          <div>
            <Label htmlFor="genre-filter-seasonal" className="text-sm font-medium">Filter by Genre</Label>
            <Select value={genreFilter} onValueChange={setGenreFilter}>
              <SelectTrigger id="genre-filter-seasonal"><SelectValue placeholder="All Genres" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Genres</SelectItem>
                {uniqueGenres.map(genre => <SelectItem key={genre} value={genre}>{genre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="studio-filter-seasonal" className="text-sm font-medium">Filter by Studio</Label>
            <Select value={studioFilter} onValueChange={setStudioFilter}>
              <SelectTrigger id="studio-filter-seasonal"><SelectValue placeholder="All Studios" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Studios</SelectItem>
                {uniqueStudios.map(studio => <SelectItem key={studio} value={studio}>{studio}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
           <Button variant="outline" onClick={() => { setGenreFilter(''); setStudioFilter(''); }} className="self-end">
              Clear Filters
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
            <AnimeCard key={anime.mal_id} anime={anime} />
          ))}
        </div>
      )}
      
      {!isLoading && !error && filteredAnime.length === 0 && (
        <div className="text-center py-10">
          <ListFilter className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">No Anime Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            There are no anime matching your criteria for {season.charAt(0).toUpperCase() + season.slice(1)} {year}. Try different filters or season.
          </p>
        </div>
      )}
    </div>
  );
}
