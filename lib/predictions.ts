// Prediction tracker types + state persistence
// Tests whether somatic predictions correlate with actual space weather activity
// Supports two backends: local JSON file (dev/scripts) and Upstash Redis (deployed)

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, renameSync } from 'fs';
import { join, dirname } from 'path';

// === Types ===

export interface Prediction {
  id: string;
  timestamp: string;            // ISO, always UTC
  note: string | null;          // optional context ("headache", "people acting weird")
  status: 'pending' | 'hit' | 'miss';
  verifiedAt: string | null;
  windowHours: number;          // verification window (default 48)
  windowEnd: string;            // timestamp + windowHours
  matchedEvents: MatchedEvent[];
}

export interface MatchedEvent {
  type: 'flare' | 'kp' | 'cme' | 'bz' | 'wind';
  description: string;          // e.g., "M2.4 flare", "Kp 6 (G2)"
  timestamp: string;
}

export interface PredictionConfig {
  verificationWindowHours: number;
  baseRate: number | null;      // pre-computed from historical data
  baseRateComputedAt: string | null;
  baseRateSampleWindows: number;
  cooldownHours: number;        // minimum time between predictions
  maxPredictions: number;       // cap before archiving oldest
}

export interface PredictionState {
  schemaVersion: number;
  predictions: Prediction[];
  config: PredictionConfig;
}

export interface Scorecard {
  totalPredictions: number;
  pending: number;
  hits: number;
  misses: number;
  hitRate: number | null;
  baseRate: number | null;
  pValue: number | null;        // binomial test
  totalDaysTracked: number;
}

// === State File Path ===

const STATE_PATH = join(process.cwd(), 'scripts', 'state', 'predictions.json');

// === Defaults ===

const DEFAULT_CONFIG: PredictionConfig = {
  verificationWindowHours: 48,
  baseRate: null,
  baseRateComputedAt: null,
  baseRateSampleWindows: 0,
  cooldownHours: 6,
  maxPredictions: 500,
};

const DEFAULT_STATE: PredictionState = {
  schemaVersion: 1,
  predictions: [],
  config: DEFAULT_CONFIG,
};

// === Backend Detection ===

function useRedis(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let _redis: import('@upstash/redis').Redis | null = null;
async function getRedis() {
  if (!_redis) {
    const { Redis } = await import('@upstash/redis');
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

const REDIS_KEY = 'predictions';

function parseState(parsed: Record<string, unknown>): PredictionState {
  return {
    ...DEFAULT_STATE,
    ...parsed,
    config: { ...DEFAULT_CONFIG, ...((parsed.config as Record<string, unknown>) || {}) },
  };
}

// === Load / Save (async — works with both backends) ===

export async function loadPredictions(): Promise<PredictionState> {
  if (useRedis()) {
    try {
      const redis = await getRedis();
      const data = await redis.get<PredictionState>(REDIS_KEY);
      if (!data) return structuredClone(DEFAULT_STATE);
      return parseState(data as unknown as Record<string, unknown>);
    } catch (err) {
      console.error('Failed to load predictions from Redis:', err);
      return structuredClone(DEFAULT_STATE);
    }
  }

  // Local file fallback
  if (!existsSync(STATE_PATH)) return structuredClone(DEFAULT_STATE);
  try {
    const raw = readFileSync(STATE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return parseState(parsed);
  } catch (err) {
    console.error('Failed to parse predictions state, using defaults:', err);
    return structuredClone(DEFAULT_STATE);
  }
}

export async function savePredictions(state: PredictionState): Promise<void> {
  // Enforce cap — archive oldest
  if (state.predictions.length > state.config.maxPredictions) {
    state.predictions = state.predictions.slice(-state.config.maxPredictions);
  }

  if (useRedis()) {
    try {
      const redis = await getRedis();
      await redis.set(REDIS_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Failed to save predictions to Redis:', err);
      throw err;
    }
    return;
  }

  // Local file fallback
  const dir = dirname(STATE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const json = JSON.stringify(state, null, 2);

  // Pre-write validation
  try {
    JSON.parse(json);
  } catch (err) {
    console.error('CRITICAL: Predictions serialization produced invalid JSON:', err);
    return;
  }

  // Atomic write
  const tmpPath = join(dir, `.predictions-${process.pid}.tmp`);
  try {
    writeFileSync(tmpPath, json, 'utf-8');
    renameSync(tmpPath, STATE_PATH);
  } catch (err) {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}

// === Helpers ===

export function isWithinCooldown(state: PredictionState): boolean {
  if (state.predictions.length === 0) return false;
  const last = state.predictions[state.predictions.length - 1];
  const elapsed = Date.now() - new Date(last.timestamp).getTime();
  return elapsed < state.config.cooldownHours * 60 * 60 * 1000;
}

export function computeScorecard(state: PredictionState): Scorecard {
  const verified = state.predictions.filter((p) => p.status !== 'pending');
  const hits = verified.filter((p) => p.status === 'hit').length;
  const misses = verified.filter((p) => p.status === 'miss').length;
  const n = hits + misses;
  const hitRate = n > 0 ? hits / n : null;

  // Days tracked: from first prediction to now
  let totalDaysTracked = 0;
  if (state.predictions.length > 0) {
    const first = new Date(state.predictions[0].timestamp);
    totalDaysTracked = Math.floor((Date.now() - first.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Binomial test p-value (one-tailed: is hit rate significantly above base rate?)
  let pValue: number | null = null;
  if (n > 0 && state.config.baseRate !== null) {
    pValue = binomialPValue(hits, n, state.config.baseRate);
  }

  return {
    totalPredictions: state.predictions.length,
    pending: state.predictions.filter((p) => p.status === 'pending').length,
    hits,
    misses,
    hitRate,
    baseRate: state.config.baseRate,
    pValue,
    totalDaysTracked,
  };
}

/**
 * One-tailed binomial test: P(X >= k) given n trials and probability p.
 * Uses the survival function (1 - CDF) of the binomial distribution.
 */
function binomialPValue(k: number, n: number, p: number): number {
  if (p <= 0) return k > 0 ? 0 : 1;
  if (p >= 1) return 1;

  // P(X >= k) = sum from i=k to n of C(n,i) * p^i * (1-p)^(n-i)
  let pValue = 0;
  for (let i = k; i <= n; i++) {
    pValue += binomialPMF(i, n, p);
  }
  return Math.min(pValue, 1);
}

function binomialPMF(k: number, n: number, p: number): number {
  // Use log space to avoid overflow
  let logP = logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p);
  return Math.exp(logP);
}

function logChoose(n: number, k: number): number {
  if (k === 0 || k === n) return 0;
  let result = 0;
  for (let i = 0; i < k; i++) {
    result += Math.log(n - i) - Math.log(i + 1);
  }
  return result;
}
