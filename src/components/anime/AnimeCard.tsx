
"use client";

import Image from 'next/image';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { JikanAnime, UserAnime, UserAnimeStatus, JikanAnimeRelation } from '@/types/anime';
import { USER_ANIME_STATUS_OPTIONS } from '@/types/anime';
import { ProgressBar } from './ProgressBar';
import { RatingInput } from './RatingInput';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { AddToShelfDialog } from './AddToShelfDialog';
import { AddAllToShelfDialog } from './AddAllToShelfDialog';
import { Star, PlusCircle, MinusCircle, Trash2, Edit3, CheckCircle, Eye, XCircle, PauseCircle, ListPlus, Layers, Loader2, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '../ui/input';
import { jikanApi } from '@/lib/jikanApi';
import { Skeleton } from '../ui/skeleton';

interface AnimeCardProps {
  anime: JikanAnime; 
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


export function AnimeCard({ anime, shelfItem, onIgnorePreview }: AnimeCardProps) {
  const { addAnimeToShelf, updateAnimeOnShelf, removeAnimeFromShelf, isAnimeOnShelf } = useAnimeShelf();
  const { toast } = useToast();
  
  const isOnShelf = shelfItem !== undefined || isAnimeOnShelf(anime.mal_id);
  const currentShelfItem = shelfItem || useAnimeShelf().getAnimeFromShelf(anime.mal_id);

  const [relations, setRelations] = useState<JikanAnimeRelation[]>([]);
  const [isLoadingRelations, setIsLoadingRelations] = useState(false);
  const [showAddAllButton, setShowAddAllButton] = useState(false);

  useEffect(() => {
    const fetchRelations = async () => {
      if (!isOnShelf && ['TV', 'OVA', 'ONA', 'Movie', 'Special'].includes(anime.type ?? '')) {
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
            console.error("Failed to fetch relations:", error);
            setShowAddAllButton(false);
        } finally {
            setIsLoadingRelations(false);
        }
      } else {
        setShowAddAllButton(false);
      }
    };
    fetchRelations();
  }, [anime.mal_id, anime.type, isOnShelf]);


  const handleAddToShelf = (details: { user_status: UserAnimeStatus; current_episode: number; user_rating: number | null }) => {
    addAnimeToShelf(anime, details);
    toast({ title: "Added to Shelf", description: `"${anime.title}" has been added to your shelf.` });
  };

  const handleUpdateStatus = (status: UserAnimeStatus) => {
    if (currentShelfItem) {
      updateAnimeOnShelf(anime.mal_id, { user_status: status }, anime.episodes);
      toast({ title: "Status Updated", description: `"${anime.title}" status set to ${status}.` });
    }
  };

  const handleUpdateRating = (rating: number | null) => {
    if (currentShelfItem) {
      updateAnimeOnShelf(anime.mal_id, { user_rating: rating }, anime.episodes);
      toast({ title: "Rating Updated", description: `"${anime.title}" rating set.` });
    }
  };

  const handleIncrementEpisode = () => {
    if (currentShelfItem && (currentShelfItem.total_episodes === null || currentShelfItem.current_episode < currentShelfItem.total_episodes)) {
      updateAnimeOnShelf(anime.mal_id, { current_episode: currentShelfItem.current_episode + 1 }, anime.episodes);
    }
  };

  const handleDecrementEpisode = () => {
    if (currentShelfItem && currentShelfItem.current_episode > 0) {
      updateAnimeOnShelf(anime.mal_id, { current_episode: currentShelfItem.current_episode - 1 }, anime.episodes);
    }
  };
  
  const handleSetEpisode = (episode: number) => {
    if (currentShelfItem) {
      const newEpisode = Math.max(0, Math.min(episode, currentShelfItem.total_episodes ?? Infinity));
      updateAnimeOnShelf(anime.mal_id, { current_episode: newEpisode }, anime.episodes);
    }
  };


  const handleRemoveFromShelf = () => {
    removeAnimeFromShelf(anime.mal_id);
    toast({ title: "Removed from Shelf", description: `"${anime.title}" has been removed from your shelf.`, variant: "destructive" });
  };
  
  const StatusIcon = currentShelfItem ? statusIcons[currentShelfItem.user_status] : null;


  return (
    <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 h-full">
      <CardHeader className="p-0 relative">
        <Image
          src={anime.images.webp?.large_image_url || anime.images.webp?.image_url || anime.images.jpg.large_image_url || anime.images.jpg.image_url || "https://picsum.photos/400/600"}
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
          {anime.title}
        </CardTitle>
        <div className="text-xs text-muted-foreground mb-2">
          <span>{anime.type}</span>
          {anime.episodes !== null && <span> &bull; {anime.episodes} episodes</span>}
          {anime.season && anime.year && <span> &bull; {`${anime.season} ${anime.year}`.replace(/\b\w/g, l => l.toUpperCase())}</span>}
        </div>
        
        <div className="flex flex-wrap gap-1 mb-3">
          {anime.genres?.slice(0, 3).map(genre => (
            <Badge key={genre.mal_id + '-' + genre.name} variant="secondary" className="text-xs">{genre.name}</Badge>
          ))}
        </div>

        {currentShelfItem && (
          <div className="space-y-3">
            <ProgressBar current={currentShelfItem.current_episode} total={currentShelfItem.total_episodes} />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handleDecrementEpisode} disabled={currentShelfItem.current_episode === 0}>
                <MinusCircle size={16} />
              </Button>
              <Input 
                type="number"
                value={currentShelfItem.current_episode}
                onChange={(e) => handleSetEpisode(parseInt(e.target.value))}
                className="w-16 text-center h-9"
                min={0}
                max={currentShelfItem.total_episodes ?? undefined}
              />
              <Button variant="outline" size="icon" onClick={handleIncrementEpisode} disabled={currentShelfItem.total_episodes !== null && currentShelfItem.current_episode >= currentShelfItem.total_episodes}>
                <PlusCircle size={16} />
              </Button>
            </div>
            <Select value={currentShelfItem.user_status} onValueChange={(value) => handleUpdateStatus(value as UserAnimeStatus)}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder="Set status" />
              </SelectTrigger>
              <SelectContent>
                {USER_ANIME_STATUS_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RatingInput value={currentShelfItem.user_rating} onChange={handleUpdateRating} />
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0 flex flex-col gap-2">
        {!isOnShelf && (
           <AddToShelfDialog anime={anime} onAddToShelf={handleAddToShelf}>
              <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                <PlusCircle size={16} className="mr-2" /> Add to Shelf
              </Button>
            </AddToShelfDialog>
        )}

        {isLoadingRelations && !isOnShelf && (
              <Button variant="outline" className="w-full" disabled>
                <Loader2 size={16} className="mr-2 animate-spin" /> Checking for series...
              </Button>
        )}

        {!isLoadingRelations && showAddAllButton && !isOnShelf && (
          <AddAllToShelfDialog
            mainAnime={anime}
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

        {onIgnorePreview && !isOnShelf && (
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => onIgnorePreview(anime.mal_id)}>
            <EyeOff size={16} className="mr-2" /> Ignore in Preview
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
