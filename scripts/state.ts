// State persistence with atomic writes, lockfile with PID/stale detection

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync, renameSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { hostname } from 'os';
import type { CheckerState } from '../lib/types';
import { CONFIG } from './config';

// Resolve project root — works in both ESM and CJS contexts
const SCRIPTS_DIR = typeof __dirname !== 'undefined' ? __dirname : dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = resolve(SCRIPTS_DIR, '..');
const STATE_PATH = join(PROJECT_ROOT, CONFIG.stateFile);
const LOCK_PATH = join(PROJECT_ROOT, CONFIG.lockFile);

// === Default State ===

const DEFAULT_STATE: CheckerState = {
  schemaVersion: 1,
  lastRunAt: new Date(0).toISOString(),
  lastKp: 0,
  lastBz: 0,
  lastWindSpeed: 0,
  lastWindDensity: 0,
  kpWasAbove5: false,
  kpWasAbove7: false,
  bzWasBelow10: false,
  bzWasBelow15: false,
  windWasAbove600: false,
  windWasAbove700: false,
  densityWasAbove20: false,
  knownCMEs: [],
  knownFlareIds: [],
  knownHSSIds: [],
  knownRegionNumbers: [],
  knownAlertProductIds: [],
  lastCooldowns: {},
  dataHealth: [],
  alertsSent: [],
};

// === State Read/Write ===

export function loadState(): CheckerState {
  if (!existsSync(STATE_PATH)) return { ...DEFAULT_STATE };
  try {
    const raw = readFileSync(STATE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    // Merge with defaults to handle any missing fields from older versions
    return { ...DEFAULT_STATE, ...parsed };
  } catch (err) {
    console.error('Failed to parse state file, using defaults:', err);
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state: CheckerState): void {
  const dir = dirname(STATE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Cap alert history
  state.alertsSent = state.alertsSent.slice(-CONFIG.maxAlertHistory);

  // Serialize
  const json = JSON.stringify(state, null, 2);

  // Pre-write validation: ensure we can parse what we're about to write
  try {
    JSON.parse(json);
  } catch (err) {
    console.error('CRITICAL: State serialization produced invalid JSON, aborting save:', err);
    return;
  }

  // Atomic write: temp file then rename
  const tmpPath = join(dir, `.checker-state-${process.pid}.tmp`);
  try {
    writeFileSync(tmpPath, json, 'utf-8');
    renameSync(tmpPath, STATE_PATH);
  } catch (err) {
    // Clean up temp file if rename failed
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}

// === Lockfile with PID + Timestamp + Stale Detection ===

interface LockInfo {
  pid: number;
  timestamp: string;
  hostname: string;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // Signal 0 = check if process exists
    return true;
  } catch {
    return false;
  }
}

export function acquireLock(): boolean {
  const dir = dirname(LOCK_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Check existing lock
  if (existsSync(LOCK_PATH)) {
    try {
      const raw = readFileSync(LOCK_PATH, 'utf-8');
      const lock: LockInfo = JSON.parse(raw);

      // Check if lock holder is still alive
      if (isProcessAlive(lock.pid)) {
        // Check if lock is older than timeout (stale detection)
        const lockAge = Date.now() - new Date(lock.timestamp).getTime();
        if (lockAge < CONFIG.lockTimeout) {
          console.log(`Lock held by PID ${lock.pid} (${Math.round(lockAge / 1000)}s old). Exiting.`);
          return false;
        }
        console.warn(`Stale lock from PID ${lock.pid} (${Math.round(lockAge / 1000)}s old). Stealing lock.`);
      } else {
        console.warn(`Orphaned lock from dead PID ${lock.pid}. Cleaning up.`);
      }
    } catch {
      console.warn('Corrupt lock file. Cleaning up.');
    }
  }

  // Write new lock
  const lockInfo: LockInfo = {
    pid: process.pid,
    timestamp: new Date().toISOString(),
    hostname: hostname(),
  };
  writeFileSync(LOCK_PATH, JSON.stringify(lockInfo), 'utf-8');
  return true;
}

export function releaseLock(): void {
  try {
    if (existsSync(LOCK_PATH)) {
      const raw = readFileSync(LOCK_PATH, 'utf-8');
      const lock: LockInfo = JSON.parse(raw);
      // Only release if we own it
      if (lock.pid === process.pid) {
        unlinkSync(LOCK_PATH);
      }
    }
  } catch {
    // Best effort
  }
}

// === Log Truncation ===

export function truncateLogs(): void {
  const logFiles = [
    join(PROJECT_ROOT, CONFIG.stateDir, 'checker-stdout.log'),
    join(PROJECT_ROOT, CONFIG.stateDir, 'checker-stderr.log'),
  ];

  for (const logPath of logFiles) {
    try {
      if (!existsSync(logPath)) continue;
      const stats = statSync(logPath);
      if (stats.size > CONFIG.maxLogSize) {
        // Read last portion of the file
        const content = readFileSync(logPath, 'utf-8');
        const truncated = content.slice(-Math.floor(CONFIG.maxLogSize / 2));
        writeFileSync(logPath, `--- Log truncated at ${new Date().toISOString()} ---\n${truncated}`);
      }
    } catch {
      // Best effort
    }
  }
}

// === Cooldown Check ===

export function isCoolingDown(alertType: string, state: CheckerState): boolean {
  const cooldownMinutes = CONFIG.cooldowns[alertType];
  if (!cooldownMinutes || cooldownMinutes === 0) return false;

  const lastSent = state.lastCooldowns[alertType];
  if (!lastSent) return false;

  const elapsed = Date.now() - new Date(lastSent).getTime();
  return elapsed < cooldownMinutes * 60 * 1000;
}

export function recordCooldown(alertType: string, state: CheckerState): void {
  state.lastCooldowns[alertType] = new Date().toISOString();
}
