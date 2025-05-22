
"use client";

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UserAnime, UserAnimeStatus, JikanAnimeRelation } from '@/types/anime';
import { USER_ANIME_STATUS_OPTIONS } from '@/types/anime';
import { ProgressBar } from './ProgressBar';
import { Layers, Eye, CheckCircle, PauseCircle, XCircle, ListPlus, Star } from 'lucide-react';
import { AnimeGroupModal } from './AnimeGroupModal';

interface AnimeGroupCardProps {
  group: UserAnime[];
  relationsMap: Map<number, JikanAnimeRelation[]>; // Pass relations for modal
}

const statusOrder: UserAnimeStatus[] = ['plan_to_watch', 'on_hold', 'watching', 'dropped', 'completed'];
const statusIcons: Record<UserAnimeStatus, React.ElementType> = {
  watching: Eye,
  completed: CheckCircle,
  on_hold: PauseCircle,
  dropped: XCircle,
  plan_to_watch: ListPlus,
};


export function AnimeGroupCard({ group, relationsMap }: AnimeGroupCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const representativeAnime = useMemo(() => {
    // Sort by MAL ID as a simple heuristic for "earliest" or "main" entry if no air dates
    // Or use the first item passed if presorted
    return [...group].sort((a,b) => a.mal_id - b.mal_id)[0] || group[0];
  }, [group]);

  const aggregatedData = useMemo(() => {
    let totalCurrentEpisodes = 0;
    let totalMaxEpisodes = 0;
    let knownMaxEpisodesCount = 0; // Count of items with non-null total_episodes
    let hasUnknownMaxEpisodes = false;

    let sumRatings = 0;
    let ratedCount = 0;
    let lowestStatusIndex = statusOrder.length; // Initialize with a high value

    group.forEach(anime => {
      totalCurrentEpisodes += anime.current_episode;
      if (anime.total_episodes !== null) {
        totalMaxEpisodes += anime.total_episodes;
        knownMaxEpisodesCount++;
      } else {
        hasUnknownMaxEpisodes = true;
      }

      if (anime.user_rating !== null) {
        sumRatings += anime.user_rating;
        ratedCount++;
      }

      const statusIdx = statusOrder.indexOf(anime.user_status);
      if (statusIdx < lowestStatusIndex) {
        lowestStatusIndex = statusIdx;
      }
    });

    const averageRating = ratedCount > 0 ? Math.round(sumRatings / ratedCount) : null;
    const overallStatus = lowestStatusIndex < statusOrder.length ? statusOrder[lowestStatusIndex] : 'plan_to_watch';

    let displayTotalEpisodes: number | string = totalMaxEpisodes;
    if (hasUnknownMaxEpisodes && knownMaxEpisodesCount > 0) {
        displayTotalEpisodes = `${totalMaxEpisodes}+`;
    } else if (hasUnknownMaxEpisodes && knownMaxEpisodesCount === 0) {
        displayTotalEpisodes = '?'; // All have unknown max episodes
    }


    return {
      currentEpisodes: totalCurrentEpisodes,
      maxEpisodes: displayTotalEpisodes,
      // Use actual numeric total for progress bar if possible, otherwise handle "?" case
      numericMaxEpisodesForProgress: (hasUnknownMaxEpisodes || knownMaxEpisodesCount === 0) ? null : totalMaxEpisodes,
      rating: averageRating,
      status: overallStatus,
    };
  }, [group]);

  const OverallStatusIcon = statusIcons[aggregatedData.status];

  // Prepare images for stacking
  const imagesToDisplay = useMemo(() => {
    return group
      .slice(0, 3) // Max 3 images for stacking
      .map(anime => ({ src: anime.cover_image, alt: anime.title }))
      .reverse(); // To make the first anime's image on top visually
  }, [group]);

  return (
    <>
      <Card
        className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 h-full cursor-pointer"
        onClick={() => setIsModalOpen(true)}
      >
        <CardHeader className="p-0 relative h-48 md:h-64 bg-muted">
          {imagesToDisplay.map((img, index) => (
            <Image
              key={index}
              src={img.src || "https://placehold.co/400x300.png"} // Fallback image
              alt={img.alt}
              width={400}
              height={300}
              className="object-cover w-full h-full absolute"
              style={{
                zIndex: index + 1,
                // Create a slight cascade effect. Adjust these values as needed.
                transform: `translateX(${index * 4}px) translateY(${index * 4}px) scale(${1 - index * 0.05})`,
                clipPath: index < imagesToDisplay.length -1 ? `inset(0 ${ (index + 1) * 10}px ${ (index + 1) * 10}px 0)` : undefined, // Example clip
              }}
              data-ai-hint="anime series cover stack"
              priority={index === imagesToDisplay.length -1} // Prioritize the top-most image
            />
          ))}
          <Badge
            variant="secondary"
            className="absolute top-2 left-2 z-10 bg-black/70 text-white"
            style={{ zIndex: imagesToDisplay.length + 1 }}
          >
            {group.length} {group.length > 1 ? 'titles' : 'title'}
          </Badge>
           {OverallStatusIcon && (
            <div
              className="absolute top-2 right-2 bg-background/80 p-1.5 rounded-full shadow-md"
              style={{ zIndex: imagesToDisplay.length + 1 }}
            >
              <OverallStatusIcon size={20} className="text-foreground" />
            </div>
          )}
        </CardHeader>
        <CardContent className="p-4 flex-grow">
          <CardTitle className="text-lg font-semibold mb-1 leading-tight truncate" title={representativeAnime.title + (group.length > 1 ? ` & ${group.length - 1} more` : '')}>
            {representativeAnime.title}{group.length > 1 ? ` (Series)` : ''}
          </CardTitle>
          <div className="text-xs text-muted-foreground mb-2">
            <span>{group.length} Animes in Series</span>
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            {representativeAnime.genres?.slice(0,2).join(', ')}{representativeAnime.genres?.length > 2 ? '...' : ''}
          </div>

          <div className="space-y-3 mt-2">
            <ProgressBar
                current={aggregatedData.currentEpisodes}
                total={aggregatedData.numericMaxEpisodesForProgress}
                status={aggregatedData.status}
            />
            <div className="text-sm text-muted-foreground">
                Episodes: {aggregatedData.currentEpisodes} / {aggregatedData.maxEpisodes}
            </div>
            {aggregatedData.rating !== null && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Star size={16} className="mr-1 text-yellow-500" /> Avg. Rating: {aggregatedData.rating}/10
              </div>
            )}
             <div className="flex items-center text-sm text-muted-foreground">
                <Layers size={16} className="mr-1 text-primary" /> Status: {USER_ANIME_STATUS_OPTIONS.find(opt => opt.value === aggregatedData.status)?.label || 'Unknown'}
              </div>
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0">
          <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => setIsModalOpen(true)}>
            <Layers size={16} className="mr-2" /> View Series Details
          </Button>
        </CardFooter>
      </Card>
      <AnimeGroupModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        groupItems={group}
        relationsMap={relationsMap}
        representativeAnime={representativeAnime}
      />
    </>
  );
}
