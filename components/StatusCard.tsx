'use client';

import { STATUS_COLORS, STATUS_LABELS, type StatusLevel } from '@/lib/thresholds';

interface StatusCardProps {
  title: string;
  value: string | number;
  unit?: string;
  status: StatusLevel;
  subtitle?: string;
}

export function StatusCard({ title, value, unit, status, subtitle }: StatusCardProps) {
  const colors = STATUS_COLORS[status];

  return (
    <div className={`rounded-lg p-4 ${colors.bg} border border-white/5`}>
      <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{title}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-semibold ${colors.text}`}>{value}</span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
        <span className={`text-sm ${colors.text}`}>{subtitle || STATUS_LABELS[status]}</span>
      </div>
    </div>
  );
}
