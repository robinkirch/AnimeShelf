
'use client';
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import type { UserAnime, UserAnimeStatus, JikanAnime, ImportMode } from '@/types/anime';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { USER_ANIME_STATUS_OPTIONS, BROADCAST_DAY_OPTIONS } from '@/types/anime';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, UploadCloud, Loader2, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { jikanApi } from '@/lib/jikanApi'; // Import jikanApi
import { useI18n } from '@/i18n/I18nContext';
import { parseCsvLine, parseDurationToMinutes } from '@/lib/parsing';
import { parseBackup, type BackupParseError } from '@/lib/backup';
import { rendererLogger } from '@/lib/logger';
import type { BackupImportResult } from '@/contexts/AnimeShelfContext';
import type { MessageKey } from '@/i18n/I18nContext';

const EXPECTED_HEADERS = ['mal_id', 'title', 'cover_image', 'total_episodes', 'user_status', 'current_episode', 'user_rating', 'genres', 'studios', 'type', 'year', 'season', 'streaming_platforms', 'broadcast_day', 'duration_minutes'];
const MINIMUM_REQUIRED_FOR_PROCESSING = ['user_status', 'current_episode'];

const BACKUP_ERROR_KEYS: Record<BackupParseError, MessageKey> = {
  invalidJson: 'io.import.toast.backupInvalidJson',
  notABackup: 'io.import.toast.backupNotABackup',
  unsupportedVersion: 'io.import.toast.backupUnsupportedVersion',
};

const isBackupFile = (file: File) => file.name.toLowerCase().endsWith('.json');

export function ImportCsvSection({ onImported }: { onImported: () => void }) {
  const { t } = useI18n();
const { importAnimeBatch, importBackup, isAnimeOnShelf, isElectronStoreReady } = useAnimeShelf();
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ successCount: number; skippedCount: number; errors: Array<{ animeTitle?: string; malId?: number; error: string }> } | null>(null);
  // Asked before every import: extend (keep existing anime) or overwrite existing anime. Nothing is ever deleted.
  const [isModeDialogOpen, setIsModeDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [totalLines, setTotalLines] = useState(0);
  const [processedLines, setProcessedLines] = useState(0);
  const [backupSummary, setBackupSummary] = useState<{ result: BackupImportResult; invalid: number } | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selected = event.target.files[0];
      if (selected.type === "text/csv" || selected.name.toLowerCase().endsWith(".csv") || isBackupFile(selected)) {
        setFile(selected);
        setImportResults(null);
        setBackupSummary(null);
        setTotalLines(0);
        setProcessedLines(0);
      } else {
        toast({ title: t('io.import.toast.invalidTypeTitle'), description: t('io.import.toast.invalidTypeDescription'), variant: "destructive"});
        event.target.value = ""; 
      }
    }
  };

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFile(null);
  };

  /** JSON backup: shelf, watch history and ignored preview entries (src/lib/backup.ts). */
  const importBackupFile = async (selected: File, mode: ImportMode) => {
    setIsImporting(true);
    setImportResults(null);
    setBackupSummary(null);
    try {
      const parsed = parseBackup(await selected.text());
      if (!parsed.ok) {
        toast({ title: t('io.import.toast.errorTitle'), description: t(BACKUP_ERROR_KEYS[parsed.error]), variant: "destructive" });
        return;
      }
      const { backup, invalid } = parsed.result;
      const result = await importBackup(backup, mode);
      setBackupSummary({ result, invalid: invalid.shelf + invalid.watchHistory + invalid.ignoredPreview });
      toast({
        title: t('io.import.toast.backupSuccessTitle'),
        description: t('io.import.toast.backupSuccessDescription', {
          shelf: result.shelf.successCount, history: result.watchHistory.added, ignored: result.ignoredPreviewAdded,
        }),
        variant: result.shelf.errors.length > 0 ? "destructive" : "default",
      });
      onImported();
    } catch (error) {
      rendererLogger.error('Backup import failed.', { category: 'user-action-error', action: 'import-backup', error: String(error) });
      toast({ title: t('io.import.toast.errorTitle'), description: t('io.import.toast.backupFailed'), variant: "destructive" });
    } finally {
      setIsImporting(false);
      resetFileInput();
    }
  };

  const handleImportClick = () => {
    if (!file) {
      toast({ title: t('io.import.toast.errorTitle'), description: t('io.import.toast.noFile'), variant: "destructive" });
      return;
    }
    setIsModeDialogOpen(true);
  };

  const handleImport = async (mode: ImportMode) => {
    setIsModeDialogOpen(false);
    if (!file) return;
    if (isBackupFile(file)) {
      await importBackupFile(file, mode);
      return;
    }
    setBackupSummary(null);
    setIsImporting(true);
    setImportResults(null);
    setProcessedLines(0);
    setTotalLines(0);


    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setIsImporting(false);
        toast({ title: t('io.import.toast.errorTitle'), description: t('io.import.toast.unreadable'), variant: "destructive" });
        return;
      }
      
      const lines = text.split(/\r\n|\n|\r/).filter(line => line.trim() !== ''); 
      if (lines.length < 1) { 
         setIsImporting(false);
         toast({ title: t('io.import.toast.errorTitle'), description: t('io.import.toast.empty'), variant: "destructive" });
         return;
      }

      const csvHeaders = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
      
      const missingCoreRequirements = MINIMUM_REQUIRED_FOR_PROCESSING.filter(rh => !csvHeaders.includes(rh.toLowerCase()));
      const hasIdentifier = csvHeaders.includes('mal_id') || csvHeaders.includes('title');

      if (missingCoreRequirements.length > 0 || !hasIdentifier) {
         setIsImporting(false);
         let errorMsg = t('io.import.toast.invalidHeaders') + ' ';
         if (missingCoreRequirements.length > 0) errorMsg += t('io.import.toast.missingFields', { fields: missingCoreRequirements.join(', ') }) + ' ';
         if (!hasIdentifier) errorMsg += t('io.import.toast.missingIdentifier') + ' ';
         errorMsg += t('io.import.toast.headersFound', { headers: csvHeaders.join(', ') });
         toast({ title: t('io.import.toast.errorTitle'), description: errorMsg, variant: "destructive", duration: 10000 });
         return;
      }
      
      if (lines.length < 2) { 
         setIsImporting(false);
         toast({ title: t('io.import.toast.errorTitle'), description: t('io.import.toast.noDataRows'), variant: "destructive" });
         return;
      }

      setTotalLines(lines.length -1); // -1 for header row
      const importedAnimeList: UserAnime[] = [];
      const processingErrors: Array<{ animeTitle?: string; malId?: number; error: string }> = [];
      let skippedExisting = 0;

      for (let i = 1; i < lines.length; i++) {
        setProcessedLines(i); // Update processed lines count (i is 1-based for data rows)
        const lineContent = lines[i];
        if (!lineContent.trim()) continue;

        const values = parseCsvLine(lineContent);

        if (values.length !== csvHeaders.length) {
            processingErrors.push({ animeTitle: t('io.import.row', { row: i + 1 }), error: t('io.import.errors.columnMismatch', { expected: csvHeaders.length, actual: values.length, line: lineContent.substring(0, 100) }) });
            continue;
        }

        const row: Record<string, string> = {};
        csvHeaders.forEach((header, index) => {
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
                 processingErrors.push({ animeTitle: row.title?.trim() || t('io.import.row', { row: i + 1 }), error: t('io.import.errors.invalidMalId', { value: mal_id_csv_str }) });
                 continue;
            }
        }

        // Extend mode keeps existing anime unchanged, so don't spend API requests on them.
        if (mode === 'extend' && mal_id && isAnimeOnShelf(mal_id)) {
            skippedExisting++;
            continue;
        }

        const title_csv = row.title?.trim();

        if (!mal_id && title_csv) {
            try {
                const searchResults = await jikanApi.searchAnime(title_csv, 1);
                if (searchResults.length > 0 && searchResults[0]) {
                    jikanDataFromApi = searchResults[0];
                    mal_id = jikanDataFromApi.mal_id;
                } else {
                    processingErrors.push({ animeTitle: title_csv, error: t('io.import.errors.titleNotFound') });
                    continue;
                }
            } catch (apiError: any) {
                processingErrors.push({ animeTitle: title_csv, error: t('io.import.errors.searchFailed', { title: title_csv, message: apiError.message }) });
                continue;
            }
        } else if (!mal_id && !title_csv) {
            processingErrors.push({ animeTitle: t('io.import.row', { row: i + 1 }), error: t('io.import.errors.missingIdAndTitle') });
            continue;
        } else if (mal_id && !jikanDataFromApi) { // mal_id from CSV, fetch if necessary
            const needsApiFetch = !row.cover_image || (row.total_episodes === undefined || row.total_episodes === '') || !row.genres || !row.studios || !row.type || !row.year || !row.season || !row.duration_minutes;
            if (needsApiFetch) {
                 try {
                    jikanDataFromApi = await jikanApi.getAnimeById(mal_id);
                 } catch (apiError: any) {
                    console.warn(`Could not fetch details for MAL ID ${mal_id} during import. Proceeding with CSV data. Error: ${apiError.message}`);
                 }
            }
        }
        
        if (!mal_id) { // Should be caught earlier, but safety net
            processingErrors.push({ animeTitle: title_csv || t('io.import.row', { row: i + 1 }), error: t('io.import.errors.noMalId') });
            continue;
        }
        
        // --- User-specific fields from CSV (Required) ---
        const user_status_csv = row.user_status as UserAnimeStatus;
        if (!USER_ANIME_STATUS_OPTIONS.find(opt => opt.value === user_status_csv)) {
          processingErrors.push({ malId: mal_id, animeTitle: title_csv, error: t('io.import.errors.invalidStatus', { value: user_status_csv, allowed: USER_ANIME_STATUS_OPTIONS.map(o => o.value).join(', ') }) });
          continue;
        }
        
        // --- Combine CSV and API Data ---
        const finalTitle = title_csv || jikanDataFromApi?.title || 'Unknown Title';
        const cover_image = row.cover_image?.trim() || jikanDataFromApi?.images.webp?.large_image_url || jikanDataFromApi?.images.webp?.image_url || jikanDataFromApi?.images.jpg.large_image_url || `https://cdn.myanimelist.net/images/anime/${Math.floor(mal_id / 1000)}/${mal_id}.jpg`;

        let total_episodes: number | null = null;
        if (row.total_episodes?.trim()) {
            const parsed = parseInt(row.total_episodes.trim(), 10);
            if (!isNaN(parsed) && parsed >= 0) total_episodes = parsed;
            else { processingErrors.push({ malId: mal_id, animeTitle: finalTitle, error: t('io.import.errors.invalidTotalEpisodes', { value: row.total_episodes }) }); continue; }
        } else if (jikanDataFromApi?.episodes !== undefined) {
            total_episodes = jikanDataFromApi.episodes;
        }

        const current_episode_csv_str = row.current_episode;
        let current_episode_csv = parseInt(current_episode_csv_str, 10);
        if (isNaN(current_episode_csv) || current_episode_csv < 0) {
          processingErrors.push({ malId: mal_id, animeTitle: finalTitle, error: t('io.import.errors.invalidCurrentEpisode', { value: current_episode_csv_str }) });
          continue;
        }
        if (total_episodes !== null && current_episode_csv > total_episodes && total_episodes !== 0) { // Allow current_episode > 0 for movies (total_episodes: 0)
            current_episode_csv = total_episodes; // Cap at total episodes
        }


        let user_rating: number | null = null;
        if (row.user_rating?.trim()) {
            const parsed = parseInt(row.user_rating.trim(), 10);
            if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) user_rating = parsed;
            else { processingErrors.push({ malId: mal_id, animeTitle: finalTitle, error: t('io.import.errors.invalidRating', { value: row.user_rating }) }); continue; }
        }
        
        const genres = row.genres?.trim() ? row.genres.trim().split(';').map(g => g.trim()).filter(g => g) : (jikanDataFromApi?.genres?.map(g => g.name) || []);
        const studios = row.studios?.trim() ? row.studios.trim().split(';').map(s => s.trim()).filter(s => s) : (jikanDataFromApi?.studios?.map(s => s.name) || []);
        const type = row.type?.trim() || jikanDataFromApi?.type || null;

        let year: number | null = null;
        if (row.year?.trim()) {
            const parsed = parseInt(row.year.trim(), 10);
            if (!isNaN(parsed)) year = parsed;
            else { processingErrors.push({ malId: mal_id, animeTitle: finalTitle, error: t('io.import.errors.invalidYear', { value: row.year }) }); continue; }
        } else if (jikanDataFromApi?.year !== undefined) {
            year = jikanDataFromApi.year;
        }
        
        const season = row.season?.trim() || jikanDataFromApi?.season || null;
        const streaming_platforms = row.streaming_platforms?.trim() ? row.streaming_platforms.trim().split(';').map(p => p.trim()).filter(p => p) : (jikanDataFromApi?.streaming?.map(s => s.name) || []);
        
        let broadcast_day: string | null = null;
        if (row.broadcast_day?.trim()) {
            const csvDay = row.broadcast_day.trim();
            if (BROADCAST_DAY_OPTIONS.find(opt => opt.value.toLowerCase() === csvDay.toLowerCase()) || csvDay.toLowerCase() === 'other') {
                broadcast_day = BROADCAST_DAY_OPTIONS.find(opt => opt.value.toLowerCase() === csvDay.toLowerCase())?.value || 'Other';
            } else { processingErrors.push({ malId: mal_id, animeTitle: finalTitle, error: t('io.import.errors.invalidBroadcastDay', { value: csvDay }) }); continue; }
        } else if (jikanDataFromApi?.broadcast?.day) {
            broadcast_day = jikanDataFromApi.broadcast.day;
        }

        let duration_minutes: number | null = null;
        if (row.duration_minutes?.trim()) {
            const parsed = parseInt(row.duration_minutes.trim(), 10);
            if (!isNaN(parsed) && parsed >= 0) duration_minutes = parsed;
            else { processingErrors.push({ malId: mal_id, animeTitle: finalTitle, error: t('io.import.errors.invalidDuration', { value: row.duration_minutes }) }); continue; }
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

      // Await the database operation
      const dbResults = await importAnimeBatch(importedAnimeList, mode);
      const finalResults = {
        successCount: dbResults.successCount,
        skippedCount: dbResults.skippedCount + skippedExisting,
        errors: [...processingErrors, ...dbResults.errors] 
      };
      console.log(finalResults.successCount+"successes to "+finalResults.errors.length+" errors");
      setImportResults(finalResults);
      setIsImporting(false); // Ensure this is set after awaiting

      if (finalResults.successCount > 0 && finalResults.errors.length === 0) {
        toast({ title: t('io.import.toast.successTitle'), description: t('io.import.toast.successDescription', { count: finalResults.successCount }) });
      } else if (finalResults.successCount > 0 && finalResults.errors.length > 0) {
        toast({ title: t('io.import.toast.partialTitle'), description: t('io.import.toast.partialDescription', { success: finalResults.successCount, errors: finalResults.errors.length }), duration: 7000 });
      } else if (finalResults.errors.length > 0) {
         toast({ title: t('io.import.toast.failedTitle'), description: t('io.import.toast.failedDescription', { errors: finalResults.errors.length }), variant: "destructive", duration: 7000 });
      } else if (importedAnimeList.length === 0 && processingErrors.length === 0) {
        toast({ title: t('io.import.toast.noteTitle'), description: t('io.import.toast.noValidData') });
      } else { // This case might mean all entries were already present and identical, or only processingErrors occurred without any valid to import.
        toast({ title: t('io.import.toast.noteTitle'), description: t('io.import.toast.nothingNew') });
      }
      
      onImported(); // Call the callback to signal import completion
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
      }
      setFile(null);
      // setTotalLines(0); // Keep totalLines and processedLines for the final status message.
      // setProcessedLines(0);
    };
    reader.onerror = () => {
      setIsImporting(false);
      toast({ title: t('io.import.toast.errorTitle'), description: t('io.import.toast.readFailed'), variant: "destructive" });
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 py-4 grow">
      <div>
        <h4 className="font-medium mb-1 text-sm">{t('io.import.backupTitle')}</h4>
        <p className="text-xs text-muted-foreground">{t('io.import.backupDescription')}</p>
      </div>
      <div>
        <h4 className="font-medium mb-1 text-sm">{t('io.import.csvTitle')}</h4>
        <h5 className="font-medium mb-1 text-xs">{t('io.import.formatTitle')}</h5>
        <p className="text-xs text-muted-foreground">
          {t('io.import.formatHeader')}{' '}
          {t('io.import.requiredColumns')} (<code className="text-xs bg-muted/50 px-1 rounded">mal_id</code> {t('io.import.or')} <code className="text-xs bg-muted/50 px-1 rounded">title</code>), <code className="text-xs bg-muted/50 px-1 rounded">user_status</code>, <code className="text-xs bg-muted/50 px-1 rounded">current_episode</code>.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {t('io.import.supportedColumns')}
        </p>
        <ScrollArea className="h-auto max-h-20 whitespace-pre-wrap">
          <code className="block bg-muted p-2 rounded-md text-xs mt-1 wrap-break-word">
            {EXPECTED_HEADERS.join(', ')}
          </code>
        </ScrollArea>
        <p className="text-xs text-muted-foreground mt-1">
          {t('io.import.multiValueIntro')} <code className="text-xs bg-muted/50 px-1 rounded">genres</code>, <code className="text-xs bg-muted/50 px-1 rounded">studios</code>, <code className="text-xs bg-muted/50 px-1 rounded">streaming_platforms</code>. {t('io.import.multiValueNote')}
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="csv-file" className="text-sm">{t('io.import.selectFile')}</Label>
        <Input id="csv-file" type="file" accept=".json,.csv" onChange={handleFileChange} ref={fileInputRef} className="text-sm" />
      </div>
      <Button onClick={handleImportClick} disabled={!file || isImporting || !isElectronStoreReady} className="w-full">
        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
        {t('io.import.button')}
      </Button>

      <Dialog open={isModeDialogOpen} onOpenChange={setIsModeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('io.import.modeDialog.title')}</DialogTitle>
            <DialogDescription>{t('io.import.modeDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Button variant="outline" onClick={() => void handleImport('extend')} className="h-auto min-h-9 whitespace-normal py-3 flex-col items-start text-left">
              <span className="font-semibold">{t('io.import.modeDialog.extend')}</span>
              <span className="text-xs font-normal text-muted-foreground">{t('io.import.modeDialog.extendHint')}</span>
            </Button>
            <Button variant="outline" onClick={() => void handleImport('overwrite')} className="h-auto min-h-9 whitespace-normal py-3 flex-col items-start text-left">
              <span className="font-semibold">{t('io.import.modeDialog.overwrite')}</span>
              <span className="text-xs font-normal text-muted-foreground">{t('io.import.modeDialog.overwriteHint')}</span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsModeDialogOpen(false)}>{t('common.cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isImporting && totalLines > 0 && (
        <div className="text-sm text-muted-foreground text-center mt-2">
          {t('io.import.processing', { current: processedLines, total: totalLines })}
        </div>
      )}

      {backupSummary && (
        <div className="mt-4">
          <h4 className="font-medium mb-2 text-sm">{t('io.import.resultsTitle')}</h4>
          <Alert variant={backupSummary.result.shelf.errors.length > 0 ? "destructive" : "default"}>
            {backupSummary.result.shelf.errors.length > 0 ? <Info className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
            <AlertTitle className="text-sm">{t('io.import.backupShelf', { count: backupSummary.result.shelf.successCount })}</AlertTitle>
            <AlertDescription className="text-xs space-y-1">
              {backupSummary.result.shelf.skippedCount > 0 && <p>{t('io.import.skippedExisting', { count: backupSummary.result.shelf.skippedCount })}</p>}
              <p>{t('io.import.backupHistory', { added: backupSummary.result.watchHistory.added, skipped: backupSummary.result.watchHistory.skipped })}</p>
              <p>{t('io.import.backupIgnored', { count: backupSummary.result.ignoredPreviewAdded })}</p>
              {backupSummary.invalid > 0 && <p>{t('io.import.backupInvalid', { count: backupSummary.invalid })}</p>}
            </AlertDescription>
          </Alert>
          {backupSummary.result.shelf.errors.length > 0 && (
            <ul className="text-xs space-y-1 mt-2 max-h-32 overflow-y-auto border rounded-md p-2 bg-muted/30">
              {backupSummary.result.shelf.errors.map((err, index) => (
                <li key={index} className="text-destructive dark:text-red-400">
                  <strong>{err.animeTitle || (err.malId ? t('io.import.malId', { id: err.malId }) : t('io.import.row', { row: index + 1 }))}:</strong> {err.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {importResults && (
        <div className="mt-4">
          <h4 className="font-medium mb-2 text-sm">{t('io.import.resultsTitle')}</h4>
          <Alert variant={importResults.errors.length > 0 && importResults.successCount === 0 ? "destructive" : (importResults.errors.length > 0 ? "default" : "default")}>
            {importResults.errors.length === 0 && importResults.successCount > 0 && <CheckCircle className="h-4 w-4" />}
            {importResults.errors.length > 0 && importResults.successCount === 0 && <XCircle className="h-4 w-4" />}
            {importResults.errors.length > 0 && importResults.successCount > 0 && <Info className="h-4 w-4" />}

            <AlertTitle className="text-sm">
              {importResults.successCount > 0 ? t('io.import.resultSuccess', { count: importResults.successCount }) : (importResults.errors.length > 0 ? t('io.import.resultWithErrors') : t('io.import.resultProcessed'))}
              {importResults.errors.length > 0 && t('io.import.resultErrorCount', { count: importResults.errors.length })}
            </AlertTitle>
            {importResults.skippedCount > 0 && (
              <AlertDescription className="text-xs">{t('io.import.skippedExisting', { count: importResults.skippedCount })}</AlertDescription>
            )}
            {(importResults.errors.length > 0 || (importResults.successCount === 0 && importResults.errors.length === 0 && totalLines > 0)) && (
                 <AlertDescription className="text-xs">
                    {importResults.errors.length > 0 ? t('io.import.seeDetails') : (importResults.successCount === 0 && totalLines > 0 ? t('io.import.noValidData') : t('io.import.noData'))}
                </AlertDescription>
            )}
          </Alert>
          {importResults.errors.length > 0 && (
            <ScrollArea className="h-32 mt-2 border rounded-md p-2 bg-muted/30">
              <ul className="text-xs space-y-1">
                {importResults.errors.map((err, index) => (
                  <li key={index} className="text-destructive dark:text-red-400">
                    <strong>{err.animeTitle || (err.malId ? t('io.import.malId', { id: err.malId }) : t('io.import.row', { row: index + 1 }))}:</strong> {err.error}
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
    
