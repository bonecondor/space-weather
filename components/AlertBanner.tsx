'use client';

import type { NOAAAlert } from '@/lib/types';

interface AlertBannerProps {
  alerts: NOAAAlert[];
}

export function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  // Get most recent alert
  const latestAlert = alerts[0];

  // Determine alert level from message content
  const isWatch = latestAlert.message.toLowerCase().includes('watch');
  const isWarning = latestAlert.message.toLowerCase().includes('warning');

  const bgColor = isWarning
    ? 'bg-red-500/20 border-red-500/50'
    : isWatch
      ? 'bg-orange-500/20 border-orange-500/50'
      : 'bg-yellow-500/20 border-yellow-500/50';

  const textColor = isWarning
    ? 'text-red-300'
    : isWatch
      ? 'text-orange-300'
      : 'text-yellow-300';

  // Extract first line of message for summary
  const summary = latestAlert.message.split('\n')[0].trim();

  return (
    <div className={`rounded-lg p-4 border ${bgColor}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">⚠️</span>
        <div className="flex-1 min-w-0">
          <div className={`font-medium ${textColor}`}>
            Active Alert{alerts.length > 1 ? `s (${alerts.length})` : ''}
          </div>
          <div className="text-sm text-gray-300 mt-1 truncate">{summary}</div>
          <div className="text-xs text-gray-500 mt-1">
            {new Date(latestAlert.issueTime).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
