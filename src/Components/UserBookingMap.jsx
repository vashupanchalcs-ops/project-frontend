/**
 * UserBookingMap.jsx — src/Components/UserBookingMap.jsx
 *
 * KEY FIXES:
 * 1. PICKUP COORD — the saved booking coordinate is immutable and drives the
 *    marker, backend route origin, and every displayed route.
 * 2. ROUTE POLYLINE — both legs use a road-routing provider; failures show an
 *    error state rather than a misleading straight line.
 * 4. LEG STATS — calculated from actual route path length, not crow-flies
 * 5. MAP BOUNDS — auto-fits to show all 3 markers + both route lines
 */

import { useCallback, useEffect, useRef, useState } from "react";
import useLeaflet, {
  DELHI,
  makePinIcon,
  fetchRoadRoute,
} from "../hooks/useLeaflet";

const BASE = "http://127.0.0.1:8000";
const GOOGLE_TILE = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
const OPENCAGE_API_KEY = (import.meta?.env?.VITE_OPENCAGE_API_KEY || "").trim();

// ── Helpers ───────────────────────────────────────────────────────────────────
const normalizeHosp = (v = "") =>
  String(v)
    .toLowerCase()
    .replace(/saharda/gi, "sharda")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const inIndia = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;

const HOSPITAL_LOCATION_FALLBACKS = [
  { terms: ["sharda", "saharda"], lat: 28.4744, lng: 77.5030 },
  { terms: ["noida"], lat: 28.5355, lng: 77.3910 },
  { terms: ["ghaziabad", "loni"], lat: 28.6692, lng: 77.4538 },
  { terms: ["delhi", "new delhi"], lat: 28.6139, lng: 77.2090 },
];

const fallbackHospitalLatLng = (name, cityHint) => {
  const normalized = normalizeHosp(`${name || ""} ${cityHint || ""}`);
  return HOSPITAL_LOCATION_FALLBACKS.find(({ terms }) => terms.some((term) => normalized.includes(term)))
    || { lat: DELHI.lat, lng: DELHI.lng };
};

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

// Path distance from Leaflet [lat,lng] array
const pathKm = (path = []) => {
  if (!Array.isArray(path) || path.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (!Array.isArray(a) || !Array.isArray(b)) continue;
    total += haversineKm(
      { lat: Number(a[0]), lng: Number(a[1]) },
      { lat: Number(b[0]), lng: Number(b[1]) }
    );
  }
  return total;
};

// ETA: assume 28 km/h average for ambulance in city traffic
const approxMins = (km) => Math.max(1, Math.round((km / 28) * 60));
const fmtSecs    = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// Ambulance SVG badge marker
const makeAmbulanceBadgeIcon = (L) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:42px;height:42px;border-radius:50%;
      background:#ffffff;border:3px solid #fff;
      box-shadow:0 0 0 6px rgba(255, 255, 255, 0.15),0 8px 18px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 13.5V8.8C3 7.81 3.81 7 4.8 7H12.3C12.78 7 13.23 7.19 13.57 7.53L15.1 9.06H17.54C18.29 9.06 18.96 9.53 19.22 10.23L20.44 13.5H21V16H19.88C19.61 17.15 18.58 18 17.35 18C16.12 18 15.09 17.15 14.82 16H9.18C8.91 17.15 7.88 18 6.65 18C5.42 18 4.39 17.15 4.12 16H3V13.5Z" fill="white"/>
        <rect x="5.2" y="9" width="5.2" height="3.5" rx="0.6" fill="#ffffff"/>
        <rect x="12.2" y="9.4" width="2.8" height="2.2" rx="0.4" fill="#ffffff"/>
        <circle cx="6.65" cy="16" r="1.4" fill="#111"/>
        <circle cx="17.35" cy="16" r="1.4" fill="#111"/>
      </svg>
    </div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });

// ── Geocoding helpers ─────────────────────────────────────────────────────────
async function nominatimGeocode(queries) {
  for (const q of queries) {
    if (!q) continue;
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=in`;
      const res  = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data = await res.json();
      if (data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (inIndia(lat, lng)) return { lat, lng };
      }
    } catch {}
  }
  return null;
}

async function openCageGeocode(queries) {
  if (!OPENCAGE_API_KEY) return null;
  for (const q of queries) {
    if (!q) continue;
    try {
      const params = new URLSearchParams({
        q, key: OPENCAGE_API_KEY,
        language: "en", countrycode: "in",
        limit: "1", no_annotations: "1",
      });
      const res  = await fetch(`https://api.opencagedata.com/geocode/v1/json?${params}`);
      if (!res.ok) continue;
      const data = await res.json();
      const first = data?.results?.[0];
      const lat = Number(first?.geometry?.lat);
      const lng = Number(first?.geometry?.lng);
      if (inIndia(lat, lng)) return { lat, lng };
    } catch {}
  }
  return null;
}

// ── Hospital coordinate resolution ───────────────────────────────────────────
async function resolveHospitalLatLng(hospName, hospitalsArr, cityHint = "", assignedHospitalId = null) {
  if (!hospName) return null;
  const key = normalizeHosp(hospName);

  // 1) Try backend hospital list by ID first, then name-match
  if (hospitalsArr?.length) {
    const byId = assignedHospitalId
      ? hospitalsArr.find((h) => Number(h.id) === Number(assignedHospitalId))
      : null;
    if (byId) {
      const lat = parseFloat(byId.latitude);
      const lng = parseFloat(byId.longitude);
      if (inIndia(lat, lng)) return { lat, lng };
    }

    let bestMatch = null, bestScore = 0;
    for (const h of hospitalsArr) {
      const hKey = normalizeHosp(h.name || "");
      if (!hKey) continue;
      let score = 0;
      if (hKey === key) score = 100;
      else if (hKey.includes(key) || key.includes(hKey))
        score = Math.min(hKey.length, key.length);
      if (score > bestScore) { bestScore = score; bestMatch = h; }
    }
    if (bestMatch && bestScore > 0) {
      const lat = parseFloat(bestMatch.latitude);
      const lng = parseFloat(bestMatch.longitude);
      if (inIndia(lat, lng)) return { lat, lng };
    }
  }

  // 2) External geocoding fallbacks
  const searchName = key.includes("sharda") ? "Sharda Hospital" : hospName;
  const fallbackQueries = [
    cityHint ? `${searchName} hospital ${cityHint}, India` : null,
    cityHint ? `${searchName} ${cityHint}, India`          : null,
    `${searchName} Delhi NCR, India`,
    `${searchName}, India`,
  ].filter(Boolean);

  return (
    (await openCageGeocode(fallbackQueries)) ||
    (await nominatimGeocode(fallbackQueries)) ||
    fallbackHospitalLatLng(hospName, cityHint)
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function UserBookingMap({ booking, onClose, embedded = false }) {
  const leafletReady = useLeaflet();

  const mapDivRef           = useRef(null);
  const mapRef              = useRef(null);
  const ambMarkerRef        = useRef(null);
  const pickupMarkerRef     = useRef(null);
  const hospMarkerRef       = useRef(null);
  const routeLine1Ref       = useRef(null); // Ambulance to pickup (green)
  const routeLine2Ref       = useRef(null); // Pickup to hospital (yellow)
  const pollRef             = useRef(null);
  const lastAmbOriginRef    = useRef(null);
  const hasFittedRef        = useRef(false); // Auto-fit the map only once.
  const pickupLLRef         = useRef(null);  // pickupLL ka ref — always latest
  const hospLLRef           = useRef(null);  // hospLL ka ref
  const route1FetchingRef   = useRef(false); // OSRM fetch in progress guard

  const [hospitals,       setHospitals]       = useState([]);
  const [hospitalsLoaded, setHospitalsLoaded] = useState(false);
  const [ambLoc,          setAmbLoc]          = useState(null);
  const [pickupLL,        setPickupLL]        = useState(null);
  const [hospLL,          setHospLL]          = useState(null);
  const [legStats,        setLegStats]        = useState({ d1: null, m1: null, d2: null, m2: null });
  const [elapsed,         setElapsed]         = useState(0);
  const [mapReady,        setMapReady]        = useState(false);
  const [routeState, setRouteState] = useState({ leg1: "idle", leg2: "idle", error: "" });
  const [routeRetry, setRouteRetry] = useState(0);

  // ── Elapsed timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Sync state → refs so pollAmbulance always has latest values
  useEffect(() => { pickupLLRef.current = pickupLL; }, [pickupLL]);
  useEffect(() => { hospLLRef.current   = hospLL;   }, [hospLL]);

  // ── Load hospitals ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${BASE}/api/hospitals/`)
      .then((r) => r.json())
      .then((data) => { setHospitals(Array.isArray(data) ? data : []); setHospitalsLoaded(true); })
      .catch(() => setHospitalsLoaded(true));
  }, []);

  // ── Init Leaflet map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletReady || !mapDivRef.current || mapRef.current) return;
    const L   = window.L;
    const map = L.map(mapDivRef.current, {
      center:      [DELHI.lat, DELHI.lng],
      zoom:        13,
      zoomControl: false,
    });

    // Google Maps style tiles
    L.tileLayer(GOOGLE_TILE, {
      maxZoom:     19,
      attribution: "© Google Maps",
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;
    setMapReady(true);

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [leafletReady]);

  // ── Resolve pickup + hospital from booking fields ───────────────────────────
  useEffect(() => {
    if (!booking || !hospitalsLoaded) return;

    const hospName       = booking.assigned_hospital_name || booking.destination || "";
    const pickupCity     = booking.pickup_city       || "";
    const pickupDistrict = booking.pickup_district   || "";
    const cityHint       = pickupCity || pickupDistrict || "";

    let cancelled = false;

    (async () => {
      const [, hLL] = await Promise.all([
        Promise.resolve(null),
        resolveHospitalLatLng(
          hospName,
          hospitals,
          cityHint,
          booking.assigned_hospital_id || null
        ),
      ]);

      if (cancelled) return;

      // The booking coordinate is the single source of truth. Old records that
      // do not contain a confirmed point need an address update before routing.
      const directLat = Number(booking?.pickup_latitude);
      const directLng = Number(booking?.pickup_longitude);
      const storedLL  = inIndia(directLat, directLng)
        ? { lat: directLat, lng: directLng }
        : null;

      if (storedLL) {
        setPickupLL(storedLL);
      } else {
        setRouteState((previous) => ({ ...previous, error: "This booking has no confirmed pickup coordinate. Update the pickup address before routing." }));
      }
      if (hLL) setHospLL(hLL);
    })();

    return () => { cancelled = true; };
  }, [booking, hospitals, hospitalsLoaded]);

  // ── fitBounds — sirf PEHLI baar auto-fit, no deps to avoid re-render loop ──
  const fitBounds = useCallback((force = false) => {
    if (!mapRef.current || !window.L) return;
    if (hasFittedRef.current && !force) return;
    const L      = window.L;
    const bounds = L.latLngBounds([]);
    if (routeLine1Ref.current?.getLatLngs?.()?.flat?.()?.length >= 2)
      bounds.extend(routeLine1Ref.current.getBounds());
    if (routeLine2Ref.current?.getLatLngs?.()?.flat?.()?.length >= 2)
      bounds.extend(routeLine2Ref.current.getBounds());
    // Use refs for current values — no state dependency
    const aLoc = ambMarkerRef.current?.getLatLng?.();
    const pLoc = pickupMarkerRef.current?.getLatLng?.();
    const hLoc = hospMarkerRef.current?.getLatLng?.();
    if (aLoc) bounds.extend([aLoc.lat, aLoc.lng]);
    if (pLoc) bounds.extend([pLoc.lat, pLoc.lng]);
    if (hLoc) bounds.extend([hLoc.lat, hLoc.lng]);
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [70, 70], maxZoom: 15 });
      hasFittedRef.current = true;
    }
  }, []); // NO deps — prevents re-render loop

  // ── Draw pickup + hospital markers AND pickup→hospital route ────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.L) return;
    const L   = window.L;
    const map = mapRef.current;

    // Pickup marker
    if (pickupLL) {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setLatLng([pickupLL.lat, pickupLL.lng]);
      } else {
        pickupMarkerRef.current = L.marker([pickupLL.lat, pickupLL.lng], {
          icon: makePinIcon("#f7c948", "📍"),
          zIndexOffset: 3500,
          riseOnHover: true,
        }).addTo(map)
          .bindPopup(`<div style="font-weight:700;font-size:13px">📍 Pickup Location</div>
            <div style="font-size:11px;color:#666;margin-top:4px">${booking?.pickup_location || ""}</div>`);
      }
    }

    // Hospital marker
    if (hospLL) {
      if (hospMarkerRef.current) {
        hospMarkerRef.current.setLatLng([hospLL.lat, hospLL.lng]);
      } else {
        hospMarkerRef.current = L.marker([hospLL.lat, hospLL.lng], {
          icon: makePinIcon("#00d4aa", "🏥"),
          zIndexOffset: 3200,
          riseOnHover: true,
        }).addTo(map)
          .bindPopup(`<div style="font-weight:700;font-size:13px">🏥 ${booking?.assigned_hospital_name || "Hospital"}</div>`);
      }
    }

    // Route 2: Pickup → Hospital. The origin below is the stored booking pin,
    // never a snapped or freshly geocoded replacement.
    if (pickupLL && hospLL && !routeLine2Ref.current) {
      (async () => {
        setRouteState((previous) => ({ ...previous, leg2: "loading", error: "" }));
        try {
          const pts = await fetchRoadRoute([pickupLL, hospLL], { retries: 2 });
          if (!pts || pts.length < 2) throw new Error("No road route returned");
          routeLine2Ref.current = L.polyline(pts, {
            color: "#f59a23", weight: 6, opacity: 0.92,
          }).addTo(map);
          routeLine2Ref.current.bringToFront();
          const d2 = pathKm(pts);
          setLegStats((prev) => ({ ...prev, d2: d2.toFixed(1), m2: approxMins(d2) }));
          setRouteState((previous) => ({ ...previous, leg2: "ready" }));
          fitBounds(true);
        } catch (e) {
          console.warn("Route 2 fetch failed:", e);
          setRouteState((previous) => ({ ...previous, leg2: "error", error: "Hospital route could not be loaded. Retrying is available after the next update." }));
        }
      })();
    }
  }, [mapReady, pickupLL, hospLL, fitBounds, routeRetry]);

  // ── Poll ambulance live location ────────────────────────────────────────────
  const pollAmbulance = useCallback(async () => {
    if (!booking?.ambulance_id) return;
    try {
      const res  = await fetch(`${BASE}/api/ambulances/`);
      const list = await res.json();
      const amb  = list.find((a) => Number(a.id) === Number(booking.ambulance_id));
      if (!amb) return;

      const lat = parseFloat(amb.latitude);
      const lng = parseFloat(amb.longitude);
      if (!inIndia(lat, lng)) return;

      const loc = { lat, lng };
      setAmbLoc(loc);

      if (!mapRef.current || !window.L) return;
      const L   = window.L;
      const map = mapRef.current;

      // Ambulance marker
      if (ambMarkerRef.current) {
        ambMarkerRef.current.setLatLng([lat, lng]);
        ambMarkerRef.current.setZIndexOffset(9000);
        ambMarkerRef.current.setIcon(makeAmbulanceBadgeIcon(L));
        ambMarkerRef.current.bringToFront();
      } else {
        ambMarkerRef.current = L.marker([lat, lng], {
          icon:         makeAmbulanceBadgeIcon(L),
          zIndexOffset: 9000,
          riseOnHover:  true,
        }).addTo(map)
          .bindPopup(`<div style="font-weight:700;font-size:13px">🚑 ${booking?.ambulance_number || "Ambulance"}</div>`);
        ambMarkerRef.current.bringToFront();
      }

      // Route 1: Ambulance → Pickup. The pickup request coordinate is always
      // the immutable booking pin, never a refreshed GPS or snapped point.
      const pLL = pickupLLRef.current;

      if (pLL) {
        const movedEnough = !lastAmbOriginRef.current || haversineKm(lastAmbOriginRef.current, loc) > 0.2;
        if (movedEnough && !route1FetchingRef.current) {
          route1FetchingRef.current = true;
          lastAmbOriginRef.current = { ...loc };
          setRouteState((previous) => ({ ...previous, leg1: "loading", error: "" }));
          ;(async () => {
            try {
              const pts = await fetchRoadRoute([loc, pLL], { retries: 2 });
              if (!pts || pts.length < 2) throw new Error("No road route returned");
              if (routeLine1Ref.current) routeLine1Ref.current.setLatLngs(pts);
              else routeLine1Ref.current = L.polyline(pts, { color: "#126f1e", weight: 6, opacity: 0.95 }).addTo(map);
              routeLine1Ref.current.bringToFront();
              const d1 = pathKm(pts);
              setLegStats((previous) => ({ ...previous, d1: d1.toFixed(1), m1: approxMins(d1) }));
              setRouteState((previous) => ({ ...previous, leg1: "ready" }));
              fitBounds(true);
            } catch (error) {
              console.warn("Route 1 fetch failed:", error);
              // Make the next polling cycle a deliberate retry even when the
              // ambulance has not moved far enough to normally recalculate.
              lastAmbOriginRef.current = null;
              setRouteState((previous) => ({ ...previous, leg1: "error", error: "Ambulance road route could not be loaded. Waiting to retry." }));
            } finally {
              route1FetchingRef.current = false;
            }
          })();
        }
      }
    } catch (e) {
      console.warn("Ambulance poll failed:", e);
    }
  }, [booking, fitBounds]); // pickupLL/hospLL removed — using refs now

  useEffect(() => {
    if (!mapReady) return;
    pollAmbulance();
    pollRef.current = setInterval(pollAmbulance, 8000);
    return () => clearInterval(pollRef.current);
  }, [mapReady, pollAmbulance]);

  // ── Styles ──────────────────────────────────────────────────────────────────
  const rootStyle = embedded
    ? { position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "#f7f7f2" }
    : {
        position: "fixed", inset: 0, zIndex: 9000,
        display: "flex", flexDirection: "column",
        background: "#f7f7f2",
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      };

  const hospName = booking?.assigned_hospital_name || booking?.destination || "Hospital pending";

  return (
    <div style={rootStyle}>

      {/* ── Top Stats Bar ──────────────────────────────────────────────────── */}
      <div style={{
        background: "#fffef6",
        borderBottom: "1px solid rgba(20,20,20,0.12)",
        padding: "10px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, gap: 12, flexWrap: "wrap", zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>

          {/* Leg 1: Ambulance → Pickup */}
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#126f1e", fontWeight: 900, fontSize: 20, lineHeight: 1 }}>
              {legStats.d1 != null ? `${legStats.d1} km · ~${legStats.m1} min` : "Locating…"}
            </div>
            <div style={{ fontSize: 10, color: "rgba(17,17,17,0.5)", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>
              Ambulance → Pickup
            </div>
          </div>

          <div style={{ width: 1, height: 36, background: "rgba(17,17,17,0.1)" }} />

          {/* Leg 2: Pickup → Hospital */}
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#f59a23", fontWeight: 900, fontSize: 20, lineHeight: 1 }}>
              {legStats.d2 != null
                ? `${legStats.d2} km · ~${legStats.m2} min`
                : hospLL ? "Calculating…" : "Locating hospital…"}
            </div>
            <div style={{ fontSize: 10, color: "rgba(17,17,17,0.5)", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>
              Pickup → Hospital
            </div>
          </div>

          <div style={{ width: 1, height: 36, background: "rgba(17,17,17,0.1)" }} />

          {/* Elapsed */}
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#111", fontWeight: 900, fontSize: 20, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {fmtSecs(elapsed)}
            </div>
            <div style={{ fontSize: 10, color: "rgba(17,17,17,0.5)", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>
              Elapsed
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{
            background: "#fff3df", border: "1px solid #f59a23",
            borderRadius: 10, padding: "5px 10px", fontSize: 11, fontWeight: 700,
            maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            🏥 {hospName}
          </div>
          {onClose && (
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "#111", color: "#fff", border: "none",
              fontSize: 16, cursor: "pointer", fontWeight: 900,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>×</button>
          )}
        </div>
      </div>

      {/* ── Info Bar ───────────────────────────────────────────────────────── */}
      <div style={{
        background: "#f7f7f0", borderBottom: "1px solid rgba(20,20,20,0.08)",
        padding: "6px 20px", display: "flex", alignItems: "center", gap: 16,
        flexShrink: 0, fontSize: 11, flexWrap: "wrap",
      }}>
        <span style={{ color: "#111", fontWeight: 700 }}>🚑 Booking #{booking?.id}</span>
        <span style={{ color: "rgba(17,17,17,0.6)" }}>·</span>
        <span style={{ color: "rgba(17,17,17,0.7)" }}>📍 {booking?.pickup_location || "—"}</span>
        <span style={{ color: "rgba(17,17,17,0.6)" }}>·</span>
        <span style={{ color: "rgba(17,17,17,0.7)" }}>{booking?.ambulance_number || "AMB-0000"}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span style={{ width: 10, height: 4, borderRadius: 2, background: "#126f1e", display: "inline-block" }} />
            <span style={{ fontSize: 10, color: "rgba(17,17,17,0.65)" }}>Amb → Pickup</span>
          </span>
          <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span style={{ width: 10, height: 4, borderRadius: 2, background: "#f59a23", display: "inline-block" }} />
            <span style={{ fontSize: 10, color: "rgba(17,17,17,0.65)" }}>Pickup → Hospital</span>
          </span>
        </div>
      </div>

      {routeState.error && (
        <div role="status" style={{ padding: "8px 20px", fontSize: 12, fontWeight: 700, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span>Route update: {routeState.error}</span>
          <button
            type="button"
            onClick={() => {
              lastAmbOriginRef.current = null;
              setRouteRetry((value) => value + 1);
              void pollAmbulance();
            }}
          >
            Retry route
          </button>
        </div>
      )}

      {/* ── Map ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <div ref={mapDivRef} style={{ position: "absolute", inset: 0 }} />

        {/* Loading overlay */}
        {!leafletReady && (
          <div style={{
            position: "absolute", inset: 0, background: "#f7f7f2",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 10,
          }}>
            <div style={{
              width: 36, height: 36,
              border: "3px solid rgba(17,17,17,0.1)",
              borderTop: "3px solid #f59a23",
              borderRadius: "50%",
              animation: "ubm-spin 0.8s linear infinite",
            }} />
            <p style={{ color: "rgba(17,17,17,0.5)", fontSize: 13 }}>Loading map…</p>
          </div>
        )}

        {/* Hospital locating toast */}
        {leafletReady && !hospLL && hospitalsLoaded && (
          <div style={{
            position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
            background: "rgba(255,255,255,0.96)", border: "1px solid rgba(17,17,17,0.1)",
            borderRadius: 10, padding: "6px 14px", fontSize: 11, fontWeight: 600,
            color: "rgba(17,17,17,0.65)", zIndex: 999, whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}>
            🔍 Locating hospital…
          </div>
        )}

      </div>

      <style>{`
        @keyframes ubm-spin { to { transform: rotate(360deg); } }
        .leaflet-control-zoom a {
          background: #fffef6 !important; color: #111 !important;
          border-color: rgba(17,17,17,0.15) !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 10px !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important;
          font-family: 'Helvetica Neue', sans-serif !important;
        }
        .leaflet-routing-container { display: none !important; }
      `}</style>
    </div>
  );
}
