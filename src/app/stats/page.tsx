"use client";

import React from 'react';
import { OverallStats } from '@/components/stats/OverallStats';
import { MonthlyWatchTimeChart } from '@/components/stats/MonthlyWatchTimeChart';
import { GenreDevelopmentChart } from '@/components/stats/GenreDevelopmentChart';
import { StudioStatsChart } from '@/components/stats/StudioStatsChart';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { Loader2, Info } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useI18n } from '@/i18n/I18nContext';

export default function StatisticsPage() {
  const { isInitialized: shelfInitialized, shelf } = useAnimeShelf();
  const { t } = useI18n();

  if (!shelfInitialized) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (shelf.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
            <Info className="h-16 w-16 text-muted-foreground mb-6" />
            <h2 className="text-2xl font-semibold text-primary">{t('stats.emptyTitle')}</h2>
            <p className="text-muted-foreground mt-2">
                {t('stats.emptyDescription')}
            </p>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <header className="pb-2">
        <h1 className="text-4xl font-bold tracking-tight text-primary mb-2">{t('stats.title')}</h1>
        <p className="text-lg text-muted-foreground max-w-3xl">
          {t('stats.subtitle')}
        </p>
      </header>

      <OverallStats />

      <Separator className="my-8" />
      
      <MonthlyWatchTimeChart />

      <Separator className="my-8" />

      <GenreDevelopmentChart />

      <Separator className="my-8" />

      <StudioStatsChart />

    </div>
  );
}