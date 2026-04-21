// ─── Subscription & Usage Tracking ────────────────────────────────────
// Hybrid approach: client-side cache + server-side enforcement
// The server is the source of truth; client caches for fast UI checks.
import { apiFetch } from './apiFetch';
const USAGE_KEY = (userId: string) => `ts_daily_usage_${userId}`;
const SUB_KEY = (userId: string) => `ts_subscription_${userId}`;

// Track current user so non-user-aware functions can get the key
let _currentUserId = '';
// Pre-initialize from localStorage so canUseFeature works immediately on tab reopen
// before onAuthStateChange fires
try {
  const cachedUser = localStorage.getItem('trendsense_user');
  if (cachedUser) {
    const parsed = JSON.parse(cachedUser);
    if (parsed?.id) _currentUserId = parsed.id;
  }
} catch { /* ignore */ }
export function setCurrentUser(userId: string): void { _currentUserId = userId; }
export function clearUsageCache(): void {
  if (_currentUserId) {
    localStorage.removeItem(USAGE_KEY(_currentUserId));
    localStorage.removeItem(SUB_KEY(_currentUserId));
  }
  _currentUserId = '';
}

export type PlanTier = 'free' | 'pro';

export interface Subscription {
  tier: PlanTier;
  status: string;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
}

interface DailyUsage {
  date: string;
  scripts: number;
  narrations: number;
  videoGenerations: number;
}

export const FREE_LIMITS: Record<string, number> = {
  scripts: 3,
  narrations: 3,
  videoGenerations: 1,
};

export const PRO_PRICE = '₹33/mo';
export const PRO_PRICE_ORIGINAL = '₹99/mo';
export const PRO_FEATURES = [
  'Unlimited script exports',
  'Unlimited video generation & download',
  'Unlimited audio downloads',
  'All creator formats',
  'Priority AI (no rate limits)',
  'Premium video styles (coming soon)',
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Client-side cache (fast UI checks) ────────────────────────────────

function getCachedUsage(): DailyUsage {
  if (!_currentUserId) return { date: today(), scripts: 0, narrations: 0, videoGenerations: 0 };
  try {
    const raw = localStorage.getItem(USAGE_KEY(_currentUserId));
    if (raw) {
      const usage = JSON.parse(raw) as DailyUsage;
      if (usage.date === today()) return usage;
    }
  } catch { /* ignore */ }
  return { date: today(), scripts: 0, narrations: 0, videoGenerations: 0 };
}

function saveCachedUsage(usage: DailyUsage): void {
  if (!_currentUserId) return;
  localStorage.setItem(USAGE_KEY(_currentUserId), JSON.stringify(usage));
}

function getCachedSubscription(): Subscription {
  if (!_currentUserId) return { tier: 'free', status: 'active', trialEnd: null, currentPeriodEnd: null };
  try {
    const raw = localStorage.getItem(SUB_KEY(_currentUserId));
    if (raw) return JSON.parse(raw) as Subscription;
  } catch { /* ignore */ }
  return { tier: 'free', status: 'active', trialEnd: null, currentPeriodEnd: null };
}

function saveCachedSubscription(sub: Subscription): void {
  if (!_currentUserId) return;
  localStorage.setItem(SUB_KEY(_currentUserId), JSON.stringify(sub));
}

// ─── Server sync ───────────────────────────────────────────────────────

export interface ServerUsageSnapshot {
  usage: { scripts: number; narrations: number; videoGenerations: number };
  isPro: boolean;
}

export async function syncUsageFromServer(_userId: string): Promise<ServerUsageSnapshot | null> {
  try {
    const res = await apiFetch('/api/usage');
    if (!res.ok) return null;
    const data = await res.json();

    const isPro = !!data.isPro;

    if (data.subscription) {
      saveCachedSubscription({
        tier: isPro ? 'pro' : 'free',
        status: data.subscription.status || 'active',
        trialEnd: data.subscription.trial_end || null,
        currentPeriodEnd: data.subscription.current_period_end || null,
      });
    }

    const usage = {
      scripts: data.usage?.scripts || 0,
      narrations: data.usage?.narrations || 0,
      videoGenerations: data.usage?.video_generations || 0,
    };

    saveCachedUsage({ date: today(), ...usage });

    return { usage, isPro };
  } catch {
    return null;
  }
}

// ─── Public API (used by components) ───────────────────────────────────

export function getSubscription(): Subscription {
  return getCachedSubscription();
}

export function isPro(): boolean {
  const sub = getCachedSubscription();
  return sub.tier === 'pro' && (sub.status === 'active' || sub.status === 'trialing');
}

export type UsageType = 'scripts' | 'narrations' | 'videoGenerations';

export function canUseFeature(type: UsageType): { allowed: boolean; used: number; limit: number } {
  if (isPro()) return { allowed: true, used: 0, limit: Infinity };
  const usage = getCachedUsage();
  const limit = FREE_LIMITS[type] || 5;
  return { allowed: usage[type] < limit, used: usage[type], limit };
}

export function trackUsage(type: UsageType): void {
  if (isPro()) return;
  const usage = getCachedUsage();
  usage[type]++;
  saveCachedUsage(usage);
}

/**
 * Primary usage gate: checks server-side limit, then updates local cache.
 * Throws if server rejects (limit reached). Call this instead of trackUsage()
 * for server-enforced features.
 */
export async function trackUsageWithServer(userId: string, type: UsageType): Promise<void> {
  if (isPro()) return;
  // Enforce on server FIRST (source of truth), then update local cache
  await trackUsageOnServer(userId, type);
  // Only increment local if server accepted
  trackUsage(type);
}

export async function trackUsageOnServer(_userId: string, type: string): Promise<void> {
  const serverType = type === 'videoGenerations' ? 'video_generations' : type;
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await apiFetch('/api/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: serverType }),
      });

      if (res.status === 403) {
        const data = await res.json();
        throw new Error(`Daily limit reached: ${data.used}/${data.limit} ${type}`);
      }

      if (res.ok) return; // success

      // 4xx (non-403) → don't retry
      if (res.status >= 400 && res.status < 500) return;

      // 5xx → retry with backoff
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    } catch (err: any) {
      if (err.message?.includes('Daily limit')) throw err;
      // Network error → retry
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }
  }
  // All attempts exhausted due to network — silently continue (local cache is still updated)
}

export async function startCheckout(_userId: string, email: string): Promise<string | null> {
  try {
    const res = await apiFetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  } catch {
    return null;
  }
}

export function getDailyUsage(): DailyUsage {
  return getCachedUsage();
}
