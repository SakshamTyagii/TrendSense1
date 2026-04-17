// ─── Subscription & Usage Tracking ────────────────────────────────────
// Hybrid approach: client-side cache + server-side enforcement
// The server is the source of truth; client caches for fast UI checks.
import { apiFetch } from './apiFetch';
const USAGE_KEY = 'ts_daily_usage';
const SUB_KEY = 'ts_subscription';

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
  reelUploads: number;
  explanations: number;
}

export const FREE_LIMITS: Record<string, number> = {
  scripts: 5,
  narrations: 3,
  reelUploads: 2,
  explanations: 10,
};

export const PRO_PRICE = '₹33/mo';
export const PRO_PRICE_ORIGINAL = '₹99/mo';
export const PRO_FEATURES = [
  'Unlimited AI script generation',
  'Unlimited audio narrations',
  'Unlimited reel uploads',
  'All 4 content formats',
  'Full creator insights & analytics',
  'Priority AI (no rate limits)',
  'HD audio export',
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Client-side cache (fast UI checks) ────────────────────────────────

function getCachedUsage(): DailyUsage {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (raw) {
      const usage = JSON.parse(raw) as DailyUsage;
      if (usage.date === today()) return usage;
    }
  } catch { /* ignore */ }
  return { date: today(), scripts: 0, narrations: 0, reelUploads: 0, explanations: 0 };
}

function saveCachedUsage(usage: DailyUsage): void {
  localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
}

function getCachedSubscription(): Subscription {
  try {
    const raw = localStorage.getItem(SUB_KEY);
    if (raw) return JSON.parse(raw) as Subscription;
  } catch { /* ignore */ }
  return { tier: 'free', status: 'active', trialEnd: null, currentPeriodEnd: null };
}

function saveCachedSubscription(sub: Subscription): void {
  localStorage.setItem(SUB_KEY, JSON.stringify(sub));
}

// ─── Server sync ───────────────────────────────────────────────────────

export async function syncUsageFromServer(_userId: string): Promise<void> {
  try {
    const res = await apiFetch('/api/usage');
    if (!res.ok) return;
    const data = await res.json();
    
    if (data.subscription) {
      saveCachedSubscription({
        tier: data.isPro ? 'pro' : 'free',
        status: data.subscription.status || 'active',
        trialEnd: data.subscription.trial_end || null,
        currentPeriodEnd: data.subscription.current_period_end || null,
      });
    }
    
    if (data.usage) {
      saveCachedUsage({
        date: today(),
        scripts: data.usage.scripts || 0,
        narrations: data.usage.narrations || 0,
        reelUploads: data.usage.reel_uploads || 0,
        explanations: data.usage.explanations || 0,
      });
    }
  } catch { /* continue with cached data */ }
}

// ─── Public API (used by components) ───────────────────────────────────

export function getSubscription(): Subscription {
  return getCachedSubscription();
}

export function isPro(): boolean {
  const sub = getCachedSubscription();
  return sub.tier === 'pro' && (sub.status === 'active' || sub.status === 'trialing');
}

export type UsageType = 'scripts' | 'narrations' | 'reelUploads' | 'explanations';

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
  // Optimistically update local cache
  trackUsage(type);
  // Enforce on server (source of truth)
  await trackUsageOnServer(userId, type);
}

export async function trackUsageOnServer(_userId: string, type: string): Promise<void> {
  // Map client-side type names to server column names
  const serverType = type === 'reelUploads' ? 'reel_uploads' : type;
  try {
    const res = await apiFetch('/api/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: serverType }),
    });
    if (res.status === 403) {
      // Server says limit reached — update local cache
      const data = await res.json();
      throw new Error(`Daily limit reached: ${data.used}/${data.limit} ${type}`);
    }
  } catch (err: any) {
    if (err.message.includes('Daily limit')) throw err;
    // Network error — fall through, local cache already updated
  }
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
