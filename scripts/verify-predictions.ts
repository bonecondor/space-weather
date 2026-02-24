// Verification pass: check expired prediction windows against actual space weather data
// Called from checker.ts after each cycle

import { loadPredictions, savePredictions, type Prediction, type MatchedEvent } from '../lib/predictions';
import type { CheckerState, SpaceWeatherSnapshot } from '../lib/types';
import { sendSignalMessage } from './notify';

export async function verifyPendingPredictions(
  checkerState: CheckerState,
  snapshot: SpaceWeatherSnapshot
): Promise<void> {
  const predState = await loadPredictions();
  const now = new Date();
  let changed = false;

  for (const prediction of predState.predictions) {
    if (prediction.status !== 'pending') continue;
    if (new Date(prediction.windowEnd) > now) continue; // window still open

    const matched = findMatchingEvents(prediction, checkerState, snapshot);
    prediction.matchedEvents = matched;
    prediction.status = matched.length > 0 ? 'hit' : 'miss';
    prediction.verifiedAt = now.toISOString();
    changed = true;

    // Notify mom via Signal
    notifyResult(prediction);

    const predDate = new Date(prediction.timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    console.log(`  [PREDICT] ${predDate}: ${prediction.status.toUpperCase()} (${matched.length} events)`);
  }

  if (changed) {
    await savePredictions(predState);
  }
}

function findMatchingEvents(
  prediction: Prediction,
  state: CheckerState,
  snapshot: SpaceWeatherSnapshot
): MatchedEvent[] {
  const start = new Date(prediction.timestamp).getTime();
  const end = new Date(prediction.windowEnd).getTime();
  const events: MatchedEvent[] = [];
  const seen = new Set<string>();

  // Check checker's alertsSent for significant events in the window
  for (const alert of state.alertsSent) {
    const alertTime = new Date(alert.timestamp).getTime();
    if (alertTime < start || alertTime > end) continue;

    let event: MatchedEvent | null = null;

    if (alert.type === 'flare-m' || alert.type === 'flare-x') {
      event = { type: 'flare', description: alert.title, timestamp: alert.timestamp };
    } else if (alert.type === 'kp-threshold' || alert.type === 'kp-elevated') {
      event = { type: 'kp', description: alert.title, timestamp: alert.timestamp };
    } else if (alert.type === 'cme-earth') {
      event = { type: 'cme', description: alert.title, timestamp: alert.timestamp };
    } else if (alert.type === 'bz-threshold') {
      event = { type: 'bz', description: alert.title, timestamp: alert.timestamp };
    } else if (alert.type === 'wind-speed') {
      event = { type: 'wind', description: alert.title, timestamp: alert.timestamp };
    }

    if (event) {
      const key = `${event.type}-${event.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        events.push(event);
      }
    }
  }

  // Also check DONKI flares directly (in case checker alert was suppressed by cooldown)
  for (const flare of snapshot.recentFlares) {
    const flareTime = new Date(flare.beginTime).getTime();
    if (flareTime < start || flareTime > end) continue;
    if (flare.classType.startsWith('M') || flare.classType.startsWith('X')) {
      const key = `flare-${flare.beginTime}`;
      if (!seen.has(key)) {
        seen.add(key);
        events.push({
          type: 'flare',
          description: `${flare.classType} Flare`,
          timestamp: flare.beginTime,
        });
      }
    }
  }

  // Check DONKI geomagnetic storms
  for (const storm of snapshot.recentStorms) {
    const stormTime = new Date(storm.startTime).getTime();
    if (stormTime < start || stormTime > end) continue;
    if (storm.kpIndex >= 5) {
      const key = `kp-${storm.startTime}`;
      if (!seen.has(key)) {
        seen.add(key);
        events.push({
          type: 'kp',
          description: `Kp ${storm.kpIndex} (${storm.gScale})`,
          timestamp: storm.startTime,
        });
      }
    }
  }

  // Check earth-directed CMEs
  for (const cme of snapshot.earthDirectedCMEs) {
    const cmeTime = new Date(cme.startTime).getTime();
    if (cmeTime < start || cmeTime > end) continue;
    const key = `cme-${cme.startTime}`;
    if (!seen.has(key)) {
      seen.add(key);
      events.push({
        type: 'cme',
        description: `Earth-directed CME${cme.speed ? ` (${cme.speed} km/s)` : ''}`,
        timestamp: cme.startTime,
      });
    }
  }

  return events;
}

function notifyResult(prediction: Prediction): void {
  const predDate = new Date(prediction.timestamp).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  let message: string;
  if (prediction.status === 'hit') {
    const topEvent = prediction.matchedEvents[0];
    const extras = prediction.matchedEvents.length > 1
      ? ` (+${prediction.matchedEvents.length - 1} more)`
      : '';
    message = `Your prediction from ${predDate}: HIT — ${topEvent.description}${extras}`;
  } else {
    message = `Your prediction from ${predDate}: MISS — quiet window`;
  }

  const emoji = prediction.status === 'hit' ? '🎯' : '🤷';

  try {
    sendSignalMessage({
      id: `predict-result-${prediction.id}`,
      type: 'prediction-result',
      urgency: 'info',
      title: `${emoji} Solar Sense`,
      body: message,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to send prediction result notification:', err);
  }
}
