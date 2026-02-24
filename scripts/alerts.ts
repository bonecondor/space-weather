// Alert evaluation logic — the core brain
// Compares current snapshot + active regions against previous state
// Produces an array of alerts to dispatch

import type {
  SpaceWeatherSnapshot,
  CheckerState,
  SpaceWeatherAlert,
  ActiveRegion,
  AlertUrgency,
  KnownCME,
} from '../lib/types';
import { CONFIG } from './config';

export function evaluateAlerts(
  snapshot: SpaceWeatherSnapshot,
  activeRegions: ActiveRegion[],
  prevState: CheckerState
): SpaceWeatherAlert[] {
  const alerts: SpaceWeatherAlert[] = [];
  const now = new Date().toISOString();

  // --- 1. Earth-Directed CMEs ---
  for (const cme of snapshot.earthDirectedCMEs) {
    const known = prevState.knownCMEs.find((k) => k.id === cme.id);

    if (!known) {
      // New CME
      const predictedKp = cme.predictedKp ?? 0;
      const urgency: AlertUrgency = predictedKp >= 7 ? 'critical' : 'high';
      const speed = cme.speed ? ` at ${cme.speed} km/s` : '';
      const eta = cme.predictedArrival ? `, ETA ${formatETA(cme.predictedArrival)}` : '';
      const impact = predictedKp >= 5
        ? ` ${CONFIG.impactDescriptions.kp[Math.min(Math.floor(predictedKp), 9)] || ''}`
        : '';

      alerts.push({
        id: `cme-earth-${cme.id}`,
        type: 'cme-earth',
        urgency,
        title: `Earth-Directed CME${predictedKp >= 5 ? ` (Kp ${predictedKp} predicted)` : ''}`,
        body: `CME erupted ${formatTime(cme.startTime)}${speed}${eta}.${impact}`,
        timestamp: now,
        sourceEventId: cme.id,
      });
    } else {
      // Known CME — check for significant forecast revision
      const oldKp = known.predictedKp ?? 0;
      const newKp = cme.predictedKp ?? 0;
      const kpJump = newKp - oldKp;

      if (kpJump >= CONFIG.thresholds.cmeRevision.kpJump && newKp >= 5) {
        const urgency: AlertUrgency = newKp >= 7 ? 'critical' : 'high';
        alerts.push({
          id: `cme-revision-${cme.id}-${now}`,
          type: 'cme-revision',
          urgency,
          title: `CME Forecast Upgraded: Kp ${oldKp} → ${newKp}`,
          body: `Earth-directed CME now predicted to cause Kp ${newKp} (was ${oldKp}). ${CONFIG.impactDescriptions.kp[Math.min(Math.floor(newKp), 9)] || ''}`,
          timestamp: now,
          sourceEventId: cme.id,
        });
      }
    }
  }

  // --- 2. Solar Flares (M1+ = high, X = critical) ---
  for (const flare of snapshot.recentFlares) {
    if (prevState.knownFlareIds.includes(flare.id)) continue;

    const cls = flare.classType;
    const letter = cls.charAt(0);

    let urgency: AlertUrgency | null = null;
    let alertType = '';
    if (letter === 'X') { urgency = 'critical'; alertType = 'flare-x'; }
    else if (letter === 'M') { urgency = 'high'; alertType = 'flare-m'; }

    if (!urgency) continue; // Skip C-class and below

    const region = flare.activeRegionNum ? ` from region ${flare.activeRegionNum}` : '';
    const impact = CONFIG.impactDescriptions.flare[letter] || '';

    alerts.push({
      id: `flare-${flare.id}`,
      type: alertType,
      urgency,
      title: `${cls} Solar Flare`,
      body: `${cls} flare detected${region} at ${formatTime(flare.beginTime)}. ${impact}`,
      timestamp: now,
      sourceEventId: flare.id,
    });
  }

  // --- 3. High Speed Streams (coronal hole proxy) ---
  for (const hss of snapshot.recentHSS) {
    if (prevState.knownHSSIds.includes(hss.id)) continue;

    alerts.push({
      id: `hss-${hss.id}`,
      type: 'hss-arrival',
      urgency: 'moderate',
      title: 'Coronal Hole Stream Arriving',
      body: `High-speed stream detected at ${formatTime(hss.eventTime)}. ${CONFIG.impactDescriptions.windSpeed[600]}`,
      timestamp: now,
      sourceEventId: hss.id,
    });
  }

  // --- 4. Kp Threshold Crossings ---
  const kp = snapshot.kp;
  const prevKp = prevState.lastKp;

  if (kp >= 7 && prevKp < 7) {
    const kpInt = Math.min(Math.floor(kp), 9);
    alerts.push({
      id: `kp-cross-7-${now}`,
      type: 'kp-threshold',
      urgency: 'critical',
      title: `Kp ${kp} — G${Math.min(kpInt - 4, 5)} Storm`,
      body: `Kp index jumped to ${kp} (was ${prevKp}). ${CONFIG.impactDescriptions.kp[kpInt] || ''}`,
      timestamp: now,
    });
  } else if (kp >= 5 && prevKp < 5) {
    alerts.push({
      id: `kp-cross-5-${now}`,
      type: 'kp-threshold',
      urgency: 'high',
      title: `Kp ${kp} — G1 Storm Threshold`,
      body: `Kp index rose to ${kp} (was ${prevKp}). ${CONFIG.impactDescriptions.kp[5]}`,
      timestamp: now,
    });
  } else if (kp >= 4 && prevKp < 4) {
    alerts.push({
      id: `kp-cross-4-${now}`,
      type: 'kp-elevated',
      urgency: 'info',
      title: `Kp Elevated to ${kp}`,
      body: `${CONFIG.impactDescriptions.kp[4]}`,
      timestamp: now,
    });
  }

  // --- 5. Bz Threshold Crossings (southward) ---
  const bz = snapshot.magneticField?.bz ?? 0;
  const prevBz = prevState.lastBz;

  if (bz <= -15 && prevBz > -15) {
    alerts.push({
      id: `bz-cross-15-${now}`,
      type: 'bz-threshold',
      urgency: 'high',
      title: `Strong Southward Bz: ${bz.toFixed(1)} nT`,
      body: `Magnetic field Bz dropped to ${bz.toFixed(1)} nT. ${CONFIG.impactDescriptions.bz['-15']}`,
      timestamp: now,
    });
  } else if (bz <= -10 && prevBz > -10) {
    alerts.push({
      id: `bz-cross-10-${now}`,
      type: 'bz-threshold',
      urgency: 'moderate',
      title: `Southward Bz: ${bz.toFixed(1)} nT`,
      body: `Magnetic field Bz dropped to ${bz.toFixed(1)} nT. ${CONFIG.impactDescriptions.bz['-10']}`,
      timestamp: now,
    });
  }

  // --- 6. Solar Wind Speed Crossings ---
  const windSpeed = snapshot.solarWind?.speed ?? 0;
  const prevSpeed = prevState.lastWindSpeed;

  if (windSpeed >= 700 && prevSpeed < 700) {
    alerts.push({
      id: `wind-speed-700-${now}`,
      type: 'wind-speed',
      urgency: 'high',
      title: `Solar Wind ${Math.round(windSpeed)} km/s`,
      body: `Solar wind speed surged to ${Math.round(windSpeed)} km/s (was ${Math.round(prevSpeed)}). ${CONFIG.impactDescriptions.windSpeed[700]}`,
      timestamp: now,
    });
  } else if (windSpeed >= 600 && prevSpeed < 600) {
    alerts.push({
      id: `wind-speed-600-${now}`,
      type: 'wind-speed',
      urgency: 'moderate',
      title: `Solar Wind Elevated: ${Math.round(windSpeed)} km/s`,
      body: `Solar wind speed rose to ${Math.round(windSpeed)} km/s. ${CONFIG.impactDescriptions.windSpeed[600]}`,
      timestamp: now,
    });
  }

  // --- 7. Solar Wind Density Spike ---
  const density = snapshot.solarWind?.density ?? 0;
  const prevDensity = prevState.lastWindDensity;

  if (density >= 20 && prevDensity < 20) {
    alerts.push({
      id: `wind-density-20-${now}`,
      type: 'wind-density',
      urgency: 'moderate',
      title: `Density Spike: ${density.toFixed(1)} p/cm\u00b3`,
      body: `Solar wind density jumped to ${density.toFixed(1)} p/cm\u00b3 (was ${prevDensity.toFixed(1)}). May indicate incoming CME or shock front.`,
      timestamp: now,
    });
  }

  // --- 8. New Active Regions with High Flare Probability ---
  if (CONFIG.activeRegionAlerts.enabled) {
    for (const region of activeRegions) {
      if (prevState.knownRegionNumbers.includes(region.regionNumber)) continue;
      if (
        region.flareProb_M < CONFIG.thresholds.activeRegion.mFlareProb &&
        region.flareProb_X < CONFIG.thresholds.activeRegion.xFlareProb
      ) continue;

      const magClass = region.magneticClass || 'unknown';
      alerts.push({
        id: `region-new-${region.regionNumber}`,
        type: 'active-region',
        urgency: 'info',
        title: `New Active Region ${region.regionNumber}`,
        body: `${magClass} class at ${region.location}. M-flare: ${region.flareProb_M}%, X-flare: ${region.flareProb_X}%.`,
        timestamp: now,
      });
    }
  }

  // --- 9. "All Clear" Notifications ---
  // When previously-crossed thresholds return to normal

  if (prevState.kpWasAbove5 && kp < 5) {
    alerts.push({
      id: `all-clear-kp5-${now}`,
      type: 'all-clear',
      urgency: 'moderate',
      title: `Kp Returning to Normal: ${kp}`,
      body: `Geomagnetic storm conditions subsiding. Kp dropped back to ${kp}.`,
      timestamp: now,
    });
  }

  if (prevState.kpWasAbove7 && kp < 5) {
    // Only if the major storm all-clear hasn't already been covered by the G1 all-clear
    // (this fires when kp drops from 7+ all the way below 5)
  }

  if (prevState.bzWasBelow15 && bz > -10) {
    alerts.push({
      id: `all-clear-bz15-${now}`,
      type: 'all-clear',
      urgency: 'moderate',
      title: `Bz Recovering: ${bz.toFixed(1)} nT`,
      body: `Magnetic field returning northward. Strong geoeffective conditions easing.`,
      timestamp: now,
    });
  }

  if (prevState.windWasAbove700 && windSpeed < 600) {
    alerts.push({
      id: `all-clear-wind700-${now}`,
      type: 'all-clear',
      urgency: 'moderate',
      title: `Solar Wind Easing: ${Math.round(windSpeed)} km/s`,
      body: `High-speed solar wind conditions subsiding.`,
      timestamp: now,
    });
  }

  return alerts;
}

// === Helpers ===

function formatETA(arrivalTime: string): string {
  const diffMs = new Date(arrivalTime).getTime() - Date.now();
  const hours = Math.round(diffMs / 3600000);
  if (hours < 0) return 'already past predicted arrival';
  if (hours < 1) return 'imminent';
  if (hours < 24) return `~${hours}h`;
  const days = Math.round(hours / 24);
  return `~${days}d`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
