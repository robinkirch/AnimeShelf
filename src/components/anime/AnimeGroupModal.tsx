
"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { UserAnime, UserAnimeStatus, JikanAnimeRelation, JikanMALItem, JikanAnime as FullJikanAnime } from '@/types/anime'; // Added JikanMALItem and FullJikanAnime
import { USER_ANIME_STATUS_OPTIONS, BROADCAST_DAY_OPTIONS } from '@/types/anime';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RatingInput } from './RatingInput';
import { ProgressBar } from './ProgressBar';
import { PlusCircle, MinusCircle, Tv, Youtube, Loader2 } from 'lucide-react'; // Added Loader2
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';
import { StreamingPlatformsInput } from './StreamingPlatformsInput'; // Import the new component
import { jikanApi } from '@/lib/jikanApi';

const NO_BROADCAST_DAY_VALUE = "_none_";

interface EditableAnimeState extends UserAnime {
  apiStreamingSuggestions?: string[];
  jikanData?: FullJikanAnime;
}

interface AnimeGroupModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  groupItems: UserAnime[];
  relationsMap: Map<number, JikanAnimeRelation[]>; // Kept for potential future use
  representativeAnime: UserAnime;
}


export function AnimeGroupModal({
    isOpen,
    onOpenChange,
    groupItems,
    representativeAnime
}: AnimeGroupModalProps) {
  const { updateAnimeOnShelf } = useAnimeShelf();
  const { toast } = useToast();

  const [editableItems, setEditableItems] = useState<EditableAnimeState[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    const fetchDetailsAndInitialize = async () => {
      if (isOpen) {
        setIsLoadingDetails(true);
        const itemsWithDetails = await Promise.all(
          groupItems.map(async (item) => {
            const jikanData = await jikanApi.getAnimeById(item.mal_id);
            return {
              ...item,
              streaming_platforms: item.streaming_platforms || [],
              apiStreamingSuggestions: jikanData?.streaming?.map((s: JikanMALItem) => s.name) || [],
              jikanData: jikanData || undefined,
            };
          })
        );

        const sorted = itemsWithDetails.sort((a, b) => {
          const yearA = a.jikanData?.year ?? a.year ?? Infinity;
          const yearB = b.jikanData?.year ?? b.year ?? Infinity;
          if (yearA !== yearB) return yearA - yearB;

          const seasonOrder = ['winter', 'spring', 'summer', 'fall'];
          const seasonAIndex = a.jikanData?.season ? seasonOrder.indexOf(a.jikanData.season.toLowerCase()) : Infinity;
          const seasonBIndex = b.jikanData?.season ? seasonOrder.indexOf(b.jikanData.season.toLowerCase()) : Infinity;
          if (seasonAIndex !== seasonBIndex) return seasonAIndex - seasonBIndex;

          return a.title.localeCompare(b.title);
        });
        setEditableItems(sorted);
        setIsLoadingDetails(false);
      }
    };

    fetchDetailsAndInitialize();
  }, [isOpen, groupItems]);

  const handleItemChange = (mal_id: number, field: keyof EditableAnimeState, value: any) => {
    setEditableItems(prev =>
      prev.map(item =>
        item.mal_id === mal_id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleItemUpdate = (
    anime: EditableAnimeState,
    updates: Partial<Omit<UserAnime, 'mal_id' | 'title' | 'cover_image' | 'total_episodes' | 'genres' | 'studios' | 'type' | 'year' | 'season' | 'duration_minutes'>>,
  ) => {
    updateAnimeOnShelf(anime.mal_id, updates, anime.jikanData?.episodes ?? anime.total_episodes);
    toast({
      title: "Update Successful",
      description: `Updated progress for "${anime.title}".`
    });
  };

  const handleEpisodeChange = (anime: EditableAnimeState, newEpisodeStr: string) => {
    const newEpisode = parseInt(newEpisodeStr, 10);
    if (isNaN(newEpisode)) return;

    const totalEps = anime.jikanData?.episodes ?? anime.total_episodes;
    const clampedEpisode = Math.max(0, totalEps != null ? Math.min(newEpisode, totalEps) : newEpisode);

    setEditableItems(prev => prev.map(item => item.mal_id === anime.mal_id ? {...item, current_episode: clampedEpisode} : item));
    handleItemUpdate(anime, { current_episode: clampedEpisode });
  };

  const handleStreamingPlatformsChange = (anime: EditableAnimeState, newPlatforms: string[]) => {
     setEditableItems(prev => prev.map(item => item.mal_id === anime.mal_id ? {...item, streaming_platforms: newPlatforms} : item));
    handleItemUpdate(anime, { streaming_platforms: newPlatforms });
  };


  if (isLoadingDetails && isOpen) {
    return (
       <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Series: {representativeAnime.title}</DialogTitle>
                <DialogDescription>Loading details for each season...</DialogDescription>
            </DialogHeader>
            <div className="flex-grow flex items-center justify-center p-10">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
             <DialogFooter className="mt-auto pt-4 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled>Close</Button>
            </DialogFooter>
        </DialogContent>
       </Dialog>
    );
  }


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Series: {representativeAnime.title}</DialogTitle>
          <DialogDescription>
            Manage individual anime within this series. Changes are saved automatically.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow pr-3 -mr-3">
          <div className="space-y-6 py-4">
            {editableItems.map((anime) => (
              <div key={anime.mal_id} className="p-4 border rounded-lg shadow-sm bg-card">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Image
                    src={anime.cover_image || "https://placehold.co/100x150.png"}
                    alt={`Cover for ${anime.title}`}
                    width={100}
                    height={150}
                    className="rounded-md object-cover self-center sm:self-start"
                    data-ai-hint="anime cover art"
                  />
                  <div className="flex-grow space-y-3">
                    <h3 className="text-lg font-semibold">{anime.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {anime.jikanData?.type || anime.type || 'Unknown Type'}
                      {(anime.jikanData?.episodes ?? anime.total_episodes) !== null ? ` • ${(anime.jikanData?.episodes ?? anime.total_episodes)} episodes` : ' • Episodes unknown'}
                      {(anime.jikanData?.year ?? anime.year) && ` • ${(anime.jikanData?.year ?? anime.year)}`}
                      {(anime.jikanData?.season ?? anime.season) && ` • ${(anime.jikanData?.season ?? anime.season).charAt(0).toUpperCase() + (anime.jikanData?.season ?? anime.season).slice(1)}`}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                      <div>
                        <Label htmlFor={`status-modal-${anime.mal_id}`} className="text-xs">Status</Label>
                        <Select
                          value={anime.user_status}
                          onValueChange={(value) => {
                              handleItemChange(anime.mal_id, 'user_status', value as UserAnimeStatus);
                              handleItemUpdate(anime, { user_status: value as UserAnimeStatus });
                          }}
                          aria-label={`Status for ${anime.title}`}
                        >
                          <SelectTrigger id={`status-modal-${anime.mal_id}`} className="h-9 text-xs">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {USER_ANIME_STATUS_OPTIONS.map(option => (
                              <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => handleEpisodeChange(anime, (anime.current_episode - 1).toString())}
                            disabled={anime.current_episode === 0}
                            aria-label={`Decrement episode count for ${anime.title}`}
                        >
                          <MinusCircle size={16} />
                        </Button>
                        <div className="flex-grow">
                            <Label htmlFor={`episode-modal-${anime.mal_id}`} className="text-xs text-center block mb-0.5">Episode</Label>
                            <Input
                                id={`episode-modal-${anime.mal_id}`}
                                type="number"
                                value={anime.current_episode}
                                onChange={(e) => handleItemChange(anime.mal_id, 'current_episode', parseInt(e.target.value) || 0)}
                                onBlur={(e) => handleEpisodeChange(anime, e.target.value)}
                                className="h-9 text-xs text-center"
                                min={0}
                                max={anime.jikanData?.episodes ?? anime.total_episodes ?? undefined}
                                aria-label={`Current episode for ${anime.title}`}
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => handleEpisodeChange(anime, (anime.current_episode + 1).toString())}
                            disabled={(anime.jikanData?.episodes ?? anime.total_episodes) !== null && anime.current_episode >= (anime.jikanData?.episodes ?? anime.total_episodes ?? Infinity)}
                            aria-label={`Increment episode count for ${anime.title}`}
                        >
                          <PlusCircle size={16} />
                        </Button>
                      </div>
                       <div>
                        <Label htmlFor={`rating-modal-${anime.mal_id}`} className="text-xs">Rating</Label>
                        <RatingInput
                          value={anime.user_rating}
                          onChange={(value) => {
                            handleItemChange(anime.mal_id, 'user_rating', value);
                            handleItemUpdate(anime, { user_rating: value });
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                        <div>
                            <Label htmlFor={`broadcast-day-modal-${anime.mal_id}`} className="text-xs">Broadcast Day</Label>
                            <Select
                                value={anime.broadcast_day || NO_BROADCAST_DAY_VALUE}
                                onValueChange={(value) => {
                                    const newDay = value === NO_BROADCAST_DAY_VALUE ? null : value;
                                    handleItemChange(anime.mal_id, 'broadcast_day', newDay);
                                    handleItemUpdate(anime, { broadcast_day: newDay });
                                }}
                                aria-label={`Broadcast day for ${anime.title}`}
                            >
                            <SelectTrigger id={`broadcast-day-modal-${anime.mal_id}`} className="h-9 text-xs mt-0.5">
                                <SelectValue placeholder="Set broadcast day" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NO_BROADCAST_DAY_VALUE} className="text-xs">Unknown / Not Set</SelectItem>
                                {BROADCAST_DAY_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                        </div>
                        <div className="mt-0.5">
                             <Label htmlFor={`streaming-platforms-modal-${anime.mal_id}`} className="text-xs">Streaming Platforms</Label>
                            <StreamingPlatformsInput
                                value={anime.streaming_platforms}
                                onChange={(newPlatforms) => handleStreamingPlatformsChange(anime, newPlatforms)}
                                apiSuggestions={anime.apiStreamingSuggestions}
                                placeholder="Add streaming platforms..."
                            />
                        </div>
                    </div>
                     {anime.streaming_platforms.length > 0 && !isLoadingDetails && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                            {anime.streaming_platforms.map(platform => (
                                <Badge key={platform} variant="outline" className="text-xs bg-muted text-muted-foreground">
                                   {platform.startsWith("http") ? <Youtube size={12} className="mr-1"/> : <Tv size={12} className="mr-1"/>}
                                   {platform}
                                </Badge>
                            ))}
                        </div>
                    )}
                    <ProgressBar
                        current={anime.current_episode}
                        total={anime.jikanData?.episodes ?? anime.total_episodes}
                        status={anime.user_status}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter className="mt-auto pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
