
"use client";

import React, { useMemo } from 'react';
import type { UserAnime, UserAnimeStatus } from '@/types/anime';
import { USER_ANIME_STATUS_OPTIONS } from '@/types/anime';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';

interface StatusDistributionBarProps {
  shelf: UserAnime[];
}

interface StatusInfo {
  status: UserAnimeStatus;
  label: string;
  count: number;
  percentage: number;
  colorClass: string;
  textColorClass?: string;
}

const statusOrder: UserAnimeStatus[] = ['completed', 'watching', 'plan_to_watch', 'on_hold', 'dropped'];

const statusDisplayConfig: Record<UserAnimeStatus, { label: string; colorClass: string, textColorClass?: string }> = {
  completed: { label: 'Completed', colorClass: 'bg-[hsl(var(--chart-2))]', textColorClass: 'text-primary-foreground' }, // Green
  watching: { label: 'Watching', colorClass: 'bg-primary', textColorClass: 'text-primary-foreground' },         // Blue
  plan_to_watch: { label: 'Plan to Watch', colorClass: 'bg-muted', textColorClass: 'text-muted-foreground' },// Gray
  on_hold: { label: 'On Hold', colorClass: 'bg-[hsl(var(--chart-5))]', textColorClass: 'text-primary-foreground'  },        // Orange
  dropped: { label: 'Dropped', colorClass: 'bg-destructive', textColorClass: 'text-destructive-foreground' },     // Red
};


export function StatusDistributionBar({ shelf }: StatusDistributionBarProps) {
  const statusData = useMemo(() => {
    if (shelf.length === 0) {
      return [];
    }

    const counts: Record<UserAnimeStatus, number> = {
      watching: 0,
      completed: 0,
      on_hold: 0,
      dropped: 0,
      plan_to_watch: 0,
    };

    shelf.forEach(anime => {
      counts[anime.user_status]++;
    });

    const total = shelf.length;

    return statusOrder.map(status => {
      const count = counts[status];
      const percentage = total > 0 ? (count / total) * 100 : 0;
      const config = statusDisplayConfig[status] || { label: status, colorClass: 'bg-gray-500', textColorClass: 'text-white' };
      return {
        status,
        label: config.label,
        count,
        percentage,
        colorClass: config.colorClass,
        textColorClass: config.textColorClass ?? 'text-white', // Default to white text if not specified
      };
    }).filter(item => item.count > 0); // Only include segments with count > 0 for display

  }, [shelf]);

  if (shelf.length === 0) {
    return null; // Don't render if shelf is empty
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="w-full mb-6">
        <div className="text-sm font-medium text-muted-foreground mb-2">Shelf Status Overview:</div>
        <div className="flex h-6 w-full rounded-full overflow-hidden shadow-inner bg-muted/30">
          {statusData.map(item => (
            <Tooltip key={item.status}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "h-full flex items-center justify-center transition-all duration-300 ease-in-out",
                    item.colorClass,
                    item.textColorClass
                  )}
                  style={{ width: `${item.percentage}%` }}
                  aria-label={`${item.label}: ${item.count} (${item.percentage.toFixed(1)}%)`}
                >
                  {item.percentage > 5 && ( // Only show text if segment is wide enough
                    <span className="text-xs font-medium truncate px-1">{item.label}</span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{item.label}: {item.count} anime ({item.percentage.toFixed(1)}%)</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
