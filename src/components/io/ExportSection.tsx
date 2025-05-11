'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
// import type { UserAnime } from '@/types/anime'; // Not explicitly used as type, but shelf is UserAnime[]
import { DownloadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ExportSection() {
  const { shelf } = useAnimeShelf();
  const { toast } = useToast();

  const escapeCsvCell = (cellData: any): string => {
    const stringData = String(cellData === null || cellData === undefined ? '' : cellData);
    if (stringData.includes(',') || stringData.includes('"') || stringData.includes('\n')) {
      return `"${stringData.replace(/"/g, '""')}"`;
    }
    return stringData;
  };

  const exportToCsv = () => {
    if (shelf.length === 0) {
      toast({ title: "Export Failed", description: "Your shelf is empty. Nothing to export.", variant: "destructive" });
      return;
    }

    const headers = ['mal_id', 'title', 'cover_image', 'total_episodes', 'user_status', 'current_episode', 'user_rating', 'genres', 'studios', 'type', 'year', 'season', 'streaming_platforms', 'broadcast_day', 'duration_minutes'];
    
    const csvRows = [
      headers.join(','), 
      ...shelf.map(anime => 
        [
          anime.mal_id,
          escapeCsvCell(anime.title),
          escapeCsvCell(anime.cover_image),
          anime.total_episodes === null || anime.total_episodes === undefined ? '' : anime.total_episodes,
          anime.user_status,
          anime.current_episode,
          anime.user_rating === null || anime.user_rating === undefined ? '' : anime.user_rating,
          escapeCsvCell(anime.genres.join(';')), 
          escapeCsvCell(anime.studios.join(';')), 
          escapeCsvCell(anime.type ?? ''),
          anime.year === null || anime.year === undefined ? '' : anime.year,
          escapeCsvCell(anime.season ?? ''),
          escapeCsvCell(anime.streaming_platforms.join(';')),
          escapeCsvCell(anime.broadcast_day ?? ''),
          anime.duration_minutes === null || anime.duration_minutes === undefined ? '' : anime.duration_minutes,
        ].join(',')
      )
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // Added BOM for Excel
    const link = document.createElement('a');
    
    if (navigator.msSaveBlob) { 
        navigator.msSaveBlob(blob, "animeshelf_export.csv");
    } else {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'animeshelf_export.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    
    toast({ title: "Export Successful", description: `${shelf.length} anime entries exported.` });
  };

  return (
    <div className="space-y-4 py-4">
      <p className="text-sm text-muted-foreground">
        This will download a CSV file containing all anime currently on your shelf. Ensure your browser allows file downloads.
      </p>
      <Button onClick={exportToCsv} className="w-full">
        <DownloadCloud className="mr-2 h-4 w-4" /> Export Shelf to CSV
      </Button>
    </div>
  );
}