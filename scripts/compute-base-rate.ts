#!/usr/bin/env node
// One-time script: compute base rate of "significant activity" in random 48h windows
// Uses 2 years of DONKI flare + geomagnetic storm data
// Run: ./node_modules/.bin/tsx scripts/compute-base-rate.ts

import { loadPredictions, savePredictions } from '../lib/predictions';

const API_KEY = process.env.NASA_API_KEY || 'DEMO_KEY';
const BASE_URL = 'https://api.nasa.gov/DONKI';
const WINDOW_HOURS = 48;
const SAMPLE_COUNT = 1000;

interface SimpleFlare {
  beginTime: string;
  classType: string;
}

interface SimpleStorm {
  startTime: string;
  kpIndex: number;
}

interface SimpleCME {
  startTime: string;
  isEarthDirected: boolean;
}

async function fetchDONKIRaw<T>(endpoint: string, startDate: string, endDate: string): Promise<T[]> {
  const url = `${BASE_URL}/${endpoint}?startDate=${startDate}&endDate=${endDate}&api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 429) {
      console.error(`Rate limited on ${endpoint}. Wait and retry, or use a proper NASA API key.`);
      return [];
    }
    throw new Error(`DONKI ${endpoint} failed: ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function main() {
  console.log('Computing base rate from DONKI historical data...\n');

  // Date range: 2 years back from now
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  console.log(`  Range: ${startStr} to ${endStr}`);
  console.log(`  Fetching flares...`);

  // Fetch flares (M+ only matter)
  const rawFlares = await fetchDONKIRaw<{ flrID: string; beginTime: string; classType: string }>('FLR', startStr, endStr);
  const mPlusFlares: SimpleFlare[] = rawFlares
    .filter((f) => f.classType && (f.classType.startsWith('M') || f.classType.startsWith('X')))
    .map((f) => ({ beginTime: f.beginTime, classType: f.classType }));
  console.log(`  Found ${mPlusFlares.length} M/X-class flares`);

  console.log(`  Fetching geomagnetic storms...`);

  // Fetch geomagnetic storms (Kp >= 5)
  const rawStorms = await fetchDONKIRaw<{
    gstID: string;
    startTime: string;
    allKpIndex: Array<{ kpIndex: number }>;
  }>('GST', startStr, endStr);
  const significantStorms: SimpleStorm[] = rawStorms
    .map((s) => ({
      startTime: s.startTime,
      kpIndex: Math.max(...(s.allKpIndex || []).map((k) => k.kpIndex), 0),
    }))
    .filter((s) => s.kpIndex >= 5);
  console.log(`  Found ${significantStorms.length} storms with Kp >= 5`);

  console.log(`  Fetching CMEs...`);

  // Fetch earth-directed CMEs
  const rawCMEs = await fetchDONKIRaw<{
    activityID: string;
    startTime: string;
    note: string;
    cmeAnalyses?: Array<{
      halfAngle: number | null;
      enlilList?: Array<{ isEarthGB: boolean }>;
    }>;
  }>('CME', startStr, endStr);
  const earthCMEs: SimpleCME[] = rawCMEs
    .filter((c) => {
      const note = (c.note || '').toLowerCase();
      const hasEnlil = c.cmeAnalyses?.some((a) => a.enlilList?.some((e) => e.isEarthGB));
      const isHalo = note.includes('halo');
      const mentionsEarth = note.includes('earth') || note.includes('geoeffective');
      return hasEnlil || isHalo || mentionsEarth;
    })
    .map((c) => ({ startTime: c.startTime, isEarthDirected: true }));
  console.log(`  Found ${earthCMEs.length} earth-directed CMEs`);

  // Build event timestamp array (all significant events)
  const allEventTimes: number[] = [
    ...mPlusFlares.map((f) => new Date(f.beginTime).getTime()),
    ...significantStorms.map((s) => new Date(s.startTime).getTime()),
    ...earthCMEs.map((c) => new Date(c.startTime).getTime()),
  ].sort();

  console.log(`\n  Total significant events: ${allEventTimes.length}`);

  // Generate random 48h windows and check for activity
  const rangeMs = endDate.getTime() - startDate.getTime() - WINDOW_HOURS * 60 * 60 * 1000;
  const windowMs = WINDOW_HOURS * 60 * 60 * 1000;

  let hits = 0;
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const windowStart = startDate.getTime() + Math.random() * rangeMs;
    const windowEnd = windowStart + windowMs;

    // Binary search for efficiency
    const hasActivity = allEventTimes.some((t) => t >= windowStart && t <= windowEnd);
    if (hasActivity) hits++;
  }

  const baseRate = hits / SAMPLE_COUNT;

  console.log(`\n  Sampled ${SAMPLE_COUNT} random ${WINDOW_HOURS}h windows`);
  console.log(`  Windows with significant activity: ${hits}/${SAMPLE_COUNT}`);
  console.log(`  Base rate: ${(baseRate * 100).toFixed(1)}%\n`);

  // Save to predictions config
  const state = await loadPredictions();
  state.config.baseRate = baseRate;
  state.config.baseRateComputedAt = new Date().toISOString();
  state.config.baseRateSampleWindows = SAMPLE_COUNT;
  await savePredictions(state);

  console.log(`  Saved to predictions.json`);
}

main().catch((err) => {
  console.error('Base rate computation failed:', err);
  process.exit(1);
});
