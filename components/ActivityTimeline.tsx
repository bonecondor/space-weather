'use client';

import type { SolarFlare, GeomagneticStorm, CME } from '@/lib/types';

interface TimelineEvent {
  id: string;
  time: Date;
  type: 'flare' | 'storm' | 'cme';
  title: string;
  subtitle?: string;
}

interface ActivityTimelineProps {
  flares: SolarFlare[];
  storms: GeomagneticStorm[];
  cmes: CME[];
}

export function ActivityTimeline({ flares, storms, cmes }: ActivityTimelineProps) {
  // Combine and sort all events
  const events: TimelineEvent[] = [
    ...flares.map((f) => ({
      id: f.id,
      time: new Date(f.beginTime),
      type: 'flare' as const,
      title: `${f.classType} Flare`,
      subtitle: f.activeRegionNum ? `Region ${f.activeRegionNum}` : undefined,
    })),
    ...storms.map((s) => ({
      id: s.id,
      time: new Date(s.startTime),
      type: 'storm' as const,
      title: `${s.gScale} Storm`,
      subtitle: `Kp ${s.kpIndex}`,
    })),
    ...cmes.map((c) => ({
      id: c.id,
      time: new Date(c.startTime),
      type: 'cme' as const,
      title: 'CME Eruption',
      subtitle: c.speed ? `${c.speed} km/s` : undefined,
    })),
  ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 10); // Show last 10 events

  const typeIcons: Record<string, string> = {
    flare: '☀️',
    storm: '🌊',
    cme: '💨',
  };

  const typeColors: Record<string, string> = {
    flare: 'text-yellow-400',
    storm: 'text-blue-400',
    cme: 'text-purple-400',
  };

  if (events.length === 0) {
    return (
      <div className="rounded-lg p-4 bg-gray-800/50 border border-white/5">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
          Recent Activity
        </h3>
        <div className="text-gray-500 text-sm">No significant activity in the past 7 days</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-4 bg-gray-800/50 border border-white/5">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
        Recent Activity
      </h3>
      <div className="space-y-2">
        {events.map((event) => (
          <div key={event.id} className="flex items-center gap-3 text-sm">
            <span>{typeIcons[event.type]}</span>
            <span className="text-gray-500 w-24 flex-shrink-0">
              {formatEventTime(event.time)}
            </span>
            <span className={typeColors[event.type]}>{event.title}</span>
            {event.subtitle && (
              <span className="text-gray-500">({event.subtitle})</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatEventTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) {
    return 'Just now';
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}
