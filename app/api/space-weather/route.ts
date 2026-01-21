import { NextResponse } from 'next/server';
import { fetchAllDONKI } from '@/lib/donki';
import { fetchAllSWPC } from '@/lib/swpc';
import type { SpaceWeatherSnapshot } from '@/lib/types';

// In-memory cache for DONKI data (rate limited)
let donkiCache: {
  data: Awaited<ReturnType<typeof fetchAllDONKI>> | null;
  fetchedAt: Date | null;
} = { data: null, fetchedAt: null };

const DONKI_CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours

async function getDONKIData() {
  const now = new Date();

  // Check if cache is still valid
  if (
    donkiCache.data &&
    donkiCache.fetchedAt &&
    now.getTime() - donkiCache.fetchedAt.getTime() < DONKI_CACHE_DURATION
  ) {
    return { data: donkiCache.data, cached: true, fetchedAt: donkiCache.fetchedAt };
  }

  // Fetch fresh data
  try {
    const data = await fetchAllDONKI(7);
    donkiCache = { data, fetchedAt: now };
    return { data, cached: false, fetchedAt: now };
  } catch (error) {
    // If fetch fails but we have cached data, use it
    if (donkiCache.data) {
      console.warn('DONKI fetch failed, using stale cache:', error);
      return { data: donkiCache.data, cached: true, fetchedAt: donkiCache.fetchedAt, stale: true };
    }
    throw error;
  }
}

export async function GET() {
  try {
    // Fetch SWPC (real-time, no rate limits) and DONKI (cached) in parallel
    const [swpc, donki] = await Promise.all([fetchAllSWPC(), getDONKIData()]);

    const snapshot: SpaceWeatherSnapshot = {
      timestamp: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),

      // Geomagnetic
      kp: swpc.kp,
      kpForecast24h: swpc.kpForecast24h,
      gScale: swpc.gScale,

      // Solar
      xrayFlux: swpc.xrayFlux,
      latestFlare: donki.data.flares[donki.data.flares.length - 1] || null,
      sScale: null, // Would need additional parsing from alerts
      rScale: null,

      // Solar Wind
      solarWind: swpc.solarWind,
      magneticField: swpc.magneticField,

      // Events from DONKI
      recentCMEs: donki.data.cmes,
      earthDirectedCMEs: donki.data.earthDirectedCMEs,
      recentFlares: donki.data.flares,
      recentStorms: donki.data.storms,
      recentSEP: donki.data.sep,
      recentHSS: donki.data.hss,
      recentIPS: donki.data.ips,
      recentMPC: donki.data.mpc,

      // Alerts & Forecast
      activeAlerts: swpc.alerts,
      forecast3Day: swpc.forecast3Day,
    };

    return NextResponse.json({
      snapshot,
      meta: {
        donkiCached: donki.cached,
        donkiFetchedAt: donki.fetchedAt?.toISOString(),
        swpcFetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Space weather fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch space weather data' },
      { status: 500 }
    );
  }
}
