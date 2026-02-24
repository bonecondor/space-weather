// Space Weather Data Types

// === Geomagnetic Scales ===
export type GScale = 'G0' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5';
export type SScale = 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
export type RScale = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

// === CME (Coronal Mass Ejection) ===
export interface CME {
  id: string;
  activityID: string;
  startTime: string;
  sourceLocation: string | null;
  activeRegionNum: number | null;
  speed: number | null; // km/s
  halfAngle: number | null; // degrees
  isEarthDirected: boolean;
  predictedArrival: string | null;
  predictedKp: number | null;
  note: string | null;
}

// === Solar Flare ===
export interface SolarFlare {
  id: string;
  beginTime: string;
  peakTime: string | null;
  endTime: string | null;
  classType: string; // e.g., "M1.2", "X2.0", "C5.5"
  sourceLocation: string | null;
  activeRegionNum: number | null;
}

// === Geomagnetic Storm ===
export interface GeomagneticStorm {
  id: string;
  startTime: string;
  kpIndex: number;
  gScale: GScale;
}

// === Solar Energetic Particle Event ===
export interface SEPEvent {
  id: string;
  eventTime: string;
  instruments: string[];
}

// === High Speed Stream ===
export interface HighSpeedStream {
  id: string;
  eventTime: string;
  instruments: string[];
}

// === Interplanetary Shock ===
export interface InterplanetaryShock {
  id: string;
  eventTime: string;
  location: string | null;
  instruments: string[];
}

// === Magnetopause Crossing ===
export interface MagnetopauseCrossing {
  id: string;
  eventTime: string;
  instruments: string[];
}

// === Real-time Solar Wind (from L1 - ACE/DSCOVR) ===
export interface SolarWind {
  timestamp: string;
  speed: number; // km/s
  density: number; // p/cm³
  temperature: number; // K
}

export interface MagneticField {
  timestamp: string;
  bx: number; // nT
  by: number; // nT
  bz: number; // nT (negative = geoeffective)
  bt: number; // nT total
}

// === NOAA Alert ===
export interface NOAAAlert {
  productId: string;
  issueTime: string;
  message: string;
}

// === Aggregated Snapshot ===
export interface SpaceWeatherSnapshot {
  timestamp: string;
  fetchedAt: string;

  // Geomagnetic
  kp: number; // 0-9
  kpForecast24h: number[];
  gScale: GScale | null;

  // Solar
  xrayFlux: number | null; // W/m²
  latestFlare: SolarFlare | null;
  sScale: SScale | null;
  rScale: RScale | null;

  // Solar Wind (L1)
  solarWind: SolarWind | null;
  magneticField: MagneticField | null;

  // Events
  recentCMEs: CME[];
  earthDirectedCMEs: CME[];
  recentFlares: SolarFlare[];
  recentStorms: GeomagneticStorm[];
  recentSEP: SEPEvent[];
  recentHSS: HighSpeedStream[];
  recentIPS: InterplanetaryShock[];
  recentMPC: MagnetopauseCrossing[];

  // Alerts
  activeAlerts: NOAAAlert[];

  // 3-day forecast (raw text)
  forecast3Day: string | null;
}

// === Alert Thresholds ===
export interface AlertThresholds {
  kpMin: number; // Default: 5 (G1 storm)
  bzMax: number; // Default: -10 (strong southward)
  solarWindSpeedMin: number; // Default: 600 km/s
  flareClassMin: string; // Default: "X1.0"
}

// === Cache Metadata ===
export interface CacheEntry<T> {
  data: T;
  fetchedAt: string;
  expiresAt: string;
}

// === Active Solar Region (from SWPC solar_regions.json) ===
export interface ActiveRegion {
  regionNumber: number;
  observedDate: string;
  latitude: number;
  longitude: number;
  location: string; // e.g., "N13W13"
  area: number | null; // millionths of solar hemisphere
  spotClass: string | null; // e.g., "Cso", "Hrx"
  magneticClass: string | null; // e.g., "A", "B", "BG", "BGD"
  numberSpots: number | null;
  flareProb_C: number; // 0-100 percent
  flareProb_M: number; // 0-100 percent
  flareProb_X: number; // 0-100 percent
  protonProb: number; // 0-100 percent
  firstDate: string | null;
}

// === Notification System Types ===

export type AlertUrgency = 'critical' | 'high' | 'moderate' | 'info';

export interface SpaceWeatherAlert {
  id: string; // Deterministic ID for dedup: `${type}-${key}`
  type: string; // e.g., 'cme-earth', 'flare-x', 'kp-threshold', 'all-clear'
  urgency: AlertUrgency;
  title: string; // Short headline
  body: string; // 1-2 sentence detail with impact context
  timestamp: string; // ISO string when alert was generated
  sourceEventId?: string; // Link to DONKI/SWPC event ID
}

export interface DataHealthEntry {
  source: string; // e.g., 'swpc-kp', 'donki-cme', 'swpc-regions'
  ok: boolean;
  lastSuccess: string; // ISO timestamp
  lastError?: string;
}

// Stored CME forecast fields for revision detection
export interface KnownCME {
  id: string;
  predictedKp: number | null;
  predictedArrival: string | null;
}

export interface CheckerState {
  schemaVersion: number; // Currently 1
  lastRunAt: string;

  // Previous metric values (for threshold-crossing detection)
  lastKp: number;
  lastBz: number;
  lastWindSpeed: number;
  lastWindDensity: number;

  // Flags for which thresholds were previously crossed (for "all clear" detection)
  kpWasAbove5: boolean;
  kpWasAbove7: boolean;
  bzWasBelow10: boolean;
  bzWasBelow15: boolean;
  windWasAbove600: boolean;
  windWasAbove700: boolean;
  densityWasAbove20: boolean;

  // Known event IDs (prevent re-alerting)
  knownCMEs: KnownCME[]; // With forecast fields for revision detection
  knownFlareIds: string[];
  knownHSSIds: string[];
  knownRegionNumbers: number[];
  knownAlertProductIds: string[];

  // Cooldown tracking: last time each alert type was sent
  lastCooldowns: Record<string, string>; // alertType -> ISO timestamp

  // Data health per source
  dataHealth: DataHealthEntry[];

  // Alert history (last 100)
  alertsSent: SpaceWeatherAlert[];
}
