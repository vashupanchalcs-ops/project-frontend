/**
 * fetchCache.js
 * Transparent GET cache for all API calls.
 * Installed in main.jsx — every page and card benefits automatically.
 *
 * Strategy: stale-while-revalidate
 * - If cache exists → return cached data IMMEDIATELY as a Response
 * - Simultaneously fetch fresh data in background → update cache
 * - Eliminates loading delays across the entire project
 */

const MEM = new Map();

const TTL = {
  '/api/bookings/':   25_000,   // 25 s
  '/api/ambulances/': 15_000,   // 15 s
  '/api/hospitals/': 120_000,   // 2 min
  '/api/hospitals':  120_000,
  DEFAULT:            30_000,
};

const CACHEABLE = [
  '/api/bookings',
  '/api/ambulances',
  '/api/hospitals',
  '/api/admin/live-locations',
  '/api/driver/active-route',
  '/api/driver/notifications',
  '/api/staff/dashboard',
  '/api/staff/notifications',
];

function getUrlString(input) {
  if (typeof input === 'string') return input;
  if (input && typeof input.url === 'string') return input.url;
  return String(input || '');
}

function isCacheable(input) {
  const u = getUrlString(input);
  return CACHEABLE.some(p => u.includes(p));
}

function getTTL(input) {
  const u = getUrlString(input);
  for (const [k, v] of Object.entries(TTL)) {
    if (u.includes(k)) return v;
  }
  return TTL.DEFAULT;
}

function cacheKey(input) {
  return getUrlString(input).split('?')[0];
}

function readMem(key) {
  const entry = MEM.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) { MEM.delete(key); return null; }
  return entry;
}

function readStorage(key) {
  try {
    const raw = sessionStorage.getItem('sr_fc_' + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.ts > entry.ttl) { sessionStorage.removeItem('sr_fc_' + key); return null; }
    return entry;
  } catch { return null; }
}

function writeCache(key, data, ttl) {
  if (!data) return;
  const entry = { data, ts: Date.now(), ttl };
  MEM.set(key, entry);
  try { sessionStorage.setItem('sr_fc_' + key, JSON.stringify(entry)); } catch {}
}

function makeFakeResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
  });
}

export function installFetchCache() {
  if (window.__fetchCacheInstalled) return;
  window.__fetchCacheInstalled = true;

  const original = window.fetch.bind(window);

  window.fetch = async function cachedFetch(input, options = {}) {
    const method = (options?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();

    // Only intercept cacheable GET requests
    if (method !== 'GET' || !isCacheable(input)) {
      return original(input, options);
    }

    const key = cacheKey(input);
    const ttl = getTTL(input);

    // 1. Check memory cache (fastest - 0ms response)
    const memEntry = readMem(key);
    if (memEntry) {
      // Revalidate in background if close to expiry
      const age = Date.now() - memEntry.ts;
      if (age > ttl * 0.5) {
        original(input, options).then(async r => {
          if (r.ok) {
            const fresh = await r.clone().json().catch(() => null);
            if (fresh !== null) writeCache(key, fresh, ttl);
          }
        }).catch(() => {});
      }
      return makeFakeResponse(memEntry.data);
    }

    // 2. Check sessionStorage (instant response across page navigations)
    const stored = readStorage(key);
    if (stored) {
      MEM.set(key, stored); // promote to memory
      // Revalidate in background
      original(input, options).then(async r => {
        if (r.ok) {
          const fresh = await r.clone().json().catch(() => null);
          if (fresh !== null) writeCache(key, fresh, ttl);
        }
      }).catch(() => {});
      return makeFakeResponse(stored.data);
    }

    // 3. No cache — perform real fetch and populate cache
    try {
      const response = await original(input, options);
      if (response.ok) {
        const clone = response.clone();
        clone.json().then(data => {
          if (data !== null) writeCache(key, data, ttl);
        }).catch(() => {});
      }
      return response;
    } catch (err) {
      // If network fails (or cold start timeout), return stale if we have it
      if (stored) return makeFakeResponse(stored.data);
      throw err;
    }
  };
}

// Invalidate specific cache (after booking/driver mutation)
export function invalidateCache(urlPattern) {
  for (const key of MEM.keys()) {
    if (key.includes(urlPattern)) MEM.delete(key);
  }
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('sr_fc_') && k.includes(urlPattern)) {
        sessionStorage.removeItem(k);
        i--;
      }
    }
  } catch {}
}
