-- TrendSense Migration 004 — updated_at triggers
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ── Helper function ──────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── profiles ─────────────────────────────────────────────────────────────
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── subscriptions ────────────────────────────────────────────────────────
drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ── usage_tracking — add updated_at if missing ───────────────────────────
alter table public.usage_tracking
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_usage_updated_at on public.usage_tracking;
create trigger set_usage_updated_at
  before update on public.usage_tracking
  for each row execute function public.set_updated_at();

-- ── creator_scripts — add updated_at if missing ──────────────────────────
alter table public.creator_scripts
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_creator_scripts_updated_at on public.creator_scripts;
create trigger set_creator_scripts_updated_at
  before update on public.creator_scripts
  for each row execute function public.set_updated_at();
