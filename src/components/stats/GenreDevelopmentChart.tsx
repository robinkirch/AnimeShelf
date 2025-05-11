"use client";

import React, { useMemo } from 'react';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartTooltipContent } from '@/components/ui/chart';
import { TrendingUp, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const seasonOrder = ['winter', 'spring', 'summer', 'fall'];

function getCurrentSeasonInfo(): { year: number; name: string } {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const year = now.getFullYear();
    if (month < 3) return { year, name: 'winter' }; // Jan, Feb, Mar (assuming Mar is start of Spring for calculation)
    if (month < 6) return { year, name: 'spring' }; // Apr, May, Jun
    if (month < 9) return { year, name: 'summer' }; // Jul, Aug, Sep
    return { year, name: 'fall' };   // Oct, Nov, Dec
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

  const { chartData, allGenres } = useMemo(() => {
    if (!isInitialized || shelf.length === 0) return { chartData: [], allGenres: [] };

    const currentSeasonInfo = getCurrentSeasonInfo();
    const last12Seasons = getPreviousNSeasons(currentSeasonInfo.year, currentSeasonInfo.name, 12);
    
    const genreCountsBySeason: Record<string, Record<string, number>> = {};
    const uniqueGenres = new Set<string>();

    last12Seasons.forEach(s => {
        genreCountsBySeason[s.key] = {};
    });

    shelf.forEach(anime => {
      if ((anime.user_status === 'completed' || anime.user_status === 'watching') && anime.year && anime.season) {
        const animeSeasonKey = `${anime.year}-${anime.season.toLowerCase()}`;
        if (genreCountsBySeason[animeSeasonKey]) {
          anime.genres.forEach(genre => {
            uniqueGenres.add(genre);
            genreCountsBySeason[animeSeasonKey][genre] = (genreCountsBySeason[animeSeasonKey][genre] || 0) + 1;
          });
        }
      }
    });
    
    const sortedGenres = Array.from(uniqueGenres).sort();
    const topGenres = sortedGenres.slice(0, 5); // Limit to top 5 genres for readability, or make dynamic

    const formattedChartData = last12Seasons.map(s => {
      const seasonData: { name: string; [key: string]: string | number } = { name: s.label };
      topGenres.forEach(genre => {
        seasonData[genre] = genreCountsBySeason[s.key]?.[genre] || 0;
      });
      return seasonData;
    });

    return { chartData: formattedChartData, allGenres: topGenres };

  }, [shelf, isInitialized]);
  
  const genreColors = [
    'hsl(var(--chart-1))', 
    'hsl(var(--chart-2))', 
    'hsl(var(--chart-3))', 
    'hsl(var(--chart-4))', 
    'hsl(var(--chart-5))'
  ]; // Use ShadCN chart colors


  if (!isInitialized) {
     return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><TrendingUp className="mr-3 h-6 w-6" />Genre Popularity Over Seasons</CardTitle>
          <CardDescription>Count of your watched anime by genre for the last 12 airing seasons.</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center">
          <p className="text-muted-foreground">Loading chart data...</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0 || allGenres.length === 0) {
     return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><TrendingUp className="mr-3 h-6 w-6" />Genre Popularity Over Seasons</CardTitle>
                <CardDescription>Count of your watched anime by genre for the last 12 airing seasons.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        Not enough data to display genre trends. Ensure anime on your shelf have year, season, and genre information, and are marked as watched/completed.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><TrendingUp className="mr-3 h-6 w-6" />Genre Popularity (Top {allGenres.length}) Over Seasons</CardTitle>
        <CardDescription>Count of your watched/completed anime by genre for the last 12 airing seasons. Shows top {allGenres.length} genres.</CardDescription>
      </CardHeader>
      <CardContent className="h-[400px] pb-0"> {/* Increased height for better label visibility */}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
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
                label={{ value: 'Anime Count', angle: -90, position: 'insideLeft', offset:-5, style: {textAnchor: 'middle', fontSize: '12px', fill: 'hsl(var(--muted-foreground))'} }} 
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
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}