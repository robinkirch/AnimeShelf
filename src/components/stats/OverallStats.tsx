"use client";

import React, { useMemo } from 'react';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Clapperboard, ListChecks, Clock3, Tv, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ElementType;
  description?: string;
  className?: string;
  valueClassName?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, description, className, valueClassName }) => (
  <Card className={cn("shadow-lg", className)}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
    </CardHeader>
    <CardContent>
      <div className={cn("text-2xl font-bold", valueClassName)}>{value}</div>
      {description && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
    </CardContent>
  </Card>
);

export function OverallStats() {
  const { shelf } = useAnimeShelf();

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
    const totalWatchTimeHours = totalWatchTimeMinutes > 0 ? (totalWatchTimeMinutes / 60).toFixed(1) : 0;
    
    const topRatedAnime = shelf
      .filter(a => a.user_rating !== null && a.user_rating >= 1)
      .sort((a, b) => b.user_rating! - a.user_rating!)
      .slice(0, 3);

    return {
      completedAnimeCount: completedAnime.length,
      totalEpisodesWatched,
      totalWatchTimeHours: `${totalWatchTimeHours} hrs`,
      topRatedAnime,
    };
  }, [shelf]);

  return (
    <section>
        <h2 className="text-2xl font-semibold mb-4 text-primary flex items-center">
            <ListChecks className="mr-3 h-7 w-7" />
            At a Glance
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard 
                title="Anime Completed" 
                value={stats.completedAnimeCount} 
                icon={Clapperboard}
                className="bg-gradient-to-br from-[hsl(var(--chart-1))] to-[hsl(var(--chart-1),0.7)] text-primary-foreground"
                valueClassName="text-primary-foreground"
            />
            <StatCard 
                title="Episodes Watched" 
                value={stats.totalEpisodesWatched} 
                icon={Tv}
                className="bg-gradient-to-br from-[hsl(var(--chart-2))] to-[hsl(var(--chart-2),0.7)] text-primary-foreground"
                valueClassName="text-primary-foreground"
            />
            <StatCard 
                title="Total Watch Time" 
                value={stats.totalWatchTimeHours} 
                icon={Clock3}
                className="bg-gradient-to-br from-[hsl(var(--chart-3))] to-[hsl(var(--chart-3),0.7)] text-primary-foreground"
                valueClassName="text-primary-foreground"
            />
            <Card className="shadow-lg col-span-full md:col-span-2 lg:col-span-1 bg-gradient-to-br from-[hsl(var(--chart-4))] to-[hsl(var(--chart-4),0.7)] text-primary-foreground">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground/80">Top Rated Anime</CardTitle>
                <Award className="h-5 w-5 text-muted-foreground/80" />
                </CardHeader>
                <CardContent>
                {stats.topRatedAnime.length > 0 ? (
                    <ul className="space-y-2">
                    {stats.topRatedAnime.map((anime, index) => (
                        <li key={anime.mal_id} className="flex items-center gap-3 text-sm">
                           <Image 
                             src={anime.cover_image} 
                             alt={anime.title} 
                             width={32} 
                             height={48} 
                             className="rounded-sm object-cover"
                             data-ai-hint="anime cover small"
                            />
                           <span className="font-semibold flex-grow truncate" title={anime.title}>{index + 1}. {anime.title}</span>
                           <div className="flex items-center">
                             <Star className="h-4 w-4 text-yellow-300 mr-1" /> 
                             <span>{anime.user_rating}/10</span>
                           </div>
                        </li>
                    ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground/80 pt-1">No anime rated yet.</p>
                )}
                </CardContent>
            </Card>
        </div>
    </section>
  );
}