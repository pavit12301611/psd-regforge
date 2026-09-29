/** Compact, phone-friendly timestamps: "just now", "3 h ago", "12 Sep 2025". */
export function relativeTime(ts: number | null | undefined): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 45_000) return 'just now';
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: new Date(ts).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

/** Full timestamp for tooltips and detail views. */
export function absoluteTime(ts: number | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
