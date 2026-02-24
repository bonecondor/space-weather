// Notification dispatch — desktop (osascript) + Signal (signal-cli)

import { execSync } from 'child_process';
import type { SpaceWeatherAlert, AlertUrgency } from '../lib/types';
import { CONFIG } from './config';

// === Desktop Notification via osascript ===

export function sendDesktopNotification(alert: SpaceWeatherAlert): void {
  const urgencyPrefix: Record<AlertUrgency, string> = {
    critical: '🔴 CRITICAL',
    high: '🟠 ',
    moderate: '',
    info: '',
  };
  const prefix = urgencyPrefix[alert.urgency];
  const title = prefix ? `${prefix}${alert.title}` : alert.title;

  // Different sounds by urgency
  const sound: Record<AlertUrgency, string> = {
    critical: 'Sosumi',
    high: 'Submarine',
    moderate: 'Pop',
    info: 'Tink',
  };

  const script = `display notification "${escapeOsa(alert.body)}" with title "${escapeOsa(title)}" subtitle "Space Weather" sound name "${sound[alert.urgency]}"`;
  try {
    execSync(`osascript -e '${script}'`, { timeout: 5000, stdio: 'pipe' });
  } catch (e) {
    console.error('Desktop notification failed:', e instanceof Error ? e.message : e);
  }
}

// === Signal Message via signal-cli ===

export function sendSignalMessage(alert: SpaceWeatherAlert): void {
  const account = process.env.SIGNAL_ACCOUNT;
  const recipient = process.env.SIGNAL_RECIPIENT;

  if (!account || !recipient) {
    console.warn('Signal not configured (SIGNAL_ACCOUNT / SIGNAL_RECIPIENT not set). Skipping.');
    return;
  }

  const urgencyEmoji: Record<AlertUrgency, string> = {
    critical: '🔴',
    high: '🟠',
    moderate: '🟡',
    info: '🔵',
  };

  const message = `${urgencyEmoji[alert.urgency]} ${alert.title}\n${alert.body}`;

  try {
    execSync(
      `${CONFIG.signalCli} -a ${account} send -m ${escapeShellArg(message)} ${recipient}`,
      { timeout: 30000, stdio: 'pipe' }
    );
  } catch (e) {
    console.error('Signal notification failed:', e instanceof Error ? e.message : e);
  }
}

// === Dispatch Alert by Urgency ===

export function dispatchAlert(alert: SpaceWeatherAlert): void {
  // Check quiet hours (non-critical only)
  if (alert.urgency !== 'critical' && isQuietHours()) {
    console.log(`  [QUIET] Suppressed ${alert.urgency} alert: ${alert.title}`);
    return;
  }

  const channels = CONFIG.channels[alert.urgency];

  for (const channel of channels) {
    switch (channel) {
      case 'signal':
        sendSignalMessage(alert);
        break;
      case 'desktop':
        sendDesktopNotification(alert);
        break;
    }
  }
}

// === Batch Info Alerts ===

export function dispatchAlerts(alerts: SpaceWeatherAlert[]): void {
  const infoAlerts = alerts.filter((a) => a.urgency === 'info');
  const otherAlerts = alerts.filter((a) => a.urgency !== 'info');

  // Dispatch non-info alerts individually
  for (const alert of otherAlerts) {
    dispatchAlert(alert);
  }

  // Batch info alerts into a single notification
  if (infoAlerts.length === 1) {
    dispatchAlert(infoAlerts[0]);
  } else if (infoAlerts.length > 1) {
    dispatchAlert({
      id: `info-batch-${Date.now()}`,
      type: 'info-batch',
      urgency: 'info',
      title: `${infoAlerts.length} Space Weather Updates`,
      body: infoAlerts.map((a) => a.title).join(' · '),
      timestamp: new Date().toISOString(),
    });
  }
}

// === Quiet Hours Check ===

function isQuietHours(): boolean {
  if (!CONFIG.quietHours.enabled) return false;

  const hour = new Date().getHours();
  const { start, end } = CONFIG.quietHours;

  // Handle overnight ranges (e.g., 23-7)
  if (start > end) {
    return hour >= start || hour < end;
  }
  return hour >= start && hour < end;
}

// === Escaping ===

function escapeOsa(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeShellArg(s: string): string {
  // Use single quotes with escaped single quotes
  return `'${s.replace(/'/g, "'\\''")}'`;
}
