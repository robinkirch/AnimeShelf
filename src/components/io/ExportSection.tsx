'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { DownloadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nContext';
import { backupFileName, createBackup } from '@/lib/backup';

/** Exports shelf, watch history and ignored preview entries as one JSON backup file (see src/lib/backup.ts). */
export function ExportSection() {
  const { t } = useI18n();
  const { shelf, episodeWatchHistory, ignoredPreviewAnimeMalIds } = useAnimeShelf();
  const { toast } = useToast();

  const exportBackup = async () => {
    if (shelf.length === 0 && episodeWatchHistory.length === 0 && ignoredPreviewAnimeMalIds.length === 0) {
      toast({ title: t('io.export.failedTitle'), description: t('io.export.nothingToExport'), variant: "destructive" });
      return;
    }

    const appVersion = await window.electronStore?.getAppVersion().catch(() => null) ?? null;
    const backup = createBackup({ shelf, watchHistory: episodeWatchHistory, ignoredPreviewMalIds: ignoredPreviewAnimeMalIds }, appVersion);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFileName();
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: t('io.export.successTitle'),
      description: t('io.export.successDescription', { shelf: shelf.length, history: episodeWatchHistory.length, ignored: ignoredPreviewAnimeMalIds.length }),
    });
  };

  return (
    <div className="space-y-4 py-4">
      <p className="text-sm text-muted-foreground">
        {t('io.export.description')}
      </p>
      <Button onClick={() => void exportBackup()} className="w-full">
        <DownloadCloud className="mr-2 h-4 w-4" /> {t('io.export.button')}
      </Button>
    </div>
  );
}
