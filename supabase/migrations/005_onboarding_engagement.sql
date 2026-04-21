-- TrendSense Migration 005 — Onboarding + Engagement Tracking
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ── Extend profiles with onboarding fields ───────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intent_profile jsonb NOT NULL DEFAULT '{"content_creation":0,"entertainment":0,"education":0,"general":0.5}',
  ADD COLUMN IF NOT EXISTS content_format_prefs text[] NOT NULL DEFAULT '{}';

-- ── Engagement tracking table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_engagement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  news_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('view','dwell','save','share','listen','expand','create','skip','unsave')),
  value numeric NOT NULL DEFAULT 1,
  category text,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast ranking queries
CREATE INDEX IF NOT EXISTS idx_engagement_user_time
  ON public.user_engagement (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_engagement_user_type
  ON public.user_engagement (user_id, event_type);

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.user_engagement ENABLE ROW LEVEL SECURITY;

-- Users can insert their own engagement events
CREATE POLICY "Users insert own engagement"
  ON public.user_engagement FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own engagement events
CREATE POLICY "Users read own engagement"
  ON public.user_engagement FOR SELECT
  USING (auth.uid() = user_id);
