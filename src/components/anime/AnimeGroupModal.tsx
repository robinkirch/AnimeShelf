
"use client";

import React from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter, // Added DialogFooter import
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { UserAnime, UserAnimeStatus, JikanAnimeRelation } from '@/types/anime';
import { USER_ANIME_STATUS_OPTIONS } from '@/types/anime';
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
import { PlusCircle, MinusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnimeGroupModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  groupItems: UserAnime[];
  relationsMap: Map<number, JikanAnimeRelation[]>;
  representativeAnime: UserAnime;
}

export function AnimeGroupModal({ 
    isOpen, 
    onOpenChange, 
    groupItems, 
    relationsMap, // We might use this later to show relation types within the modal
    representativeAnime 
}: AnimeGroupModalProps) {
  const { updateAnimeOnShelf } = useAnimeShelf();
  const { toast } = useToast();

  // Sort items within the modal, e.g., by MAL ID or a derived air date if available
  const sortedGroupItems = [...groupItems].sort((a, b) => {
    // Try to sort by Jikan's year, then by title if year is same or missing
    // This assumes UserAnime might eventually have year/season, or we fetch Jikan data for modal
    const yearA = a.mal_id; // Placeholder until proper year/season is available on UserAnime
    const yearB = b.mal_id;

    if (yearA !== yearB) {
      return yearA - yearB;
    }
    return a.title.localeCompare(b.title);
  });


  const handleUpdate = (
    mal_id: number, 
    updates: Partial<Omit<UserAnime, 'mal_id' | 'title' | 'cover_image' | 'total_episodes' | 'genres' | 'studios' | 'type'>>,
    totalEpisodes?: number | null
  ) => {
    updateAnimeOnShelf(mal_id, updates, totalEpisodes);
    toast({
      title: "Update Successful",
      description: `Updated progress for "${groupItems.find(item => item.mal_id === mal_id)?.title}".`
    });
  };
  
  const handleEpisodeChange = (anime: UserAnime, newEpisode: number) => {
    const clampedEpisode = Math.max(0, anime.total_episodes != null ? Math.min(newEpisode, anime.total_episodes) : newEpisode);
    handleUpdate(anime.mal_id, { current_episode: clampedEpisode }, anime.total_episodes);
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Series: {representativeAnime.title}</DialogTitle>
          <DialogDescription>
            Manage individual anime within this series. Changes are saved automatically.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow pr-3 -mr-3"> {/* Negative margin to hide double scrollbar if content shorter than area */}
          <div className="space-y-6 py-4">
            {sortedGroupItems.map((anime) => (
              <div key={anime.mal_id} className="p-4 border rounded-lg shadow-sm bg-card">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Image
                    src={anime.cover_image || "https://picsum.photos/150/225"}
                    alt={anime.title}
                    width={100}
                    height={150}
                    className="rounded-md object-cover self-center sm:self-start"
                    data-ai-hint="anime cover art"
                  />
                  <div className="flex-grow space-y-3">
                    <h3 className="text-lg font-semibold">{anime.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {anime.type || 'Unknown Type'}
                      {anime.total_episodes !== null ? ` • ${anime.total_episodes} episodes` : ' • Episodes unknown'}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                      <div>
                        <Label htmlFor={`status-${anime.mal_id}`} className="text-xs">Status</Label>
                        <Select
                          value={anime.user_status}
                          onValueChange={(value) => handleUpdate(anime.mal_id, { user_status: value as UserAnimeStatus }, anime.total_episodes)}
                        >
                          <SelectTrigger id={`status-${anime.mal_id}`} className="h-9 text-xs">
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
                            onClick={() => handleEpisodeChange(anime, anime.current_episode - 1)} 
                            disabled={anime.current_episode === 0}
                        >
                          <MinusCircle size={16} />
                        </Button>
                        <div className="flex-grow">
                            <Label htmlFor={`episode-${anime.mal_id}`} className="text-xs text-center block mb-0.5">Episode</Label>
                            <Input
                                id={`episode-${anime.mal_id}`}
                                type="number"
                                value={anime.current_episode}
                                onChange={(e) => handleEpisodeChange(anime, parseInt(e.target.value))}
                                className="h-9 text-xs text-center"
                                min={0}
                                max={anime.total_episodes ?? undefined}
                            />
                        </div>
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-9 w-9"
                            onClick={() => handleEpisodeChange(anime, anime.current_episode + 1)}
                            disabled={anime.total_episodes !== null && anime.current_episode >= anime.total_episodes}
                        >
                          <PlusCircle size={16} />
                        </Button>
                      </div>
                       <div>
                        <Label htmlFor={`rating-${anime.mal_id}`} className="text-xs">Rating</Label>
                        <RatingInput
                          value={anime.user_rating}
                          onChange={(value) => handleUpdate(anime.mal_id, { user_rating: value }, anime.total_episodes)}
                        />
                      </div>
                    </div>
                    <ProgressBar current={anime.current_episode} total={anime.total_episodes} />
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

