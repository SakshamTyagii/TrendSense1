import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './_auth';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const FREE_LIMITS: Record<string, number> = {
  scripts: 3,
  narrations: 3,
  video_generations: 1,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify JWT
  const authUserId = await authenticateRequest(req, res);
  if (!authUserId) return;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ─── GET: check usage + subscription status ───────────────────────
  if (req.method === 'GET') {
    // Use the authenticated user's ID (ignore query param)
    const userId = authUserId;

    const today = new Date().toISOString().slice(0, 10);

    // Get subscription
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier, status, trial_end, current_period_end')
      .eq('user_id', userId)
      .single();

    const isPro = sub?.tier === 'pro' && (sub.status === 'active' || sub.status === 'trialing');

    // Get today's usage
    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('scripts, narrations, video_generations')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single();

    const currentUsage = usage || { scripts: 0, narrations: 0, video_generations: 0 };

    return res.status(200).json({
      isPro,
      subscription: sub || { tier: 'free', status: 'active' },
      usage: currentUsage,
      limits: isPro ? null : FREE_LIMITS,
    });
  }

  // ─── POST: track usage (increment) ───────────────────────────────
  if (req.method === 'POST') {
    const { type } = req.body || {};
    const userId = authUserId;
    if (!type) return res.status(400).json({ error: 'Missing type' });

    const validTypes = ['scripts', 'narrations', 'video_generations'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be: ${validTypes.join(', ')}` });
    }

    const today = new Date().toISOString().slice(0, 10);

    // Check subscription first
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', userId)
      .single();

    const isPro = sub?.tier === 'pro' && (sub.status === 'active' || sub.status === 'trialing');

    // Get or create today's usage row
    const { data: existing } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single();

    if (!existing) {
      // Create new row for today
      await supabase.from('usage_tracking').insert({
        user_id: userId,
        usage_date: today,
        [type]: 1,
      });
    } else {
      const currentCount = existing[type] || 0;
      const limit = FREE_LIMITS[type];

      // Enforce limit for free users
      if (!isPro && currentCount >= limit) {
        return res.status(403).json({
          error: 'Daily limit reached',
          used: currentCount,
          limit,
          type,
        });
      }

      // Increment
      await supabase
        .from('usage_tracking')
        .update({ [type]: currentCount + 1 })
        .eq('user_id', userId)
        .eq('usage_date', today);
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
