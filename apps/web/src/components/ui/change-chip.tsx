import { cn } from '@/lib/utils';

export function ChangeChip({
  change,
  className,
}: {
  change: { text: string; dir: -1 | 0 | 1 } | null;
  className?: string;
}) {
  if (!change) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium',
        change.dir > 0 && 'bg-positive/15 text-positive',
        change.dir < 0 && 'bg-negative/15 text-negative',
        change.dir === 0 && 'bg-card text-hint',
        className,
      )}
    >
      {change.dir > 0 ? '▲ ' : change.dir < 0 ? '▼ ' : ''}
      {change.text}
    </span>
  );
}
