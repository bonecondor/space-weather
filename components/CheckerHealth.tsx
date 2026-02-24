'use client';

import { useEffect, useState, useCallback } from 'react';
import type { DataHealthEntry } from '@/lib/types';

interface CheckerHealthData {
  health: DataHealthEntry[] | null;
  lastRun: string | null;
  checkerActive: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  swpc: 'NOAA SWPC',
  donki: 'NASA DONKI',
  'swpc-regions': 'Active Regions',
  'swpc-realtime-wind': 'Solar Wind (RT)',
  'swpc-realtime-mag': 'Mag Field (RT)',
};

export function CheckerHealth() {
  const [data, setData] = useState<CheckerHealthData>({
    health: null,
    lastRun: null,
    checkerActive: false,
  });

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      if (!res.ok) return;
      const json = await res.json();
      setData({
        health: json.health || null,
        lastRun: json.lastRun || null,
        checkerActive: json.checkerActive ?? false,
      });
    } catch {
      // Fail silently
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (!data.checkerActive) {
    return (
      <div className="rounded-lg p-3 bg-gray-800/50 border border-white/5 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-gray-600" />
        <span className="text-xs text-gray-500">Checker not active</span>
      </div>
    );
  }

  const lastRunAge = data.lastRun ? getAgeMinutes(data.lastRun) : null;
  const isStale = lastRunAge !== null && lastRunAge > 20; // Hasn't run in 20+ min

  return (
    <div className="rounded-lg p-3 bg-gray-800/50 border border-white/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isStale ? 'bg-yellow-400' : 'bg-emerald-400'}`} />
          <span className="text-xs text-gray-400">
            Last check: {data.lastRun ? formatAge(data.lastRun) : 'never'}
          </span>
        </div>
      </div>
      {data.health && data.health.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {data.health.map((h) => (
            <div key={h.source} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${h.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500">
                {SOURCE_LABELS[h.source] || h.source}
              </span>
              {!h.ok && h.lastError && (
                <span className="text-xs text-red-400/70" title={h.lastError}>!</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getAgeMinutes(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60);
}

function formatAge(iso: string): string {
  const mins = Math.floor(getAgeMinutes(iso));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
