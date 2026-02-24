'use client';

import { getSolarWindStatus, getDensityStatus, STATUS_COLORS } from '@/lib/thresholds';
import type { SolarWind } from '@/lib/types';

interface SolarWindGaugeProps {
  wind: SolarWind | null;
}

export function SolarWindGauge({ wind }: SolarWindGaugeProps) {
  if (!wind) {
    return (
      <div className="rounded-lg p-4 bg-gray-800/50 border border-white/5">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
          Solar Wind
        </h3>
        <div className="text-gray-500 text-sm">No data available</div>
      </div>
    );
  }

  const speedStatus = getSolarWindStatus(wind.speed);
  const densityStatus = getDensityStatus(wind.density);
  const speedColors = STATUS_COLORS[speedStatus];
  const densityColors = STATUS_COLORS[densityStatus];

  // Gauge proportions (capped at max display range)
  const speedPct = Math.min((wind.speed / 1000) * 100, 100);
  const densityPct = Math.min((wind.density / 50) * 100, 100);

  return (
    <div className="rounded-lg p-4 bg-gray-800/50 border border-white/5">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
        Solar Wind
      </h3>

      <div className="space-y-4">
        {/* Speed gauge */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs text-gray-500">Speed</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-lg font-semibold ${speedColors.text}`}>
                {Math.round(wind.speed)}
              </span>
              <span className="text-xs text-gray-500">km/s</span>
            </div>
          </div>
          <div className="h-2.5 bg-gray-900 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${speedPct}%`,
                background: speedGradient(wind.speed),
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
            <span>0</span>
            <span className="text-yellow-700">500</span>
            <span className="text-orange-700">600</span>
            <span className="text-red-700">800</span>
            <span>1000</span>
          </div>
        </div>

        {/* Density gauge */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs text-gray-500">Density</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-lg font-semibold ${densityColors.text}`}>
                {wind.density.toFixed(1)}
              </span>
              <span className="text-xs text-gray-500">p/cm&sup3;</span>
            </div>
          </div>
          <div className="h-2.5 bg-gray-900 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${densityPct}%`,
                background: densityGradient(wind.density),
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
            <span>0</span>
            <span className="text-yellow-700">15</span>
            <span className="text-orange-700">20</span>
            <span className="text-red-700">40</span>
            <span>50</span>
          </div>
        </div>

        {/* Temperature */}
        <div className="flex items-baseline justify-between pt-1 border-t border-white/5">
          <span className="text-xs text-gray-500">Temperature</span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm text-gray-400">
              {formatTemp(wind.temperature)}
            </span>
            <span className="text-xs text-gray-600">K</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function speedGradient(speed: number): string {
  if (speed >= 800) return 'linear-gradient(90deg, #f59e0b, #ef4444)';
  if (speed >= 600) return 'linear-gradient(90deg, #eab308, #f97316)';
  if (speed >= 500) return 'linear-gradient(90deg, #10b981, #eab308)';
  return '#10b981';
}

function densityGradient(density: number): string {
  if (density >= 40) return 'linear-gradient(90deg, #f97316, #ef4444)';
  if (density >= 20) return 'linear-gradient(90deg, #eab308, #f97316)';
  if (density >= 15) return 'linear-gradient(90deg, #10b981, #eab308)';
  return '#10b981';
}

function formatTemp(temp: number): string {
  if (temp >= 1_000_000) return `${(temp / 1_000_000).toFixed(1)}M`;
  if (temp >= 1000) return `${(temp / 1000).toFixed(0)}K`;
  return temp.toFixed(0);
}
