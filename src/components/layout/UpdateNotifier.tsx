"use client";

import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUpdateStatus } from '@/hooks/use-update-status';
import { useI18n } from '@/i18n/I18nContext';

/** Shows a toast once when a new version is available. Updating itself is started in the settings. */
export function UpdateNotifier() {
  const { status } = useUpdateStatus();
  const { toast } = useToast();
  const { t } = useI18n();
  const notifiedVersion = useRef<string | null>(null);

  useEffect(() => {
    if (status.state !== 'available' || notifiedVersion.current === status.version) return;
    notifiedVersion.current = status.version;
    toast({
      title: t('updates.availableToastTitle'),
      description: t('updates.availableToastDescription', { version: status.version }),
    });
  }, [status, toast, t]);

  return null;
}
