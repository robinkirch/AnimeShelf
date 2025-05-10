
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { jikanApi } from '@/lib/jikanApi';
import type { JikanAnime } from '@/types/anime';
import { AnimeCard } from '@/components/anime/AnimeCard';
import { Loader2, Tv, AlertCircle, CalendarClock, History } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function PreviewPage() {
  const { shelf, isInitialized: shelfInitialized, setUpcomingSequels: setContextUpcomingSequels } = useAnimeShelf();
  
  const [futureSeasonalAnime, setFutureSeasonalAnime] = useState<JikanAnime[]>([]);
  const [otherContinuations, setOtherContinuations] = useState<JikanAnime[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("Initializing...");

  const shelfMalIds = useMemo(() => new Set(shelf.map(a => a.mal_id)), [shelf]);

  const monthToSeasonIndex = useCallback((month: number): number => {
    if (month < 3) return 0; // Winter (Jan, Feb, Mar)
    if (month < 6) return 1; // Spring (Apr, May, Jun)
    if (month < 9) return 2; // Summer (Jul, Aug, Sep)
    return 3; // Fall (Oct, Nov, Dec)
  }, []);

  const isFutureSeasonOrAirDate = useCallback((anime: JikanAnime): boolean => {
    if (anime.status === "Not yet aired") return true;
    if (anime.airing && anime.aired?.from && new Date(anime.aired.from) > new Date()) return true;
    
    if (anime.year === null || anime.season === null) return false;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-11
    const seasonOrder: { [key: string]: number } = { winter: 0, spring: 1, summer: 2, fall: 3 };
    const currentSeasonIndex = monthToSeasonIndex(currentMonth);
    
    const targetSeasonIndex = seasonOrder[anime.season.toLowerCase()];

    if (targetSeasonIndex === undefined) return false; 

    if (anime.year > currentYear) return true;
    if (anime.year === currentYear && targetSeasonIndex > currentSeasonIndex) return true;
    
    return false;
  }, [monthToSeasonIndex]);


  const fetchAndCategorizeContinuations = useCallback(async () => {
    if (!shelfInitialized) {
      setStatusMessage("Waiting for shelf to initialize...");
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatusMessage("Analyzing your shelf for related anime...");
    
    const foundFutureAnime: JikanAnime[] = [];
    const foundOtherContinuations: JikanAnime[] = [];
    const processedRelatedAnimeMalIds = new Set<number>(); 

    try {
      let itemProcessed = 0;
      for (const userAnime of shelf) {
        itemProcessed++;
        setStatusMessage(`Processing ${itemProcessed}/${shelf.length}: ${userAnime.title}`);
        
        const relations = await jikanApi.getAnimeRelations(userAnime.mal_id);
        const potentialContinuations = relations
          .filter(rel => ['Sequel', 'Prequel', 'Alternative version', 'Other', 'Parent story', 'Full story', 'Spin-off', 'Side story'].includes(rel.relation))
          .flatMap(rel => rel.entry)
          .filter(entry => entry.type === 'anime');

        for (const potentialContinuation of potentialContinuations) {
          if (shelfMalIds.has(potentialContinuation.mal_id) || processedRelatedAnimeMalIds.has(potentialContinuation.mal_id)) {
            continue; 
          }

          const animeDetails = await jikanApi.getAnimeById(potentialContinuation.mal_id);
          if (animeDetails) {
            processedRelatedAnimeMalIds.add(animeDetails.mal_id);
            
            if (isFutureSeasonOrAirDate(animeDetails)) {
              if (!foundFutureAnime.some(s => s.mal_id === animeDetails.mal_id)) {
                  foundFutureAnime.push(animeDetails);
              }
            } else {
              if (!foundOtherContinuations.some(s => s.mal_id === animeDetails.mal_id)) {
                  foundOtherContinuations.push(animeDetails);
              }
            }
          }
        }
      }

      const sortAnime = (a: JikanAnime, b: JikanAnime) => {
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
      };
      
      foundFutureAnime.sort(sortAnime);
      // Sort past/ongoing chronologically, with newest first for relevance
      foundOtherContinuations.sort((a,b) => sortAnime(b,a));


      setFutureSeasonalAnime(foundFutureAnime);
      setOtherContinuations(foundOtherContinuations);
      setContextUpcomingSequels(foundFutureAnime); // Update context for header badge

      const totalFound = foundFutureAnime.length + foundOtherContinuations.length;
      setStatusMessage(totalFound > 0 ? `Found ${foundFutureAnime.length} upcoming and ${foundOtherContinuations.length} other related anime.` : "No new related anime found based on your shelf.");

    } catch (e: any) {
      console.error("Error fetching related anime:", e);
      setError(`Failed to fetch related anime. ${e.message || 'The Jikan API might be temporarily unavailable or rate limits exceeded.'}`);
      setStatusMessage("Error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [shelf, shelfInitialized, setContextUpcomingSequels, shelfMalIds, isFutureSeasonOrAirDate, monthToSeasonIndex]);

  useEffect(() => {
    if(shelfInitialized){ 
        fetchAndCategorizeContinuations();
    }
  }, [shelfInitialized, fetchAndCategorizeContinuations]);


  const renderSkeletons = (count: number) => (
    Array.from({ length: count }).map((_, index) => (
      <div key={index} className="border rounded-lg p-4 space-y-3">
        <Skeleton className="h-64 w-full" data-ai-hint="anime poster" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-10 w-full" />
      </div>
    ))
  );

  return (
    <div className="space-y-8">
      <section className="bg-card p-6 rounded-lg shadow-sm">
        <h1 className="text-3xl font-bold text-primary mb-2">Anime Continuations &amp; Previews</h1>
        <p className="text-muted-foreground mb-3">
          Discover upcoming seasons, prequels, sequels, and other related anime for series on your shelf.
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
          <Button onClick={fetchAndCategorizeContinuations} className="mt-4">Try Again</Button>
        </div>
      )}

      {!isLoading && !error && (
        <>
          <section className="space-y-6">
            <div className='flex items-center gap-2'>
              <CalendarClock className="h-7 w-7 text-primary" />
              <h2 className="text-2xl font-semibold text-primary">Upcoming Future Seasons &amp; Series</h2>
            </div>
            {futureSeasonalAnime.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {futureSeasonalAnime.map(anime => (
                  <AnimeCard key={`future-${anime.mal_id}`} anime={anime} />
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-card p-6 rounded-lg shadow-sm">
                <Tv className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-xl font-semibold">No New Upcoming Anime Found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  We couldn't find any new strictly upcoming continuations for the anime on your shelf.
                </p>
                 {shelf.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Add some anime to your shelf first.</p>}
              </div>
            )}
          </section>

          <Separator className="my-8" />

          <section className="space-y-6">
            <div className='flex items-center gap-2'>
              <History className="h-7 w-7 text-primary" />
              <h2 className="text-2xl font-semibold text-primary">Other Related Series (Past/Ongoing)</h2>
            </div>
            {otherContinuations.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {otherContinuations.map(anime => (
                  <AnimeCard key={`other-${anime.mal_id}`} anime={anime} />
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-card p-6 rounded-lg shadow-sm">
                <Tv className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-xl font-semibold">No Other Related Anime Found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  No past or currently ongoing (but already started) related series were found for items on your shelf.
                </p>
                {shelf.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Add some anime to your shelf first.</p>}
              </div>
            )}
          </section>
          
          {futureSeasonalAnime.length === 0 && otherContinuations.length === 0 && shelf.length > 0 && !isLoading && !error && (
             <div className="text-center py-10 bg-card p-6 rounded-lg shadow-sm mt-8">
                <Tv className="mx-auto h-16 w-16 text-muted-foreground" />
                <h3 className="mt-4 text-2xl font-semibold">No Related Anime Found</h3>
                <p className="mt-2 text-md text-muted-foreground">
                    We checked all anime on your shelf but couldn't find any related series (upcoming, past, or ongoing) that aren't already on your shelf.
                </p>
             </div>
          )}
           {shelf.length === 0 && !isLoading && !error && (
             <div className="text-center py-10 bg-card p-6 rounded-lg shadow-sm mt-8">
                <Tv className="mx-auto h-16 w-16 text-muted-foreground" />
                <h3 className="mt-4 text-2xl font-semibold">Your Shelf is Empty</h3>
                <p className="mt-2 text-md text-muted-foreground">
                    Add some anime to your shelf to discover related series here.
                </p>
             </div>
           )}
        </>
      )}
    </div>
  );
}

    