import { API_BASE_URL as BASE, apiRequest } from "../api/client";
export { BASE };

import { readCache, writeCache, isFresh, CACHE_TTL } from './dataCache.js';

const inflight = new Map();

/**
 * cache-first API fetch.
 * - Returns cached data immediately if available.
 * - If stale, refreshes in background (stale-while-revalidate).
 * - If no cache, awaits fresh fetch.
 */
export async function apiFetch(endpoint, {
  key, ttl, signal, method = 'GET', body, headers = {},
} = {}) {
  if (method === 'GET' && key) {
    const cached = readCache(key);
    if (cached !== undefined) {
      if (!isFresh(key)) {
        // revalidate in background
        _doFetch(endpoint, { key, ttl, method, headers }).catch(() => {});
      }
      return cached;
    }
    if (inflight.has(key)) return inflight.get(key);
  }
  return _doFetch(endpoint, { key, ttl, signal, method, body, headers });
}

async function _doFetch(endpoint, { key, ttl, signal, method = 'GET', body, headers = {} } = {}) {
  const p = apiRequest(endpoint, { method, body, headers, signal }).then(data => {
    if (key) writeCache(key, data, ttl || CACHE_TTL.DEFAULT);
    return data;
  }).finally(() => { if (key) inflight.delete(key); });

  if (method === 'GET' && key) inflight.set(key, p);
  return p;
}

/** Prefetch all critical data in parallel on app start */
export function prefetchAll() {
  Promise.all([
    apiFetch('/api/ambulances/', { key: 'ambulances', ttl: CACHE_TTL.ambulances }),
    apiFetch('/api/bookings/',   { key: 'bookings',   ttl: CACHE_TTL.bookings   }),
    apiFetch('/api/hospitals/',  { key: 'hospitals',  ttl: CACHE_TTL.hospitals  }),
  ]).catch(() => {});
}

let _kTimer = null;
/** Ping backend every 10 min to prevent Render cold start */
export function startKeepalive() {
  if (_kTimer) return;
  const ping = () => apiRequest('/api/health/', { method: 'GET' }).catch(() => {});
  ping();
  _kTimer = setInterval(ping, 10 * 60 * 1000);
}
export function stopKeepalive() {
  if (_kTimer) { clearInterval(_kTimer); _kTimer = null; }
}
