'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ScorecardSummary {
  hits: number;
  misses: number;
  pending: number;
  hitRate: number | null;
}

export default function PredictPage() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'cooldown' | 'error'>('idle');
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [cooldownMessage, setCooldownMessage] = useState('');
  const [scorecard, setScorecard] = useState<ScorecardSummary | null>(null);
  const [lastPrediction, setLastPrediction] = useState<string | null>(null);

  // Fetch existing data on mount
  useEffect(() => {
    fetch('/api/predictions')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setScorecard({
          hits: data.scorecard.hits,
          misses: data.scorecard.misses,
          pending: data.scorecard.pending,
          hitRate: data.scorecard.hitRate,
        });
        if (data.predictions.length > 0) {
          setLastPrediction(data.predictions[0].timestamp);
        }
      })
      .catch(() => {});
  }, []);

  const handlePredict = useCallback(async () => {
    if (status === 'submitting') return;
    setStatus('submitting');

    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note || undefined }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setCooldownMessage(data.message || 'Too soon — wait a bit');
        setStatus('cooldown');
        setTimeout(() => setStatus('idle'), 4000);
        return;
      }

      if (!res.ok) throw new Error('Failed');

      setStatus('success');
      setNote('');
      setShowNote(false);
      setLastPrediction(new Date().toISOString());
      setTimeout(() => setStatus('idle'), 3000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }, [note, status]);

  const buttonText = {
    idle: 'I Sense Something',
    submitting: 'Logging...',
    success: 'Logged',
    cooldown: 'Too Soon',
    error: 'Failed — Try Again',
  }[status];

  const buttonBg = {
    idle: 'bg-purple-600/20 border-purple-500/40 hover:bg-purple-500/30 active:bg-purple-500/40',
    submitting: 'bg-purple-600/10 border-purple-500/20',
    success: 'bg-emerald-600/20 border-emerald-500/40',
    cooldown: 'bg-yellow-600/20 border-yellow-500/40',
    error: 'bg-red-600/20 border-red-500/40',
  }[status];

  const buttonTextColor = {
    idle: 'text-purple-300',
    submitting: 'text-purple-400/50',
    success: 'text-emerald-300',
    cooldown: 'text-yellow-300',
    error: 'text-red-300',
  }[status];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 max-w-sm mx-auto">
      {/* Title */}
      <h1 className="text-lg font-medium text-gray-400 tracking-wide mb-12">
        Solar Sense
      </h1>

      {/* Big button */}
      <button
        onClick={handlePredict}
        disabled={status === 'submitting'}
        className={`w-48 h-48 rounded-2xl border-2 transition-all duration-300 ${buttonBg} ${buttonTextColor} text-lg font-semibold select-none`}
      >
        {buttonText}
      </button>

      {/* Status message */}
      <div className="h-8 mt-4 text-center">
        {status === 'success' && (
          <span className="text-sm text-emerald-400/80">
            Checking the next 48 hours...
          </span>
        )}
        {status === 'cooldown' && (
          <span className="text-sm text-yellow-400/80">{cooldownMessage}</span>
        )}
      </div>

      {/* Note field (collapsed by default) */}
      <div className="mt-2 w-full">
        {showNote ? (
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="headache, people acting weird..."
            maxLength={200}
            className="w-full bg-gray-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500/40"
          />
        ) : (
          <button
            onClick={() => setShowNote(true)}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            + add a note
          </button>
        )}
      </div>

      {/* Score summary */}
      <div className="mt-12 text-center space-y-2">
        {scorecard && (scorecard.hits + scorecard.misses) > 0 && (
          <div className="text-sm text-gray-500">
            Record:{' '}
            <span className="text-gray-300">
              {scorecard.hits}/{scorecard.hits + scorecard.misses} hits
            </span>
            {scorecard.hitRate !== null && (
              <span className="text-gray-400">
                {' '}({(scorecard.hitRate * 100).toFixed(0)}%)
              </span>
            )}
          </div>
        )}
        {scorecard && scorecard.pending > 0 && (
          <div className="text-xs text-gray-600">
            {scorecard.pending} pending
          </div>
        )}
        {lastPrediction && (
          <div className="text-xs text-gray-600">
            Last: {formatRelative(lastPrediction)}
          </div>
        )}
        <Link
          href="/scorecard"
          className="inline-block text-xs text-purple-500/60 hover:text-purple-400 transition-colors mt-1"
        >
          View scorecard
        </Link>
      </div>
    </main>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
