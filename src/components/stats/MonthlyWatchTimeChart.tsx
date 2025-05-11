"use client";

import React, { useMemo } from 'react';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartTooltipContent } from '@/components/ui/chart';
import { CalendarClock, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function MonthlyWatchTimeChart() {
  const { episodeWatchHistory, shelf, isInitialized } = useAnimeShelf();

  const chartData = useMemo(() => {
    if (!isInitialized || episodeWatchHistory.length === 0) return [];

    const animeDurationMap = new Map<number, number | null>();
    shelf.forEach(anime => {
      animeDurationMap.set(anime.mal_id, anime.duration_minutes);
    });

    const monthlyData: { [key: string]: { name: string; year: number; month: number; totalHours: number } } = {};
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11); // Include current month + 11 past months
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    for (let i = 0; i < 12; i++) {
        const date = new Date(twelveMonthsAgo);
        date.setMonth(twelveMonthsAgo.getMonth() + i);
        const monthName = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear();
        const key = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = { name: `${monthName} ${year}`, year: year, month: date.getMonth() + 1, totalHours: 0 };
    }
    
    episodeWatchHistory.forEach(event => {
      const watchedDate = new Date(event.watched_at);
      if (watchedDate < twelveMonthsAgo) return;

      const duration = animeDurationMap.get(event.mal_id);
      if (duration) {
        const key = `${watchedDate.getFullYear()}-${String(watchedDate.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[key]) {
            // Assuming each event.episode_number_watched means one episode
            // If episodes_watched_count was used: event.episodes_watched_count * duration
            monthlyData[key].totalHours += duration / 60;
        }
      }
    });
    
    return Object.values(monthlyData)
        .sort((a,b) => a.year - b.year || a.month - b.month)
        .map(data => ({ ...data, totalHours: parseFloat(data.totalHours.toFixed(1)) }));

  }, [episodeWatchHistory, shelf, isInitialized]);

  if (!isInitialized) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><CalendarClock className="mr-3 h-6 w-6" />Monthly Watch Time</CardTitle>
          <CardDescription>Total hours watched per month over the last 12 months.</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center">
          <p className="text-muted-foreground">Loading chart data...</p>
        </CardContent>
      </Card>
    );
  }
  
  if (chartData.length === 0 || episodeWatchHistory.length === 0) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><CalendarClock className="mr-3 h-6 w-6" />Monthly Watch Time</CardTitle>
                <CardDescription>Total hours watched per month over the last 12 months.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        No watch history data available to display the chart. Start tracking your watched episodes in "My Shelf".
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><CalendarClock className="mr-3 h-6 w-6" />Monthly Watch Time</CardTitle>
        <CardDescription>Total hours watched per month over the last 12 months.</CardDescription>
      </CardHeader>
      <CardContent className="h-[350px] pb-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false}/>
            <XAxis 
              dataKey="name" 
              tickLine={false} 
              axisLine={false} 
              tickMargin={8} 
              angle={-35}
              textAnchor="end"
              height={60} // Adjust height to accommodate angled labels
              interval={0} // Show all labels
              fontSize={12}
            />
            <YAxis 
              label={{ value: 'Hours Watched', angle: -90, position: 'insideLeft', offset:-5, style: {textAnchor: 'middle', fontSize: '12px', fill: 'hsl(var(--muted-foreground))'} }} 
              tickFormatter={(value) => `${value}h`}
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
              content={<ChartTooltipContent 
                formatter={(value, name, item) => {
                    return (
                        <div className="flex flex-col">
                           <span className="text-sm font-bold">{item.payload.name}</span>
                           <span className="text-xs text-muted-foreground">Watch Time: {value} hrs</span>
                        </div>
                    );
                }}
                hideLabel={true}
                hideIndicator={true}
              />}
            />
            <Legend 
                formatter={(value) => <span style={{color: 'hsl(var(--foreground))'}}>{value}</span>}
                wrapperStyle={{paddingTop: '10px'}}
            />
            <Bar dataKey="totalHours" name="Watch Time" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}