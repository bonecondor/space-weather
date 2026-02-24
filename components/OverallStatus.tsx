'use client';

import type { StatusLevel } from '@/lib/thresholds';

interface OverallStatusProps {
  kpStatus: StatusLevel;
  bzStatus: StatusLevel;
  windStatus: StatusLevel;
  flareStatus: StatusLevel;
  earthDirectedCMECount: number;
}

const SEVERITY_ORDER: StatusLevel[] = ['quiet', 'elevated', 'minor', 'moderate', 'strong', 'severe', 'extreme'];

const STATUS_CONFIG: Record<string, { bg: string; label: string; description: string }> = {
  quiet: { bg: 'bg-emerald-500/15 border-emerald-500/30', label: 'All Quiet', description: 'No significant activity' },
  elevated: { bg: 'bg-yellow-500/15 border-yellow-500/30', label: 'Elevated', description: 'Some activity, nothing actionable' },
  minor: { bg: 'bg-yellow-500/15 border-yellow-500/30', label: 'Minor Storm', description: 'G1 conditions present' },
  moderate: { bg: 'bg-orange-500/15 border-orange-500/30', label: 'Active', description: 'Moderate conditions detected' },
  strong: { bg: 'bg-red-500/15 border-red-500/30', label: 'Storm', description: 'G3+ geomagnetic storm' },
  severe: { bg: 'bg-red-500/15 border-red-500/30', label: 'Severe', description: 'Major storm in progress' },
  extreme: { bg: 'bg-purple-500/15 border-purple-500/30', label: 'Extreme', description: 'Extreme conditions' },
};

export function OverallStatus({ kpStatus, bzStatus, windStatus, flareStatus, earthDirectedCMECount }: OverallStatusProps) {
  const statuses = [kpStatus, bzStatus, windStatus, flareStatus];
  const worstIndex = Math.max(...statuses.map((s) => SEVERITY_ORDER.indexOf(s)));
  const effectiveIndex = earthDirectedCMECount > 0 ? Math.max(worstIndex, 3) : worstIndex;
  const overall = SEVERITY_ORDER[Math.min(effectiveIndex, SEVERITY_ORDER.length - 1)];
  const { bg, label, description } = STATUS_CONFIG[overall];

  return (
    <div className={`rounded-xl p-5 border ${bg}`}>
      <div className="text-2xl font-bold tracking-tight">{label}</div>
      <div className="text-sm text-gray-400 mt-1">{description}</div>
      {earthDirectedCMECount > 0 && (
        <div className="text-sm text-orange-400 mt-2 font-medium">
          {earthDirectedCMECount} Earth-directed CME{earthDirectedCMECount > 1 ? 's' : ''} in transit
        </div>
      )}
    </div>
  );
}
