import { StatusCard } from '@/components/StatusCard';
import { AlertBanner } from '@/components/AlertBanner';
import { EarthDirectedEvents } from '@/components/EarthDirectedEvents';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { Forecast } from '@/components/Forecast';
import { DataFreshness } from '@/components/DataFreshness';
import {
  getKpStatus,
  getBzStatus,
  getSolarWindStatus,
  getFlareStatus,
} from '@/lib/thresholds';
import { fetchAllDONKI } from '@/lib/donki';
import { fetchAllSWPC } from '@/lib/swpc';
import type { SpaceWeatherSnapshot } from '@/lib/types';

// Force dynamic rendering (data changes frequently)
export const dynamic = 'force-dynamic';
export const revalidate = 300; // Revalidate every 5 minutes

async function getSpaceWeather(): Promise<{
  snapshot: SpaceWeatherSnapshot;
  meta: { donkiCached: boolean; donkiFetchedAt: string | null; swpcFetchedAt: string };
}> {
  // Fetch data directly instead of through API route during build
  const [swpc, donki] = await Promise.all([fetchAllSWPC(), fetchAllDONKI(7)]);

  const snapshot: SpaceWeatherSnapshot = {
    timestamp: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    kp: swpc.kp,
    kpForecast24h: swpc.kpForecast24h,
    gScale: swpc.gScale,
    xrayFlux: swpc.xrayFlux,
    latestFlare: donki.flares[donki.flares.length - 1] || null,
    sScale: null,
    rScale: null,
    solarWind: swpc.solarWind,
    magneticField: swpc.magneticField,
    recentCMEs: donki.cmes,
    earthDirectedCMEs: donki.earthDirectedCMEs,
    recentFlares: donki.flares,
    recentStorms: donki.storms,
    recentSEP: donki.sep,
    recentHSS: donki.hss,
    recentIPS: donki.ips,
    recentMPC: donki.mpc,
    activeAlerts: swpc.alerts,
    forecast3Day: swpc.forecast3Day,
  };

  return {
    snapshot,
    meta: {
      donkiCached: false,
      donkiFetchedAt: new Date().toISOString(),
      swpcFetchedAt: new Date().toISOString(),
    },
  };
}

export default async function Home() {
  const { snapshot, meta } = await getSpaceWeather();

  const kpStatus = getKpStatus(snapshot.kp);
  const bzStatus = snapshot.magneticField
    ? getBzStatus(snapshot.magneticField.bz)
    : 'quiet';
  const windStatus = snapshot.solarWind
    ? getSolarWindStatus(snapshot.solarWind.speed)
    : 'quiet';
  const flareStatus = snapshot.latestFlare
    ? getFlareStatus(snapshot.latestFlare.classType)
    : 'quiet';

  // Determine current X-ray class for display
  const xrayClass = snapshot.xrayFlux
    ? fluxToClass(snapshot.xrayFlux)
    : 'B1.0';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Space Weather</h1>
          <DataFreshness
            swpcFetchedAt={meta.swpcFetchedAt}
            donkiFetchedAt={meta.donkiFetchedAt}
            donkiCached={meta.donkiCached}
          />
        </div>

        {/* Alert Banner */}
        {snapshot.activeAlerts.length > 0 && (
          <AlertBanner alerts={snapshot.activeAlerts} />
        )}

        {/* Current Conditions */}
        <section>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
            Current Conditions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatusCard
              title="Kp Index"
              value={snapshot.kp.toFixed(1)}
              status={kpStatus}
              subtitle={snapshot.gScale || undefined}
            />
            <StatusCard
              title="Bz"
              value={snapshot.magneticField?.bz.toFixed(1) ?? '—'}
              unit="nT"
              status={bzStatus}
              subtitle={snapshot.magneticField?.bz && snapshot.magneticField.bz < 0 ? 'Southward' : 'Northward'}
            />
            <StatusCard
              title="Solar Wind"
              value={snapshot.solarWind?.speed.toFixed(0) ?? '—'}
              unit="km/s"
              status={windStatus}
            />
            <StatusCard
              title="X-ray"
              value={xrayClass}
              status={flareStatus}
            />
          </div>
        </section>

        {/* Earth-Directed Events */}
        <EarthDirectedEvents cmes={snapshot.earthDirectedCMEs} />

        {/* Two columns: Timeline + Forecast */}
        <div className="grid sm:grid-cols-2 gap-4">
          <ActivityTimeline
            flares={snapshot.recentFlares}
            storms={snapshot.recentStorms}
            cmes={snapshot.recentCMEs}
          />
          <Forecast
            kpForecast={snapshot.kpForecast24h}
            forecastText={snapshot.forecast3Day}
          />
        </div>

        {/* Footer */}
        <footer className="text-center text-xs text-gray-600 pt-8">
          Data from NASA DONKI & NOAA SWPC
        </footer>
      </main>
    </div>
  );
}

function fluxToClass(flux: number): string {
  if (flux >= 1e-4) return `X${(flux / 1e-4).toFixed(1)}`;
  if (flux >= 1e-5) return `M${(flux / 1e-5).toFixed(1)}`;
  if (flux >= 1e-6) return `C${(flux / 1e-6).toFixed(1)}`;
  if (flux >= 1e-7) return `B${(flux / 1e-7).toFixed(1)}`;
  return `A${(flux / 1e-8).toFixed(1)}`;
}
