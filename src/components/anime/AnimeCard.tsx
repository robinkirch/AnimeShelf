
"use client";

import Image from 'next/image';
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { Star, PlusCircle, MinusCircle, Trash2, Edit3, CheckCircle, Eye, XCircle, PauseCircle, ListPlus, Layers, Loader2, EyeOff, Tv, RotateCcw } from 'lucide-react';
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
import { jikanApi, isAbortError } from '@/lib/jikanApi';
import { StreamingPlatformsInput } from './StreamingPlatformsInput'; // Import the new component
import { useI18n } from '@/i18n/I18nContext';
import { broadcastDayLabel, seasonLabel, statusLabel } from '@/i18n/labels';

interface AnimeCardProps {
  anime: JikanAnime | Partial<JikanAnime>;
  shelfItem?: UserAnime;
  onIgnorePreview?: (mal_id: number) => void;
  showRestorePreviewButton?: boolean; // New prop
  onRestorePreview?: () => void; // New prop for action
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
// Card buttons may wrap to two lines: longer translations (e.g. German) would overflow narrow cards otherwise.
const WRAPPING_BUTTON = 'h-auto min-h-9 whitespace-normal py-2';

export function AnimeCard({ anime, shelfItem, onIgnorePreview, showRestorePreviewButton, onRestorePreview }: AnimeCardProps) {
  const { addAnimeToShelf, updateAnimeOnShelf, removeAnimeFromShelf, isAnimeOnShelf, getAnimeFromShelf } = useAnimeShelf();
  const { toast } = useToast();
  const { t } = useI18n();

  const isOnShelf = shelfItem !== undefined || isAnimeOnShelf(anime.mal_id!);
  const currentShelfItem = shelfItem || getAnimeFromShelf(anime.mal_id!);

  const [relations, setRelations] = useState<JikanAnimeRelation[]>([]);
  const [isLoadingRelations, setIsLoadingRelations] = useState(false);
  const [showAddAllButton, setShowAddAllButton] = useState(false);
  // Relations are only fetched once the card scrolls into view, otherwise a season page with
  // 100+ cards would flood the Jikan queue before the user even looks at them.
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (isInView || !cardRef.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setIsInView(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [isInView]);

  const fullAnimeDataForDialog = anime as JikanAnime;

  const apiStreamingSuggestions = useMemo(() => {
    const fullData = anime as JikanAnime;
    return fullData.streaming?.map((s: JikanMALItem) => s.name) || [];
  }, [anime]);


  useEffect(() => {
    const shouldFetch = isInView && anime.mal_id && !isOnShelf && ['TV', 'OVA', 'ONA', 'Movie', 'Special'].includes(anime.type ?? '') && !(anime.type && IGNORED_TYPES_FOR_ADD_ALL.includes(anime.type)) && !showRestorePreviewButton;
    if (!shouldFetch) {
      setRelations([]);
      setShowAddAllButton(false);
      setIsLoadingRelations(false);
      return;
    }

    const controller = new AbortController();
    const fetchRelations = async () => {
      setIsLoadingRelations(true);
      try {
        const rels = await jikanApi.getAnimeRelations(anime.mal_id!, { signal: controller.signal });
        setRelations(rels);
        setShowAddAllButton(rels.some(relation =>
          (relation.relation === 'Sequel' || relation.relation === 'Prequel') &&
          relation.entry.some(e => e.type === 'anime')
        ));
        setIsLoadingRelations(false);
      } catch (error) {
        if (isAbortError(error)) return;
        console.error("Failed to fetch relations for anime ID:", anime.mal_id, error);
        setShowAddAllButton(false);
        setIsLoadingRelations(false);
      }
    };
    fetchRelations();
    return () => controller.abort();
  }, [isInView, anime.mal_id, anime.type, isOnShelf, showRestorePreviewButton]);


  const handleAddToShelf = (details: { user_status: UserAnimeStatus; current_episode: number; user_rating: number | null; streaming_platforms: string[]; broadcast_day: string | null; }) => {
    if (!fullAnimeDataForDialog.mal_id) {
        toast({ title: t('common.error'), description: t('anime.toast.invalidId'), variant: "destructive" });
        return;
    }
    addAnimeToShelf(fullAnimeDataForDialog, details);
    toast({ title: t('anime.toast.addedTitle'), description: t('anime.toast.addedDescription', { title: anime.title ?? '' }) });
  };

  const handleUpdateStatus = (status: UserAnimeStatus) => {
    if (currentShelfItem && anime.mal_id) {
      updateAnimeOnShelf(anime.mal_id, { user_status: status }, fullAnimeDataForDialog.episodes);
      toast({ title: t('anime.toast.statusTitle'), description: t('anime.toast.statusDescription', { title: anime.title ?? '', status: statusLabel(t, status) }) });
    }
  };

  const handleUpdateRating = (rating: number | null) => {
    if (currentShelfItem && anime.mal_id) {
      updateAnimeOnShelf(anime.mal_id, { user_rating: rating }, fullAnimeDataForDialog.episodes);
      toast({ title: t('anime.toast.ratingTitle'), description: t('anime.toast.ratingDescription', { title: anime.title ?? '' }) });
    }
  };

  const handleUpdateBroadcastDay = (day: string | null) => {
    if (currentShelfItem && anime.mal_id) {
      updateAnimeOnShelf(anime.mal_id, { broadcast_day: day === NO_BROADCAST_DAY_VALUE ? null : day }, fullAnimeDataForDialog.episodes);
      toast({ title: t('anime.toast.broadcastTitle'), description: t('anime.toast.broadcastDescription', { title: anime.title ?? '' }) });
    }
  };

  const handleUpdateStreamingPlatforms = (newPlatforms: string[]) => {
    if (currentShelfItem && anime.mal_id) {
      updateAnimeOnShelf(anime.mal_id, { streaming_platforms: newPlatforms }, fullAnimeDataForDialog.episodes);
      toast({ title: t('anime.toast.platformsTitle'), description: t('anime.toast.platformsDescription', { title: anime.title ?? '' }) });
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
        toast({ title: t('anime.toast.removedTitle'), description: t('anime.toast.removedDescription', { title: anime.title ?? '' }), variant: "destructive" });
    }
  };

  const StatusIcon = currentShelfItem ? statusIcons[currentShelfItem.user_status] : null;


  return (
    <Card ref={cardRef} className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 h-full">
      <CardHeader className="p-0 relative">
        <Image
          src={anime.images?.webp?.large_image_url || anime.images?.webp?.image_url || anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || "https://placehold.co/400x300.png"}
          alt={t('anime.coverAlt', { title: anime.title ?? '' })}
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
      <CardContent className="p-4 grow">
        <CardTitle className="text-lg font-semibold mb-1 leading-tight truncate" title={anime.title}>
          {anime.title || t('anime.unknownTitle')}
        </CardTitle>
        <div className="text-xs text-muted-foreground mb-2">
          <span>{anime.type || t('anime.notAvailable')}</span>
          {anime.episodes !== null && typeof anime.episodes !== 'undefined' && <span> &bull; {t('common.episodes', { count: anime.episodes })}</span>}
          {anime.season && anime.year && <span> &bull; {`${seasonLabel(t, anime.season)} ${anime.year}`}</span>}
          {currentShelfItem?.broadcast_day && <span> &bull; {broadcastDayLabel(t, currentShelfItem.broadcast_day)}</span>}
          {(anime as JikanAnime).broadcast?.day && !currentShelfItem?.broadcast_day && <span> &bull; {broadcastDayLabel(t, (anime as JikanAnime).broadcast!.day)}</span>}
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {anime.genres?.slice(0, 3).map(genre => (
            <Badge key={`${anime.mal_id}-${genre.mal_id}-${genre.name}`} variant="secondary" className="text-xs">{genre.name}</Badge>
          ))}
        </div>

        {currentShelfItem && (
          <div className="space-y-3">
            <ProgressBar
                current={currentShelfItem.current_episode}
                total={currentShelfItem.total_episodes}
                status={currentShelfItem.user_status}
            />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleDecrementEpisode}
                disabled={currentShelfItem.current_episode === 0}
                aria-label={t('anime.decrementEpisode', { title: anime.title ?? '' })}
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
                aria-label={t('anime.currentEpisodeFor', { title: anime.title ?? '' })}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleIncrementEpisode}
                disabled={currentShelfItem.total_episodes !== null && currentShelfItem.current_episode >= currentShelfItem.total_episodes}
                aria-label={t('anime.incrementEpisode', { title: anime.title ?? '' })}
              >
                <PlusCircle size={16} />
              </Button>
            </div>
            <Select value={currentShelfItem.user_status} onValueChange={(value) => handleUpdateStatus(value as UserAnimeStatus)}>
              <SelectTrigger className="w-full text-sm" aria-label={t('anime.statusFor', { title: anime.title ?? '' })}>
                <SelectValue placeholder={t('anime.setStatus')} />
              </SelectTrigger>
              <SelectContent>
                {USER_ANIME_STATUS_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{statusLabel(t, option.value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RatingInput value={currentShelfItem.user_rating} onChange={handleUpdateRating} />
            <div>
              <Label htmlFor={`broadcast-day-${anime.mal_id}`} className="text-xs font-medium">{t('anime.broadcastDay')}</Label>
              <Select value={currentShelfItem.broadcast_day || NO_BROADCAST_DAY_VALUE} onValueChange={handleUpdateBroadcastDay}>
                <SelectTrigger id={`broadcast-day-${anime.mal_id}`} className="w-full text-sm mt-1">
                  <SelectValue placeholder={t('anime.setBroadcastDay')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BROADCAST_DAY_VALUE}>{t('anime.broadcastNotSet')}</SelectItem>
                  {BROADCAST_DAY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>{broadcastDayLabel(t, option.value)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
             <div>
                <Label htmlFor={`streaming-platforms-${anime.mal_id}`} className="text-xs font-medium">{t('anime.streamingPlatforms')}</Label>
                 <StreamingPlatformsInput
                    value={currentShelfItem.streaming_platforms}
                    onChange={handleUpdateStreamingPlatforms}
                    apiSuggestions={apiStreamingSuggestions}
                    placeholder={t('anime.addEditPlatforms')}
                />
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0 flex flex-col gap-2 mt-auto">
        {showRestorePreviewButton && onRestorePreview ? (
          <Button variant="outline" size="sm" className={`w-full ${WRAPPING_BUTTON}`} onClick={onRestorePreview}>
            <RotateCcw size={16} className="mr-2" /> {t('anime.restoreToPreview')}
          </Button>
        ) : (
          <>
            {!isOnShelf && (
              <AddToShelfDialog anime={fullAnimeDataForDialog} onAddToShelf={handleAddToShelf}>
                <Button className={`w-full bg-accent hover:bg-accent/90 text-accent-foreground ${WRAPPING_BUTTON}`}>
                  <PlusCircle size={16} className="mr-2" /> {t('anime.addToShelf')}
                </Button>
              </AddToShelfDialog>
            )}

            {isLoadingRelations && !isOnShelf && !(anime.type && IGNORED_TYPES_FOR_ADD_ALL.includes(anime.type)) && (
              <Button variant="outline" className={`w-full ${WRAPPING_BUTTON}`} disabled>
                <Loader2 size={16} className="mr-2 animate-spin" /> {t('anime.checkingSeries')}
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
                  toast({ title: t('anime.toast.seriesAddedTitle'), description: t('anime.toast.seriesAddedDescription', { title: anime.title ?? '' }) });
                }}
              >
                <Button variant="outline" className={`w-full ${WRAPPING_BUTTON}`}>
                  <Layers size={16} className="mr-2" /> {t('anime.addEntireSeries')}
                </Button>
              </AddAllToShelfDialog>
            )}

            {isOnShelf && currentShelfItem && (
              <Button variant="destructive" className={`w-full ${WRAPPING_BUTTON}`} onClick={handleRemoveFromShelf}>
                <Trash2 size={16} className="mr-2" /> {t('anime.removeFromShelf')}
              </Button>
            )}

            {onIgnorePreview && !isOnShelf && anime.mal_id && ( // This button is not shown if showRestorePreviewButton is true
              <Button variant="outline" size="sm" className={`w-full mt-2 ${WRAPPING_BUTTON}`} onClick={() => onIgnorePreview(anime.mal_id!)}>
                <EyeOff size={16} className="mr-2" /> {t('anime.ignoreInPreview')}
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
}

function handleItemChange(mal_id: number, field: keyof UserAnime, value: any) {
  console.log(`AnimeCard: Optimistic UI update for ${mal_id}, field ${String(field)}, value ${value}`);
}
