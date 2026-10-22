"use client";

import { Download, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useUpdateStatus } from '@/hooks/use-update-status';
import { useI18n } from '@/i18n/I18nContext';

/** Settings section: app version, update state, manual check and the only place where an update is started. */
export function UpdateSection() {
  const { version, status, check, install } = useUpdateStatus();
  const { t } = useI18n();

  const message = (() => {
    switch (status.state) {
      case 'disabled': return t('updates.disabled');
      case 'checking': return t('updates.checking');
      case 'not-available': return t('updates.upToDate');
      case 'available': return t('updates.available', { version: status.version });
      case 'downloading': return t('updates.downloading', { version: status.version, percent: status.percent });
      case 'installing': return t('updates.installing', { version: status.version });
      case 'error': return t('updates.error');
      default: return null;
    }
  })();

  return (
    <div className="space-y-3 p-4 border rounded-lg shadow-xs">
      <h3 className="text-lg font-medium flex items-center gap-2"><Download className="h-5 w-5 text-primary" />{t('updates.title')}</h3>
      {version && <p className="text-sm">{t('updates.currentVersion', { version })}</p>}
      {message && <p className="text-xs text-muted-foreground" role="status">{message}</p>}
      {status.state === 'downloading' && <Progress value={status.percent} className="h-2" />}
      {status.state === 'available' ? (
        <>
          <Button onClick={() => void install()} className="w-full h-auto min-h-9 whitespace-normal py-2">
            <Download className="mr-2 h-4 w-4" /> {t('updates.installNow')}
          </Button>
          <p className="text-xs text-muted-foreground">{t('updates.installHint')}</p>
        </>
      ) : (
        <Button
          variant="outline"
          onClick={() => void check()}
          disabled={status.state === 'disabled' || status.state === 'checking' || status.state === 'downloading' || status.state === 'installing'}
          className="w-full h-auto min-h-9 whitespace-normal py-2"
        >
          {status.state === 'checking' || status.state === 'downloading' || status.state === 'installing'
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <RefreshCw className="mr-2 h-4 w-4" />}
          {t('updates.check')}
        </Button>
      )}
    </div>
  );
}
