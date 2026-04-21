-- TrendSense Migration 003 — Add video_generations column to usage_tracking
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

alter table public.usage_tracking
  add column if not exists video_generations integer not null default 0;
