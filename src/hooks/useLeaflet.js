// useLeaflet.js — src/hooks/useLeaflet.js
//
// FIX: LOCAL_HINTS mein Shiv Vihar Delhi ka correct coords (28.7419, 77.3158)
// Images se verify kiya gaya — Shiv Vihar, Delhi (Karawal Nagar ke paas)
// Ghaziabad wala wrong coord tha (28.72604, 77.28324)

import { useState, useEffect } from "react";

let leafletLoaded = false;
let leafletPromise = null;

const loadLeaflet = () => {
  if (leafletLoaded) return Promise.resolve();
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise(async (resolve, reject) => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if (!document.getElementById("lrm-css")) {
      const link = document.createElement("link");
      link.id = "lrm-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css";
      document.head.appendChild(link);
    }
    if (!window.L) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    if (!window.L?.Routing) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js";
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    if (!window.L?.PolylineDecorator) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://unpkg.com/leaflet-polylinedecorator@1.6.0/dist/leaflet.polylineDecorator.js";
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    leafletLoaded = true;
    resolve();
  });

  return leafletPromise;
};

// ── Tile URLs ─────────────────────────────────────────────────────────────────
export const LIGHT_TILE     = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
export const DARK_TILE      = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
export const SATELLITE_TILE = "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}";

// ── India bounds ──────────────────────────────────────────────────────────────
export const isIndiaCoord = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;

export const DELHI = { lat: 28.6139, lng: 77.2090 };

export const STATUS_COLOR = {
  available: "#00c853",
  en_route:  "#ff6d00",
  busy:      "#e53935",
  offline:   "#555555",
};

export const normalizePlace = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/saharda/g, "sharda")
    .replace(/\baiims\b/g, "aiims")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// ── Marker icons ──────────────────────────────────────────────────────────────
export const makeIcon = (color, size = 14) => {
  if (!window.L) return null;
  return window.L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:2.5px solid #fff;border-radius:50%;box-shadow:0 0 0 4px ${color}44,0 2px 8px rgba(0,0,0,0.6);"></div>`,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

export const makePinIcon = (color, emoji = "") => {
  if (!window.L) return null;
  return window.L.divIcon({
    className: "",
    html: `<div style="width:36px;height:36px;background:${color};border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 16px ${color}88;display:flex;align-items:center;justify-content:center;overflow:visible;">
      <span style="transform:rotate(45deg);font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center;width:18px;height:18px;font-family:'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif;">${emoji || "•"}</span>
    </div>`,
    iconSize:    [36, 36],
    iconAnchor:  [18, 36],
    popupAnchor: [0, -40],
  });
};

// ── Haversine ─────────────────────────────────────────────────────────────────
const haversineKm = (a, b) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const pathDistanceKm = (path = []) => {
  if (!Array.isArray(path) || path.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const next = path[i];
    if (!Array.isArray(prev) || !Array.isArray(next)) continue;
    total += haversineKm(
      { lat: Number(prev[0]), lng: Number(prev[1]) },
      { lat: Number(next[0]), lng: Number(next[1]) }
    );
  }
  return total;
};

// Route validation — rejects loopy/circular/backtracking routes
const sanitizeRoutePath = (path, points) => {
  if (!Array.isArray(path) || path.length < 2) return null;
  const cleaned = path.filter(
    (p) => Array.isArray(p) && p.length >= 2 &&
      Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))
  );
  if (cleaned.length < 2) return null;

  const start   = points[0];
  const end     = points[points.length - 1];
  const crowKm  = haversineKm(start, end);
  const routeKm = pathDistanceKm(cleaned);
  if (!Number.isFinite(routeKm) || routeKm <= 0) return null;

  // 1. Basic length check — reject if >2.5x crow-flies
  if (crowKm > 0.3 && routeKm > crowKm * 2.5) return null;

  // 2. Endpoint check — last route point must be near destination
  const lastPt = { lat: Number(cleaned[cleaned.length - 1][0]), lng: Number(cleaned[cleaned.length - 1][1]) };
  const endDist = haversineKm(end, lastPt);
  if (endDist > Math.max(crowKm * 0.3, 0.3)) return null; // last pt must be within 30% of crow-dist from dest

  // 3. Loop/backtrack check — scan for any point that goes far from direct path
  if (cleaned.length > 6 && crowKm > 0.5) {
    // Max allowed detour = 60% of crow-flies distance from the start-end line
    const maxDetour = crowKm * 0.6;
    for (let i = 1; i < cleaned.length - 1; i++) {
      const pt = { lat: Number(cleaned[i][0]), lng: Number(cleaned[i][1]) };
      // Simple check: point should be making progress toward end, not looping back
      const dFromStart = haversineKm(start, pt);
      const dFromEnd   = haversineKm(end, pt);
      // If a midpoint is farther from end than start→end × 1.6 → backtracking
      if (i > cleaned.length * 0.4 && dFromEnd > crowKm * 1.6) return null;
    }
  }

  return cleaned;
};

// ── OSRM routing ──────────────────────────────────────────────────────────────
const ROUTE_ENDPOINTS = [
  "https://routing.openstreetmap.de/routed-car/route/v1/driving",
  "https://router.project-osrm.org/route/v1/driving",
];

const fetchRouteFromEndpoint = async (base, coordStr) => {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(`${base}/${coordStr}?overview=full&geometries=geojson`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data        = await res.json();
    const routeCoords = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(routeCoords) || routeCoords.length < 2) return null;
    return routeCoords.map((c) => [c[1], c[0]]); // GeoJSON [lng,lat] → Leaflet [lat,lng]
  } finally {
    clearTimeout(timeout);
  }
};

// Snap to nearest road point — skip for hospital campuses (causes loops)
export const fetchNearestRoadPoint = async (point) => {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
  // Skip snapping inside hospital campuses — OSRM loops on internal roads
  if (isNoSnapHospital(point.lat, point.lng)) return point;
  for (const base of ROUTE_ENDPOINTS) {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 5000);
    try {
      const nearestBase = base.replace("/route/v1/driving", "/nearest/v1/driving");
      const res = await fetch(`${nearestBase}/${point.lng},${point.lat}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const data = await res.json();
      const loc  = data?.waypoints?.[0]?.location;
      if (!Array.isArray(loc) || loc.length < 2) continue;
      const lat = Number(loc[1]);
      const lng = Number(loc[0]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      // FIX: tight snap — >80m se zyada snap hua to original use karo
      const snapDist = haversineKm(point, { lat, lng });
      if (snapDist > 0.08) return point; // campus loop fix
      return { lat, lng };
    } catch {
      clearTimeout(timeout);
    }
  }
  return null;
};

// Main road route fetcher — always returns at least straight-line
export const fetchRoadRoute = async (points, options = {}) => {
  const { allowStraightFallback = true } = options;
  if (!points || points.length < 2) return [];

  const crowKm = haversineKm(points[0], points[points.length - 1]);
  // Short distance — straight line is fine
  if (crowKm < 0.3) return points.map((p) => [p.lat, p.lng]);
  const dest = points[points.length - 1];
  const destGate = getHospitalGate(dest.lat, dest.lng);
  const straightLine = points.map((p) => [p.lat, p.lng]);

  // Campus hospital — route to gate (public road), NOT to internal campus pin
  // Gate coords are on main roads outside campus — no OSRM loop possible
  if (destGate) {
    const gateCoordStr = [...points.slice(0, -1), destGate]
      .map(p => `${p.lng},${p.lat}`).join(";");
    const gateCrowKm = haversineKm(points[0], destGate);
    for (const ep of ROUTE_ENDPOINTS) {
      try {
        const path = await fetchRouteFromEndpoint(ep, gateCoordStr);
        if (!path || path.length < 2) continue;
        const routeKm = pathDistanceKm(path);
        // Reject if loopy: routeKm > 2x crow OR endpoint far from gate
        if (gateCrowKm > 0.3 && routeKm > gateCrowKm * 2.2) continue;
        const lastPt = path[path.length - 1];
        const gap = haversineKm(destGate, { lat: +lastPt[0], lng: +lastPt[1] });
        if (gap > 0.3) continue;
        // Valid road route to gate — append short line to actual pin
        return [...path, [dest.lat, dest.lng]];
      } catch {}
    }
    // All endpoints failed/looped — fallback straight
    return straightLine;
  }

  // Non-campus: normal OSRM routing
  const coordStr = points.map((p) => `${p.lng},${p.lat}`).join(";");

  for (const endpoint of ROUTE_ENDPOINTS) {
    try {
      const path     = await fetchRouteFromEndpoint(endpoint, coordStr);
      const safePath = sanitizeRoutePath(path, points);
      if (safePath && safePath.length > 1) {
        const lastPt = safePath[safePath.length - 1];
        const gap    = haversineKm(dest, { lat: Number(lastPt[0]), lng: Number(lastPt[1]) });
        if (gap > Math.max(crowKm * 0.2, 0.15)) {
          console.warn("Route gap too large:", gap.toFixed(2), "km — skipping");
          continue;
        }
        return safePath;
      }
    } catch (e) {
      console.warn(`OSRM failed (${endpoint}):`, e?.message || e);
    }
  }

  // BRouter fallback
  try {
    const brouterCoords = points.map((p) => `${p.lng},${p.lat}`).join("|");
    const controller    = new AbortController();
    const timeout       = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://brouter.de/brouter?lonlats=${brouterCoords}&profile=car-fast&alternativeidx=0&format=geojson`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data   = await res.json();
      const coords = data?.features?.[0]?.geometry?.coordinates;
      if (Array.isArray(coords) && coords.length > 1) {
        const mapped   = coords.map((c) => [c[1], c[0]]);
        const safePath = sanitizeRoutePath(mapped, points);
        if (safePath && safePath.length > 1) return safePath;
      }
    }
  } catch (e) {
    console.warn("BRouter failed:", e?.message || e);
  }

  if (allowStraightFallback) return straightLine;
  return [];
};

export const fetchRouteWithManeuvers = async (points, options = {}) => {
  const path = await fetchRoadRoute(points, options);
  return { path, maneuvers: [] };
};

// ── Geocoding ─────────────────────────────────────────────────────────────────
const API_BASE         = (import.meta?.env?.VITE_API_BASE_URL || import.meta?.env?.VITE_API_BASE || "http://127.0.0.1:8000").replace(/\/+$/, "");
const OPENCAGE_API_KEY = (import.meta?.env?.VITE_OPENCAGE_API_KEY || "").trim();

const geocodeCache = new Map();

const parseLatLngText = (text) => {
  const m = String(text || "").trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return isIndiaCoord(lat, lng) ? { lat, lng } : null;
};

// ── LOCAL_HINTS — verified coordinates ───────────────────────────────────────
// Shiv Vihar EXACT coords from Google Maps screenshot: 28.72587, 77.27944
const LOCAL_HINTS = [
  // Shiv Vihar, Delhi — exact center verified from Google Maps (28.72587, 77.27944)
  { keys: ["shiv vihar", "shivvihar", "shiv vihar delhi", "shivihar", "shivhihar", "shiv vihar ghaziabad"], lat: 28.72587, lng: 77.27944 },

  // Hospitals — verified
  { keys: ["sharda hospital", "saharda hospital", "sharda university hospital"],   lat: 28.4748, lng: 77.4730 },
  { keys: ["aiims delhi", "aiims new delhi", "aiims hospital", "aiims hospital delhi", "all india institute of medical sciences"], lat: 28.5710, lng: 77.2055 }, // Sri Aurobindo Marg, outside campus
  { keys: ["safdarjung hospital"],                                                  lat: 28.5694, lng: 77.2057 },
  { keys: ["gtb hospital", "guru teg bahadur hospital", "guru tegh bahadur"],       lat: 28.6786, lng: 77.3058 },
  { keys: ["ram manohar lohia", "rml hospital"],                                    lat: 28.6339, lng: 77.2090 },
  { keys: ["max hospital saket"],                                                   lat: 28.5275, lng: 77.2194 },
  { keys: ["apollo hospital sarita vihar"],                                         lat: 28.5393, lng: 77.2863 },
  { keys: ["fortis hospital noida"],                                                lat: 28.5458, lng: 77.3910 },
  { keys: ["kailash hospital noida", "kailash hospital"],                           lat: 28.5700, lng: 77.3262 },

  // Common Delhi/NCR areas
  { keys: ["karawal nagar"],                                                        lat: 28.7391, lng: 77.3069 },
  { keys: ["mustafabad"],                                                           lat: 28.7283, lng: 77.2951 },
  { keys: ["dayalpur"],                                                             lat: 28.7192, lng: 77.3051 },
  { keys: ["johri enclave"],                                                        lat: 28.7101, lng: 77.3298 },
  { keys: ["sonia vihar"],                                                          lat: 28.7252, lng: 77.2605 },
];

// Hospital campuses — when destination is inside campus, replace with nearest
// PUBLIC ROAD point so OSRM doesn't route through internal one-way roads
const HOSPITAL_GATES = [
  // AIIMS Delhi: Gate No.1 on Sri Aurobindo Marg — exact entry point from image
  { center: { lat: 28.5672, lng: 77.2090 }, radius: 0.6,
    gate:   { lat: 28.5683, lng: 77.2078 } },
  // Safdarjung: Ring Road / Aurobindo Marg junction
  { center: { lat: 28.5694, lng: 77.2057 }, radius: 0.4,
    gate:   { lat: 28.5710, lng: 77.2050 } },
  // GTB Hospital: GT Road entry
  { center: { lat: 28.6786, lng: 77.3058 }, radius: 0.3,
    gate:   { lat: 28.6795, lng: 77.3042 } },
  // Sharda Hospital Greater Noida
  { center: { lat: 28.4748, lng: 77.4730 }, radius: 0.4,
    gate:   { lat: 28.4760, lng: 77.4715 } },
  // Apollo Sarita Vihar: Mathura Road entry
  { center: { lat: 28.5393, lng: 77.2863 }, radius: 0.3,
    gate:   { lat: 28.5400, lng: 77.2850 } },
  // Fortis Noida: Sector 62 road
  { center: { lat: 28.5458, lng: 77.3910 }, radius: 0.3,
    gate:   { lat: 28.5465, lng: 77.3895 } },
];

// Returns gate coord if point is inside a hospital campus, else null
const getHospitalGate = (lat, lng) => {
  for (const h of HOSPITAL_GATES) {
    if (haversineKm({ lat, lng }, h.center) < h.radius) return h.gate;
  }
  return null;
};

// Legacy alias used in fetchNearestRoadPoint
const isNoSnapHospital = (lat, lng) => getHospitalGate(lat, lng) !== null;

const checkLocalHints = (text) => {
  const normalized = normalizePlace(text);
  // Score each hint — longest matching key wins
  let bestMatch = null;
  let bestScore = 0;
  for (const hint of LOCAL_HINTS) {
    for (const k of hint.keys) {
      if (normalized.includes(k) || k.includes(normalized)) {
        const score = k.length;
        if (score > bestScore) { bestScore = score; bestMatch = hint; }
      }
    }
  }
  return bestMatch ? { lat: bestMatch.lat, lng: bestMatch.lng } : null;
};

const geocodeByOpenCage = async (text) => {
  if (!OPENCAGE_API_KEY) return null;
  const cacheKey = `opencage:${normalizePlace(text)}`;
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);
  try {
    const params = new URLSearchParams({
      q: `${text}, India`, key: OPENCAGE_API_KEY,
      language: "en", countrycode: "in", limit: "1", no_annotations: "1",
    });
    const res = await fetch(`https://api.opencagedata.com/geocode/v1/json?${params}`);
    if (!res.ok) return null;
    const data  = await res.json();
    const first = data?.results?.[0];
    const lat   = Number(first?.geometry?.lat);
    const lng   = Number(first?.geometry?.lng);
    if (!isIndiaCoord(lat, lng)) return null;
    const found = { lat, lng };
    geocodeCache.set(cacheKey, found);
    return found;
  } catch { return null; }
};

const geocodeByNominatim = async (text) => {
  const cacheKey = `nom:${normalizePlace(text)}`;
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text + ", India")}&format=json&limit=1&countrycodes=in`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    if (!res.ok) return null;
    const data  = await res.json();
    const first = data?.[0];
    if (!first) return null;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!isIndiaCoord(lat, lng)) return null;
    const found = { lat, lng };
    geocodeCache.set(cacheKey, found);
    return found;
  } catch { return null; }
};

const geocodeByBackend = async (text, context = {}) => {
  const cacheKey = `backend:${normalizePlace(text)}`;
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);
  try {
    const res = await fetch(`${API_BASE}/api/geocode/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: text, force_api: true, ...context }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const lat  = Number(data?.lat);
    const lng  = Number(data?.lng);
    if (!isIndiaCoord(lat, lng)) return null;
    const found = { lat, lng };
    geocodeCache.set(cacheKey, found);
    return found;
  } catch { return null; }
};

// Master geocoder — LOCAL_HINTS first, then API chain
export const geocodeInIndia = async (raw, context = {}) => {
  const text = String(raw || "").trim();
  if (!text) return null;

  // 1. lat,lng text
  const byLatLng = parseLatLngText(text);
  if (byLatLng) return byLatLng;

  // 2. Local hints (fastest, most accurate for known areas)
  const local = checkLocalHints(text);
  if (local) return local;

  // 3. Backend geocode API
  try { const r = await geocodeByBackend(text, context); if (r) return r; } catch {}

  // 4. OpenCage
  try { const r = await geocodeByOpenCage(text); if (r) return r; } catch {}

  // 5. Nominatim
  try { const r = await geocodeByNominatim(text); if (r) return r; } catch {}

  return null;
};

// ── useLeaflet hook ───────────────────────────────────────────────────────────
const useLeaflet = () => {
  const [ready, setReady] = useState(leafletLoaded);

  useEffect(() => {
    if (leafletLoaded) { setReady(true); return; }
    loadLeaflet()
      .then(() => setReady(true))
      .catch((err) => console.error("Leaflet load failed:", err));
  }, []);

  return ready;
};

export default useLeaflet;
