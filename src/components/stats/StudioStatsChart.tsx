
"use client";

import React, { useMemo } from 'react';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Film, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';


export function StudioStatsChart() {
  const { shelf, isInitialized } = useAnimeShelf();

  const chartData = useMemo(() => {
    if (!isInitialized || shelf.length === 0) return [];

    const studioCounts: Record<string, number> = {};
    shelf.forEach(anime => {
      if (anime.user_status === 'completed') { 
        anime.studios.forEach(studioName => {
          studioCounts[studioName] = (studioCounts[studioName] || 0) + 1;
        });
      }
    });

    return Object.entries(studioCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count) 
      .slice(0, 15); 

  }, [shelf, isInitialized]);
  
  const chartConfig = useMemo(() => ({
    count: {
      label: "Completed Anime",
      color: "hsl(var(--chart-5))",
    },
  } as ChartConfig), []);


  if (!isInitialized) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Film className="mr-3 h-6 w-6" />Anime by Studio</CardTitle>
          <CardDescription>Number of completed anime per animation studio (Top 15).</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center">
          <p className="text-muted-foreground">Loading chart data...</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
     return (
        <Card>
            <CardHeader>
                 <CardTitle className="flex items-center"><Film className="mr-3 h-6 w-6" />Anime by Studio</CardTitle>
                <CardDescription>Number of completed anime per animation studio (Top 15).</CardDescription>
            </CardHeader>
            <CardContent>
                 <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        No completed anime with studio information found on your shelf. Complete some anime to see studio statistics.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><Film className="mr-3 h-6 w-6" />Anime by Studio (Top {chartData.length})</CardTitle>
        <CardDescription>Number of completed anime per animation studio. Showing top {chartData.length} studios.</CardDescription>
      </CardHeader>
      <CardContent className="h-[400px] pb-0">
        <ChartContainer config={chartConfig} className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20, bottom: 20 }}> 
                <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                <XAxis 
                    type="number" 
                    allowDecimals={false} 
                    tickLine={false} 
                    axisLine={false} 
                    fontSize={12}
                    label={{ value: 'Anime Count', position: 'insideBottom', offset: -15, style: {textAnchor: 'middle', fontSize: '12px', fill: 'hsl(var(--muted-foreground))'} }}
                />
                <YAxis 
                    dataKey="name" 
                    type="category" 
                    tickLine={false} 
                    axisLine={false} 
                    tickMargin={5} 
                    width={120} 
                    interval={0} 
                    fontSize={11}
                />
                <Tooltip
                cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                content={<ChartTooltipContent formatter={(value, name, item) => {
                    return (
                            <div className="flex flex-col">
                            <span className="text-sm font-bold">{item.payload.name}</span>
                            <span className="text-xs text-muted-foreground">Completed Anime: {value}</span>
                            </div>
                        );
                }} 
                hideLabel={true}
                hideIndicator={true}
                />}
                />
                <Legend 
                    wrapperStyle={{paddingTop: '10px'}}
                    formatter={(value) => <span style={{color: 'hsl(var(--foreground))'}}>{value}</span>}
                />
                <Bar dataKey="count" name="Completed Anime" fill="hsl(var(--chart-5))" radius={[0, 4, 4, 0]} barSize={20}/>
            </BarChart>
            </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
