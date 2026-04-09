// localStorage-based AI response cache — avoids redundant API calls
// Keyed by article URL (stable across sessions, unlike generated IDs)

const CACHE_PREFIX = 'ts_ai_';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_ENTRIES = 200;

type CacheType = 'explanation' | 'narration' | 'script' | 'insights';

interface CacheEntry<T> {
  data: T;
  ts: number;
}

function storageKey(type: CacheType): string {
  return `${CACHE_PREFIX}${type}`;
}

function hashKey(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return String(h);
}

function loadCache<T>(type: CacheType): Record<string, CacheEntry<T>> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(type)) || '{}');
  } catch {
    return {};
  }
}

function saveCache<T>(type: CacheType, cache: Record<string, CacheEntry<T>>): void {
  const now = Date.now();
  const entries = Object.entries(cache)
    .filter(([, v]) => now - v.ts < TTL_MS)
    .sort((a, b) => b[1].ts - a[1].ts)
    .slice(0, MAX_ENTRIES);
  localStorage.setItem(storageKey(type), JSON.stringify(Object.fromEntries(entries)));
}

export function getCached<T>(type: CacheType, key: string): T | null {
  const cache = loadCache<T>(type);
  const h = hashKey(key);
  const entry = cache[h];
  if (entry && Date.now() - entry.ts < TTL_MS) {
    return entry.data;
  }
  return null;
}

export function setCache<T>(type: CacheType, key: string, data: T): void {
  const cache = loadCache<T>(type);
  cache[hashKey(key)] = { data, ts: Date.now() };
  saveCache(type, cache);
}
