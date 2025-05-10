interface ProgressBarProps {
  current: number;
  total: number | null;
  height?: string; 
}

export function ProgressBar({ current, total, height = "h-2.5" }: ProgressBarProps) {
  if (total === null || total === 0) {
    return <div className={`${height} w-full bg-muted rounded-full shadow-inner`} title={`Progress: ${current} episodes (total unknown)`}>
        <div
            className="bg-accent h-full rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `100%` }} // Show as full if total is unknown but progress exists
            aria-valuenow={current}
            aria-valuemin={0}
            aria-valuemax={total ?? current}
            role="progressbar"
            aria-label={`Progress: ${current} episodes`}
        />
    </div>;
  }
  const percentage = Math.min(Math.max((current / total) * 100, 0), 100);
  return (
    <div className={`${height} w-full bg-muted rounded-full overflow-hidden shadow-inner`} title={`Progress: ${current} of ${total} episodes`}>
      <div
        className="bg-accent h-full rounded-full transition-all duration-300 ease-in-out flex items-center justify-center"
        style={{ width: `${percentage}%` }}
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        role="progressbar"
        aria-label={`Progress: ${current} of ${total} episodes`}
      >
        {/* Optional: text inside progress bar if it's tall enough */}
        {/* <span className="text-xs text-accent-foreground font-medium">{`${Math.round(percentage)}%`}</span> */}
      </div>
    </div>
  );
}
