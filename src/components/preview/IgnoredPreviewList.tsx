
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { jikanApi } from '@/lib/jikanApi';
import type { JikanAnime } from '@/types/anime';
import { AnimeCard } from '@/components/anime/AnimeCard';
import { Loader2, ListFilter, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HelpCircle } from 'lucide-react';


export function IgnoredPreviewList() {
  const { ignoredPreviewAnimeMalIds, removeIgnoredPreviewAnime, ignoredPreviewAnimeMalIdsInitialized } = useAnimeShelf();
  const { toast } = useToast();

  const [detailedIgnoredAnime, setDetailedIgnoredAnime] = useState<JikanAnime[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  const observerRef = useRef<HTMLDivElement | null>(null);

  const fetchData = useCallback(async () => {
    if (!ignoredPreviewAnimeMalIdsInitialized || ignoredPreviewAnimeMalIds.length === 0) {
      setDetailedIgnoredAnime([]); // Clear if list is empty or not initialized
      setIsLoading(false); // Ensure loading is false if no data to fetch
      return;
    }

    setIsLoading(true);
    setError(null);
    const fetchedAnime: JikanAnime[] = [];
    try {
      for (const mal_id of ignoredPreviewAnimeMalIds) {
        // Consider a small delay if rate limiting is a concern, but batching might be better.
        // For now, direct fetching. JikanApi already has a delay.
        const animeDetails = await jikanApi.getAnimeById(mal_id);
        if (animeDetails) {
          fetchedAnime.push(animeDetails);
        }
      }
      setDetailedIgnoredAnime(fetchedAnime.sort((a,b) => a.title.localeCompare(b.title)));
    } catch (e) {
      console.error("Error fetching ignored anime details:", e);
      setError("Failed to load details for ignored anime. API issues or rate limits may be the cause.");
    } finally {
      setIsLoading(false);
    }
  }, [ignoredPreviewAnimeMalIds, ignoredPreviewAnimeMalIdsInitialized]);

  useEffect(() => {
    const currentObserverRef = observerRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasBeenVisible) {
          setHasBeenVisible(true);
        }
      },
      { threshold: 0.01 } // Fetch when even a small part is visible
    );

    if (currentObserverRef) {
      observer.observe(currentObserverRef);
    }

    return () => {
      if (currentObserverRef) {
        observer.unobserve(currentObserverRef);
      }
      observer.disconnect();
    };
  }, [hasBeenVisible]);

  useEffect(() => {
    if (hasBeenVisible && ignoredPreviewAnimeMalIdsInitialized) { // Check initialization here too
      fetchData();
    }
  }, [hasBeenVisible, fetchData, ignoredPreviewAnimeMalIdsInitialized]); // Add ignoredPreviewAnimeMalIdsInitialized


  const handleRestorePreview = (mal_id: number, title: string) => {
    removeIgnoredPreviewAnime(mal_id);
    toast({
      title: "Anime Restored to Preview",
      description: `"${title}" will now appear in previews if relevant.`,
    });
  };
  
  const renderSkeletons = (count: number) => (
    Array.from({ length: count }).map((_, index) => (
      <div key={index} className="border rounded-lg p-4 space-y-3 bg-card shadow">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-9 w-full mt-2" />
      </div>
    ))
  );

  if (!hasBeenVisible && !ignoredPreviewAnimeMalIdsInitialized) {
    // If not visible and not initialized, render a minimal placeholder for the observer to attach.
    return <div ref={observerRef} className="min-h-[1px]" aria-hidden="true"></div>;
  }
  
  if (!hasBeenVisible && ignoredPreviewAnimeMalIdsInitialized) {
     // If initialized but not visible, still just the placeholder.
    return <div ref={observerRef} className="min-h-[1px]" aria-hidden="true"></div>;
  }

  // From here, hasBeenVisible is true or it's initializing
  if (!ignoredPreviewAnimeMalIdsInitialized || (isLoading && detailedIgnoredAnime.length === 0 && ignoredPreviewAnimeMalIds.length > 0) ) {
    return (
        <div ref={observerRef} className="py-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {renderSkeletons(Math.min(ignoredPreviewAnimeMalIds.length, 4) || 2)}
            </div>
        </div>
    );
  }
  

  if (error) {
    return (
      <div ref={observerRef} className="py-6">
        <Alert variant="destructive">
            <HelpCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Ignored List</AlertTitle>
            <AlertDescription>
            {error}
            <Button variant="link" onClick={fetchData} className="p-0 h-auto text-destructive-foreground hover:underline ml-1">
                Try again?
            </Button>
            </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (ignoredPreviewAnimeMalIds.length === 0 && ignoredPreviewAnimeMalIdsInitialized) {
     return (
        <div ref={observerRef} className="text-center py-10 bg-card p-6 rounded-lg shadow-sm border border-dashed">
          <Eye className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="mt-2 text-xl font-semibold text-muted-foreground">No Ignored Anime</h3>
          <p className="mt-1 text-sm text-muted-foreground">You haven't ignored any anime from the preview page yet.</p>
        </div>
    );
  }
  
  if (detailedIgnoredAnime.length === 0 && ignoredPreviewAnimeMalIds.length > 0 && !isLoading && ignoredPreviewAnimeMalIdsInitialized) {
     return (
        <div ref={observerRef} className="text-center py-10 bg-card p-6 rounded-lg shadow-sm border border-dashed">
          <ListFilter className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="mt-2 text-xl font-semibold text-muted-foreground">Loading Details...</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Fetching details for your {ignoredPreviewAnimeMalIds.length} ignored anime. If this persists, try reloading.
          </p>
        </div>
    );
  }


  return (
    <div ref={observerRef}>
      {detailedIgnoredAnime.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {detailedIgnoredAnime.map(anime => (
            <AnimeCard
                key={`ignored-${anime.mal_id}`}
                anime={anime}
                showRestorePreviewButton={true}
                onRestorePreview={() => handleRestorePreview(anime.mal_id, anime.title)}
            />
            ))}
        </div>
      )}
    </div>
  );
}
