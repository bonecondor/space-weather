'use client';

interface DataFreshnessProps {
  swpcFetchedAt: string;
  donkiFetchedAt: string | null;
  donkiCached: boolean;
}

export function DataFreshness({ swpcFetchedAt, donkiFetchedAt, donkiCached }: DataFreshnessProps) {
  const swpcAge = getAge(swpcFetchedAt);
  const donkiAge = donkiFetchedAt ? getAge(donkiFetchedAt) : null;

  return (
    <div className="flex items-center gap-4 text-xs text-gray-500">
      <span>SWPC: {swpcAge}</span>
      {donkiAge && (
        <span>
          DONKI: {donkiAge}
          {donkiCached && ' (cached)'}
        </span>
      )}
    </div>
  );
}

function getAge(timestamp: string): string {
  const then = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
