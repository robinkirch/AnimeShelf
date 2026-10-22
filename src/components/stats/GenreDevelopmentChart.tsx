
"use client";

import React, { useMemo } from 'react';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { TrendingUp, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useI18n } from '@/i18n/I18nContext';
import { seasonLabel } from '@/i18n/labels';

const seasonOrder = ['winter', 'spring', 'summer', 'fall'];

function getCurrentSeasonInfo(): { year: number; name: string } {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const year = now.getFullYear();
    if (month < 3) return { year, name: 'winter' }; 
    if (month < 6) return { year, name: 'spring' }; 
    if (month < 9) return { year, name: 'summer' }; 
    return { year, name: 'fall' };   
}

function getPreviousNSeasons(currentYear: number, currentSeasonName: string, n: number): Array<{ year: number, season: string, key: string, label: string }> {
  const seasonsArray: Array<{ year: number, season: string, key: string, label: string }> = [];
  let year = currentYear;
  let seasonIdx = seasonOrder.indexOf(currentSeasonName.toLowerCase());

  for (let i = 0; i < n; i++) {
    const seasonName = seasonOrder[seasonIdx];
    const label = `${seasonName.charAt(0).toUpperCase() + seasonName.slice(1)} ${year}`;
    seasonsArray.push({ year, season: seasonName, key: `${year}-${seasonName}`, label });
    
    seasonIdx--;
    if (seasonIdx < 0) {
      seasonIdx = seasonOrder.length - 1;
      year--;
    }
  }
  return seasonsArray.reverse(); 
}

export function GenreDevelopmentChart() {
  const { shelf, isInitialized } = useAnimeShelf();
  const { t } = useI18n();
  
  const genreColors = useMemo(() => [
    'hsl(var(--chart-1))', 
    'hsl(var(--chart-2))', 
    'hsl(var(--chart-3))', 
    'hsl(var(--chart-4))', 
    'hsl(var(--chart-5))'
  ], []);


  const { chartData, allGenres, chartConfig } = useMemo(() => {
    if (!isInitialized || shelf.length === 0) return { chartData: [], allGenres: [], chartConfig: {} as ChartConfig };

    const currentSeasonInfo = getCurrentSeasonInfo();
    const last12Seasons = getPreviousNSeasons(currentSeasonInfo.year, currentSeasonInfo.name, 12);
    
    const genreCountsBySeason: Record<string, Record<string, number>> = {};
    const genreTotals: Record<string, number> = {};

    last12Seasons.forEach(s => {
        genreCountsBySeason[s.key] = {};
    });

    shelf.forEach(anime => {
      if ((anime.user_status === 'completed' || anime.user_status === 'watching') && anime.year && anime.season) {
        const animeSeasonKey = `${anime.year}-${anime.season.toLowerCase()}`;
        if (genreCountsBySeason[animeSeasonKey]) {
          anime.genres.forEach(genre => {
            genreTotals[genre] = (genreTotals[genre] || 0) + 1;
            genreCountsBySeason[animeSeasonKey][genre] = (genreCountsBySeason[animeSeasonKey][genre] || 0) + 1;
          });
        }
      }
    });
    
    const topGenres = Object.entries(genreTotals)
      .sort(([genreA, countA], [genreB, countB]) => countB - countA || genreA.localeCompare(genreB))
      .slice(0, 5)
      .map(([genre]) => genre);

    const formattedChartData = last12Seasons.map(s => {
      const seasonData: { name: string; [key: string]: string | number } = { name: `${seasonLabel(t, s.season)} ${s.year}` };
      topGenres.forEach(genre => {
        seasonData[genre] = genreCountsBySeason[s.key]?.[genre] || 0;
      });
      return seasonData;
    });

    const generatedChartConfig: ChartConfig = {};
    topGenres.forEach((genre, index) => {
        generatedChartConfig[genre] = {
            label: genre,
            color: genreColors[index % genreColors.length],
        };
    });
    
    return { chartData: formattedChartData, allGenres: topGenres, chartConfig: generatedChartConfig };

  }, [shelf, isInitialized, genreColors, t]);
  

  if (!isInitialized) {
     return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><TrendingUp className="mr-3 h-6 w-6" />{t('stats.genre.title')}</CardTitle>
          <CardDescription>{t('stats.genre.description')}</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center">
          <p className="text-muted-foreground">{t('stats.loadingChart')}</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0 || allGenres.length === 0) {
     return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><TrendingUp className="mr-3 h-6 w-6" />{t('stats.genre.title')}</CardTitle>
                <CardDescription>{t('stats.genre.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                 <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        {t('stats.genre.empty')}
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><TrendingUp className="mr-3 h-6 w-6" />{t('stats.genre.titleTop', { count: allGenres.length })}</CardTitle>
        <CardDescription>{t('stats.genre.descriptionTop', { count: allGenres.length })}</CardDescription>
      </CardHeader>
      <CardContent className="h-[400px] pb-0">
        <ChartContainer config={chartConfig} className="aspect-auto w-full h-full">
            <BarChart data={chartData} margin={{ left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                <XAxis 
                    dataKey="name" 
                    tickLine={false} 
                    axisLine={false} 
                    tickMargin={10}
                    angle={-40}
                    textAnchor="end"
                    height={70}
                    interval={0}
                    fontSize={11}
                />
                <YAxis 
                    label={{ value: t('stats.genre.axis'), angle: -90, position: 'insideLeft', offset:-5, style: {textAnchor: 'middle', fontSize: '12px', fill: 'hsl(var(--muted-foreground))'} }} 
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                />
                <Tooltip
                cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                content={<ChartTooltipContent />}
                />
                <Legend 
                    wrapperStyle={{paddingTop: '10px'}}
                    formatter={(value) => <span style={{color: 'hsl(var(--foreground))'}}>{value}</span>}
                />
                {allGenres.map((genre, index) => (
                <Bar key={genre} dataKey={genre} stackId="a" fill={genreColors[index % genreColors.length]} radius={[4, 4, 0, 0]} />
                ))}
            </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
