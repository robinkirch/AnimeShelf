
"use client";

import React, { useMemo } from 'react';
import type { UserAnime, UserAnimeStatus } from '@/types/anime';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nContext';
import { statusLabel } from '@/i18n/labels';

interface StatusDistributionBarProps {
  shelf: UserAnime[];
}

const statusOrder: UserAnimeStatus[] = ['completed', 'watching', 'plan_to_watch', 'on_hold', 'dropped'];

// Labels are translated (statusLabel); only the colors are configured here.
const statusDisplayConfig: Record<UserAnimeStatus, { colorClass: string, textColorClass?: string }> = {
  completed: { colorClass: 'bg-[hsl(var(--chart-2))]', textColorClass: 'text-primary-foreground' }, // Green
  watching: { colorClass: 'bg-primary', textColorClass: 'text-primary-foreground' },         // Blue
  plan_to_watch: { colorClass: 'bg-muted', textColorClass: 'text-muted-foreground' },// Gray
  on_hold: { colorClass: 'bg-[hsl(var(--chart-5))]', textColorClass: 'text-primary-foreground'  },        // Orange
  dropped: { colorClass: 'bg-destructive', textColorClass: 'text-destructive-foreground' },     // Red
};


export function StatusDistributionBar({ shelf }: StatusDistributionBarProps) {
  const { t, locale } = useI18n();
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
      const config = statusDisplayConfig[status] || { colorClass: 'bg-gray-500', textColorClass: 'text-white' };
      return {
        status,
        label: statusLabel(t, status),
        count,
        percentage,
        colorClass: config.colorClass,
        textColorClass: config.textColorClass ?? 'text-white', // Default to white text if not specified
      };
    }).filter(item => item.count > 0); // Only include segments with count > 0 for display

  }, [shelf, t]);

  if (shelf.length === 0) {
    return null; // Don't render if shelf is empty
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="w-full mb-6">
        <div className="text-sm font-medium text-muted-foreground mb-2">{t('stats.statusOverview')}</div>
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
                <p>{t('stats.statusTooltip', { label: item.label, count: item.count, percent: item.percentage.toLocaleString(locale, { maximumFractionDigits: 1 }) })}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
