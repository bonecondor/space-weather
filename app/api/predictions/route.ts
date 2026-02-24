import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  loadPredictions,
  savePredictions,
  isWithinCooldown,
  computeScorecard,
  type Prediction,
} from '@/lib/predictions';

function isAuthorized(request: Request): boolean {
  const token = process.env.PREDICT_TOKEN;
  if (!token) return true; // No token configured = open (local dev)
  const auth = request.headers.get('Authorization');
  return auth === `Bearer ${token}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : null;

  const state = await loadPredictions();

  // Check cooldown
  if (isWithinCooldown(state)) {
    const last = state.predictions[state.predictions.length - 1];
    const cooldownEnds = new Date(
      new Date(last.timestamp).getTime() + state.config.cooldownHours * 60 * 60 * 1000
    );
    return NextResponse.json(
      {
        error: 'cooldown',
        message: `Too soon — wait until ${cooldownEnds.toLocaleTimeString()}`,
        cooldownEnds: cooldownEnds.toISOString(),
      },
      { status: 429 }
    );
  }

  const now = new Date();
  const windowEnd = new Date(
    now.getTime() + state.config.verificationWindowHours * 60 * 60 * 1000
  );

  const prediction: Prediction = {
    id: randomUUID(),
    timestamp: now.toISOString(),
    note: note || null,
    status: 'pending',
    verifiedAt: null,
    windowHours: state.config.verificationWindowHours,
    windowEnd: windowEnd.toISOString(),
    matchedEvents: [],
  };

  state.predictions.push(prediction);
  await savePredictions(state);

  return NextResponse.json({ ok: true, prediction });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = await loadPredictions();
  const scorecard = computeScorecard(state);

  return NextResponse.json({
    predictions: state.predictions.slice().reverse(),
    scorecard,
    config: {
      verificationWindowHours: state.config.verificationWindowHours,
      cooldownHours: state.config.cooldownHours,
      baseRate: state.config.baseRate,
      baseRateComputedAt: state.config.baseRateComputedAt,
    },
  });
}
