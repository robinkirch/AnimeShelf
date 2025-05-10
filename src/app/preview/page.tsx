
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { jikanApi } from '@/lib/jikanApi';
import type { JikanAnime, JikanAnimeRelation, JikanAnimeRelationEntry } from '@/types/anime';
import { AnimeCard } from '@/components/anime/AnimeCard';
import { Loader2, CalendarDays, Tv, Film, History, HelpCircle, ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from '@/components/ui/skeleton';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Not used

type CategorizedAnime = JikanAnime & {
  relationType?: string; // e.g., "Sequel", "Prequel"
  relatedTo?: string; // Title of the anime it's related to on the shelf
};

export default function PreviewPage() {
  const { shelf, setUpcomingSequels, isInitialized: shelfInitialized } = useAnimeShelf();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [futureAnime, setFutureAnime] = useState<CategorizedAnime[]>([]);
  const [otherContinuations, setOtherContinuations] = useState<CategorizedAnime[]>([]);
  
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const currentMonth = useMemo(() => new Date().getMonth(), []); // 0-11

  const getCurrentSeasonName = useCallback((): string => {
    if (currentMonth < 3) return 'winter'; 
    if (currentMonth < 6) return 'spring'; 
    if (currentMonth < 9) return 'summer'; 
    return 'fall';   
  }, [currentMonth]);
  const currentSeason = useMemo(() => getCurrentSeasonName(), [getCurrentSeasonName]);
  const seasonOrder = useMemo(() => ['winter', 'spring', 'summer', 'fall'], []);


  const isFutureSeasonOrAirDate = useCallback((anime: JikanAnime): boolean => {
    if (!anime.year && !anime.aired?.from) return false; 

    const animeYear = anime.year || (anime.aired?.from ? new Date(anime.aired.from).getFullYear() : 0);
    const animeSeason = anime.season?.toLowerCase();

    if (animeYear > currentYear) return true;
    if (animeYear === currentYear) {
      const currentSeasonIndex = seasonOrder.indexOf(currentSeason);
      const animeSeasonIndex = animeSeason ? seasonOrder.indexOf(animeSeason) : -1;
      
      if (animeSeasonIndex > currentSeasonIndex) return true;

      if ((animeSeasonIndex === currentSeasonIndex || animeSeasonIndex === -1) && anime.aired?.from) {
        const airDate = new Date(anime.aired.from);
        const currentDate = new Date();
        currentDate.setHours(0,0,0,0); 
        return airDate > currentDate;
      }
    }
    return false;
  }, [currentYear, currentSeason, seasonOrder]);


  const fetchAndCategorizeContinuations = useCallback(async () => {
    if (!shelfInitialized || shelf.length === 0) {
      setFutureAnime([]);
      setOtherContinuations([]);
      setUpcomingSequels([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const foundFutureAnimeMap = new Map<number, CategorizedAnime>();
    const foundOtherContinuationsMap = new Map<number, CategorizedAnime>();
    const processedRelatedAnimeMalIds = new Set<number>(); 
    const shelfMalIds = new Set(shelf.map(a => a.mal_id));

    try {
      for (const userAnime of shelf) {
        // No need to check processedRelatedAnimeMalIds for userAnime itself.
        // It's for relations to avoid fetching the same relation multiple times.
        
        const relations = await jikanApi.getAnimeRelations(userAnime.mal_id);
        if (!relations || relations.length === 0) continue;

        const potentialContinuations = relations
            .filter(rel => ['Sequel', 'Prequel', 'Alternative setting', 'Alternative version', "Other", "Side story", "Full story", "Parent story"].includes(rel.relation))
            .flatMap(rel => rel.entry.map(e => ({ ...e, relationType: rel.relation })))
            .filter(entry => entry.type === 'anime' && !shelfMalIds.has(entry.mal_id));
        
        for (const potentialContinuation of potentialContinuations) {
          if (processedRelatedAnimeMalIds.has(potentialContinuation.mal_id)) continue;

          const animeDetails = await jikanApi.getAnimeById(potentialContinuation.mal_id);
          processedRelatedAnimeMalIds.add(potentialContinuation.mal_id); 

          if (animeDetails) {
            const categorizedEntry: CategorizedAnime = { 
              ...animeDetails, 
              relationType: potentialContinuation.relationType,
              relatedTo: userAnime.title 
            };

            if (isFutureSeasonOrAirDate(animeDetails)) {
              if (!foundFutureAnimeMap.has(animeDetails.mal_id)) {
                foundFutureAnimeMap.set(animeDetails.mal_id, categorizedEntry);
              }
            } else {
               const animeYear = animeDetails.year || (animeDetails.aired?.from ? new Date(animeDetails.aired.from).getFullYear() : 0);
               const animeSeason = animeDetails.season?.toLowerCase();
               const airDate = animeDetails.aired?.from ? new Date(animeDetails.aired.from) : null;
               const currentDate = new Date();
               currentDate.setHours(0,0,0,0);

               const isCurrentOrPast = 
                (animeYear < currentYear) ||
                (animeYear === currentYear && animeSeason && currentSeason && seasonOrder.indexOf(animeSeason) <= seasonOrder.indexOf(currentSeason)) ||
                (airDate && airDate <= currentDate);

              if (isCurrentOrPast) { 
                if (!foundOtherContinuationsMap.has(animeDetails.mal_id)) {
                  foundOtherContinuationsMap.set(animeDetails.mal_id, categorizedEntry);
                }
              }
            }
          }
        }
      }
      const allUpcoming = Array.from(foundFutureAnimeMap.values()).sort((a,b) => (a.year || Infinity) - (b.year || Infinity) || (a.title.localeCompare(b.title)));
      setFutureAnime(allUpcoming);
      setOtherContinuations(Array.from(foundOtherContinuationsMap.values()).sort((a,b) => (b.year || 0) - (a.year || 0) || (a.title.localeCompare(b.title))));
      setUpcomingSequels(allUpcoming);
      
    } catch (e) {
      console.error("Error fetching continuations:", e);
      setError("Failed to load upcoming anime. API might be temporarily unavailable or rate limits exceeded.");
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shelf, shelfInitialized, isFutureSeasonOrAirDate, setUpcomingSequels, currentYear, currentSeason, seasonOrder]);

  useEffect(() => {
    fetchAndCategorizeContinuations();
  }, [fetchAndCategorizeContinuations]);


  const renderAnimeList = (animeList: CategorizedAnime[], listTitle: string, emptyMessage: string, IconComponent: React.ElementType) => (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <IconComponent className="h-8 w-8 text-primary" />
        <h2 className="text-2xl font-semibold text-primary">{listTitle} ({animeList.length})</h2>
      </div>
      {animeList.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {animeList.map(anime => <AnimeCard key={`${anime.mal_id}-${listTitle}`} anime={anime} />)}
        </div>
      ) : (
        <div className="text-center py-10 bg-card p-6 rounded-lg shadow-sm border border-dashed">
          <ListFilter className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="mt-2 text-xl font-semibold text-muted-foreground">No Anime Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      )}
    </section>
  );
  
  const renderSkeletons = (count: number) => (
    Array.from({ length: count }).map((_, index) => (
      <div key={index} className="border rounded-lg p-4 space-y-3 bg-card shadow">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-10 w-full" />
      </div>
    ))
  );

  if (isLoading) {
    return (
      <div className="space-y-10">
        <div>
            <div className="flex items-center gap-3 mb-6"> <Skeleton className="h-8 w-8 rounded-full" /> <Skeleton className="h-8 w-56" /> </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{renderSkeletons(4)}</div>
        </div>
        <Separator />
        <div>
            <div className="flex items-center gap-3 mb-6"> <Skeleton className="h-8 w-8 rounded-full" /> <Skeleton className="h-8 w-64" /> </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{renderSkeletons(4)}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto my-10">
        <HelpCircle className="h-5 w-5" />
        <AlertTitle className="text-lg">Error Fetching Previews</AlertTitle>
        <AlertDescription>
          {error} 
          <Button variant="link" onClick={fetchAndCategorizeContinuations} className="p-0 h-auto text-destructive-foreground hover:underline ml-1">
            Try again?
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  
  if (!shelfInitialized) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <p className="text-xl text-muted-foreground">Initializing your shelf data...</p>
      </div>
    );
  }

  if (shelf.length === 0 && shelfInitialized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-8 bg-card rounded-xl shadow-lg">
        <History className="h-20 w-20 text-primary mb-8" />
        <h2 className="text-3xl font-semibold mb-3">Your Shelf is Empty</h2>
        <p className="text-lg text-muted-foreground mb-6 max-w-md">
          Add some anime to your shelf first. Then, this page will show you exciting previews of upcoming seasons and other related shows!
        </p>
        <Button asChild size="lg">
          <a href="/">Go to My Shelf</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="pb-2">
        <h1 className="text-4xl font-bold tracking-tight text-primary mb-2">Anime Preview</h1>
        <p className="text-lg text-muted-foreground max-w-3xl">
          Discover future seasons and other continuations for anime you're tracking. Add them to your plan-to-watch list with a click!
        </p>
      </header>
      
      {renderAnimeList(
        futureAnime, 
        "Upcoming Future Seasons", 
        "No direct future seasons or announced new entries found for anime on your shelf.",
        CalendarDays
      )}

      <Separator className="my-10" />

      {renderAnimeList(
        otherContinuations,
        "Other Related Series (Current & Past)",
        "No other direct continuations (like current, past seasons, or side stories) found for anime on your shelf.",
        Tv
      )}

      {(futureAnime.length === 0 && otherContinuations.length === 0 && shelf.length > 0 && !isLoading) && (
           <div className="text-center py-16 bg-card p-8 rounded-lg shadow-sm border border-dashed">
                <ListFilter className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
                <h3 className="mt-2 text-2xl font-semibold">No Previews Found</h3>
                <p className="mt-2 text-md text-muted-foreground max-w-lg mx-auto">
                    We couldn't find any relevant upcoming seasons or other related series based on your current shelf. 
                    Ensure your shelf has anime with known relations, or try again later as new announcements happen.
                </p>
           </div>
      )}
    </div>
  );
}

