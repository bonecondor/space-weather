'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface MatchedEvent {
  type: string;
  description: string;
  timestamp: string;
}

interface PredictionItem {
  id: string;
  timestamp: string;
  note: string | null;
  status: 'pending' | 'hit' | 'miss';
  verifiedAt: string | null;
  matchedEvents: MatchedEvent[];
}

interface ScorecardData {
  totalPredictions: number;
  pending: number;
  hits: number;
  misses: number;
  hitRate: number | null;
  baseRate: number | null;
  pValue: number | null;
  totalDaysTracked: number;
}

interface ApiResponse {
  predictions: PredictionItem[];
  scorecard: ScorecardData;
  config: {
    verificationWindowHours: number;
    baseRate: number | null;
    baseRateComputedAt: string | null;
  };
}

export default function ScorecardPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/predictions')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen p-6 max-w-2xl mx-auto">
        <div className="text-gray-500">Loading...</div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen p-6 max-w-2xl mx-auto">
        <div className="text-gray-500">No prediction data available yet.</div>
        <Link href="/predict" className="text-purple-400 text-sm mt-4 inline-block">
          Make your first prediction
        </Link>
      </main>
    );
  }

  const { scorecard, predictions, config } = data;
  const verified = scorecard.hits + scorecard.misses;

  return (
    <main className="min-h-screen p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-200">Solar Sense Scorecard</h1>
        <Link
          href="/predict"
          className="text-sm text-purple-500/60 hover:text-purple-400 transition-colors"
        >
          Log prediction
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Predictions" value={scorecard.totalPredictions.toString()} />
        <StatBox
          label="Hits"
          value={scorecard.hits.toString()}
          color="text-emerald-400"
        />
        <StatBox
          label="Misses"
          value={scorecard.misses.toString()}
          color="text-red-400"
        />
        <StatBox
          label="Hit Rate"
          value={
            scorecard.hitRate !== null
              ? `${(scorecard.hitRate * 100).toFixed(0)}%`
              : '—'
          }
          color={
            scorecard.hitRate !== null && scorecard.baseRate !== null
              ? scorecard.hitRate > scorecard.baseRate
                ? 'text-emerald-400'
                : 'text-gray-400'
              : 'text-gray-400'
          }
        />
      </div>

      {scorecard.pending > 0 && (
        <div className="text-xs text-gray-600">
          {scorecard.pending} prediction{scorecard.pending > 1 ? 's' : ''} still pending
        </div>
      )}

      {/* Base rate comparison */}
      {scorecard.baseRate !== null && verified > 0 && (
        <div className="rounded-lg p-4 bg-gray-800/50 border border-white/5 space-y-2">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
            vs. Chance
          </h2>
          <div className="flex items-baseline gap-4">
            <div>
              <span className="text-2xl font-semibold text-gray-200">
                {scorecard.hitRate !== null
                  ? `${(scorecard.hitRate * 100).toFixed(0)}%`
                  : '—'}
              </span>
              <span className="text-xs text-gray-500 ml-1">her rate</span>
            </div>
            <span className="text-gray-600">vs</span>
            <div>
              <span className="text-2xl font-semibold text-gray-400">
                {(scorecard.baseRate * 100).toFixed(0)}%
              </span>
              <span className="text-xs text-gray-500 ml-1">base rate</span>
            </div>
          </div>

          {scorecard.hitRate !== null && (
            <div className="text-sm text-gray-500">
              {scorecard.hitRate > scorecard.baseRate
                ? `${((scorecard.hitRate - scorecard.baseRate) * 100).toFixed(0)} points above chance`
                : scorecard.hitRate < scorecard.baseRate
                  ? `${((scorecard.baseRate - scorecard.hitRate) * 100).toFixed(0)} points below chance`
                  : 'Exactly at chance level'}
            </div>
          )}

          {scorecard.pValue !== null && (
            <div className="text-xs text-gray-600">
              p-value: {scorecard.pValue < 0.001 ? '<0.001' : scorecard.pValue.toFixed(3)}
              {scorecard.pValue < 0.05
                ? ' (statistically significant)'
                : ' (not yet significant)'}
            </div>
          )}

          <div className="text-[11px] text-gray-700 mt-2">
            Base rate: {(scorecard.baseRate * 100).toFixed(1)}% of random{' '}
            {config.verificationWindowHours}h windows had significant activity (from 2yr DONKI
            history). Note: events cluster around 27-day solar rotation — not fully independent.
          </div>
        </div>
      )}

      {/* Prediction timeline */}
      {predictions.length > 0 && (
        <div className="rounded-lg p-4 bg-gray-800/50 border border-white/5">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
            Timeline
          </h2>
          <div className="space-y-3">
            {predictions.slice(0, 30).map((p) => (
              <PredictionRow key={p.id} prediction={p} />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-gray-700 text-center pt-4">
        Tracking since{' '}
        {predictions.length > 0
          ? new Date(
              predictions[predictions.length - 1].timestamp
            ).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
          : '—'}
        {' · '}{scorecard.totalDaysTracked} days
      </div>
    </main>
  );
}

function StatBox({
  label,
  value,
  color = 'text-gray-200',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg p-3 bg-gray-800/50 border border-white/5 text-center">
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function PredictionRow({ prediction }: { prediction: PredictionItem }) {
  const date = new Date(prediction.timestamp).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const statusConfig = {
    pending: { dot: 'bg-gray-500', label: 'Pending' },
    hit: { dot: 'bg-emerald-400', label: 'Hit' },
    miss: { dot: 'bg-red-400', label: 'Miss' },
  }[prediction.status];

  return (
    <div className="flex items-start gap-3 py-1 border-b border-white/5 last:border-0">
      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusConfig.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-300">{date}</span>
          <span className="text-xs text-gray-600">{statusConfig.label}</span>
        </div>
        {prediction.note && (
          <div className="text-xs text-gray-500 mt-0.5 truncate">{prediction.note}</div>
        )}
        {prediction.matchedEvents.length > 0 && (
          <div className="text-xs text-emerald-500/70 mt-0.5">
            {prediction.matchedEvents.map((e) => e.description).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}
