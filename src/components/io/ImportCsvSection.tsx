
'use client';
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import type { UserAnime, UserAnimeStatus } from '@/types/anime';
import { USER_ANIME_STATUS_OPTIONS, BROADCAST_DAY_OPTIONS } from '@/types/anime';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, UploadCloud, Loader2, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

const EXPECTED_HEADERS = ['mal_id', 'title', 'cover_image', 'total_episodes', 'user_status', 'current_episode', 'user_rating', 'genres', 'studios', 'type', 'year', 'season', 'streaming_platforms', 'broadcast_day'];
const REQUIRED_HEADERS = ['mal_id', 'title', 'user_status', 'current_episode'];

export function ImportCsvSection({ onImported }: { onImported: () => void }) {
  const { importAnimeBatch } = useAnimeShelf();
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ successCount: number; errors: Array<{ animeTitle?: string; malId?: number; error: string }> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      if (event.target.files[0].type === "text/csv" || event.target.files[0].name.endsWith(".csv")) {
        setFile(event.target.files[0]);
        setImportResults(null); 
      } else {
        toast({ title: "Invalid File Type", description: "Please select a valid .csv file.", variant: "destructive"});
        event.target.value = ""; // Reset file input
      }
    }
  };

  const parseCsvCell = (cell: string): string => {
    if (typeof cell !== 'string') return '';
    if (cell.startsWith('"') && cell.endsWith('"')) {
      return cell.substring(1, cell.length - 1).replace(/""/g, '"');
    }
    return cell;
  };

  const handleImport = async () => {
    if (!file) {
      toast({ title: "Import Error", description: "Please select a CSV file to import.", variant: "destructive" });
      return;
    }
    setIsImporting(true);
    setImportResults(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setIsImporting(false);
        toast({ title: "Import Error", description: "Could not read file content.", variant: "destructive" });
        return;
      }
      
      const lines = text.split(/\r\n|\n|\r/).filter(line => line.trim() !== ''); 
      if (lines.length < 1) { 
         setIsImporting(false);
         toast({ title: "Import Error", description: "CSV file is empty.", variant: "destructive" });
         return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase()); 
      
      const missingRequiredHeaders = REQUIRED_HEADERS.filter(rh => !headers.includes(rh.toLowerCase()));
      if (missingRequiredHeaders.length > 0) {
         setIsImporting(false);
         toast({ title: "Import Error", description: `CSV headers are invalid. Missing required headers: ${missingRequiredHeaders.join(', ')}. Found: ${headers.join(', ')}`, variant: "destructive" });
         return;
      }
      
      if (lines.length < 2) { 
         setIsImporting(false);
         toast({ title: "Import Error", description: "CSV file has a header row but no data rows.", variant: "destructive" });
         return;
      }

      const importedAnimeList: UserAnime[] = [];
      const processingErrors: Array<{ animeTitle?: string; malId?: number; error: string }> = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const values = (line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || []).map(v => v.trim());

        if (values.length !== headers.length) {
            processingErrors.push({ animeTitle: `Row ${i+1}`, error: `Column count mismatch. Expected ${headers.length}, got ${values.length}. Line: "${line.substring(0,50)}..."` });
            continue;
        }

        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = parseCsvCell(values[index] || '');
        });
        
        const mal_id_str = row.mal_id;
        const mal_id = parseInt(mal_id_str, 10);
        const title = row.title;

        if (isNaN(mal_id)) {
          processingErrors.push({ animeTitle: title || `Row ${i+1}`, error: "Missing or invalid 'mal_id'." });
          continue;
        }
        if (!title) {
          processingErrors.push({ malId: mal_id, error: "Missing 'title'." });
          continue;
        }
        const user_status = row.user_status as UserAnimeStatus;
        if (!USER_ANIME_STATUS_OPTIONS.find(opt => opt.value === user_status)) {
          processingErrors.push({ malId: mal_id, animeTitle: title, error: `Invalid 'user_status': ${user_status}.` });
          continue;
        }
        const current_episode_str = row.current_episode;
        const current_episode = parseInt(current_episode_str, 10);
        if (isNaN(current_episode) || current_episode < 0) {
          processingErrors.push({ malId: mal_id, animeTitle: title, error: `Invalid 'current_episode': ${current_episode_str}. Must be a non-negative number.` });
          continue;
        }

        const total_episodes_str = row.total_episodes;
        const total_episodes = total_episodes_str === '' ? null : parseInt(total_episodes_str, 10);
        if (total_episodes_str !== '' && (isNaN(total_episodes as number) || (total_episodes as number) < 0) ) {
            processingErrors.push({ malId: mal_id, animeTitle: title, error: `Invalid 'total_episodes': ${total_episodes_str}. Must be a non-negative number or empty.` });
            continue;
        }

        const user_rating_str = row.user_rating;
        const user_rating = user_rating_str === '' ? null : parseInt(user_rating_str, 10);
         if (user_rating_str !== '' && (isNaN(user_rating as number) || (user_rating as number) < 1 || (user_rating as number) > 10) ) {
            processingErrors.push({ malId: mal_id, animeTitle: title, error: `Invalid 'user_rating': ${user_rating_str}. Must be between 1-10 or empty.` });
            continue;
        }
        
        const year_str = row.year;
        const year = year_str === '' ? null : parseInt(year_str, 10);
        if (year_str !== '' && isNaN(year as number)) {
            processingErrors.push({ malId: mal_id, animeTitle: title, error: `Invalid 'year': ${year_str}. Must be a number or empty.` });
            continue;
        }

        const broadcast_day_str = row.broadcast_day;
        const broadcast_day = broadcast_day_str === '' ? null : broadcast_day_str;
        if (broadcast_day !== null && !BROADCAST_DAY_OPTIONS.find(opt => opt.value === broadcast_day)) {
           if (broadcast_day !== null && typeof broadcast_day === 'string' && !BROADCAST_DAY_OPTIONS.map(o => o.value.toLowerCase()).includes(broadcast_day.toLowerCase()) && broadcast_day !== "Other") {
             processingErrors.push({ malId: mal_id, animeTitle: title, error: `Invalid 'broadcast_day': ${broadcast_day}. Must be one of predefined values, 'Other', or empty.` });
             continue;
           }
        }

        importedAnimeList.push({
          mal_id,
          title,
          cover_image: row.cover_image || `https://cdn.myanimelist.net/images/anime/${Math.floor(mal_id / 1000)}/${mal_id}.jpg`,
          total_episodes,
          user_status,
          current_episode,
          user_rating,
          genres: row.genres ? row.genres.split(';').map(g => g.trim()).filter(g => g) : [],
          studios: row.studios ? row.studios.split(';').map(s => s.trim()).filter(s => s) : [],
          type: row.type || null,
          year,
          season: row.season || null,
          streaming_platforms: row.streaming_platforms ? row.streaming_platforms.split(';').map(p => p.trim()).filter(p => p) : [],
          broadcast_day,
        });
      }

      const resultsFromContext = importAnimeBatch(importedAnimeList);
      const finalResults = {
        successCount: resultsFromContext.successCount,
        errors: [...processingErrors, ...resultsFromContext.errors] 
      };

      setImportResults(finalResults);
      setIsImporting(false);

      if (finalResults.successCount > 0 && finalResults.errors.length === 0) {
        toast({ title: "Import Successful", description: `${finalResults.successCount} anime entries imported/updated.` });
      } else if (finalResults.successCount > 0 && finalResults.errors.length > 0) {
        toast({ title: "Import Partially Successful", description: `${finalResults.successCount} entries imported/updated. ${finalResults.errors.length} errors occurred.`, duration: 7000 });
      } else if (finalResults.errors.length > 0) {
         toast({ title: "Import Failed", description: `No anime imported. ${finalResults.errors.length} errors occurred. See details below.`, variant: "destructive", duration: 7000 });
      } else {
        toast({ title: "Import Note", description: "No new anime data found in the file to import, or all entries were already up-to-date." });
      }
      
      onImported();
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
      }
      setFile(null);
    };
    reader.onerror = () => {
      setIsImporting(false);
      toast({ title: "Import Error", description: "Failed to read the selected file.", variant: "destructive" });
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 py-4">
      <div>
        <h4 className="font-medium mb-1 text-sm">Expected CSV Format:</h4>
        <p className="text-xs text-muted-foreground">
          The CSV file must have a header row. Column names are case-insensitive.
          Required columns: <code className="text-xs bg-muted/50 px-1 rounded">{REQUIRED_HEADERS.join(', ')}</code>.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Full list of supported columns (others will be ignored):
        </p>
        <code className="block bg-muted p-2 rounded-md text-xs mt-1 break-words">
          {EXPECTED_HEADERS.join(',')}
        </code>
        <p className="text-xs text-muted-foreground mt-1">
          For <code className="text-xs bg-muted/50 px-1 rounded">genres</code>, <code className="text-xs bg-muted/50 px-1 rounded">studios</code>, and <code className="text-xs bg-muted/50 px-1 rounded">streaming_platforms</code>, use a semi-colon (;) to separate multiple values (e.g., "Action;Adventure").
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="csv-file" className="text-sm">Select CSV File</Label>
        <Input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} ref={fileInputRef} className="text-sm" />
      </div>
      <Button onClick={handleImport} disabled={!file || isImporting} className="w-full">
        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
        Import from CSV
      </Button>

      {importResults && (
        <div className="mt-4">
          <h4 className="font-medium mb-2 text-sm">Import Results:</h4>
          <Alert variant={importResults.errors.length > 0 && importResults.successCount === 0 ? "destructive" : (importResults.errors.length > 0 ? "default" : "default")}>
            {importResults.errors.length === 0 && importResults.successCount > 0 && <CheckCircle className="h-4 w-4" />}
            {importResults.errors.length > 0 && importResults.successCount === 0 && <XCircle className="h-4 w-4" />}
            {importResults.errors.length > 0 && importResults.successCount > 0 && <Info className="h-4 w-4" />}

            <AlertTitle className="text-sm">
              {importResults.successCount > 0 ? `${importResults.successCount} Anime Imported/Updated Successfully.` : 'Import Processed.'}
              {importResults.errors.length > 0 && ` ${importResults.errors.length} errors occurred.`}
            </AlertTitle>
            {(importResults.errors.length > 0 || importResults.successCount === 0 && importResults.errors.length === 0) && (
                 <AlertDescription className="text-xs">
                    {importResults.errors.length > 0 ? "See error details below." : (importResults.successCount === 0 ? "No data was imported." : "")}
                </AlertDescription>
            )}
          </Alert>
          {importResults.errors.length > 0 && (
            <ScrollArea className="h-32 mt-2 border rounded-md p-2 bg-muted/30">
              <ul className="text-xs space-y-1">
                {importResults.errors.map((err, index) => (
                  <li key={index} className="text-destructive dark:text-red-400">
                    <strong>{err.animeTitle || (err.malId ? `MAL ID: ${err.malId}` : 'Unknown Entry')}:</strong> {err.error}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
