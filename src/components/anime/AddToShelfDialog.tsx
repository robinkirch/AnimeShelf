"use client";

import React, { useState, useEffect } from 'react';
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
import type { JikanAnime, UserAnimeStatus } from '@/types/anime';
import { USER_ANIME_STATUS_OPTIONS, BROADCAST_DAY_OPTIONS } from '@/types/anime';
import { RatingInput } from './RatingInput';
import Image from 'next/image';
import { StreamingPlatformsInput } from './StreamingPlatformsInput'; // Import the new component
import { useI18n } from '@/i18n/I18nContext';
import { broadcastDayLabel, statusLabel } from '@/i18n/labels';

interface AddToShelfDialogProps {
  anime: JikanAnime;
  onAddToShelf: (details: { 
    user_status: UserAnimeStatus; 
    current_episode: number; 
    user_rating: number | null;
    streaming_platforms: string[];
    broadcast_day: string | null;
  }) => void;
  children: React.ReactNode; // For the trigger button
}

const NO_BROADCAST_DAY_VALUE = "_none_";

export function AddToShelfDialog({ anime, onAddToShelf, children }: AddToShelfDialogProps) {
  const { t } = useI18n();
const [isOpen, setIsOpen] = useState(false);
  const [userStatus, setUserStatus] = useState<UserAnimeStatus>('plan_to_watch');
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [streamingPlatforms, setStreamingPlatforms] = useState<string[]>([]);
  const [broadcastDay, setBroadcastDay] = useState<string | null>(anime.broadcast?.day || null);

  // Effect to initialize/reset state when dialog opens or anime prop changes
  useEffect(() => {
    if (isOpen) {
      setUserStatus('plan_to_watch');
      setCurrentEpisode(0);
      setUserRating(null);
      setStreamingPlatforms(anime.streaming?.map(s => s.name) || []);
      setBroadcastDay(anime.broadcast?.day || null);
    }
  }, [isOpen, anime]);

  useEffect(() => {
    if(userStatus == "completed" && (anime.episodes != null &&(currentEpisode != anime.episodes || currentEpisode != Infinity))) {
      setCurrentEpisode(anime.episodes ?? Infinity);
    }
  },[userStatus]);

  useEffect(() => {
    if(currentEpisode == 0) {
      setUserStatus("plan_to_watch");
    }
    else if(anime.episodes != null && currentEpisode == anime.episodes) {
      setUserStatus("completed");
    }
    else{
      setUserStatus("watching");
    }
  },[currentEpisode]);


  const handleSubmit = () => {
    onAddToShelf({
      user_status: userStatus,
      current_episode: Math.min(currentEpisode, anime.episodes ?? Infinity), // Cap at total episodes
      user_rating: userRating,
      streaming_platforms: streamingPlatforms,
      broadcast_day: broadcastDay === NO_BROADCAST_DAY_VALUE ? null : broadcastDay,
    });
    setIsOpen(false);
    // State will be reset by useEffect when dialog reopens
  };

  const apiPlatformSuggestions = React.useMemo(() => {
    return anime.streaming?.map(s => s.name) || [];
  }, [anime.streaming]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('anime.addDialog.title', { title: anime.title })}</DialogTitle>
          <DialogDescription>
            {t('anime.addDialog.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="flex items-center gap-4">
            <Image
              src={anime.images.webp?.image_url || anime.images.jpg.image_url || "https://picsum.photos/100/150"}
              alt={anime.title}
              width={80}
              height={120}
              className="rounded-md object-cover"
              data-ai-hint="anime cover"
            />
            <div>
              <h3 className="font-semibold">{anime.title}</h3>
              <p className="text-sm text-muted-foreground">{anime.episodes ? t('common.episodes', { count: anime.episodes }) : t('common.episodesUnknown')}</p>
              {anime.broadcast?.string && <p className="text-xs text-muted-foreground">{t('anime.broadcast', { value: anime.broadcast.string })}</p>}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">{t('anime.status')}</Label>
            <Select value={userStatus} onValueChange={(value) => setUserStatus(value as UserAnimeStatus)}>
              <SelectTrigger id="status" className="col-span-3">
                <SelectValue placeholder={t('anime.selectStatus')} />
              </SelectTrigger>
              <SelectContent>
                {USER_ANIME_STATUS_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{statusLabel(t, option.value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="current-episode" className="text-right">{t('anime.episode')}</Label>
            <Input
              id="current-episode"
              type="number"
              value={currentEpisode}
              onChange={(e) => setCurrentEpisode(Math.max(0, parseInt(e.target.value) || 0))}
              className="col-span-3"
              max={anime.episodes ?? undefined}
              min={0}
            />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="rating" className="text-right">{t('anime.rating')}</Label>
            <div className="col-span-3">
              <RatingInput value={userRating} onChange={setUserRating} />
            </div>
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="broadcast-day" className="text-right">{t('anime.broadcastDay')}</Label>
            <Select value={broadcastDay || NO_BROADCAST_DAY_VALUE} onValueChange={(value) => setBroadcastDay(value === NO_BROADCAST_DAY_VALUE ? null : value)}>
              <SelectTrigger id="broadcast-day" className="col-span-3">
                <SelectValue placeholder={t('anime.selectBroadcastDay')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_BROADCAST_DAY_VALUE}>{t('anime.broadcastNotSet')}</SelectItem>
                {BROADCAST_DAY_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{broadcastDayLabel(t, option.value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-start gap-4 pt-1">
            <Label htmlFor="streaming-platforms" className="text-right mt-2">{t('anime.streaming')}</Label>
            <div className="col-span-3">
              <StreamingPlatformsInput
                value={streamingPlatforms}
                onChange={setStreamingPlatforms}
                apiSuggestions={apiPlatformSuggestions}
                placeholder={t('anime.addStreamingPlatforms')}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>{t('common.cancel')}</Button>
          <Button type="submit" onClick={handleSubmit}>{t('anime.addToShelf')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

