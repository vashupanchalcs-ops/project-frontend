const defaultBase = import.meta.env.DEV
  ? 'http://127.0.0.1:8000'
  : 'https://swiftrescue-backend.onrender.com';
export const BASE = (import.meta.env.VITE_API_BASE_URL || defaultBase).replace(/\/+$/, '');

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
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    signal,
  };
  if (body) opts.body = typeof body === 'string' ? body : JSON.stringify(body);

  const p = fetch(BASE + endpoint, opts).then(async r => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((data && data.error) || ('API error ' + r.status));
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
  const ping = () => fetch(BASE + '/api/health/', { method: 'GET', cache: 'no-store' }).catch(() => {});
  ping();
  _kTimer = setInterval(ping, 10 * 60 * 1000);
}
export function stopKeepalive() {
  if (_kTimer) { clearInterval(_kTimer); _kTimer = null; }
}
