"use client";

import Image from 'next/image';
import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AnimeCard } from '@/components/anime/AnimeCard';
import { jikanApi } from '@/lib/jikanApi';
import type { JikanAnime } from '@/types/anime';
import type { RelatedEntry } from '@/types/preview';
import { EyeOff, Info, Loader2, ImageOff } from 'lucide-react';

interface RelatedAnimeCardProps {
  entry: RelatedEntry;
  onIgnorePreview: (mal_id: number, title: string) => void;
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

function getDateLabel(entry: RelatedEntry): string | null {
  if (entry.airingStatus === 'airing') return 'Airing now';
  const seasonLabel = entry.season && entry.year ? `${capitalize(entry.season)} ${entry.year}` : entry.year ? String(entry.year) : null;
  if (entry.airingStatus === 'upcoming') return seasonLabel ?? 'TBA';
  return seasonLabel;
}

/**
 * Lightweight card built from relation data (no request). The full anime data is loaded on demand
 * via Tenrai, after which the regular AnimeCard (add to shelf, rating, ...) takes over.
 */
export function RelatedAnimeCard({ entry, onIgnorePreview }: RelatedAnimeCardProps) {
  const [details, setDetails] = useState<JikanAnime | null>(entry.details ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  if (details) {
    return <AnimeCard anime={details} onIgnorePreview={(id) => onIgnorePreview(id, details.title)} />;
  }

  const dateLabel = getDateLabel(entry);

  const handleLoadDetails = async () => {
    setIsLoading(true);
    setLoadFailed(false);
    const anime = await jikanApi.getAnimeById(entry.mal_id, { priority: 'high' });
    setIsLoading(false);
    if (anime) setDetails(anime);
    else setLoadFailed(true);
  };

  return (
    <Card className="flex flex-col overflow-hidden shadow-lg h-full">
      <CardHeader className="p-0 relative h-56">
        {entry.coverUrl ? (
          <Image src={entry.coverUrl} alt={entry.title} fill sizes="(max-width: 640px) 100vw, 25vw" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted">
            <ImageOff className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4 grow space-y-2">
        <CardTitle className="text-lg leading-tight line-clamp-2" title={entry.title}>{entry.title}</CardTitle>
        {dateLabel && <p className="text-sm text-muted-foreground">{dateLabel}</p>}
        <div className="flex flex-wrap gap-1">
          {entry.format && <Badge variant="secondary">{entry.format}</Badge>}
          <Badge variant="outline">{entry.relationType}</Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">Related to: {entry.relatedTo}</p>
        {loadFailed && <p className="text-xs text-destructive">Could not load details. Please try again.</p>}
      </CardContent>
      <CardFooter className="p-4 pt-0 flex flex-col gap-2">
        <Button className="w-full" onClick={handleLoadDetails} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Info className="mr-2 h-4 w-4" />}
          Load details
        </Button>
        <Button variant="outline" className="w-full" onClick={() => onIgnorePreview(entry.mal_id, entry.title)}>
          <EyeOff className="mr-2 h-4 w-4" /> Ignore in Preview
        </Button>
      </CardFooter>
    </Card>
  );
}
