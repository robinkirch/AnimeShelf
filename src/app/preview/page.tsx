"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { jikanApi } from '@/lib/jikanApi';
import type { JikanAnime } from '@/types/anime';
import { AnimeCard } from '@/components/anime/AnimeCard';
import { Loader2, Tv, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export default function PreviewPage() {
  const { shelf, isInitialized: shelfInitialized, upcomingSequels, setUpcomingSequels } = useAnimeShelf();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("Initializing...");

  const shelfMalIds = useMemo(() => new Set(shelf.map(a => a.mal_id)), [shelf]);

  const monthToSeasonIndex = (month: number): number => {
    if (month < 3) return 0; // Winter (Jan, Feb, Mar)
    if (month < 6) return 1; // Spring (Apr, May, Jun)
    if (month < 9) return 2; // Summer (Jul, Aug, Sep)
    return 3; // Fall (Oct, Nov, Dec)
  };

  const isFutureSeason = useCallback((year: number | null, seasonName: string | null): boolean => {
    if (year === null || seasonName === null) return false;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-11
    const seasonOrder: { [key: string]: number } = { winter: 0, spring: 1, summer: 2, fall: 3 };
    const currentSeasonIndex = monthToSeasonIndex(currentMonth);
    
    const targetSeasonIndex = seasonOrder[seasonName.toLowerCase()];

    if (targetSeasonIndex === undefined) return false; // Invalid season name

    if (year > currentYear) return true;
    if (year === currentYear && targetSeasonIndex > currentSeasonIndex) return true;
    
    return false;
  }, []);


  const fetchUpcomingSequels = useCallback(async () => {
    if (!shelfInitialized) {
      setStatusMessage("Waiting for shelf to initialize...");
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatusMessage("Analyzing your shelf for upcoming anime...");
    let foundSequels: JikanAnime[] = [];
    const processedAnimeMalIds = new Set<number>(); 

    try {
      let itemProcessed = 0;
      for (const userAnime of shelf) {
        itemProcessed++;
        setStatusMessage(`Processing ${itemProcessed}/${shelf.length}: ${userAnime.title}`);
        
        const relations = await jikanApi.getAnimeRelations(userAnime.mal_id);
        const potentialSequels = relations
          .filter(rel => rel.relation === 'Sequel' || rel.relation === 'Prequel' || rel.relation === 'Alternative version' || rel.relation === 'Other' || rel.relation === 'Parent story' || rel.relation === 'Full story')
          .flatMap(rel => rel.entry)
          .filter(entry => entry.type === 'anime');

        for (const potentialSequel of potentialSequels) {
          if (shelfMalIds.has(potentialSequel.mal_id) || processedAnimeMalIds.has(potentialSequel.mal_id)) {
            continue; 
          }

          const animeDetails = await jikanApi.getAnimeById(potentialSequel.mal_id);
          if (animeDetails) {
            processedAnimeMalIds.add(animeDetails.mal_id);
            
            const isUpcoming = 
              animeDetails.status === "Not yet aired" ||
              (animeDetails.airing && animeDetails.aired?.from && new Date(animeDetails.aired.from) > new Date()) ||
              isFutureSeason(animeDetails.year, animeDetails.season);

            if (isUpcoming) {
              if (!foundSequels.some(s => s.mal_id === animeDetails.mal_id)) {
                  foundSequels.push(animeDetails);
              }
            }
          }
        }
      }

      foundSequels.sort((a, b) => {
        const dateA = a.aired?.from ? new Date(a.aired.from).getTime() : Infinity;
        const dateB = b.aired?.from ? new Date(b.aired.from).getTime() : Infinity;
        
        if(dateA !== Infinity && dateB !== Infinity) return dateA - dateB;
        if(dateA !== Infinity) return -1;
        if(dateB !== Infinity) return 1;

        const yearA = a.year ?? Infinity;
        const yearB = b.year ?? Infinity;
        if (yearA !== yearB) return yearA - yearB;

        const seasonOrder: { [key: string]: number } = { winter: 0, spring: 1, summer: 2, fall: 3 };
        const seasonA = a.season ? seasonOrder[a.season.toLowerCase()] ?? 4 : 4;
        const seasonB = b.season ? seasonOrder[b.season.toLowerCase()] ?? 4 : 4;
        return seasonA - seasonB;
      });

      setUpcomingSequels(foundSequels);
      setStatusMessage(foundSequels.length > 0 ? "Found upcoming anime!" : "No new upcoming anime found based on your shelf.");
    } catch (e: any) {
      console.error("Error fetching upcoming sequels:", e);
      setError(`Failed to fetch upcoming anime. ${e.message || 'The Jikan API might be temporarily unavailable or rate limits exceeded.'}`);
      setStatusMessage("Error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [shelf, shelfInitialized, setUpcomingSequels, shelfMalIds, isFutureSeason]);

  useEffect(() => {
    if(shelfInitialized){ // Only run if shelf is initialized
        fetchUpcomingSequels();
    }
  }, [shelfInitialized, fetchUpcomingSequels]);


  const renderSkeletons = (count: number) => (
    Array.from({ length: count }).map((_, index) => (
      <div key={index} className="border rounded-lg p-4 space-y-3">
        <Skeleton className="h-64 w-full" data-ai-hint="anime image" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-10 w-full" />
      </div>
    ))
  );
  
  const displayedSequels = useMemo(() => upcomingSequels.filter(seq => !shelfMalIds.has(seq.mal_id)), [upcomingSequels, shelfMalIds]);

  return (
    <div className="space-y-8">
      <section className="bg-card p-6 rounded-lg shadow-sm">
        <h1 className="text-3xl font-bold text-primary mb-4">Upcoming Continuations</h1>
        <p className="text-muted-foreground mb-2">
          Discover upcoming seasons and related anime for series on your shelf.
        </p>
        <p className="text-sm text-muted-foreground">
            Status: {statusMessage}
        </p>
      </section>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {renderSkeletons(8)}
        </div>
      )}

      {!isLoading && error && (
        <div className="text-center py-10 text-destructive bg-destructive/10 p-4 rounded-md">
          <AlertCircle className="mx-auto h-12 w-12 mb-2" />
          <h3 className="text-xl font-semibold mb-1">Error Fetching Data</h3>
          <p>{error}</p>
          <Button onClick={fetchUpcomingSequels} className="mt-4">Try Again</Button>
        </div>
      )}

      {!isLoading && !error && displayedSequels.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {displayedSequels.map(anime => (
            <AnimeCard key={anime.mal_id} anime={anime} />
          ))}
        </div>
      )}

      {!isLoading && !error && displayedSequels.length === 0 && (
        <div className="text-center py-10">
          <Tv className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">No New Upcoming Anime Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            We couldn't find any new upcoming continuations for the anime on your shelf, or they might already be on your shelf.
          </p>
           {shelf.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Add some anime to your shelf first to see recommendations here.</p>}
        </div>
      )}
    </div>
  );
}
