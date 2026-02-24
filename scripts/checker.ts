#!/usr/bin/env node
// Space Weather Checker — runs every 15 minutes via launchd
// Fetches data, evaluates conditions, sends notifications

import { fetchAllSWPC, fetchActiveRegions, fetchRealtimeWind, fetchRealtimeMag } from '../lib/swpc';
import { fetchAllDONKI } from '../lib/donki';
import type { SpaceWeatherSnapshot, DataHealthEntry, ActiveRegion } from '../lib/types';
import { loadState, saveState, acquireLock, releaseLock, truncateLogs, isCoolingDown, recordCooldown } from './state';
import { evaluateAlerts } from './alerts';
import { dispatchAlerts } from './notify';
import { verifyPendingPredictions } from './verify-predictions';

// === Resilient Fetch Wrapper ===

interface FetchResult<T> {
  data: T | null;
  ok: boolean;
  error?: string;
}

async function resilientFetch<T>(
  name: string,
  fn: () => Promise<T>,
  timeoutMs: number = 10000
): Promise<FetchResult<T>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const data = await fn();
    clearTimeout(timeout);
    return { data, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  [FAIL] ${name}: ${message}`);
    return { data: null, ok: false, error: message };
  }
}

// === Main ===

async function main() {
  const startTime = Date.now();
  console.log(`\n[${new Date().toISOString()}] Space weather check starting...`);

  // Truncate logs if needed
  truncateLogs();

  // Acquire lock
  if (!acquireLock()) {
    console.log('Another checker instance is running. Exiting.');
    process.exit(0);
  }

  const state = loadState();

  try {
    // Fetch all data sources in parallel with resilient error handling
    const [swpcResult, donkiResult, regionsResult, rtWindResult, rtMagResult] = await Promise.allSettled([
      resilientFetch('SWPC', () => fetchAllSWPC(), 10000),
      resilientFetch('DONKI', () => fetchAllDONKI(7), 30000),
      resilientFetch('Active Regions', () => fetchActiveRegions(), 10000),
      resilientFetch('Realtime Wind', () => fetchRealtimeWind(), 10000),
      resilientFetch('Realtime Mag', () => fetchRealtimeMag(), 10000),
    ]);

    // Extract results (Promise.allSettled always resolves)
    const swpc = swpcResult.status === 'fulfilled' ? swpcResult.value : { data: null, ok: false, error: 'promise rejected' };
    const donki = donkiResult.status === 'fulfilled' ? donkiResult.value : { data: null, ok: false, error: 'promise rejected' };
    const regions = regionsResult.status === 'fulfilled' ? regionsResult.value : { data: null, ok: false, error: 'promise rejected' };
    const rtWind = rtWindResult.status === 'fulfilled' ? rtWindResult.value : { data: null, ok: false, error: 'promise rejected' };
    const rtMag = rtMagResult.status === 'fulfilled' ? rtMagResult.value : { data: null, ok: false, error: 'promise rejected' };

    // Update data health
    const now = new Date().toISOString();
    const dataHealth: DataHealthEntry[] = [
      updateHealth('swpc', swpc.ok, swpc.error, state.dataHealth),
      updateHealth('donki', donki.ok, donki.error, state.dataHealth),
      updateHealth('swpc-regions', regions.ok, regions.error, state.dataHealth),
      updateHealth('swpc-realtime-wind', rtWind.ok, rtWind.error, state.dataHealth),
      updateHealth('swpc-realtime-mag', rtMag.ok, rtMag.error, state.dataHealth),
    ];

    // Log source status
    const okCount = dataHealth.filter((d) => d.ok).length;
    console.log(`  Sources: ${okCount}/${dataHealth.length} OK`);

    // Build best-effort snapshot
    const snapshot: SpaceWeatherSnapshot = {
      timestamp: now,
      fetchedAt: now,

      // Geomagnetic — use SWPC if available
      kp: swpc.data?.kp ?? state.lastKp,
      kpForecast24h: swpc.data?.kpForecast24h ?? [],
      gScale: swpc.data?.gScale ?? null,

      // Solar
      xrayFlux: swpc.data?.xrayFlux ?? null,
      latestFlare: donki.data?.flares[donki.data.flares.length - 1] ?? null,
      sScale: null,
      rScale: null,

      // Solar Wind — prefer realtime, fallback to SWPC 7-day
      solarWind: rtWind.data ?? swpc.data?.solarWind ?? null,
      magneticField: rtMag.data ?? swpc.data?.magneticField ?? null,

      // Events from DONKI (use empty arrays if DONKI is down)
      recentCMEs: donki.data?.cmes ?? [],
      earthDirectedCMEs: donki.data?.earthDirectedCMEs ?? [],
      recentFlares: donki.data?.flares ?? [],
      recentStorms: donki.data?.storms ?? [],
      recentSEP: donki.data?.sep ?? [],
      recentHSS: donki.data?.hss ?? [],
      recentIPS: donki.data?.ips ?? [],
      recentMPC: donki.data?.mpc ?? [],

      // Alerts & Forecast
      activeAlerts: swpc.data?.alerts ?? [],
      forecast3Day: swpc.data?.forecast3Day ?? null,
    };

    const activeRegions: ActiveRegion[] = regions.data ?? [];

    // Evaluate alerts
    const allAlerts = evaluateAlerts(snapshot, activeRegions, state);

    // Filter by cooldowns
    const alertsToSend = allAlerts.filter((alert) => {
      if (isCoolingDown(alert.type, state)) {
        console.log(`  [COOLDOWN] Suppressed: ${alert.title}`);
        return false;
      }
      return true;
    });

    // Dispatch
    if (alertsToSend.length > 0) {
      dispatchAlerts(alertsToSend);

      // Record cooldowns for sent alerts
      for (const alert of alertsToSend) {
        recordCooldown(alert.type, state);
      }
    }

    // Update state
    state.lastRunAt = now;
    state.lastKp = snapshot.kp;
    state.lastBz = snapshot.magneticField?.bz ?? state.lastBz;
    state.lastWindSpeed = snapshot.solarWind?.speed ?? state.lastWindSpeed;
    state.lastWindDensity = snapshot.solarWind?.density ?? state.lastWindDensity;

    // Update threshold-crossed flags (for "all clear" detection)
    state.kpWasAbove5 = snapshot.kp >= 5;
    state.kpWasAbove7 = snapshot.kp >= 7;
    state.bzWasBelow10 = (snapshot.magneticField?.bz ?? 0) <= -10;
    state.bzWasBelow15 = (snapshot.magneticField?.bz ?? 0) <= -15;
    state.windWasAbove600 = (snapshot.solarWind?.speed ?? 0) >= 600;
    state.windWasAbove700 = (snapshot.solarWind?.speed ?? 0) >= 700;
    state.densityWasAbove20 = (snapshot.solarWind?.density ?? 0) >= 20;

    // Track known event IDs (with CME forecast fields for revision detection)
    state.knownCMEs = snapshot.earthDirectedCMEs.map((c) => ({
      id: c.id,
      predictedKp: c.predictedKp,
      predictedArrival: c.predictedArrival,
    }));
    state.knownFlareIds = snapshot.recentFlares.map((f) => f.id);
    state.knownHSSIds = snapshot.recentHSS.map((h) => h.id);
    state.knownRegionNumbers = activeRegions.map((r) => r.regionNumber);
    state.knownAlertProductIds = snapshot.activeAlerts.map((a) => a.productId);

    // Data health
    state.dataHealth = dataHealth;

    // Append alerts to history
    state.alertsSent.push(...alertsToSend);

    // Save state atomically
    saveState(state);

    // Verify pending predictions (isolated — failure here won't block notifications)
    try {
      await verifyPendingPredictions(state, snapshot);
    } catch (err) {
      console.error('Prediction verification failed (non-fatal):', err);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Check complete in ${elapsed}ms. ${alertsToSend.length} alert(s) sent.`);
    if (alertsToSend.length > 0) {
      for (const a of alertsToSend) {
        console.log(`  [${a.urgency.toUpperCase()}] ${a.title}`);
      }
    }
  } catch (err) {
    console.error('Space weather check failed:', err);
    // Still save state with updated lastRunAt
    state.lastRunAt = new Date().toISOString();
    saveState(state);
    process.exit(1);
  } finally {
    releaseLock();
  }
}

// === Helper: Update Data Health Entry ===

function updateHealth(
  source: string,
  ok: boolean,
  error: string | undefined,
  existing: DataHealthEntry[]
): DataHealthEntry {
  const prev = existing.find((d) => d.source === source);
  return {
    source,
    ok,
    lastSuccess: ok ? new Date().toISOString() : (prev?.lastSuccess ?? new Date(0).toISOString()),
    lastError: ok ? undefined : error,
  };
}

// === Run ===
main();
