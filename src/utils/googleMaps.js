export const DELHI = { lat: 28.6139, lng: 77.209 };

const GOOGLE_MAPS_KEY = String(import.meta?.env?.VITE_GOOGLE_MAPS_API_KEY || "").trim();
const GOOGLE_MAPS_LIBRARIES = "places,geometry,marker";
const GOOGLE_MAPS_SCRIPT_ID = "swiftrescue-google-maps";

export const hasConfiguredGoogleMapsKey = () =>
  Boolean(GOOGLE_MAPS_KEY) &&
  !GOOGLE_MAPS_KEY.includes("%VITE_") &&
  !GOOGLE_MAPS_KEY.toLowerCase().includes("your_google_maps");

export const loadGoogleMapsScript = () => {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.google?.maps) return Promise.resolve(true);
  if (!hasConfiguredGoogleMapsKey()) return Promise.resolve(false);

  const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
  if (existing) {
    return new Promise((resolve) => {
      const started = Date.now();
      const timer = window.setInterval(() => {
        if (window.google?.maps) {
          window.clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - started > 10000) {
          window.clearInterval(timer);
          resolve(false);
        }
      }, 100);
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      GOOGLE_MAPS_KEY
    )}&libraries=${GOOGLE_MAPS_LIBRARIES}&loading=async`;
    script.onload = () => resolve(Boolean(window.google?.maps));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
};

export const isIndiaCoord = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= 6 &&
  lat <= 38 &&
  lng >= 68 &&
  lng <= 98;

export const normalizePlace = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/saharda/g, "sharda")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const ensureGoogleMaps = async (timeoutMs = 7000) => {
  if (!(window.google && window.google.maps)) {
    await loadGoogleMapsScript();
  }
  const started = Date.now();
  while (!(window.google && window.google.maps)) {
    if (Date.now() - started > timeoutMs) return false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return true;
};

const GEO_HINTS = [
  { keys: ["sharda hospital"], lat: 28.4748, lng: 77.484 },
  { keys: ["saharda hospital"], lat: 28.4748, lng: 77.484 },
  { keys: ["aiims", "gate", "1"], lat: 28.56695, lng: 77.20883 },
  { keys: ["aiims"], lat: 28.56695, lng: 77.20883 },
  { keys: ["shiv vihar"], lat: 28.72604, lng: 77.28324 },
  { keys: ["shivhihar"], lat: 28.72604, lng: 77.28324 },
  { keys: ["banthala", "loni"], lat: 28.742, lng: 77.304 },
  { keys: ["loni", "ghaziabad"], lat: 28.751, lng: 77.289 },
  { keys: ["ghaziabad"], lat: 28.669, lng: 77.453 },
  { keys: ["greater noida"], lat: 28.474, lng: 77.504 },
  { keys: ["noida"], lat: 28.535, lng: 77.391 },
  { keys: ["delhi"], lat: 28.6139, lng: 77.209 },
];

const hintGeocode = (query) => {
  const text = normalizePlace(query);
  if (!text) return null;
  const row = GEO_HINTS.find((h) => h.keys.every((k) => text.includes(k)));
  return row ? { lat: row.lat, lng: row.lng } : null;
};

export const geocodeInIndia = async (query) => {
  const q = String(query || "").trim();
  if (!q) return null;
  // Primary safe path (no Geocoding API dependency): deterministic local hints.
  const hinted = hintGeocode(q);
  if (hinted) return hinted;

  // Optional path: only run Geocoder when explicitly enabled.
  // This prevents repeated "Geocoding Service API is not activated" console errors.
  if (!window.__SWIFTRESCUE_ENABLE_GOOGLE_GEOCODER__) return null;

  const ok = await ensureGoogleMaps();
  if (!ok || !window.google?.maps?.Geocoder) return null;

  try {
    const geocoder = new window.google.maps.Geocoder();
    const result = await new Promise((resolve) =>
      geocoder.geocode({ address: q, region: "IN" }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng() });
        } else {
          resolve(null);
        }
      })
    );
    return result && isIndiaCoord(result.lat, result.lng) ? result : null;
  } catch {
    return null;
  }
};

export const haversineKm = (a, b) => {
  if (!a || !b) return 0;
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
