
"use client";

import React, { useMemo } from 'react';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Clapperboard, ListChecks, Clock3, Tv, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nContext';
import Image from 'next/image';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ElementType;
  description?: string;
  className?: string;
  valueClassName?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, description, className, valueClassName }) => {
  // Check if the card is intended to have a light text on dark/colored background theme
  // This is determined if the main className for the Card includes 'text-primary-foreground'
  const isLightTextTheme = className?.includes('text-primary-foreground');

  return (
    <Card className={cn("shadow-lg", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={cn(
          "text-sm font-medium",
          isLightTextTheme ? 'text-primary-foreground/80' : 'text-muted-foreground'
        )}>
          {title}
        </CardTitle>
        {Icon && <Icon className={cn("h-5 w-5", isLightTextTheme ? 'text-primary-foreground/70' : 'text-muted-foreground')} />}
      </CardHeader>
      <CardContent>
        <div className={cn(
          "text-2xl font-bold", 
          isLightTextTheme ? 'text-primary-foreground' : '', // Ensure value also respects light text theme if not overridden by valueClassName
          valueClassName
        )}>{value}</div>
        {description && <p className={cn("text-xs pt-1", isLightTextTheme ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{description}</p>}
      </CardContent>
    </Card>
  );
};

export function OverallStats() {
  const { shelf } = useAnimeShelf();
  const { t, locale } = useI18n();

  const stats = useMemo(() => {
    const completedAnime = shelf.filter(a => a.user_status === 'completed');
    const watchedOrCompletedAnime = shelf.filter(a => a.user_status === 'completed' || a.user_status === 'watching');

    const totalEpisodesWatched = watchedOrCompletedAnime.reduce((sum, a) => sum + a.current_episode, 0);

    const totalWatchTimeMinutes = watchedOrCompletedAnime.reduce((sum, a) => {
      if (a.duration_minutes && a.current_episode > 0) {
        return sum + (a.current_episode * a.duration_minutes);
      }
      return sum;
    }, 0);
    const totalWatchTimeHours = totalWatchTimeMinutes / 60;
    
    const topRatedAnime = shelf
      .filter(a => a.user_rating !== null && a.user_rating >= 1)
      .sort((a, b) => b.user_rating! - a.user_rating!)
      .slice(0, 3);

    return {
      completedAnimeCount: completedAnime.length,
      totalEpisodesWatched,
      totalWatchTimeHours,
      topRatedAnime,
    };
  }, [shelf]);

  return (
    <section>
        <h2 className="text-2xl font-semibold mb-4 text-primary flex items-center">
            <ListChecks className="mr-3 h-7 w-7" />
            {t('stats.overall.title')}
</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard 
                title={t('stats.overall.completed')} 
                value={stats.completedAnimeCount} 
                icon={Clapperboard}
                className="bg-linear-to-br from-[hsl(var(--chart-1))] to-[hsl(var(--chart-1)/0.7)] text-primary-foreground"
                valueClassName="text-primary-foreground" // Explicitly keep value text primary-foreground
            />
            <StatCard 
                title={t('stats.overall.episodes')} 
                value={stats.totalEpisodesWatched.toLocaleString(locale)} 
                icon={Tv}
                className="bg-linear-to-br from-[hsl(var(--chart-2))] to-[hsl(var(--chart-2)/0.7)] text-primary-foreground"
                valueClassName="text-primary-foreground"
            />
            <StatCard 
                title={t('stats.overall.watchTime')} 
                value={t('stats.hours', { value: stats.totalWatchTimeHours.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })} 
                icon={Clock3}
                className="bg-linear-to-br from-[hsl(var(--chart-3))] to-[hsl(var(--chart-3)/0.7)] text-primary-foreground"
                valueClassName="text-primary-foreground"
            />
            {/* Specific card for Top Rated Anime, styled slightly differently for its list content */}
            <Card className="shadow-lg col-span-full md:col-span-2 lg:col-span-1 bg-linear-to-br from-[hsl(var(--chart-4))] to-[hsl(var(--chart-4)/0.7)] text-primary-foreground">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-primary-foreground/80">{t('stats.overall.topRated')}</CardTitle>
                <Award className="h-5 w-5 text-primary-foreground/70" />
                </CardHeader>
                <CardContent>
                {stats.topRatedAnime.length > 0 ? (
                    <ul className="space-y-2">
                    {stats.topRatedAnime.map((anime, index) => (
                        <li key={anime.mal_id} className="flex items-center gap-3 text-sm">
                           {anime.cover_image && <Image 
                             src={anime.cover_image} 
                             alt={anime.title} 
                             width={32} 
                             height={48} 
                             className="rounded-sm object-cover h-12 w-8 shrink-0"
                             data-ai-hint="anime cover small"
                            />}
                           <span className="font-semibold grow truncate" title={anime.title}>{index + 1}. {anime.title}</span>
                           <div className="flex items-center">
                             <Star className="h-4 w-4 text-yellow-300 mr-1" /> 
                             <span>{anime.user_rating}/10</span>
                           </div>
                        </li>
                    ))}
                    </ul>
                ) : (
                    <p className="text-sm text-primary-foreground/70 pt-1">{t('stats.overall.noRated')}</p>
                )}
                </CardContent>
            </Card>
        </div>
    </section>
  );
}
