import { fetchAllSWPC, fetchActiveRegions } from '@/lib/swpc';
import { fetchAllDONKI } from '@/lib/donki';
import {
  getKpStatus,
  getBzStatus,
  getSolarWindStatus,
  getFlareStatus,
} from '@/lib/thresholds';
import type { SpaceWeatherSnapshot } from '@/lib/types';

import { StatusCard } from '@/components/StatusCard';
import { OverallStatus } from '@/components/OverallStatus';
import { AlertBanner } from '@/components/AlertBanner';
import { EarthDirectedEvents } from '@/components/EarthDirectedEvents';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { Forecast } from '@/components/Forecast';
import { ActiveRegions } from '@/components/ActiveRegions';
import { SolarWindGauge } from '@/components/SolarWindGauge';
import { MagFieldIndicator } from '@/components/MagFieldIndicator';
import { CheckerHealth } from '@/components/CheckerHealth';
import { AlertHistory } from '@/components/AlertHistory';
import { DashboardPoller } from '@/components/DashboardPoller';

export const revalidate = 300; // ISR: revalidate every 5 minutes

export default async function DashboardPage() {
  let snapshot: SpaceWeatherSnapshot | null = null;
  let activeRegions: Awaited<ReturnType<typeof fetchActiveRegions>> = [];
  let fetchError: string | null = null;

  try {
    const [swpc, donki, regions] = await Promise.allSettled([
      fetchAllSWPC(),
      fetchAllDONKI(7),
      fetchActiveRegions(),
    ]);

    const swpcData = swpc.status === 'fulfilled' ? swpc.value : null;
    const donkiData = donki.status === 'fulfilled' ? donki.value : null;
    activeRegions = regions.status === 'fulfilled' ? regions.value : [];

    if (!swpcData) {
      fetchError = 'SWPC data unavailable';
    }

    snapshot = {
      timestamp: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      kp: swpcData?.kp ?? 0,
      kpForecast24h: swpcData?.kpForecast24h ?? [],
      gScale: swpcData?.gScale ?? null,
      xrayFlux: swpcData?.xrayFlux ?? null,
      latestFlare: donkiData?.flares[donkiData.flares.length - 1] ?? null,
      sScale: null,
      rScale: null,
      solarWind: swpcData?.solarWind ?? null,
      magneticField: swpcData?.magneticField ?? null,
      recentCMEs: donkiData?.cmes ?? [],
      earthDirectedCMEs: donkiData?.earthDirectedCMEs ?? [],
      recentFlares: donkiData?.flares ?? [],
      recentStorms: donkiData?.storms ?? [],
      recentSEP: donkiData?.sep ?? [],
      recentHSS: donkiData?.hss ?? [],
      recentIPS: donkiData?.ips ?? [],
      recentMPC: donkiData?.mpc ?? [],
      activeAlerts: swpcData?.alerts ?? [],
      forecast3Day: swpcData?.forecast3Day ?? null,
    };
  } catch (error) {
    fetchError = error instanceof Error ? error.message : 'Unknown error';
  }

  const kp = snapshot?.kp ?? 0;
  const bz = snapshot?.magneticField?.bz ?? 0;
  const windSpeed = snapshot?.solarWind?.speed ?? 0;

  const kpStatus = getKpStatus(kp);
  const bzStatus = getBzStatus(bz);
  const windStatus = getSolarWindStatus(windSpeed);
  const flareStatus = getFlareStatus(snapshot?.latestFlare?.classType ?? null);

  return (
    <main className="min-h-screen p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-200 tracking-tight">
          Space Weather
        </h1>
        <span className="text-xs text-gray-600 font-mono">
          {new Date().toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {/* Fetch error banner */}
      {fetchError && (
        <div className="rounded-lg p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          Data fetch issue: {fetchError}
        </div>
      )}

      {/* 1. Overall Status — single glance */}
      <OverallStatus
        kpStatus={kpStatus}
        bzStatus={bzStatus}
        windStatus={windStatus}
        flareStatus={flareStatus}
        earthDirectedCMECount={snapshot?.earthDirectedCMEs.length ?? 0}
      />

      {/* 2. Checker health */}
      <CheckerHealth />

      {/* 3. NOAA alerts banner */}
      {snapshot && snapshot.activeAlerts.length > 0 && (
        <AlertBanner alerts={snapshot.activeAlerts} />
      )}

      {/* 4. Status cards — 4-card grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatusCard
          title="Kp Index"
          value={kp.toFixed(1)}
          status={kpStatus}
          subtitle={snapshot?.gScale && snapshot.gScale !== 'G0' ? snapshot.gScale : undefined}
        />
        <StatusCard
          title="Bz (IMF)"
          value={bz.toFixed(1)}
          unit="nT"
          status={bzStatus}
          subtitle={bz < 0 ? 'Southward' : 'Northward'}
        />
        <StatusCard
          title="Solar Wind"
          value={Math.round(windSpeed).toString()}
          unit="km/s"
          status={windStatus}
        />
        <StatusCard
          title="Latest Flare"
          value={snapshot?.latestFlare?.classType ?? 'None'}
          status={flareStatus}
          subtitle={
            snapshot?.latestFlare
              ? timeSince(snapshot.latestFlare.beginTime)
              : undefined
          }
        />
      </div>

      {/* 5. Solar wind gauge + magnetic field indicator */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SolarWindGauge wind={snapshot?.solarWind ?? null} />
        <MagFieldIndicator field={snapshot?.magneticField ?? null} />
      </div>

      {/* 6. Earth-directed CMEs + Forecast */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <EarthDirectedEvents cmes={snapshot?.earthDirectedCMEs ?? []} />
        <Forecast
          kpForecast={snapshot?.kpForecast24h ?? []}
          forecastText={snapshot?.forecast3Day ?? null}
        />
      </div>

      {/* 7. Active regions table */}
      <ActiveRegions regions={activeRegions} />

      {/* 8. Activity timeline */}
      <ActivityTimeline
        flares={snapshot?.recentFlares ?? []}
        storms={snapshot?.recentStorms ?? []}
        cmes={snapshot?.recentCMEs ?? []}
      />

      {/* 9. Alert history from checker */}
      <AlertHistory />

      {/* Client-side polling for auto-refresh */}
      <DashboardPoller />
    </main>
  );
}

function timeSince(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
