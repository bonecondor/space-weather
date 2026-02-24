'use client';

import { useEffect, useState, useCallback } from 'react';
import type { SpaceWeatherAlert, AlertUrgency } from '@/lib/types';

const URGENCY_CONFIG: Record<AlertUrgency, { dot: string; label: string }> = {
  critical: { dot: 'bg-red-500', label: 'Critical' },
  high: { dot: 'bg-orange-400', label: 'High' },
  moderate: { dot: 'bg-yellow-400', label: 'Moderate' },
  info: { dot: 'bg-blue-400', label: 'Info' },
};

export function AlertHistory() {
  const [alerts, setAlerts] = useState<SpaceWeatherAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      if (!res.ok) return;
      const data = await res.json();
      setAlerts(data.alerts || []);
      setLastRun(data.lastRun || null);
    } catch {
      // Silently fail — checker might not have run yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60_000); // Poll every 60s
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  return (
    <div className="rounded-lg p-4 bg-gray-800/50 border border-white/5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
          Notification History
        </h3>
        {lastRun && (
          <span className="text-xs text-gray-600">
            Checker: {formatRelativeTime(lastRun)}
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-gray-600 text-sm">Loading...</div>
      ) : alerts.length === 0 ? (
        <div className="text-gray-500 text-sm">No alerts sent yet</div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {alerts.slice(0, 25).map((alert) => {
            const config = URGENCY_CONFIG[alert.urgency];
            return (
              <div key={alert.id} className="flex items-start gap-2.5 py-1.5 border-b border-white/5 last:border-0">
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${config.dot}`}
                  title={config.label}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200 leading-tight">{alert.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{alert.body}</div>
                </div>
                <span className="text-xs text-gray-600 flex-shrink-0 mt-0.5">
                  {formatRelativeTime(alert.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
