/**
 * TrendSense Hybrid Recommendation Engine
 *
 * score = interestMatch×0.30 + intentMatch×0.20 + engagementAffinity×0.20
 *       + sessionBoost×0.15 + trendScore×0.10 + freshness×0.05
 *       - negativeSignals×0.10
 *
 * Creator-mode (creatorIntent > 0.7): interestMatch→0.25, trendScore→0.15
 * Cold start (<20 events): interest→0.50, intent→0.30, engagement→0.10
 * Session boost capped at 0.3, negative signals capped at 0.05
 */

import type { NewsItem } from '../types';

// ── Types ────────────────────────────────────────────────────────────────

export interface IntentProfile {
  content_creation: number;
  entertainment: number;
  education: number;
  general: number;
}

export interface EngagementEvent {
  news_id: string;
  event_type: 'view' | 'dwell' | 'save' | 'share' | 'listen' | 'expand' | 'create' | 'skip' | 'unsave';
  value: number;
  category: string;
  created_at: string;
}

export interface UserProfile {
  interests: string[];
  intentProfile: IntentProfile;
  contentFormatPrefs: string[];
  onboardingCompleted: boolean;
}

// ── Event weights ────────────────────────────────────────────────────────

const EVENT_WEIGHTS: Record<string, number> = {
  create: 5, save: 4, share: 4, listen: 3, expand: 3,
  dwell: 2, view: 1, skip: -2, unsave: -1,
};

const DECAY_LAMBDA = 0.1; // exp(-0.1 * days) → ~50% at 7d, ~25% at 14d

// ── Scoring helpers ──────────────────────────────────────────────────────

function interestMatch(category: string, interests: string[]): number {
  return interests.includes(category) ? 1.0 : 0.3;
}

function intentMatch(category: string, intent: IntentProfile): number {
  const map: Record<string, keyof IntentProfile> = {
    tech: 'education', finance: 'education', science: 'education',
    health: 'education', education: 'education', business: 'education',
    politics: 'general', world: 'general',
    sports: 'entertainment', entertainment: 'entertainment',
  };
  return intent[map[category] || 'general'] ?? 0.5;
}

function freshness(publishedAt: string): number {
  const hoursOld = (Date.now() - new Date(publishedAt).getTime()) / 3_600_000;
  return Math.max(0, Math.min(1, 1 - hoursOld / 48));
}

function timeDecay(createdAt: string): number {
  const days = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  return Math.exp(-DECAY_LAMBDA * days);
}

export function computeCategoryAffinity(events: EngagementEvent[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const e of events) {
    if (!e.category) continue;
    let w = EVENT_WEIGHTS[e.event_type] ?? 0;
    if (e.event_type === 'dwell' && e.value <= 10) w = 0.5;
    scores[e.category] = (scores[e.category] || 0) + w * timeDecay(e.created_at);
  }
  const max = Math.max(...Object.values(scores), 1);
  for (const k of Object.keys(scores)) scores[k] /= max;
  return scores;
}

export function computeSessionBoost(recent: EngagementEvent[], maxN = 15): Record<string, number> {
  const last = recent.slice(0, maxN);
  const counts: Record<string, number> = {};
  let total = 0;
  for (const e of last) {
    if (!e.category || e.event_type === 'skip') continue;
    counts[e.category] = (counts[e.category] || 0) + 1;
    total++;
  }
  if (!total) return {};
  const boosts: Record<string, number> = {};
  for (const [cat, n] of Object.entries(counts)) {
    boosts[cat] = Math.min(n / total, 0.3); // CAPPED at 0.3
  }
  return boosts;
}

function computeNegativeSignals(events: EngagementEvent[]): Record<string, number> {
  const neg: Record<string, number> = {};
  for (const e of events) {
    if (!e.category) continue;
    if (e.event_type === 'skip' || e.event_type === 'unsave') {
      neg[e.category] = (neg[e.category] || 0) + Math.abs(EVENT_WEIGHTS[e.event_type] ?? 0) * timeDecay(e.created_at);
    }
  }
  const max = Math.max(...Object.values(neg), 1);
  for (const k of Object.keys(neg)) neg[k] = Math.min(neg[k] / max, 0.05); // CAPPED at 0.05
  return neg;
}

// ── Main ranking ─────────────────────────────────────────────────────────

export interface RankedItem {
  news: NewsItem;
  score: number;
  reason?: string;
}

export function rankFeed(
  news: NewsItem[],
  profile: UserProfile,
  engagementHistory: EngagementEvent[],
  sessionEvents: EngagementEvent[],
): RankedItem[] {
  const affinity = computeCategoryAffinity(engagementHistory);
  const session = computeSessionBoost(sessionEvents);
  const negative = computeNegativeSignals(engagementHistory);

  const cold = engagementHistory.length < 20;
  const creator = (profile.intentProfile.content_creation ?? 0) > 0.7;

  // Adaptive weights
  let W = { interest: 0.30, intent: 0.20, engagement: 0.20, session: 0.15, trend: 0.10, fresh: 0.05, neg: 0.10 };
  if (cold)                W = { interest: 0.50, intent: 0.30, engagement: 0.10, session: 0.05, trend: 0.03, fresh: 0.02, neg: 0.02 };
  if (creator && !cold)    W = { ...W, interest: 0.25, trend: 0.15 };

  const scored: RankedItem[] = news.map(item => {
    const c = item.category;
    const iM  = interestMatch(c, profile.interests);
    const inM = intentMatch(c, profile.intentProfile);
    const eA  = affinity[c] ?? (cold ? 0.5 : 0);
    const sB  = session[c] ?? 0;
    const tS  = (item.trendScore ?? 50) / 100;
    const fR  = freshness(item.publishedAt);
    const nS  = negative[c] ?? 0;

    const score = iM*W.interest + inM*W.intent + eA*W.engagement + sB*W.session + tS*W.trend + fR*W.fresh - nS*W.neg;

    let reason: string | undefined;
    if (iM === 1.0 && eA > 0.5) reason = `Because you like ${c}`;
    else if (sB > 0.15)          reason = 'Trending in your session';
    else if (tS > 0.8)           reason = 'Trending now';
    else if (iM === 1.0)         reason = 'Matches your interests';
    else                          reason = 'Explore something new';

    return { news: item, score, reason };
  });

  scored.sort((a, b) => b.score - a.score);

  // Probabilistic mixing: 70% personalized, 20% trending, 10% exploration
  const personalized = scored.filter(s => profile.interests.includes(s.news.category));
  const trending     = [...scored].sort((a, b) => (b.news.trendScore ?? 0) - (a.news.trendScore ?? 0));
  const exploration  = scored.filter(s => !profile.interests.includes(s.news.category));

  const final: RankedItem[] = [];
  let pI = 0, tI = 0, eI = 0;
  const seen = new Set<string>();

  for (let i = 0; i < news.length; i++) {
    const r = Math.random();
    let pick: RankedItem | undefined;

    if (r < 0.20 && tI < trending.length) {
      pick = trending[tI++];
      while (pick && seen.has(pick.news.id) && tI < trending.length) pick = trending[tI++];
      if (pick) pick = { ...pick, reason: 'Trending now' };
    } else if (r < 0.30 && eI < exploration.length) {
      pick = exploration[eI++];
      while (pick && seen.has(pick.news.id) && eI < exploration.length) pick = exploration[eI++];
      if (pick) pick = { ...pick, reason: 'Explore something new' };
    } else if (pI < personalized.length) {
      pick = personalized[pI++];
      while (pick && seen.has(pick.news.id) && pI < personalized.length) pick = personalized[pI++];
    }

    if (!pick || seen.has(pick.news.id)) pick = scored.find(s => !seen.has(s.news.id));
    if (pick && !seen.has(pick.news.id)) { seen.add(pick.news.id); final.push(pick); }
  }

  return final;
}
