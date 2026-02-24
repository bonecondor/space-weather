// NOAA Space Weather Prediction Center (SWPC) Client
// Free, no API key required
// Docs: https://www.swpc.noaa.gov/products-and-data

import type { SolarWind, MagneticField, NOAAAlert, GScale, ActiveRegion } from './types';

const BASE_URL = 'https://services.swpc.noaa.gov';

// === Planetary K-index ===
// Returns array of [timestamp, Kp, a_running, station_count]
type KpEntry = [string, string, string, string];

export async function fetchKpIndex(): Promise<{ current: number; recent: number[] }> {
  const url = `${BASE_URL}/products/noaa-planetary-k-index.json`;

  const response = await fetch(url, { next: { revalidate: 900 } }); // 15 min cache
  if (!response.ok) {
    throw new Error(`SWPC Kp fetch failed: ${response.status}`);
  }

  const data: KpEntry[] = await response.json();

  // Skip header row, parse Kp values
  const kpValues = data.slice(1).map((entry) => parseFloat(entry[1])).filter((v) => !isNaN(v));

  return {
    current: kpValues[kpValues.length - 1] || 0,
    recent: kpValues.slice(-8), // Last 8 readings (24 hours at 3-hour intervals)
  };
}

// === Solar Wind Plasma (Speed, Density, Temperature) ===
// Returns array of [timestamp, density, speed, temperature]
type PlasmaEntry = [string, string, string, string];

export async function fetchSolarWindPlasma(): Promise<SolarWind | null> {
  const url = `${BASE_URL}/products/solar-wind/plasma-7-day.json`;

  const response = await fetch(url, { next: { revalidate: 300 } }); // 5 min cache
  if (!response.ok) {
    throw new Error(`SWPC plasma fetch failed: ${response.status}`);
  }

  const data: PlasmaEntry[] = await response.json();

  // Get most recent valid entry
  for (let i = data.length - 1; i > 0; i--) {
    const entry = data[i];
    const density = parseFloat(entry[1]);
    const speed = parseFloat(entry[2]);
    const temp = parseFloat(entry[3]);

    if (!isNaN(speed) && !isNaN(density)) {
      return {
        timestamp: entry[0],
        speed,
        density,
        temperature: isNaN(temp) ? 0 : temp,
      };
    }
  }

  return null;
}

// === Magnetic Field (Bx, By, Bz, Bt) ===
// Returns array of [timestamp, bx_gsm, by_gsm, bz_gsm, lon_gsm, lat_gsm, bt]
type MagEntry = [string, string, string, string, string, string, string];

export async function fetchMagneticField(): Promise<MagneticField | null> {
  const url = `${BASE_URL}/products/solar-wind/mag-7-day.json`;

  const response = await fetch(url, { next: { revalidate: 300 } }); // 5 min cache
  if (!response.ok) {
    throw new Error(`SWPC mag fetch failed: ${response.status}`);
  }

  const data: MagEntry[] = await response.json();

  // Get most recent valid entry
  for (let i = data.length - 1; i > 0; i--) {
    const entry = data[i];
    const bx = parseFloat(entry[1]);
    const by = parseFloat(entry[2]);
    const bz = parseFloat(entry[3]);
    const bt = parseFloat(entry[6]);

    if (!isNaN(bz) && !isNaN(bt)) {
      return {
        timestamp: entry[0],
        bx: isNaN(bx) ? 0 : bx,
        by: isNaN(by) ? 0 : by,
        bz,
        bt,
      };
    }
  }

  return null;
}

// === NOAA Alerts ===
interface NOAAAlertRaw {
  product_id: string;
  issue_datetime: string;
  message: string;
}

export async function fetchAlerts(): Promise<NOAAAlert[]> {
  const url = `${BASE_URL}/products/alerts.json`;

  const response = await fetch(url, { next: { revalidate: 300 } }); // 5 min cache
  if (!response.ok) {
    throw new Error(`SWPC alerts fetch failed: ${response.status}`);
  }

  const data: NOAAAlertRaw[] = await response.json();

  // Filter to recent alerts (last 24 hours)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  return data
    .filter((alert) => new Date(alert.issue_datetime) > oneDayAgo)
    .map((alert) => ({
      productId: alert.product_id,
      issueTime: alert.issue_datetime,
      message: alert.message,
    }));
}

// === 3-Day Forecast ===
export async function fetch3DayForecast(): Promise<string | null> {
  const url = `${BASE_URL}/text/3-day-forecast.txt`;

  const response = await fetch(url, { next: { revalidate: 3600 } }); // 1 hour cache
  if (!response.ok) {
    throw new Error(`SWPC forecast fetch failed: ${response.status}`);
  }

  return response.text();
}

// === X-ray Flux (GOES satellite) ===
// Returns array of [timestamp, short_flux, long_flux]
type XrayEntry = [string, string, string];

export async function fetchXrayFlux(): Promise<{ flux: number; flareClass: string } | null> {
  const url = `${BASE_URL}/json/goes/primary/xrays-7-day.json`;

  const response = await fetch(url, { next: { revalidate: 300 } }); // 5 min cache
  if (!response.ok) {
    // Fallback to older endpoint format
    return null;
  }

  const data: XrayEntry[] = await response.json();

  // Get most recent valid entry (using long wavelength flux)
  for (let i = data.length - 1; i > 0; i--) {
    const entry = data[i];
    const flux = parseFloat(entry[2]); // long wavelength (1-8 Angstrom)

    if (!isNaN(flux) && flux > 0) {
      return {
        flux,
        flareClass: fluxToClass(flux),
      };
    }
  }

  return null;
}

// Convert X-ray flux to flare class
function fluxToClass(flux: number): string {
  if (flux >= 1e-4) return `X${(flux / 1e-4).toFixed(1)}`;
  if (flux >= 1e-5) return `M${(flux / 1e-5).toFixed(1)}`;
  if (flux >= 1e-6) return `C${(flux / 1e-6).toFixed(1)}`;
  if (flux >= 1e-7) return `B${(flux / 1e-7).toFixed(1)}`;
  return `A${(flux / 1e-8).toFixed(1)}`;
}

// === Active Solar Regions ===
interface SolarRegionRaw {
  observed_date: string;
  region: number;
  latitude: number;
  longitude: number;
  location: string;
  area: number | null;
  spot_class: string | null;
  mag_class: string | null;
  number_spots: number | null;
  c_flare_probability: number;
  m_flare_probability: number;
  x_flare_probability: number;
  proton_probability: number;
  first_date: string | null;
}

export async function fetchActiveRegions(): Promise<ActiveRegion[]> {
  const url = `${BASE_URL}/json/solar_regions.json`;

  const response = await fetch(url, { next: { revalidate: 3600 } }); // 1 hour cache
  if (!response.ok) {
    throw new Error(`SWPC solar regions fetch failed: ${response.status}`);
  }

  const data: SolarRegionRaw[] = await response.json();

  // Filter to today's observations only (API returns historical data)
  const today = new Date().toISOString().split('T')[0];
  const todayRegions = data.filter((r) => r.observed_date === today);

  return todayRegions.map((r) => ({
    regionNumber: r.region,
    observedDate: r.observed_date,
    latitude: r.latitude,
    longitude: r.longitude,
    location: r.location || '',
    area: r.area,
    spotClass: r.spot_class,
    magneticClass: r.mag_class,
    numberSpots: r.number_spots,
    flareProb_C: r.c_flare_probability || 0,
    flareProb_M: r.m_flare_probability || 0,
    flareProb_X: r.x_flare_probability || 0,
    protonProb: r.proton_probability || 0,
    firstDate: r.first_date,
  }));
}

// === Real-time Solar Wind (1-day, 1-minute resolution) ===
export async function fetchRealtimeWind(): Promise<SolarWind | null> {
  const url = `${BASE_URL}/products/solar-wind/plasma-1-day.json`;

  const response = await fetch(url, { next: { revalidate: 60 } }); // 1 min cache
  if (!response.ok) {
    throw new Error(`SWPC realtime plasma fetch failed: ${response.status}`);
  }

  const data: PlasmaEntry[] = await response.json();

  // Get most recent valid entry
  for (let i = data.length - 1; i > 0; i--) {
    const entry = data[i];
    const density = parseFloat(entry[1]);
    const speed = parseFloat(entry[2]);
    const temp = parseFloat(entry[3]);

    if (!isNaN(speed) && !isNaN(density)) {
      return {
        timestamp: entry[0],
        speed,
        density,
        temperature: isNaN(temp) ? 0 : temp,
      };
    }
  }

  return null;
}

// === Real-time Magnetic Field (1-day, 1-minute resolution) ===
export async function fetchRealtimeMag(): Promise<MagneticField | null> {
  const url = `${BASE_URL}/products/solar-wind/mag-1-day.json`;

  const response = await fetch(url, { next: { revalidate: 60 } }); // 1 min cache
  if (!response.ok) {
    throw new Error(`SWPC realtime mag fetch failed: ${response.status}`);
  }

  const data: MagEntry[] = await response.json();

  // Get most recent valid entry
  for (let i = data.length - 1; i > 0; i--) {
    const entry = data[i];
    const bx = parseFloat(entry[1]);
    const by = parseFloat(entry[2]);
    const bz = parseFloat(entry[3]);
    const bt = parseFloat(entry[6]);

    if (!isNaN(bz) && !isNaN(bt)) {
      return {
        timestamp: entry[0],
        bx: isNaN(bx) ? 0 : bx,
        by: isNaN(by) ? 0 : by,
        bz,
        bt,
      };
    }
  }

  return null;
}

// === G-Scale from Kp ===
export function kpToGScale(kp: number): GScale {
  if (kp >= 9) return 'G5';
  if (kp >= 8) return 'G4';
  if (kp >= 7) return 'G3';
  if (kp >= 6) return 'G2';
  if (kp >= 5) return 'G1';
  return 'G0';
}

// === Fetch All SWPC Data ===
export async function fetchAllSWPC() {
  const [kp, plasma, mag, alerts, forecast, xray] = await Promise.all([
    fetchKpIndex(),
    fetchSolarWindPlasma(),
    fetchMagneticField(),
    fetchAlerts(),
    fetch3DayForecast(),
    fetchXrayFlux(),
  ]);

  return {
    kp: kp.current,
    kpForecast24h: kp.recent,
    gScale: kpToGScale(kp.current),
    solarWind: plasma,
    magneticField: mag,
    xrayFlux: xray?.flux || null,
    currentFlareClass: xray?.flareClass || null,
    alerts,
    forecast3Day: forecast,
  };
}
