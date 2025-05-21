
'use client';
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import type { UserAnime, UserAnimeStatus, JikanAnime } from '@/types/anime';
import { USER_ANIME_STATUS_OPTIONS, BROADCAST_DAY_OPTIONS } from '@/types/anime';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, UploadCloud, Loader2, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { jikanApi } from '@/lib/jikanApi'; // Import jikanApi

const EXPECTED_HEADERS = ['mal_id', 'title', 'cover_image', 'total_episodes', 'user_status', 'current_episode', 'user_rating', 'genres', 'studios', 'type', 'year', 'season', 'streaming_platforms', 'broadcast_day', 'duration_minutes'];
const MINIMUM_REQUIRED_FOR_PROCESSING = ['user_status', 'current_episode'];


// Helper function to parse Jikan duration string to minutes (can be moved to utils if needed elsewhere)
function parseDurationToMinutes(durationStr: string | null | undefined): number | null {
  if (!durationStr) return null;
  
  const perEpMatch = durationStr.match(/(\d+)\s*min(?:s|\.)?\s*(?:per\s*ep)?/i);
  if (perEpMatch && perEpMatch[1]) {
    return parseInt(perEpMatch[1], 10);
  }

  const hrMinMatch = durationStr.match(/(?:(\d+)\s*hr)?\s*(?:(\d+)\s*min)?/i);
  if (hrMinMatch) {
    const hours = hrMinMatch[1] ? parseInt(hrMinMatch[1], 10) : 0;
    const minutes = hrMinMatch[2] ? parseInt(hrMinMatch[2], 10) : 0;
    if (!durationStr.toLowerCase().includes("per ep") && (hours > 0 || minutes > 0)) {
        return (hours * 60) + minutes;
    }
  }
  return null;
}


export function ImportCsvSection({ onImported }: { onImported: () => void }) {
  const { importAnimeBatch } = useAnimeShelf();
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ successCount: number; errors: Array<{ animeTitle?: string; malId?: number; error: string }> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [totalLines, setTotalLines] = useState(0);
  const [processedLines, setProcessedLines] = useState(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      if (event.target.files[0].type === "text/csv" || event.target.files[0].name.endsWith(".csv")) {
        setFile(event.target.files[0]);
        setImportResults(null); 
        setTotalLines(0);
        setProcessedLines(0);
      } else {
        toast({ title: "Invalid File Type", description: "Please select a valid .csv file.", variant: "destructive"});
        event.target.value = ""; 
      }
    }
  };

  const robustCsvLineParse = (line: string, delimiter: string = ','): string[] => {
    const values: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                // Escaped quote
                currentField += '"';
                i++; // Skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            values.push(currentField);
            currentField = '';
        } else {
            currentField += char;
        }
    }
    values.push(currentField); // Add the last field
    return values;
  };


  const handleImport = async () => {
    if (!file) {
      toast({ title: "Import Error", description: "Please select a CSV file to import.", variant: "destructive" });
      return;
    }
    setIsImporting(true);
    setImportResults(null);
    setProcessedLines(0);
    setTotalLines(0);


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
      
      const missingCoreRequirements = MINIMUM_REQUIRED_FOR_PROCESSING.filter(rh => !headers.includes(rh.toLowerCase()));
      const hasIdentifier = headers.includes('mal_id') || headers.includes('title');

      if (missingCoreRequirements.length > 0 || !hasIdentifier) {
         setIsImporting(false);
         let errorMsg = "CSV headers are invalid. ";
         if (missingCoreRequirements.length > 0) errorMsg += `Missing: ${missingCoreRequirements.join(', ')}. `;
         if (!hasIdentifier) errorMsg += "Missing identifier: 'mal_id' or 'title' must be present. ";
         errorMsg += `Found: ${headers.join(', ')}`;
         toast({ title: "Import Error", description: errorMsg, variant: "destructive" });
         return;
      }
      
      if (lines.length < 2) { 
         setIsImporting(false);
         toast({ title: "Import Error", description: "CSV file has a header row but no data rows.", variant: "destructive" });
         return;
      }

      setTotalLines(lines.length -1); // -1 for header row
      const importedAnimeList: UserAnime[] = [];
      const processingErrors: Array<{ animeTitle?: string; malId?: number; error: string }> = [];

      for (let i = 1; i < lines.length; i++) {
        setProcessedLines(i); // Update processed lines count (i is 1-based for data rows)
        const lineContent = lines[i];
        if (!lineContent.trim()) continue;

        const values = robustCsvLineParse(lineContent);

        if (values.length !== headers.length) {
            processingErrors.push({ animeTitle: `Row ${i+1}`, error: `Column count mismatch. Expected ${headers.length} based on CSV header, got ${values.length} values. Ensure row has correct number of commas. Line: "${lineContent.substring(0,100)}..."` });
            continue;
        }

        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          // parseCsvCell (old function) is not needed with robustCsvLineParse if it handles quotes correctly
          row[header] = (values[index] || "").trim(); 
        });
        
        let mal_id: number | undefined = undefined;
        let jikanDataFromApi: JikanAnime | null = null;

        const mal_id_csv_str = row.mal_id?.trim();
        if (mal_id_csv_str) {
            const parsed_mal_id = parseInt(mal_id_csv_str, 10);
            if (!isNaN(parsed_mal_id) && parsed_mal_id > 0) {
                mal_id = parsed_mal_id;
            } else if (mal_id_csv_str !== '') { // Non-empty but invalid
                 processingErrors.push({ animeTitle: row.title?.trim() || `Row ${i+1}`, error: `Invalid 'mal_id' in CSV: ${mal_id_csv_str}.` });
                 continue;
            }
        }

        const title_csv = row.title?.trim();

        if (!mal_id && title_csv) {
            try {
                const searchResults = await jikanApi.searchAnime(title_csv, 1);
                if (searchResults.length > 0 && searchResults[0]) {
                    jikanDataFromApi = searchResults[0];
                    mal_id = jikanDataFromApi.mal_id;
                } else {
                    processingErrors.push({ animeTitle: title_csv, error: `Could not find MAL ID for title. Please provide MAL ID or a more precise title.` });
                    continue;
                }
            } catch (apiError) {
                processingErrors.push({ animeTitle: title_csv, error: `API error while searching for title. Please try again or provide MAL ID.` });
                continue;
            }
        } else if (!mal_id && !title_csv) {
            processingErrors.push({ animeTitle: `Row ${i+1}`, error: "Missing 'mal_id' and 'title'. One must be provided." });
            continue;
        } else if (mal_id && !jikanDataFromApi) { // mal_id from CSV, fetch if necessary
            const needsApiFetch = !row.cover_image || !row.total_episodes || !row.genres || !row.studios || !row.type || !row.year || !row.season || !row.duration_minutes;
            if (needsApiFetch) {
                 try {
                    jikanDataFromApi = await jikanApi.getAnimeById(mal_id);
                 } catch (apiError) {
                    console.warn(`Could not fetch details for MAL ID ${mal_id} during import. Proceeding with CSV data.`);
                 }
            }
        }
        
        if (!mal_id) { // Should be caught earlier, but safety net
            processingErrors.push({ animeTitle: title_csv || `Row ${i+1}`, error: "Failed to determine MAL ID for processing." });
            continue;
        }
        
        // --- User-specific fields from CSV (Required) ---
        const user_status_csv = row.user_status as UserAnimeStatus;
        if (!USER_ANIME_STATUS_OPTIONS.find(opt => opt.value === user_status_csv)) {
          processingErrors.push({ malId: mal_id, animeTitle: title_csv, error: `Invalid 'user_status': ${user_status_csv}.` });
          continue;
        }
        const current_episode_csv_str = row.current_episode;
        const current_episode_csv = parseInt(current_episode_csv_str, 10);
        if (isNaN(current_episode_csv) || current_episode_csv < 0) {
          processingErrors.push({ malId: mal_id, animeTitle: title_csv, error: `Invalid 'current_episode': ${current_episode_csv_str}. Must be a non-negative number.` });
          continue;
        }
        
        // --- Combine CSV and API Data ---
        const finalTitle = title_csv || jikanDataFromApi?.title || 'Unknown Title';
        const cover_image = row.cover_image?.trim() || jikanDataFromApi?.images.webp?.large_image_url || jikanDataFromApi?.images.webp?.image_url || jikanDataFromApi?.images.jpg.large_image_url || `https://cdn.myanimelist.net/images/anime/${Math.floor(mal_id / 1000)}/${mal_id}.jpg`;

        let total_episodes: number | null = null;
        if (row.total_episodes?.trim()) {
            const parsed = parseInt(row.total_episodes.trim(), 10);
            if (!isNaN(parsed) && parsed >= 0) total_episodes = parsed;
            else { processingErrors.push({ malId: mal_id, animeTitle: finalTitle, error: `Invalid 'total_episodes' in CSV: ${row.total_episodes}.` }); continue; }
        } else if (jikanDataFromApi?.episodes !== undefined) {
            total_episodes = jikanDataFromApi.episodes;
        }

        let user_rating: number | null = null;
        if (row.user_rating?.trim()) {
            const parsed = parseInt(row.user_rating.trim(), 10);
            if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) user_rating = parsed;
            else { processingErrors.push({ malId: mal_id, animeTitle: finalTitle, error: `Invalid 'user_rating' in CSV: ${row.user_rating}. Must be 1-10 or empty.` }); continue; }
        }
        
        const genres = row.genres?.trim() ? row.genres.trim().split(';').map(g => g.trim()).filter(g => g) : (jikanDataFromApi?.genres?.map(g => g.name) || []);
        const studios = row.studios?.trim() ? row.studios.trim().split(';').map(s => s.trim()).filter(s => s) : (jikanDataFromApi?.studios?.map(s => s.name) || []);
        const type = row.type?.trim() || jikanDataFromApi?.type || null;

        let year: number | null = null;
        if (row.year?.trim()) {
            const parsed = parseInt(row.year.trim(), 10);
            if (!isNaN(parsed)) year = parsed;
            else { processingErrors.push({ malId: mal_id, animeTitle: finalTitle, error: `Invalid 'year' in CSV: ${row.year}.` }); continue; }
        } else if (jikanDataFromApi?.year !== undefined) {
            year = jikanDataFromApi.year;
        }
        
        const season = row.season?.trim() || jikanDataFromApi?.season || null;
        const streaming_platforms = row.streaming_platforms?.trim() ? row.streaming_platforms.trim().split(';').map(p => p.trim()).filter(p => p) : (jikanDataFromApi?.streaming?.map(s => s.name) || []);
        
        let broadcast_day: string | null = null;
        if (row.broadcast_day?.trim()) {
            const csvDay = row.broadcast_day.trim();
            if (BROADCAST_DAY_OPTIONS.find(opt => opt.value === csvDay) || csvDay.toLowerCase() === 'other') broadcast_day = csvDay;
            else { processingErrors.push({ malId: mal_id, animeTitle: finalTitle, error: `Invalid 'broadcast_day' in CSV: ${csvDay}.` }); continue; }
        } else if (jikanDataFromApi?.broadcast?.day) {
            broadcast_day = jikanDataFromApi.broadcast.day;
        }

        let duration_minutes: number | null = null;
        if (row.duration_minutes?.trim()) {
            const parsed = parseInt(row.duration_minutes.trim(), 10);
            if (!isNaN(parsed) && parsed >= 0) duration_minutes = parsed;
            else { processingErrors.push({ malId: mal_id, animeTitle: finalTitle, error: `Invalid 'duration_minutes' in CSV: ${row.duration_minutes}.`}); continue; }
        } else if (jikanDataFromApi?.duration) {
            duration_minutes = parseDurationToMinutes(jikanDataFromApi.duration);
        }

        importedAnimeList.push({
          mal_id,
          title: finalTitle,
          cover_image,
          total_episodes,
          user_status: user_status_csv,
          current_episode: current_episode_csv,
          user_rating,
          genres,
          studios,
          type,
          year,
          season,
          streaming_platforms,
          broadcast_day,
          duration_minutes,
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
      } else if (importedAnimeList.length === 0 && processingErrors.length === 0) {
        toast({ title: "Import Note", description: "No valid anime data found in the file to import." });
      } else {
        toast({ title: "Import Note", description: "No new anime data found in the file to import, or all entries were already up-to-date." });
      }
      
      onImported();
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
      }
      setFile(null);
      // setTotalLines(0); // Resetting here might be too soon if user wants to see the "X of Y" on completion
      // setProcessedLines(0);
    };
    reader.onerror = () => {
      setIsImporting(false);
      toast({ title: "Import Error", description: "Failed to read the selected file.", variant: "destructive" });
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 py-4" style={{width: "100%"}}> {/* Changed width to 100% */}
      <div>
        <h4 className="font-medium mb-1 text-sm">Expected CSV Format:</h4>
        <p className="text-xs text-muted-foreground">
          The CSV file must have a header row. Column names are case-insensitive.
          Required columns: <code className="text-xs bg-muted/50 px-1 rounded">mal_id (or title)</code>, <code className="text-xs bg-muted/50 px-1 rounded">user_status</code>, <code className="text-xs bg-muted/50 px-1 rounded">current_episode</code>.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Supported columns (others will be ignored):
        </p>
        <code className="block bg-muted p-2 rounded-md text-xs mt-1 break-words">
          {EXPECTED_HEADERS.join(',')}
        </code>
        <p className="text-xs text-muted-foreground mt-1">
          For <code className="text-xs bg-muted/50 px-1 rounded">genres</code>, <code className="text-xs bg-muted/50 px-1 rounded">studios</code>, and <code className="text-xs bg-muted/50 px-1 rounded">streaming_platforms</code>, use a semi-colon (;) to separate multiple values (e.g., "Action;Adventure"). Empty fields for optional data will be filled by API if possible.
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

      {isImporting && totalLines > 0 && (
        <div className="text-sm text-muted-foreground text-center mt-2">
          Processing line {processedLines} of {totalLines}...
        </div>
      )}

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
            {(importResults.errors.length > 0 || (importResults.successCount === 0 && importResults.errors.length === 0)) && (
                 <AlertDescription className="text-xs">
                    {importResults.errors.length > 0 ? "See error details below." : (importResults.successCount === 0 ? "No data was imported or file was empty." : "")}
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

    
