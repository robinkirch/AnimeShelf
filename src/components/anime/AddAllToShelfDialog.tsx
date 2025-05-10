"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { JikanAnime, UserAnimeStatus, JikanAnimeRelation, JikanAnimeRelationEntry } from '@/types/anime';
import { USER_ANIME_STATUS_OPTIONS } from '@/types/anime';
import { RatingInput } from './RatingInput';
import Image from 'next/image';
import { jikanApi } from '@/lib/jikanApi';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

interface SeasonEntryState {
  mal_id: number;
  title: string;
  cover_image: string;
  total_episodes: number | null;
  user_status: UserAnimeStatus;
  current_episode: number;
  user_rating: number | null;
  genres: string[];
  studios: string[];
  animeData?: JikanAnime; 
}

interface AddAllToShelfDialogProps {
  mainAnime: JikanAnime;
  relations: JikanAnimeRelation[]; 
  onAddAllToShelf: (
    details: Array<{
      animeData: JikanAnime; 
      userProgress: { user_status: UserAnimeStatus; current_episode: number; user_rating: number | null };
    }>
  ) => void;
  children: React.ReactNode;
}

export function AddAllToShelfDialog({ mainAnime, relations, onAddAllToShelf, children }: AddAllToShelfDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [seasonEntries, setSeasonEntries] = useState<SeasonEntryState[]>([]);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);

  const initializeSeasonData = useCallback(async () => {
    if (!isOpen) return;

    setIsFetchingDetails(true);
    const entriesToFetchMap = new Map<number, JikanAnimeRelationEntry>();
    
    // Add main anime
    entriesToFetchMap.set(mainAnime.mal_id, { mal_id: mainAnime.mal_id, name: mainAnime.title, type: 'anime', url: mainAnime.url });

    // Add related anime (sequels/prequels)
    relations.forEach(relation => {
      relation.entry.forEach(entry => {
        if (entry.type === 'anime' && !entriesToFetchMap.has(entry.mal_id)) {
          entriesToFetchMap.set(entry.mal_id, entry);
        }
      });
    });
    
    const entriesToFetch = Array.from(entriesToFetchMap.values());

    const initialStatesPromise = entriesToFetch.map(async (entry) => {
        const animeDetails = entry.mal_id === mainAnime.mal_id ? mainAnime : await jikanApi.getAnimeById(entry.mal_id);
        if (!animeDetails) {
            return {
                mal_id: entry.mal_id,
                title: entry.name,
                cover_image: "https://picsum.photos/100/150",
                total_episodes: null,
                user_status: 'plan_to_watch' as UserAnimeStatus,
                current_episode: 0,
                user_rating: null,
                genres: [],
                studios: [],
                animeData: undefined, 
            };
        }
        return {
            mal_id: animeDetails.mal_id,
            title: animeDetails.title,
            cover_image: animeDetails.images.webp?.image_url || animeDetails.images.jpg.image_url || "https://picsum.photos/100/150",
            total_episodes: animeDetails.episodes,
            user_status: 'plan_to_watch' as UserAnimeStatus,
            current_episode: 0,
            user_rating: null,
            genres: animeDetails.genres?.map(g => g.name) || [],
            studios: animeDetails.studios?.map(s => s.name) || [],
            animeData: animeDetails,
        };
    });

    let resolvedStates = await Promise.all(initialStatesPromise);
    resolvedStates = resolvedStates.filter(s => s.animeData); // Only include successfully fetched anime

    // Sort: Prequels, Main Anime, Sequels
    resolvedStates.sort((a, b) => {
        const getOrderScore = (itemMalId: number) => {
            if (itemMalId === mainAnime.mal_id) return 0; // Main anime in the middle
            const isPrequel = relations.some(r => r.relation === 'Prequel' && r.entry.some(e => e.mal_id === itemMalId));
            if (isPrequel) return -1; // Prequels first
            const isSequel = relations.some(r => r.relation === 'Sequel' && r.entry.some(e => e.mal_id === itemMalId));
            if (isSequel) return 1; // Sequels last
            return 0; // Other relations (though filtered out before this dialog) or main if not caught
        };

        const scoreA = getOrderScore(a.mal_id);
        const scoreB = getOrderScore(b.mal_id);

        if (scoreA !== scoreB) return scoreA - scoreB;
        
        // If same category (e.g., both prequels), sort by aired date if available, then title
        const dateA = a.animeData?.aired?.from ? new Date(a.animeData.aired.from) : null;
        const dateB = b.animeData?.aired?.from ? new Date(b.animeData.aired.from) : null;

        if (dateA && dateB) {
            if (dateA < dateB) return -1;
            if (dateA > dateB) return 1;
        } else if (dateA) {
            return -1; // Ones with dates first
        } else if (dateB) {
            return 1;
        }
        
        return a.title.localeCompare(b.title);
    });
    
    setSeasonEntries(resolvedStates);
    setIsFetchingDetails(false);

  }, [mainAnime, relations, isOpen]);


  useEffect(() => {
    if (isOpen) {
      initializeSeasonData();
    } else {
      setSeasonEntries([]);
      setIsFetchingDetails(false);
    }
  }, [isOpen, initializeSeasonData]);

  const handleSeasonChange = (mal_id: number, field: keyof SeasonEntryState, value: any) => {
    setSeasonEntries(prev =>
      prev.map(entry =>
        entry.mal_id === mal_id
          ? { ...entry, [field]: field === 'current_episode' ? Math.max(0, parseInt(value) || 0) : value }
          : entry
      )
    );
  };

  const handleSubmit = () => {
    const detailsToSubmit = seasonEntries
      .filter(entry => entry.animeData) 
      .map(entry => ({
        animeData: entry.animeData!, 
        userProgress: {
          user_status: entry.user_status,
          current_episode: Math.min(entry.current_episode, entry.total_episodes ?? Infinity),
          user_rating: entry.user_rating,
        }
    }));
    onAddAllToShelf(detailsToSubmit);
    setIsOpen(false);
  };

  const renderSeasonForm = (entry: SeasonEntryState) => (
    <div key={entry.mal_id} className="grid gap-4 p-4 border rounded-md shadow-sm">
       <div className="flex items-start gap-4">
        <Image
          src={entry.cover_image}
          alt={entry.title}
          width={60}
          height={90}
          className="rounded-sm object-cover"
          data-ai-hint="anime series cover"
        />
        <div>
          <h4 className="font-semibold text-md">{entry.title}</h4>
          <p className="text-xs text-muted-foreground">
            {entry.total_episodes ? `${entry.total_episodes} episodes` : 'Episodes unknown'}
          </p>
          {entry.genres.length > 0 && (
            <p className="text-xs text-muted-foreground truncate" title={entry.genres.join(', ')}>
              Genres: {entry.genres.slice(0,3).join(', ')}{entry.genres.length > 3 ? '...' : ''}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
            <Label htmlFor={`status-${entry.mal_id}`} className="text-xs">Status</Label>
            <Select
            value={entry.user_status}
            onValueChange={(value) => handleSeasonChange(entry.mal_id, 'user_status', value as UserAnimeStatus)}
            >
            <SelectTrigger id={`status-${entry.mal_id}`} className="h-9 text-xs">
                <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
                {USER_ANIME_STATUS_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>
                ))}
            </SelectContent>
            </Select>
        </div>
        <div>
          <Label htmlFor={`current-episode-${entry.mal_id}`} className="text-xs">Episode</Label>
          <Input
            id={`current-episode-${entry.mal_id}`}
            type="number"
            value={entry.current_episode}
            onChange={(e) => handleSeasonChange(entry.mal_id, 'current_episode', e.target.value)}
            className="h-9 text-xs"
            max={entry.total_episodes ?? undefined}
            min={0}
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`rating-${entry.mal_id}`} className="text-xs">Rating</Label>
        <RatingInput
          value={entry.user_rating}
          onChange={(value) => handleSeasonChange(entry.mal_id, 'user_rating', value)}
        />
      </div>
    </div>
  );
  
  const renderSkeletons = (count: number) => (
    Array.from({ length: count }).map((_, index) => (
      <div key={index} className="space-y-3 p-4 border rounded-md shadow-sm">
        <div className="flex items-start gap-4">
            <Skeleton className="h-[90px] w-[60px] rounded-sm" />
            <div className="space-y-2 flex-grow">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-9 w-[180px]" />
      </div>
    ))
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add "{mainAnime.title}" Series to Shelf</DialogTitle>
          <DialogDescription>
            Set initial progress for each season in the series. Related seasons are fetched and shown below.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow max-h-[calc(90vh-200px)] pr-3"> {/* Adjusted max-h for footer */}
            <div className="space-y-4 py-2">
            {isFetchingDetails && renderSkeletons(3)}
            {!isFetchingDetails && seasonEntries.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No related seasons found or failed to load details.</p>
            )}
            {!isFetchingDetails && seasonEntries.map(entry => renderSeasonForm(entry))}
            </div>
        </ScrollArea>
        <DialogFooter className="mt-auto pt-4 border-t"> {/* Ensure footer is at bottom */}
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button type="submit" onClick={handleSubmit} disabled={isFetchingDetails || seasonEntries.length === 0}>
            {isFetchingDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Series to Shelf
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
