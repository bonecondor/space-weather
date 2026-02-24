// Space Weather Checker Configuration
// Edit this file to tune alert behavior without touching evaluation logic.

export const CONFIG = {
  // === Alert Thresholds ===
  thresholds: {
    kp: { elevated: 4, storm: 5, major: 7 },
    bz: { moderate: -10, strong: -15 }, // nT, negative = southward
    windSpeed: { elevated: 600, high: 700 }, // km/s
    density: { high: 20 }, // p/cm3
    flare: { notify: 'M', critical: 'X' }, // minimum class
    activeRegion: { mFlareProb: 30, xFlareProb: 10 }, // % probability to alert
    cmeRevision: { kpJump: 2 }, // re-alert if predicted Kp rises by this much
  },

  // === Cooldowns (minutes) ===
  // Minimum time between repeated alerts of the same type
  cooldowns: {
    'kp-threshold': 180, // 3 hours
    'kp-elevated': 360, // 6 hours
    'bz-threshold': 60, // 1 hour
    'wind-speed': 60,
    'wind-density': 120,
    'flare-m': 60,
    'flare-x': 0, // never suppress X-class
    'cme-earth': 0, // never suppress new CME
    'cme-revision': 60,
    'hss-arrival': 240, // 4 hours
    'active-region': 360, // 6 hours
    'all-clear': 60,
    'data-stale': 360, // 6 hours
  } as Record<string, number>,

  // === Channel Routing ===
  channels: {
    critical: ['signal', 'desktop'] as const,
    high: ['signal', 'desktop'] as const,
    moderate: ['desktop'] as const,
    info: ['desktop'] as const,
  },

  // === Quiet Hours (local time) ===
  // Suppress non-critical alerts during sleep
  quietHours: {
    enabled: true,
    start: 23, // 11 PM
    end: 7, // 7 AM
    // CRITICAL alerts always go through regardless
  },

  // === Active Region Alerts ===
  activeRegionAlerts: {
    enabled: true, // Set false to make region tracking dashboard-only
  },

  // === Data Freshness (minutes) ===
  freshness: {
    'swpc-realtime': 30, // solar wind, mag field
    'swpc-kp': 60,
    'swpc-xray': 30,
    'swpc-alerts': 30,
    'swpc-regions': 1440, // 24 hours (daily data)
    'swpc-forecast': 1440,
    'donki': 480, // 8 hours
  } as Record<string, number>,

  // === Impact Descriptions ===
  // Human-readable context for each threshold level
  impactDescriptions: {
    kp: {
      4: 'Elevated geomagnetic activity. Aurora possible at very high latitudes.',
      5: 'G1 minor storm. Aurora visible at high latitudes, weak power grid fluctuations possible.',
      6: 'G2 moderate storm. Aurora visible at mid-high latitudes, HF radio intermittent.',
      7: 'G3 strong storm. Aurora visible at mid-latitudes, power grid irregularities, satellite drag.',
      8: 'G4 severe storm. Aurora widespread, possible power grid damage, satellite charging.',
      9: 'G5 extreme storm. Widespread aurora, power grid blackouts possible, satellite damage risk.',
    } as Record<number, string>,
    bz: {
      '-10': 'Moderately geoeffective. Energy transfer into magnetosphere increasing.',
      '-15': 'Strongly geoeffective. Sustained coupling likely to drive geomagnetic storming.',
      '-20': 'Extremely geoeffective. Major storm conditions likely.',
    } as Record<string, string>,
    windSpeed: {
      600: 'Elevated solar wind. May indicate coronal hole stream or CME approach.',
      700: 'High-speed solar wind. Likely CME shock front or strong coronal hole stream.',
    } as Record<number, string>,
    flare: {
      M: 'M-class flare. Brief HF radio blackout on sunlit side of Earth.',
      X: 'X-class flare. Wide-area HF radio blackout, possible navigation errors.',
    } as Record<string, string>,
  },

  // === State File ===
  stateDir: 'scripts/state',
  stateFile: 'scripts/state/checker-state.json',
  lockFile: 'scripts/state/checker.lock',
  lockTimeout: 10 * 60 * 1000, // 10 minutes — stale lock detection
  maxAlertHistory: 100,
  maxLogSize: 1024 * 1024, // 1MB — truncate logs above this

  // === Signal ===
  signalCli: '/opt/homebrew/bin/signal-cli',
} as const;
