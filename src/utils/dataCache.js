const memCache = new Map();

export const CACHE_TTL = {
  bookings:    30000,   // 30s
  ambulances:  20000,   // 20s
  hospitals:  120000,   // 2 min
  analytics:   60000,   // 1 min
  DEFAULT:     45000,   // 45s
};

export function readCache(key) {
  const mem = memCache.get(key);
  if (mem) return mem.data;
  try {
    const raw = sessionStorage.getItem('sr_' + key);
    if (raw) {
      const parsed = JSON.parse(raw);
      memCache.set(key, { data: parsed.data, ts: parsed.ts, ttl: parsed.ttl || CACHE_TTL.DEFAULT });
      return parsed.data;
    }
  } catch {}
  return undefined;
}

export function writeCache(key, data, ttl = CACHE_TTL.DEFAULT) {
  const entry = { data, ts: Date.now(), ttl };
  memCache.set(key, entry);
  try { sessionStorage.setItem('sr_' + key, JSON.stringify(entry)); } catch {}
  return data;
}

export function isFresh(key) {
  const mem = memCache.get(key);
  if (!mem) return false;
  return (Date.now() - mem.ts) < mem.ttl;
}

export function clearCache(key) {
  memCache.delete(key);
  try { sessionStorage.removeItem('sr_' + key); } catch {}
}

// Backward compat aliases
export const readDataCache  = (key, fallback) => { const v = readCache(key); return v !== undefined ? v : fallback; };
export const writeDataCache = writeCache;
export const clearDataCache = clearCache;

export async function fetchFreshJson(url, { key, signal, fallback, ttl, cache = "default", headers } = {}) {
  const response = await fetch(url, { signal, cache, headers });
  const payload = await response.json().catch(() => fallback);
  if (!response.ok) throw new Error((payload && payload.error) || ('Request failed (' + response.status + ')'));
  if (key) writeCache(key, payload, ttl || CACHE_TTL.DEFAULT);
  return payload;
}
