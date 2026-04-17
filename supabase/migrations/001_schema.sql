-- TrendSense Production Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ──────────────────────────────────────────────────────────────
-- 1. Profiles (extends Supabase auth.users)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  avatar_url text not null default '',
  provider text not null default 'google',
  preferred_categories text[] not null default '{"tech","finance","entertainment"}',
  auto_play_audio boolean not null default false,
  dark_mode boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, avatar_url, provider)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''),
    coalesce(new.raw_app_meta_data->>'provider', 'google')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ──────────────────────────────────────────────────────────────
-- 2. Subscriptions
-- ──────────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  tier text not null default 'free' check (tier in ('free', 'pro')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  trial_end timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- ──────────────────────────────────────────────────────────────
-- 3. Usage Tracking (server-side)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.usage_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  scripts integer not null default 0,
  narrations integer not null default 0,
  reel_uploads integer not null default 0,
  explanations integer not null default 0,
  unique(user_id, usage_date)
);

-- ──────────────────────────────────────────────────────────────
-- 4. Reels (cloud-stored)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  news_id text not null,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  video_url text not null,
  thumbnail_url text not null default '',
  caption text not null default '',
  likes integer not null default 0,
  views integer not null default 0,
  duration integer not null default 30,
  created_at timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────
-- 5. Comments
-- ──────────────────────────────────────────────────────────────
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────
-- 6. Tips
-- ──────────────────────────────────────────────────────────────
create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  reel_id uuid references public.reels(id) on delete set null,
  amount_cents integer not null,
  stripe_payment_intent_id text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────
-- 7. Saved Stories & History
-- ──────────────────────────────────────────────────────────────
create table if not exists public.saved_stories (
  user_id uuid not null references public.profiles(id) on delete cascade,
  news_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, news_id)
);

create table if not exists public.user_history (
  user_id uuid not null references public.profiles(id) on delete cascade,
  news_id text not null,
  viewed_at timestamptz not null default now(),
  primary key (user_id, news_id)
);

-- ──────────────────────────────────────────────────────────────
-- 8. Row Level Security (RLS)
-- ──────────────────────────────────────────────────────────────

-- Profiles: users can read all, update own
alter table public.profiles enable row level security;
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Subscriptions: users can read own
alter table public.subscriptions enable row level security;
create policy "Users can view own subscription" on public.subscriptions for select using (auth.uid() = user_id);

-- Usage: users can read own, server can insert/update via service role
alter table public.usage_tracking enable row level security;
create policy "Users can view own usage" on public.usage_tracking for select using (auth.uid() = user_id);

-- Reels: everyone can read, creators can insert own
alter table public.reels enable row level security;
create policy "Reels are viewable by everyone" on public.reels for select using (true);
create policy "Users can insert own reels" on public.reels for insert with check (auth.uid() = creator_id);
create policy "Users can delete own reels" on public.reels for delete using (auth.uid() = creator_id);

-- Comments: everyone can read, users can insert own
alter table public.comments enable row level security;
create policy "Comments are viewable by everyone" on public.comments for select using (true);
create policy "Users can insert own comments" on public.comments for insert with check (auth.uid() = user_id);
create policy "Users can delete own comments" on public.comments for delete using (auth.uid() = user_id);

-- Tips: users can read own (sent or received)
alter table public.tips enable row level security;
create policy "Users can view own tips" on public.tips for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- Saved stories: users can manage own
alter table public.saved_stories enable row level security;
create policy "Users can manage own saved stories" on public.saved_stories for all using (auth.uid() = user_id);

-- History: users can manage own
alter table public.user_history enable row level security;
create policy "Users can manage own history" on public.user_history for all using (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 9. Storage Bucket for Reels
-- ──────────────────────────────────────────────────────────────
-- Run this separately in Supabase Dashboard → Storage → Create Bucket
-- Bucket name: reels
-- Public: true (for serving video URLs)
-- File size limit: 100MB
-- Allowed MIME types: video/mp4, video/webm, video/quicktime

-- Storage policy: authenticated users can upload to their own folder
-- insert into storage.objects: auth.uid()::text = (storage.foldername(name))[1]
