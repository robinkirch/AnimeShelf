"use client";

import React, { useState } from 'react';
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
import { USER_ANIME_STATUS_OPTIONS } from '@/types/anime';
import { RatingInput } from './RatingInput';
import Image from 'next/image';

interface AddToShelfDialogProps {
  anime: JikanAnime;
  onAddToShelf: (details: { user_status: UserAnimeStatus; current_episode: number; user_rating: number | null }) => void;
  children: React.ReactNode; // For the trigger button
}

export function AddToShelfDialog({ anime, onAddToShelf, children }: AddToShelfDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userStatus, setUserStatus] = useState<UserAnimeStatus>('plan_to_watch');
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [userRating, setUserRating] = useState<number | null>(null);

  const handleSubmit = () => {
    onAddToShelf({
      user_status: userStatus,
      current_episode: Math.min(currentEpisode, anime.episodes ?? Infinity), // Cap at total episodes
      user_rating: userRating,
    });
    setIsOpen(false);
    // Reset form for next time
    setUserStatus('plan_to_watch');
    setCurrentEpisode(0);
    setUserRating(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add "{anime.title}" to Shelf</DialogTitle>
          <DialogDescription>
            Set your initial progress and rating for this anime.
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
              <p className="text-sm text-muted-foreground">{anime.episodes ? `${anime.episodes} episodes` : 'Episodes unknown'}</p>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">Status</Label>
            <Select value={userStatus} onValueChange={(value) => setUserStatus(value as UserAnimeStatus)}>
              <SelectTrigger id="status" className="col-span-3">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {USER_ANIME_STATUS_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="current-episode" className="text-right">Episode</Label>
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
            <Label htmlFor="rating" className="text-right">Rating</Label>
            <div className="col-span-3">
              <RatingInput value={userRating} onChange={setUserRating} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button type="submit" onClick={handleSubmit}>Add to Shelf</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
