
import type { UserAnimeStatus } from '@/types/anime'; // Added import

interface ProgressBarProps {
  current: number;
  total: number | null;
  status?: UserAnimeStatus; // New prop
  height?: string;
}

export function ProgressBar({ current, total, status, height = "h-2.5" }: ProgressBarProps) {
  let percentage: number;
  let displayWidth: string;
  let colorClass = 'bg-accent'; // Default color
  let titleText: string;

  if (status === 'dropped') {
    displayWidth = '100%';
    percentage = 100; // For ARIA
    colorClass = 'bg-destructive'; // Red for dropped
    const totalDisplay = total === null ? 'unknown' : total === 0 ? '0 (e.g., movie)' : total;
    titleText = `Status: Dropped (Progress: ${current} of ${totalDisplay} episodes)`;
  } else if (total === null || total === 0) {
    displayWidth = (current > 0) ? '100%' : '0%';
    percentage = (current > 0) ? 100 : 0; // For ARIA
    // Keep accent color for unknown/movie unless dropped
    titleText = total === 0
      ? `Progress: ${current} of 0 episodes (e.g., a movie or special)`
      : `Progress: ${current} episodes (total unknown)`;
  } else {
    percentage = Math.min(Math.max((current / total) * 100, 0), 100);
    displayWidth = `${percentage}%`;
    titleText = `Progress: ${current} of ${total} episodes`;
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
