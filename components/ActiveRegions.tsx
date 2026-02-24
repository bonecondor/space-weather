'use client';

import type { ActiveRegion } from '@/lib/types';

interface ActiveRegionsProps {
  regions: ActiveRegion[];
}

export function ActiveRegions({ regions }: ActiveRegionsProps) {
  if (regions.length === 0) {
    return (
      <div className="rounded-lg p-4 bg-gray-800/50 border border-white/5">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
          Active Regions
        </h3>
        <div className="text-gray-500 text-sm">No active regions reported today</div>
      </div>
    );
  }

  // Sort by M-flare probability descending
  const sorted = [...regions].sort((a, b) => b.flareProb_M - a.flareProb_M);

  return (
    <div className="rounded-lg p-4 bg-gray-800/50 border border-white/5">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
        Active Regions
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs uppercase">
              <th className="text-left pb-2 pr-4">Region</th>
              <th className="text-left pb-2 pr-4">Location</th>
              <th className="text-left pb-2 pr-4">Mag Class</th>
              <th className="text-left pb-2 pr-4">Spots</th>
              <th className="text-right pb-2 pr-4">C%</th>
              <th className="text-right pb-2 pr-4">M%</th>
              <th className="text-right pb-2">X%</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.regionNumber} className="border-t border-white/5">
                <td className="py-1.5 pr-4 font-medium text-gray-200">{r.regionNumber}</td>
                <td className="py-1.5 pr-4 text-gray-400 font-mono text-xs">{r.location}</td>
                <td className="py-1.5 pr-4">
                  <MagBadge mag={r.magneticClass} />
                </td>
                <td className="py-1.5 pr-4 text-gray-400">{r.numberSpots ?? '-'}</td>
                <td className="py-1.5 pr-4 text-right text-gray-500">{r.flareProb_C}%</td>
                <td className={`py-1.5 pr-4 text-right font-medium ${r.flareProb_M >= 50 ? 'text-orange-400' : r.flareProb_M >= 20 ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {r.flareProb_M}%
                </td>
                <td className={`py-1.5 text-right font-medium ${r.flareProb_X >= 20 ? 'text-red-400' : r.flareProb_X >= 5 ? 'text-orange-400' : 'text-gray-500'}`}>
                  {r.flareProb_X}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MagBadge({ mag }: { mag: string | null }) {
  if (!mag) return <span className="text-gray-600">-</span>;

  // Color by complexity
  const colors: Record<string, string> = {
    A: 'text-gray-400 bg-gray-800',
    B: 'text-yellow-400 bg-yellow-500/10',
    BG: 'text-orange-400 bg-orange-500/10',
    BGD: 'text-red-400 bg-red-500/10',
  };
  const color = colors[mag] || 'text-gray-400 bg-gray-800';

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${color}`}>{mag}</span>
  );
}
