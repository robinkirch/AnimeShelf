
"use client";

import Image from 'next/image';
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { JikanAnime, UserAnime, UserAnimeStatus, JikanAnimeRelation, JikanMALItem } from '@/types/anime';
import { USER_ANIME_STATUS_OPTIONS, BROADCAST_DAY_OPTIONS } from '@/types/anime';
import { ProgressBar } from './ProgressBar';
import { RatingInput } from './RatingInput';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { AddToShelfDialog } from './AddToShelfDialog';
import { AddAllToShelfDialog } from './AddAllToShelfDialog';
import { Star, PlusCircle, MinusCircle, Trash2, Edit3, CheckCircle, Eye, XCircle, PauseCircle, ListPlus, Layers, Loader2, EyeOff, Tv, Youtube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { jikanApi } from '@/lib/jikanApi';
import { StreamingPlatformsInput } from './StreamingPlatformsInput'; // Import the new component

interface AnimeCardProps {
  anime: JikanAnime | Partial<JikanAnime>; 
  shelfItem?: UserAnime;
  onIgnorePreview?: (mal_id: number) => void; 
}

const statusIcons: Record<UserAnimeStatus, React.ElementType> = {
  watching: Eye,
  completed: CheckCircle,
  on_hold: PauseCircle,
  dropped: XCircle,
  plan_to_watch: ListPlus,
};

const IGNORED_TYPES_FOR_ADD_ALL = ['Music'];
const NO_BROADCAST_DAY_VALUE = "_none_";

export function AnimeCard({ anime, shelfItem, onIgnorePreview }: AnimeCardProps) {
  const { addAnimeToShelf, updateAnimeOnShelf, removeAnimeFromShelf, isAnimeOnShelf } = useAnimeShelf();
  const { toast } = useToast();
  
  const isOnShelf = shelfItem !== undefined || isAnimeOnShelf(anime.mal_id!); 
  const currentShelfItem = shelfItem || useAnimeShelf().getAnimeFromShelf(anime.mal_id!);

  const [relations, setRelations] = useState<JikanAnimeRelation[]>([]);
  const [isLoadingRelations, setIsLoadingRelations] = useState(false);
  const [showAddAllButton, setShowAddAllButton] = useState(false);
  // No longer need editableStreamingPlatforms as string, StreamingPlatformsInput handles string[]
  
  const fullAnimeDataForDialog = anime as JikanAnime; // Used for AddToShelfDialog and AddAllToShelfDialog

  // API suggestions for StreamingPlatformsInput, derived from the full JikanAnime data
  const apiStreamingSuggestions = useMemo(() => {
    const fullData = anime as JikanAnime; // Assume 'anime' prop can be cast
    return fullData.streaming?.map((s: JikanMALItem) => s.name) || [];
  }, [anime]);


  useEffect(() => {
    const fetchRelations = async () => {
      if (anime.mal_id && !isOnShelf && ['TV', 'OVA', 'ONA', 'Movie', 'Special'].includes(anime.type ?? '') && !(anime.type && IGNORED_TYPES_FOR_ADD_ALL.includes(anime.type))) {
        setIsLoadingRelations(true);
        try {
            const rels = await jikanApi.getAnimeRelations(anime.mal_id);
            setRelations(rels);
            
            const hasSequelsOrPrequels = rels.some(relation =>
              (relation.relation === 'Sequel' || relation.relation === 'Prequel') &&
              relation.entry.some(e => e.type === 'anime')
            );
            setShowAddAllButton(hasSequelsOrPrequels);
        } catch (error) {
            console.error("Failed to fetch relations for anime ID:", anime.mal_id, error);
            setShowAddAllButton(false); 
        } finally {
            setIsLoadingRelations(false);
        }
      } else {
        setRelations([]); 
        setShowAddAllButton(false); 
      }
    };
    fetchRelations();
  }, [anime.mal_id, anime.type, isOnShelf]);


  const handleAddToShelf = (details: { user_status: UserAnimeStatus; current_episode: number; user_rating: number | null; streaming_platforms: string[]; broadcast_day: string | null; }) => {
    if (!fullAnimeDataForDialog.mal_id) {
        toast({ title: "Error", description: "Cannot add anime without a valid ID.", variant: "destructive" });
        return;
    }
    addAnimeToShelf(fullAnimeDataForDialog, details); 
    toast({ title: "Added to Shelf", description: `"${anime.title}" has been added to your shelf.` });
  };

  const handleUpdateStatus = (status: UserAnimeStatus) => {
    if (currentShelfItem && anime.mal_id) {
      updateAnimeOnShelf(anime.mal_id, { user_status: status }, fullAnimeDataForDialog.episodes);
      toast({ title: "Status Updated", description: `"${anime.title}" status set to ${USER_ANIME_STATUS_OPTIONS.find(s => s.value === status)?.label || status}.` });
    }
  };

  const handleUpdateRating = (rating: number | null) => {
    if (currentShelfItem && anime.mal_id) {
      updateAnimeOnShelf(anime.mal_id, { user_rating: rating }, fullAnimeDataForDialog.episodes);
      toast({ title: "Rating Updated", description: `"${anime.title}" rating set.` });
    }
  };

  const handleUpdateBroadcastDay = (day: string | null) => {
    if (currentShelfItem && anime.mal_id) {
      updateAnimeOnShelf(anime.mal_id, { broadcast_day: day === NO_BROADCAST_DAY_VALUE ? null : day }, fullAnimeDataForDialog.episodes);
      toast({ title: "Broadcast Day Updated", description: `"${anime.title}" broadcast day updated.` });
    }
  };

  const handleUpdateStreamingPlatforms = (newPlatforms: string[]) => {
    if (currentShelfItem && anime.mal_id) {
      updateAnimeOnShelf(anime.mal_id, { streaming_platforms: newPlatforms }, fullAnimeDataForDialog.episodes);
      toast({ title: "Streaming Platforms Updated", description: `"${anime.title}" streaming platforms updated.` });
    }
  };


  const handleIncrementEpisode = () => {
    if (currentShelfItem && anime.mal_id && (currentShelfItem.total_episodes === null || currentShelfItem.current_episode < currentShelfItem.total_episodes)) {
      updateAnimeOnShelf(anime.mal_id, { current_episode: currentShelfItem.current_episode + 1 }, fullAnimeDataForDialog.episodes);
    }
  };

  const handleDecrementEpisode = () => {
    if (currentShelfItem && anime.mal_id && currentShelfItem.current_episode > 0) {
      updateAnimeOnShelf(anime.mal_id, { current_episode: currentShelfItem.current_episode - 1 }, fullAnimeDataForDialog.episodes);
    }
  };
  
  const handleSetEpisode = (episode: number) => {
    if (currentShelfItem && anime.mal_id) {
      const totalEps = fullAnimeDataForDialog.episodes ?? currentShelfItem.total_episodes;
      const newEpisode = Math.max(0, Math.min(episode, totalEps ?? Infinity));
      updateAnimeOnShelf(anime.mal_id, { current_episode: newEpisode }, totalEps);
    }
  };


  const handleRemoveFromShelf = () => {
    if (anime.mal_id) {
        removeAnimeFromShelf(anime.mal_id);
        toast({ title: "Removed from Shelf", description: `"${anime.title}" has been removed from your shelf.`, variant: "destructive" });
    }
  };
  
  const StatusIcon = currentShelfItem ? statusIcons[currentShelfItem.user_status] : null;


  return (
    <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 h-full">
      <CardHeader className="p-0 relative">
        <Image
          src={anime.images?.webp?.large_image_url || anime.images?.webp?.image_url || anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || "https://picsum.photos/400/600"}
          alt={`Cover image for ${anime.title}`}
          width={400}
          height={300}
          className="object-cover w-full h-48 md:h-64"
          data-ai-hint="anime cover art"
          priority={false} 
        />
         {currentShelfItem && StatusIcon && (
          <div className="absolute top-2 right-2 bg-background/80 p-1.5 rounded-full shadow-md">
            <StatusIcon size={20} className="text-foreground" />
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <CardTitle className="text-lg font-semibold mb-1 leading-tight truncate" title={anime.title}>
          {anime.title || "Unknown Title"}
        </CardTitle>
        <div className="text-xs text-muted-foreground mb-2">
          <span>{anime.type || 'N/A'}</span>
          {anime.episodes !== null && typeof anime.episodes !== 'undefined' && <span> &bull; {anime.episodes} episodes</span>}
          {anime.season && anime.year && <span> &bull; {`${anime.season} ${anime.year}`.replace(/\b\w/g, l => l.toUpperCase())}</span>}
          {currentShelfItem?.broadcast_day && <span> &bull; {currentShelfItem.broadcast_day}</span>}
          {(anime as JikanAnime).broadcast?.day && !currentShelfItem?.broadcast_day && <span> &bull; {(anime as JikanAnime).broadcast!.day}</span>}
        </div>
        
        <div className="flex flex-wrap gap-1 mb-3">
          {anime.genres?.slice(0, 3).map(genre => (
            <Badge key={`${anime.mal_id}-${genre.mal_id}-${genre.name}`} variant="secondary" className="text-xs">{genre.name}</Badge>
          ))}
        </div>

        {currentShelfItem && (
          <div className="space-y-3">
            <ProgressBar current={currentShelfItem.current_episode} total={currentShelfItem.total_episodes} />
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleDecrementEpisode} 
                disabled={currentShelfItem.current_episode === 0}
                aria-label={`Decrement episode count for ${anime.title}`}
              >
                <MinusCircle size={16} />
              </Button>
              <Input 
                type="number"
                value={currentShelfItem.current_episode}
                onChange={(e) => handleItemChange(anime.mal_id!, 'current_episode', parseInt(e.target.value))} 
                onBlur={(e) => handleSetEpisode(parseInt(e.target.value))} 
                className="w-16 text-center h-9"
                min={0}
                max={currentShelfItem.total_episodes ?? undefined}
                aria-label={`Current episode for ${anime.title}`}
              />
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleIncrementEpisode} 
                disabled={currentShelfItem.total_episodes !== null && currentShelfItem.current_episode >= currentShelfItem.total_episodes}
                aria-label={`Increment episode count for ${anime.title}`}
              >
                <PlusCircle size={16} />
              </Button>
            </div>
            <Select value={currentShelfItem.user_status} onValueChange={(value) => handleUpdateStatus(value as UserAnimeStatus)}>
              <SelectTrigger className="w-full text-sm" aria-label={`Status for ${anime.title}`}>
                <SelectValue placeholder="Set status" />
              </SelectTrigger>
              <SelectContent>
                {USER_ANIME_STATUS_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RatingInput value={currentShelfItem.user_rating} onChange={handleUpdateRating} />
            <div>
              <Label htmlFor={`broadcast-day-${anime.mal_id}`} className="text-xs font-medium">Broadcast Day</Label>
              <Select value={currentShelfItem.broadcast_day || NO_BROADCAST_DAY_VALUE} onValueChange={handleUpdateBroadcastDay}>
                <SelectTrigger id={`broadcast-day-${anime.mal_id}`} className="w-full text-sm mt-1">
                  <SelectValue placeholder="Set broadcast day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BROADCAST_DAY_VALUE}>Unknown / Not Set</SelectItem>
                  {BROADCAST_DAY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
             <div>
                <Label htmlFor={`streaming-platforms-${anime.mal_id}`} className="text-xs font-medium">Streaming Platforms</Label>
                 <StreamingPlatformsInput
                    value={currentShelfItem.streaming_platforms}
                    onChange={handleUpdateStreamingPlatforms}
                    apiSuggestions={apiStreamingSuggestions}
                    placeholder="Add/edit platforms..."
                />
                {/* Display badges if not using the input's internal badge display, or if needed for non-edit state */}
                {/* This might be redundant if StreamingPlatformsInput shows badges */}
                {/* For simplicity, we assume StreamingPlatformsInput handles its display sufficiently */}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0 flex flex-col gap-2 mt-auto">
        {!isOnShelf && (
           <AddToShelfDialog anime={fullAnimeDataForDialog} onAddToShelf={handleAddToShelf}>
              <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                <PlusCircle size={16} className="mr-2" /> Add to Shelf
              </Button>
            </AddToShelfDialog>
        )}

        {isLoadingRelations && !isOnShelf && !(anime.type && IGNORED_TYPES_FOR_ADD_ALL.includes(anime.type)) && (
              <Button variant="outline" className="w-full" disabled>
                <Loader2 size={16} className="mr-2 animate-spin" /> Checking for series...
              </Button>
        )}

        {!isLoadingRelations && showAddAllButton && !isOnShelf && !(anime.type && IGNORED_TYPES_FOR_ADD_ALL.includes(anime.type)) && (
          <AddAllToShelfDialog
            mainAnime={fullAnimeDataForDialog}
            relations={relations.filter(r => (r.relation === 'Sequel' || r.relation === 'Prequel') && r.entry.some(e => e.type === 'anime'))}
            onAddAllToShelf={(animeSeriesDetails) => {
              animeSeriesDetails.forEach(item => {
                if (!isAnimeOnShelf(item.animeData.mal_id)) {
                    addAnimeToShelf(item.animeData, item.userProgress);
                }
              });
              toast({ title: "Series Added to Shelf", description: `"${anime.title}" and related seasons added.` });
            }}
          >
            <Button variant="outline" className="w-full">
              <Layers size={16} className="mr-2" /> Add Entire Series
            </Button>
          </AddAllToShelfDialog>
        )}
        
        {isOnShelf && currentShelfItem && (
          <Button variant="destructive" className="w-full" onClick={handleRemoveFromShelf}>
            <Trash2 size={16} className="mr-2" /> Remove from Shelf
          </Button>
        )}

        {onIgnorePreview && !isOnShelf && anime.mal_id && (
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => onIgnorePreview(anime.mal_id!)}>
            <EyeOff size={16} className="mr-2" /> Ignore in Preview
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
// Helper function for optimistic UI update in AnimeCard (if needed)
// This is kept simple here; complex state changes are handled by context.
function handleItemChange(mal_id: number, field: keyof UserAnime, value: any) {
  // This function is a placeholder if direct manipulation of currentShelfItem's display state
  // before context update is needed. For now, context updates re-render the card.
  console.log(`AnimeCard: Optimistic UI update for ${mal_id}, field ${String(field)}, value ${value}`);
}

