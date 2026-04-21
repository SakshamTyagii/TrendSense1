-- TrendSense Migration 002 — Creator Scripts
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

create table if not exists public.creator_scripts (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  news_id text not null,
  hook text not null default '',
  setup text not null default '',
  points text[] not null default '{}',
  twist text not null default '',
  cta text not null default '',
  full_script text not null default '',
  format text not null default 'youtube-short',
  duration text not null default '',
  viral_title text not null default '',
  description text not null default '',
  tags text[] not null default '{}',
  thumbnail_text text not null default '',
  thumbnail_idea text not null default '',
  image_prompt text not null default '',
  created_at timestamptz not null default now()
);

alter table public.creator_scripts enable row level security;

create policy "Users can manage own scripts" on public.creator_scripts
  for all using (auth.uid() = user_id);

create index if not exists creator_scripts_user_id_idx on public.creator_scripts(user_id);
create index if not exists creator_scripts_created_at_idx on public.creator_scripts(created_at desc);
