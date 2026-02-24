import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { CheckerState } from '@/lib/types';

const STATE_PATH = join(process.cwd(), 'scripts', 'state', 'checker-state.json');

export async function GET() {
  try {
    if (!existsSync(STATE_PATH)) {
      return NextResponse.json({
        alerts: [],
        health: null,
        lastRun: null,
        checkerActive: false,
      });
    }

    const raw = readFileSync(STATE_PATH, 'utf-8');
    const state: CheckerState = JSON.parse(raw);

    return NextResponse.json({
      alerts: state.alertsSent.slice(-50).reverse(), // Last 50, newest first
      health: state.dataHealth,
      lastRun: state.lastRunAt,
      checkerActive: true,
      currentValues: {
        kp: state.lastKp,
        bz: state.lastBz,
        windSpeed: state.lastWindSpeed,
        windDensity: state.lastWindDensity,
      },
    });
  } catch (error) {
    console.error('Failed to read checker state:', error);
    return NextResponse.json(
      { error: 'Failed to read checker state' },
      { status: 500 }
    );
  }
}
