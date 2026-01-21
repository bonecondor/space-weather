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
