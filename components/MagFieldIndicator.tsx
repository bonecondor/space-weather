'use client';

import { getBzStatus, STATUS_COLORS } from '@/lib/thresholds';
import type { MagneticField } from '@/lib/types';

interface MagFieldIndicatorProps {
  field: MagneticField | null;
}

export function MagFieldIndicator({ field }: MagFieldIndicatorProps) {
  if (!field) {
    return (
      <div className="rounded-lg p-4 bg-gray-800/50 border border-white/5">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
          Magnetic Field
        </h3>
        <div className="text-gray-500 text-sm">No data available</div>
      </div>
    );
  }

  const bzStatus = getBzStatus(field.bz);
  const bzColors = STATUS_COLORS[bzStatus];
  const isSouthward = field.bz < 0;

  return (
    <div className="rounded-lg p-4 bg-gray-800/50 border border-white/5">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
        Magnetic Field (IMF)
      </h3>

      <div className="flex items-center gap-6">
        {/* Bz direction indicator */}
        <div className="flex flex-col items-center gap-1">
          <BzArrow bz={field.bz} />
          <span className="text-[10px] text-gray-600">
            {isSouthward ? 'Southward' : 'Northward'}
          </span>
        </div>

        {/* Values */}
        <div className="flex-1 space-y-3">
          {/* Bz — main value */}
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-gray-500">Bz</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-xl font-semibold ${bzColors.text}`}>
                  {field.bz.toFixed(1)}
                </span>
                <span className="text-xs text-gray-500">nT</span>
              </div>
            </div>
            {isSouthward && (
              <div className="text-[11px] text-orange-400/80 text-right mt-0.5">
                Geoeffective
              </div>
            )}
          </div>

          {/* Bt — total field */}
          <div className="flex items-baseline justify-between pt-1 border-t border-white/5">
            <span className="text-xs text-gray-500">Bt (total)</span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm text-gray-400">{field.bt.toFixed(1)}</span>
              <span className="text-xs text-gray-600">nT</span>
            </div>
          </div>

          {/* Components */}
          <div className="flex gap-4 text-xs text-gray-600">
            <span>Bx: {field.bx.toFixed(1)}</span>
            <span>By: {field.by.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BzArrow({ bz }: { bz: number }) {
  const isSouthward = bz < 0;
  const magnitude = Math.min(Math.abs(bz), 30); // Cap display at 30 nT
  const height = 24 + (magnitude / 30) * 24; // 24-48px

  // Color based on geoeffectiveness
  let color = '#10b981'; // green - northward
  if (bz <= -20) color = '#ef4444'; // red
  else if (bz <= -10) color = '#f97316'; // orange
  else if (bz <= -5) color = '#eab308'; // yellow
  else if (bz < 0) color = '#6ee7b7'; // light green - mild southward

  return (
    <svg
      width="20"
      height={height}
      viewBox={`0 0 20 ${height}`}
      className="transition-all duration-500"
    >
      {/* Arrow shaft */}
      <line
        x1="10"
        y1={isSouthward ? 2 : height - 2}
        x2="10"
        y2={isSouthward ? height - 8 : 8}
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Arrow head */}
      {isSouthward ? (
        <polygon
          points={`4,${height - 10} 10,${height} 16,${height - 10}`}
          fill={color}
        />
      ) : (
        <polygon
          points="4,10 10,0 16,10"
          fill={color}
        />
      )}
    </svg>
  );
}
