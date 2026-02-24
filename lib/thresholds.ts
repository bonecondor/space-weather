// Alert thresholds and status color logic

export const THRESHOLDS = {
  kp: {
    quiet: 3,
    elevated: 4,
    minor: 5, // G1
    moderate: 6, // G2
    strong: 7, // G3
    severe: 8, // G4
    extreme: 9, // G5
  },
  bz: {
    neutral: 0,
    mild: -5,
    moderate: -10,
    strong: -20,
  },
  solarWind: {
    quiet: 400,
    elevated: 500,
    high: 600,
    extreme: 800,
  },
  density: {
    quiet: 10,
    elevated: 15,
    high: 20,
    extreme: 40,
  },
} as const;

export type StatusLevel = 'quiet' | 'elevated' | 'minor' | 'moderate' | 'strong' | 'severe' | 'extreme';

export function getKpStatus(kp: number): StatusLevel {
  if (kp >= 9) return 'extreme';
  if (kp >= 8) return 'severe';
  if (kp >= 7) return 'strong';
  if (kp >= 6) return 'moderate';
  if (kp >= 5) return 'minor';
  if (kp >= 4) return 'elevated';
  return 'quiet';
}

export function getBzStatus(bz: number): StatusLevel {
  if (bz <= -20) return 'severe';
  if (bz <= -10) return 'moderate';
  if (bz <= -5) return 'elevated';
  return 'quiet';
}

export function getSolarWindStatus(speed: number): StatusLevel {
  if (speed >= 800) return 'severe';
  if (speed >= 600) return 'moderate';
  if (speed >= 500) return 'elevated';
  return 'quiet';
}

export function getDensityStatus(density: number): StatusLevel {
  if (density >= 40) return 'severe';
  if (density >= 20) return 'moderate';
  if (density >= 15) return 'elevated';
  return 'quiet';
}

export function getFlareStatus(classType: string | null): StatusLevel {
  if (!classType) return 'quiet';
  if (classType.startsWith('X')) return 'severe';
  if (classType.startsWith('M')) return 'moderate';
  if (classType.startsWith('C')) return 'elevated';
  return 'quiet';
}

// Color mapping for status levels
export const STATUS_COLORS: Record<StatusLevel, { bg: string; text: string; dot: string }> = {
  quiet: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  elevated: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  minor: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  moderate: { bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-400' },
  strong: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  severe: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  extreme: { bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-400' },
};

export const STATUS_LABELS: Record<StatusLevel, string> = {
  quiet: 'Quiet',
  elevated: 'Elevated',
  minor: 'Minor Storm',
  moderate: 'Moderate',
  strong: 'Strong',
  severe: 'Severe',
  extreme: 'Extreme',
};
