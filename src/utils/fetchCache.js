/**
 * fetchCache.js — Universal API Cache (Stale-While-Revalidate)
 * Installed in main.jsx → covers ALL pages across all 5 portals automatically.
 *
 * Strategy:
 *  1. ALL /api/ GET requests are cached
 *  2. If cache exists → return cached data INSTANTLY (0 ms)
 *  3. Revalidate in background → update cache silently
 *  4. Mutations (POST/PUT/PATCH/DELETE) & auth routes bypass cache
 */

const MEM = new Map();

// TTL per endpoint pattern (in milliseconds)
const TTL_MAP = {
  '/api/hospitals':   300_000,   // 5 min — hospital data rarely changes
  '/api/ambulances':  120_000,   // 2 min
  '/api/bookings':     60_000,   // 1 min
  '/api/staff':        90_000,   // 90 s
  '/api/driver':       60_000,   // 1 min
  '/api/admin':       120_000,   // 2 min
  DEFAULT:             90_000,   // 90 s default for all other /api/ routes
};

// Endpoints to NEVER cache (auth, mutations, password resets)
const NEVER_CACHE = [
  '/api/auth/',
  '/api/login',
  '/api/logout',
  '/api/signup',
  '/api/register',
  '/api/password',
  '/api/token',
];

function getUrlString(input) {
  if (typeof input === 'string') return input;
  if (input && typeof input.url === 'string') return input.url;
  return String(input || '');
}

function isCacheable(input) {
  const u = getUrlString(input);
  if (!u.includes('/api/')) return false;
  return !NEVER_CACHE.some((p) => u.includes(p));
}

function getTTL(input) {
  const u = getUrlString(input);
  for (const [k, v] of Object.entries(TTL_MAP)) {
    if (k !== 'DEFAULT' && u.includes(k)) return v;
  }
  return TTL_MAP.DEFAULT;
}

/** Standardize cache key to pathname + search so different hostnames/origins share the exact same cache */
function cacheKey(input) {
  const raw = getUrlString(input);
  try {
    const url = new URL(raw, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return raw;
  }
}

function readMem(key) {
  const entry = MEM.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) {
    MEM.delete(key);
    return null;
  }
  return entry;
}

function readStorage(key) {
  try {
    // 1. Direct fetchCache entry
    const raw = sessionStorage.getItem('sr_fc_' + key);
    if (raw) {
      const entry = JSON.parse(raw);
      if (Date.now() - entry.ts <= entry.ttl) return entry;
    }

    // 2. Cross-compatibility with legacy keys so existing session data is immediately available
    if (key.startsWith('/api/ambulances')) {
      const legacy = sessionStorage.getItem('ambulances_list_cache') || sessionStorage.getItem('sr_admin_fleet');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        const data = parsed?.data ?? parsed;
        if (Array.isArray(data) && data.length) return { data, ts: Date.now(), ttl: 120_000 };
      }
    }
    if (key.startsWith('/api/hospitals')) {
      const legacy = sessionStorage.getItem('hospitals_list_cache') || sessionStorage.getItem('sr_hospitals_list');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        const data = parsed?.data ?? parsed;
        if (Array.isArray(data) && data.length) return { data, ts: Date.now(), ttl: 300_000 };
      }
    }
    if (key.startsWith('/api/bookings')) {
      const legacy = sessionStorage.getItem('admin_bookings') || sessionStorage.getItem('admin_requests_cache') || sessionStorage.getItem('my_bookings_cache');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        const data = parsed?.data ?? parsed;
        if (Array.isArray(data) && data.length) return { data, ts: Date.now(), ttl: 60_000 };
      }
    }
  } catch {}
  return null;
}

function writeCache(key, data, ttl) {
  if (data === null || data === undefined) return;
  const entry = { data, ts: Date.now(), ttl };
  MEM.set(key, entry);
  try {
    sessionStorage.setItem('sr_fc_' + key, JSON.stringify(entry));

    // Also populate legacy storage keys for screens that read them directly
    if (key === '/api/ambulances/' && Array.isArray(data)) {
      sessionStorage.setItem('ambulances_list_cache', JSON.stringify(data));
      sessionStorage.setItem('sr_admin_fleet', JSON.stringify(entry));
    }
    if (key === '/api/hospitals/' && Array.isArray(data)) {
      sessionStorage.setItem('hospitals_list_cache', JSON.stringify(data));
      sessionStorage.setItem('sr_hospitals_list', JSON.stringify(entry));
    }
    if (key === '/api/bookings/' && Array.isArray(data)) {
      sessionStorage.setItem('admin_bookings', JSON.stringify(data));
      sessionStorage.setItem('admin_requests_cache', JSON.stringify(data));
      sessionStorage.setItem('sr_admin_bookings', JSON.stringify(entry));
    }
  } catch {}
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
    const method = (
      options?.method ||
      (input instanceof Request ? input.method : 'GET') ||
      'GET'
    ).toUpperCase();

    // Mutations & explicit no-store always bypass cache
    const requestCache = options?.cache || (input instanceof Request ? input.cache : 'default');
    if (method !== 'GET' || requestCache === 'no-store' || !isCacheable(input)) {
      return original(input, options);
    }

    const key = cacheKey(input);
    const ttl = getTTL(input);

    // 1. Memory cache → 0 ms response
    const memEntry = readMem(key);
    if (memEntry) {
      // Background revalidate if past half-life
      if (Date.now() - memEntry.ts > ttl * 0.5) {
        original(input, options)
          .then(async (r) => {
            if (r.ok) {
              const fresh = await r.clone().json().catch(() => null);
              if (fresh !== null) writeCache(key, fresh, ttl);
            }
          })
          .catch(() => {});
      }
      return makeFakeResponse(memEntry.data);
    }

    // 2. sessionStorage cache → instant across page navigations
    const stored = readStorage(key);
    if (stored) {
      MEM.set(key, stored); // promote to memory
      original(input, options)
        .then(async (r) => {
          if (r.ok) {
            const fresh = await r.clone().json().catch(() => null);
            if (fresh !== null) writeCache(key, fresh, ttl);
          }
        })
        .catch(() => {});
      return makeFakeResponse(stored.data);
    }

    // 3. Cold fetch — populate cache for future navigations
    try {
      const response = await original(input, options);
      if (response.ok) {
        response
          .clone()
          .json()
          .then((data) => {
            if (data !== null) writeCache(key, data, ttl);
          })
          .catch(() => {});
      }
      return response;
    } catch (err) {
      // Network failure — return stale if available
      const stale = readStorage(key);
      if (stale) return makeFakeResponse(stale.data);
      throw err;
    }
  };
}

/**
 * readFetchCache(endpointOrUrl)
 * Read cached data for a specific API URL or pathname instantly — use in useState() initializer.
 * Returns cached data or undefined if not cached.
 *
 * Usage:
 *   const [items, setItems] = useState(() => readFetchCache('/api/ambulances/') ?? []);
 */
export function readFetchCache(endpointOrUrl) {
  try {
    const raw = getUrlString(endpointOrUrl);
    const url = new URL(raw, window.location.origin);
    const key = `${url.pathname}${url.search}`;

    // 1. Check memory
    const mem = MEM.get(key);
    if (mem && Date.now() - mem.ts < mem.ttl) return mem.data;

    // 2. Check storage
    const stored = readStorage(key);
    if (stored) {
      MEM.set(key, stored);
      return stored.data;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Invalidate cache for a URL pattern (call after mutations) */
export function invalidateCache(urlPattern) {
  for (const key of MEM.keys()) {
    if (key.includes(urlPattern)) MEM.delete(key);
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('sr_fc_') && k.includes(urlPattern)) {
        sessionStorage.removeItem(k);
      }
    }
  } catch {}
}
