'use client';

interface ForecastProps {
  kpForecast: number[];
  forecastText: string | null;
}

interface DayForecast {
  label: string;
  maxKp: number;
  gScale: string | null;
}

export function Forecast({ kpForecast, forecastText }: ForecastProps) {
  // Parse actual Kp predictions from forecast text
  const dayForecasts = forecastText ? parseForecastKp(forecastText) : null;

  return (
    <div className="rounded-lg p-4 bg-gray-800/50 border border-white/5">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
        3-Day Forecast
      </h3>

      {dayForecasts ? (
        <div className="space-y-3">
          {dayForecasts.map((day, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-20 text-sm text-gray-400">{day.label}</div>
              <div className="flex-1 h-4 bg-gray-900 rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${(day.maxKp / 9) * 100}%`,
                    backgroundColor: kpToColor(day.maxKp),
                  }}
                />
              </div>
              <div className="w-16 text-right">
                <span className={`text-sm font-medium ${kpToTextColor(day.maxKp)}`}>
                  Kp {day.maxKp.toFixed(0)}
                </span>
                {day.gScale && (
                  <span className={`text-xs ml-1 ${kpToTextColor(day.maxKp)}`}>
                    ({day.gScale})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Fallback: show recent Kp history bars
        <div className="flex items-end gap-1 h-16">
          {kpForecast.map((kp, i) => (
            <div
              key={i}
              className="flex-1 rounded-t"
              style={{
                height: `${(kp / 9) * 100}%`,
                backgroundColor: kpToColor(kp),
                minHeight: '4px',
              }}
              title={`Kp ${kp.toFixed(1)}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function kpToColor(kp: number): string {
  if (kp >= 8) return '#a855f7'; // purple - extreme
  if (kp >= 7) return '#ef4444'; // red - strong
  if (kp >= 5) return '#f97316'; // orange - moderate
  if (kp >= 4) return '#eab308'; // yellow - elevated
  return '#10b981'; // green - quiet
}

function kpToTextColor(kp: number): string {
  if (kp >= 8) return 'text-purple-400';
  if (kp >= 7) return 'text-red-400';
  if (kp >= 5) return 'text-orange-400';
  if (kp >= 4) return 'text-yellow-400';
  return 'text-emerald-400';
}

function parseForecastKp(text: string): DayForecast[] | null {
  // The SWPC 3-day forecast has a table like:
  //              Jan 20       Jan 21       Jan 22
  // 00-03UT       6.33 (G2)    4.33         4.00
  // ...
  // We want to extract max Kp for each day

  const lines = text.split('\n');
  const dayForecasts: DayForecast[] = [];

  // Find the header line with dates
  let headerLine = '';
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    // Match lines like "             Jan 20       Jan 21       Jan 22"
    if (/^\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+/.test(lines[i])) {
      headerLine = lines[i];
      headerIndex = i;
      break;
    }
  }

  if (!headerLine || headerIndex === -1) return null;

  // Extract date labels
  const dateMatches = headerLine.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+/g);
  if (!dateMatches || dateMatches.length < 3) return null;

  // Initialize with zeros
  const maxKps: number[] = [0, 0, 0];
  const gScales: (string | null)[] = [null, null, null];

  // Parse the Kp rows (8 rows of 3-hour periods)
  for (let i = headerIndex + 1; i < Math.min(headerIndex + 10, lines.length); i++) {
    const line = lines[i];
    // Skip empty lines or lines that don't look like data
    if (!line.trim() || !/\d{2}-\d{2}UT/.test(line)) continue;

    // Extract values - they can be like "6.33 (G2)" or just "4.00"
    const valueMatches = line.match(/(\d+\.\d+)\s*(\(G\d\))?/g);
    if (!valueMatches) continue;

    valueMatches.forEach((match, colIndex) => {
      if (colIndex >= 3) return;
      const kpMatch = match.match(/(\d+\.\d+)/);
      const gMatch = match.match(/\((G\d)\)/);
      if (kpMatch) {
        const kp = parseFloat(kpMatch[1]);
        if (kp > maxKps[colIndex]) {
          maxKps[colIndex] = kp;
          gScales[colIndex] = gMatch ? gMatch[1] : (kp >= 5 ? `G${Math.min(Math.floor(kp) - 4, 5)}` : null);
        }
      }
    });
  }

  // Build result with labels
  const labels = ['Today', 'Tomorrow', 'Day 3'];
  for (let i = 0; i < 3; i++) {
    dayForecasts.push({
      label: labels[i],
      maxKp: maxKps[i],
      gScale: gScales[i],
    });
  }

  return dayForecasts;
}
