// NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information) Client
// Docs: https://api.nasa.gov/

import type {
  CME,
  SolarFlare,
  GeomagneticStorm,
  SEPEvent,
  HighSpeedStream,
  InterplanetaryShock,
  MagnetopauseCrossing,
  GScale,
} from './types';

const BASE_URL = 'https://api.nasa.gov/DONKI';

function getApiKey(): string {
  return process.env.NASA_API_KEY || 'DEMO_KEY';
}

function getDateRange(daysBack: number = 7): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

async function fetchDONKI<T>(endpoint: string, daysBack: number = 7): Promise<T[]> {
  const { startDate, endDate } = getDateRange(daysBack);
  const url = `${BASE_URL}/${endpoint}?startDate=${startDate}&endDate=${endDate}&api_key=${getApiKey()}`;

  const response = await fetch(url, { next: { revalidate: 14400 } }); // 4 hour cache

  if (!response.ok) {
    if (response.status === 429) {
      console.error('DONKI rate limit exceeded');
      return [];
    }
    throw new Error(`DONKI ${endpoint} failed: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

// === CME ===
interface DONKICMERaw {
  activityID: string;
  startTime: string;
  sourceLocation: string | null;
  activeRegionNum: number | null;
  note: string;
  cmeAnalyses?: Array<{
    speed: number | null;
    halfAngle: number | null;
    isMostAccurate: boolean;
    enlilList?: Array<{
      estimatedShockArrivalTime: string | null;
      kp_18: number | null;
      kp_90: number | null;
      kp_135: number | null;
      kp_180: number | null;
      isEarthGB: boolean;
    }>;
  }>;
}

export async function fetchCMEs(daysBack: number = 7): Promise<CME[]> {
  const raw = await fetchDONKI<DONKICMERaw>('CME', daysBack);

  return raw.map((cme) => {
    // Get the most accurate analysis if available
    const analysis = cme.cmeAnalyses?.find((a) => a.isMostAccurate) || cme.cmeAnalyses?.[0];
    const enlil = analysis?.enlilList?.find((e) => e.isEarthGB);

    // Check multiple indicators for Earth-directed CMEs:
    // 1. ENLIL model says Earth-directed
    // 2. "halo" in the note (full halo CMEs are often Earth-directed)
    // 3. Half-angle > 60 degrees (wide CMEs more likely to hit Earth)
    // 4. Note mentions "Earth" or "geomagnetic"
    const noteLC = (cme.note || '').toLowerCase();
    const isHalo = noteLC.includes('halo');
    const mentionsEarth = noteLC.includes('earth') || noteLC.includes('geomagnetic') || noteLC.includes('geoeffective');
    const isWide = (analysis?.halfAngle || 0) > 60;
    const hasEnlilEarth = !!enlil?.isEarthGB;

    const isEarthDirected = hasEnlilEarth || isHalo || mentionsEarth || isWide;

    return {
      id: cme.activityID,
      activityID: cme.activityID,
      startTime: cme.startTime,
      sourceLocation: cme.sourceLocation,
      activeRegionNum: cme.activeRegionNum,
      speed: analysis?.speed || null,
      halfAngle: analysis?.halfAngle || null,
      isEarthDirected,
      predictedArrival: enlil?.estimatedShockArrivalTime || null,
      predictedKp: enlil ? Math.max(
        enlil.kp_18 || 0,
        enlil.kp_90 || 0,
        enlil.kp_135 || 0,
        enlil.kp_180 || 0
      ) : null,
      note: cme.note || null,
    };
  });
}

// === Solar Flares ===
interface DONKIFlareRaw {
  flrID: string;
  beginTime: string;
  peakTime: string | null;
  endTime: string | null;
  classType: string;
  sourceLocation: string | null;
  activeRegionNum: number | null;
}

export async function fetchFlares(daysBack: number = 7): Promise<SolarFlare[]> {
  const raw = await fetchDONKI<DONKIFlareRaw>('FLR', daysBack);

  return raw.map((flare) => ({
    id: flare.flrID,
    beginTime: flare.beginTime,
    peakTime: flare.peakTime,
    endTime: flare.endTime,
    classType: flare.classType,
    sourceLocation: flare.sourceLocation,
    activeRegionNum: flare.activeRegionNum,
  }));
}

// === Geomagnetic Storms ===
interface DONKIGSTRaw {
  gstID: string;
  startTime: string;
  allKpIndex: Array<{
    observedTime: string;
    kpIndex: number;
    source: string;
  }>;
}

function kpToGScale(kp: number): GScale {
  if (kp >= 9) return 'G5';
  if (kp >= 8) return 'G4';
  if (kp >= 7) return 'G3';
  if (kp >= 6) return 'G2';
  if (kp >= 5) return 'G1';
  return 'G0';
}

export async function fetchGeomagneticStorms(daysBack: number = 7): Promise<GeomagneticStorm[]> {
  const raw = await fetchDONKI<DONKIGSTRaw>('GST', daysBack);

  return raw.map((storm) => {
    const maxKp = Math.max(...storm.allKpIndex.map((k) => k.kpIndex), 0);
    return {
      id: storm.gstID,
      startTime: storm.startTime,
      kpIndex: maxKp,
      gScale: kpToGScale(maxKp),
    };
  });
}

// === Solar Energetic Particles ===
interface DONKISEPRaw {
  sepID: string;
  eventTime: string;
  instruments: Array<{ displayName: string }>;
}

export async function fetchSEP(daysBack: number = 7): Promise<SEPEvent[]> {
  const raw = await fetchDONKI<DONKISEPRaw>('SEP', daysBack);

  return raw.map((sep) => ({
    id: sep.sepID,
    eventTime: sep.eventTime,
    instruments: sep.instruments?.map((i) => i.displayName) || [],
  }));
}

// === High Speed Streams ===
interface DONKIHSSRaw {
  hssID: string;
  eventTime: string;
  instruments: Array<{ displayName: string }>;
}

export async function fetchHSS(daysBack: number = 7): Promise<HighSpeedStream[]> {
  const raw = await fetchDONKI<DONKIHSSRaw>('HSS', daysBack);

  return raw.map((hss) => ({
    id: hss.hssID,
    eventTime: hss.eventTime,
    instruments: hss.instruments?.map((i) => i.displayName) || [],
  }));
}

// === Interplanetary Shocks ===
interface DONKIIPSRaw {
  activityID: string;
  eventTime: string;
  location: string | null;
  instruments: Array<{ displayName: string }>;
}

export async function fetchIPS(daysBack: number = 7): Promise<InterplanetaryShock[]> {
  const raw = await fetchDONKI<DONKIIPSRaw>('IPS', daysBack);

  return raw.map((ips) => ({
    id: ips.activityID,
    eventTime: ips.eventTime,
    location: ips.location,
    instruments: ips.instruments?.map((i) => i.displayName) || [],
  }));
}

// === Magnetopause Crossings ===
interface DONKIMPCRaw {
  mpcID: string;
  eventTime: string;
  instruments: Array<{ displayName: string }>;
}

export async function fetchMPC(daysBack: number = 7): Promise<MagnetopauseCrossing[]> {
  const raw = await fetchDONKI<DONKIMPCRaw>('MPC', daysBack);

  return raw.map((mpc) => ({
    id: mpc.mpcID,
    eventTime: mpc.eventTime,
    instruments: mpc.instruments?.map((i) => i.displayName) || [],
  }));
}

// === Fetch All DONKI Data ===
export async function fetchAllDONKI(daysBack: number = 7) {
  const [cmes, flares, storms, sep, hss, ips, mpc] = await Promise.all([
    fetchCMEs(daysBack),
    fetchFlares(daysBack),
    fetchGeomagneticStorms(daysBack),
    fetchSEP(daysBack),
    fetchHSS(daysBack),
    fetchIPS(daysBack),
    fetchMPC(daysBack),
  ]);

  return {
    cmes,
    earthDirectedCMEs: cmes.filter((c) => c.isEarthDirected),
    flares,
    storms,
    sep,
    hss,
    ips,
    mpc,
  };
}
