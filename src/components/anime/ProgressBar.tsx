
import type { UserAnimeStatus } from '@/types/anime'; // Added import
import { useI18n } from '@/i18n/I18nContext';

interface ProgressBarProps {
  current: number;
  total: number | null;
  status?: UserAnimeStatus; // New prop
  height?: string;
}

export function ProgressBar({ current, total, status, height = "h-2.5" }: ProgressBarProps) {
  const { t } = useI18n();
let percentage: number;
  let displayWidth: string;
  let colorClass = 'bg-accent'; // Default color
  let titleText: string;

  if (status === 'dropped') {
    displayWidth = '100%';
    percentage = 100; // For ARIA
    colorClass = 'bg-destructive'; // Red for dropped
    const totalDisplay = total === null ? t('anime.progress.totalUnknown') : total === 0 ? t('anime.progress.totalZero') : total;
    titleText = t('anime.progress.dropped', { current, total: totalDisplay });
  } else if (total === null || total === 0) {
    displayWidth = (current > 0) ? '100%' : '0%';
    percentage = (current > 0) ? 100 : 0; // For ARIA
    // Keep accent color for unknown/movie unless dropped
    titleText = total === 0
      ? t('anime.progress.ofZero', { current })
      : t('anime.progress.unknownTotal', { current });
  } else {
    percentage = Math.min(Math.max((current / total) * 100, 0), 100);
    displayWidth = `${percentage}%`;
    titleText = t('anime.progress.of', { current, total });
  }

  return (
    <div className={`${height} w-full bg-muted rounded-full overflow-hidden shadow-inner`} title={titleText}>
      <div
        className={`${colorClass} h-full rounded-full transition-all duration-300 ease-in-out flex items-center justify-center`}
        style={{ width: displayWidth }}
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        role="progressbar"
        aria-label={titleText}
      >
        {/* Optional: text inside progress bar if it's tall enough */}
        {/* <span className="text-xs text-accent-foreground font-medium">{`${Math.round(percentage)}%`}</span> */}
      </div>
    </div>
  );
}
