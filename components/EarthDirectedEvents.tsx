'use client';

import type { CME } from '@/lib/types';

interface EarthDirectedEventsProps {
  cmes: CME[];
}

export function EarthDirectedEvents({ cmes }: EarthDirectedEventsProps) {
  if (cmes.length === 0) {
    return (
      <div className="rounded-lg p-4 bg-gray-800/50 border border-white/5">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
          Earth-Directed Events
        </h3>
        <div className="text-gray-500 text-sm">No Earth-directed CMEs in the past 7 days</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-4 bg-gray-800/50 border border-white/5">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
        Earth-Directed Events
      </h3>
      <div className="space-y-3">
        {cmes.map((cme) => (
          <div key={cme.id} className="bg-gray-900/50 rounded p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-200">
                CME {new Date(cme.startTime).toLocaleDateString()}
              </span>
              {cme.speed && (
                <span className="text-xs text-gray-400">{cme.speed} km/s</span>
              )}
            </div>
            {cme.predictedArrival && (
              <div className="text-xs text-orange-400 mt-1">
                ETA: {formatETA(cme.predictedArrival)}
              </div>
            )}
            {cme.predictedKp && cme.predictedKp >= 5 && (
              <div className="text-xs text-red-400 mt-1">
                Expected Kp: {cme.predictedKp} (G{Math.min(cme.predictedKp - 4, 5)})
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatETA(arrivalTime: string): string {
  const arrival = new Date(arrivalTime);
  const now = new Date();
  const diffMs = arrival.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffHours < 0) {
    return `Arrived ${Math.abs(diffHours)}h ago`;
  } else if (diffHours < 24) {
    return `~${diffHours}h`;
  } else {
    const days = Math.round(diffHours / 24);
    return `~${days}d`;
  }
}
