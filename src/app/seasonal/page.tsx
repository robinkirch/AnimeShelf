
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AnimeCard } from "@/components/anime/AnimeCard";
import { jikanApi, isAbortError, JikanApiError } from '@/lib/jikanApi';
import type { JikanAnime, JikanMALItem } from '@/types/anime';
import { ANIME_TYPE_FILTER_OPTIONS } from '@/types/anime';
import { Loader2, ListFilter, ChevronDown, X, ChevronRight, CalendarClock } from 'lucide-react';
import { useI18n, type MessageKey } from '@/i18n/I18nContext';
import { seasonLabel, typeLabel } from '@/i18n/labels';
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
import { Badge } from '@/components/ui/badge'; // Added Badge import

const ALL_FILTER_VALUE = "_all_"; // Still used by studio filter
const seasons = ['winter', 'spring', 'summer', 'fall'];

function getCurrentSeasonName(): string {
  const month = new Date().getMonth();
  if (month < 3) return 'winter';
  if (month < 6) return 'spring';
  if (month < 9) return 'summer';
  return 'fall';
}

export default function SeasonalPage() {
  const [seasonalAnime, setSeasonalAnime] = useState<JikanAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useI18n();
  // Stored as a message key so it is shown in the current UI language.
  const [error, setError] = useState<MessageKey | null>(null);

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [season, setSeason] = useState<string>(getCurrentSeasonName());

  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [studioFilter, setStudioFilter] = useState<string>(ALL_FILTER_VALUE);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [reloadToken, setReloadToken] = useState(0);


  
  const availableYears = useMemo(() => {
    const currentYr = new Date().getFullYear();
    const years = [];
    for (let y = currentYr + 2; y >= 1980; y--) { // Allow selecting 2 years into future for "Next" button
      years.push(y);
    }
    return years;
  }, []);

  const isFutureSelectedSeason = useMemo(() => {
    const currentYr = new Date().getFullYear();
    const currentSsn = getCurrentSeasonName();
    const currentSeasonIndex = seasons.indexOf(currentSsn);
    const selectedSeasonIndex = seasons.indexOf(season);

    if (year > currentYr) {
      return true;
    }
    if (year === currentYr && selectedSeasonIndex > currentSeasonIndex) {
      return true;
    }
    return false;
  }, [year, season]);


  useEffect(() => {
    // Abort on season change/unmount so a slow, stale response can't overwrite the current season.
    const controller = new AbortController();
    const fetchSeasonalData = async () => {
      setIsLoading(true);
      setError(null);
      setSeasonalAnime([]);
      try {
        const data = await jikanApi.getSeason(year, season, { signal: controller.signal });
        setSeasonalAnime(data);
        setIsLoading(false);
      } catch (e) {
        if (isAbortError(e)) return;
        console.error(e);
        setError(e instanceof JikanApiError ? `apiErrors.${e.code}` : 'apiErrors.failed');
        setIsLoading(false);
      }
    };

    fetchSeasonalData();
    return () => controller.abort();
  }, [year, season, reloadToken]);

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

  const handleNextSeason = useCallback(() => {
    const currentSeasonIndex = seasons.indexOf(season);
    if (currentSeasonIndex === -1) return; // Should not happen

    if (currentSeasonIndex === seasons.length - 1) { // Fall -> Winter
      setSeason(seasons[0]); // Winter
      setYear(prevYear => prevYear + 1);
    } else {
      setSeason(seasons[currentSeasonIndex + 1]);
    }
  }, [season]);

  const getGenreFilterDisplayValue = () => {
    if (genreFilter.length === 0) {
      return t('shelf.allGenres');
    }
    if (uniqueGenres.length > 0 && genreFilter.length === uniqueGenres.length) {
       return t('shelf.allGenres');
    }
    if (genreFilter.length > 2) {
      return `${genreFilter.slice(0, 2).join(', ')}, ${t('common.moreCount', { count: genreFilter.length - 2 })}`;
    }
    return genreFilter.join(', ');
  };

  const getTypeFilterDisplayValue = () => {
    if (typeFilter.length === 0) {
      return t('shelf.allTypes');
    }
    if (ANIME_TYPE_FILTER_OPTIONS.length > 0 && typeFilter.length === ANIME_TYPE_FILTER_OPTIONS.length) {
      return t('shelf.allTypes');
    }
     if (typeFilter.length > 2) {
      const displayedTypes = typeFilter
        .slice(0, 2)
        .map(val => typeLabel(t, val));
      return `${displayedTypes.join(', ')}, ${t('common.moreCount', { count: typeFilter.length - 2 })}`;
    }
    return typeFilter
      .map(val => typeLabel(t, val))
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
      <section className="bg-card p-6 rounded-lg shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-primary">{t('seasonal.title')}</h1>
            {isFutureSelectedSeason && (
              <Badge variant="outline" className="border-accent text-accent">
                <CalendarClock className="mr-1.5 h-4 w-4" />
                {t('seasonal.future')}
</Badge>
            )}
          </div>
          <div className="flex gap-2 flex-wrap justify-center md:justify-end items-center">
            <Select value={year.toString()} onValueChange={(val) => setYear(parseInt(val))}>
              <SelectTrigger className="w-[120px] text-sm h-10">
                <SelectValue placeholder={t('seasonal.year')} />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={season} onValueChange={setSeason}>
              <SelectTrigger className="w-[120px] text-sm h-10">
                <SelectValue placeholder={t('seasonal.season')} />
              </SelectTrigger>
              <SelectContent>
                {seasons.map(s => <SelectItem key={s} value={s}>{seasonLabel(t, s)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleNextSeason} variant="outline" size="sm" className="h-10 px-3">
              {t('seasonal.next')} <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
          <div>
            <Label htmlFor="genre-filter-seasonal" className="text-sm font-medium mb-1 block">{t('shelf.genre')}</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" id="genre-filter-seasonal" className="w-full justify-between text-left font-normal">
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
            <Label htmlFor="studio-filter-seasonal" className="text-sm font-medium mb-1 block">{t('seasonal.studio')}</Label>
            <Select value={studioFilter} onValueChange={setStudioFilter}>
              <SelectTrigger id="studio-filter-seasonal"><SelectValue placeholder={t('seasonal.allStudios')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>{t('seasonal.allStudios')}</SelectItem>
                {uniqueStudios.map(studio => <SelectItem key={studio} value={studio}>{studio}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="type-filter-seasonal" className="text-sm font-medium mb-1 block">{t('shelf.type')}</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" id="type-filter-seasonal" className="w-full justify-between text-left font-normal">
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
           <Button variant="outline" onClick={clearFilters} className="self-end mt-auto sm:mt-0"> 
              <X className="mr-2 h-4 w-4" /> {t('common.clearFilters')}
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
          <p>{t(error)}</p>
          <Button onClick={() => setReloadToken(token => token + 1)} className="mt-4">{t('common.tryAgain')}</Button>
        </div>
      )}

      {!isLoading && !error && filteredAnime.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredAnime.map(anime => (
            <AnimeCard key={`${anime.mal_id}-${year}-${season}`} anime={anime} />
          ))}
        </div>
      )}
      
      {!isLoading && !error && filteredAnime.length === 0 && seasonalAnime.length > 0 && (
        <div className="text-center py-10">
          <ListFilter className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">{t('shelf.noMatchTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('seasonal.noMatchHint', { season: seasonLabel(t, season), year })}
          </p>
        </div>
      )}

      {!isLoading && !error && seasonalAnime.length === 0 && (
         <div className="text-center py-10">
          <ListFilter className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">{t('seasonal.noAnimeTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('seasonal.noAnimeHint', { season: seasonLabel(t, season), year })}
          </p>
        </div>
      )}
    </div>
  );
}

